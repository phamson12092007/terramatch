import tempfile
import unittest
from dataclasses import replace
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import patch

from app.schemas.earth import EarthFeature, EarthLocationRecord, FeatureProvenance
from app.services.earth_data import EarthDataRepository
from app.services.feature_registry import FEATURE_REGISTRY, get_feature, resolve_comparison_criterion
from app.services.similarity import evaluate_real_earth_analogs, find_real_earth_analogs, find_simulated_earth_analogs


UNITS = {"elevation_m": "m", "slope_deg": "°", "land_surface_temperature_day_k_mean": "K"}


def provenance(code):
    return FeatureProvenance(
        source_organization="Test NASA source", dataset_name="Test dataset", parameter_code=code,
        source_url="https://example.test/source", acquisition_start=date(2024, 1, 1),
        acquisition_end=date(2024, 1, 2), temporal_resolution="Daily",
        original_unit=UNITS.get(code, "m"), processed_unit=UNITS.get(code, "m"),
        processing_method="Test", retrieved_at=datetime.now(timezone.utc),
    )


def feature(key, value, status="REAL", unit=None):
    return EarthFeature(key=key, label=key, value=value, unit=unit or UNITS.get(key, "m"), data_status=status, provenance=provenance(key))


def record(location_id, features, status="REAL"):
    return EarthLocationRecord(
        location_id=location_id, name=location_id.title(), latitude=1, longitude=1,
        data_status=status, raw_response_path="", retrieved_at=datetime.now(timezone.utc), features=features,
    )


class SimilarityDataSourceTests(unittest.TestCase):
    target = {"elevation_m": 100.0, "slope_deg": 5.0, "surface_temp_k": 280.0}
    weights = {"elevation_m": 0.4, "slope_deg": 0.35, "surface_temp_k": 0.25}

    def enabled_features(self, *keys):
        return patch.dict(FEATURE_REGISTRY, {
            key: replace(get_feature(key), similarity_supported=True, data_availability="AVAILABLE", unavailable_reason=None)
            for key in keys
        })

    def repository_with(self, *records):
        temp_dir = tempfile.TemporaryDirectory()
        repository = EarthDataRepository(Path(temp_dir.name))
        for item in records:
            repository.save(item, {"test": item.location_id})
        return temp_dir, repository

    def test_registry_driven_mapping_and_compatible_scoring(self):
        self.assertEqual(resolve_comparison_criterion("surface_temp_k").key, "land_surface_temperature_day_k_mean")
        complete = record("complete-real", [feature("elevation_m", 100), feature("slope_deg", 5), feature("land_surface_temperature_day_k_mean", 280)])
        temp_dir, repository = self.repository_with(complete)
        with temp_dir, self.enabled_features("elevation_m", "slope_deg", "land_surface_temperature_day_k_mean"):
            evaluation = evaluate_real_earth_analogs(self.target, self.weights, repository=repository)
        self.assertEqual(evaluation.scored_candidate_count, 1)
        result = evaluation.results[0]
        self.assertEqual(result["similarity_score"], 100.0)
        self.assertEqual(result["comparison_features"]["surface_temp_k"]["earth_feature_key"], "land_surface_temperature_day_k_mean")
        self.assertEqual(result["comparison_features"]["elevation_m"]["weight_applied"], 0.4)
        self.assertIn("acquisition_start", result["comparison_features"]["elevation_m"])

    def test_incompatible_and_unknown_criteria_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "unsupported"):
            evaluate_real_earth_analogs(self.target, {"air_temperature_2m_c_mean": 1})
        with self.assertRaisesRegex(ValueError, "Unknown comparison criterion"):
            evaluate_real_earth_analogs(self.target, {"not-a-feature": 1})

    def test_invalid_weights_and_target_values_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "greater than zero"):
            evaluate_real_earth_analogs(self.target, {"elevation_m": -1})
        with self.assertRaisesRegex(ValueError, "finite"):
            evaluate_real_earth_analogs({**self.target, "elevation_m": float("nan")}, {"elevation_m": 1})
        with self.assertRaisesRegex(ValueError, "Lunar target does not contain"):
            evaluate_real_earth_analogs({}, {"elevation_m": 1})

    def test_invalid_registry_normalization_scale_is_rejected(self):
        with patch.dict(FEATURE_REGISTRY, {"elevation_m": replace(get_feature("elevation_m"), normalization_scale=0)}):
            with self.assertRaisesRegex(ValueError, "Normalization scale"):
                evaluate_real_earth_analogs(self.target, {"elevation_m": 1})

    def test_partial_observations_are_scored_transparently(self):
        partial = record("partial-real", [feature("elevation_m", 100)], status="PARTIAL")
        temp_dir, repository = self.repository_with(partial)
        with temp_dir, self.enabled_features("elevation_m", "slope_deg"):
            evaluation = evaluate_real_earth_analogs(self.target, {"elevation_m": 2, "slope_deg": 3}, repository=repository)
        self.assertEqual(evaluation.scored_candidate_count, 1)
        result = evaluation.results[0]
        self.assertEqual(result["similarity_score"], 100.0)
        self.assertEqual(result["used_weight_total"], 0.4)
        self.assertEqual(result["comparison_features"]["elevation_m"]["weight_applied"], 1.0)
        self.assertEqual(result["unavailable_criteria"][0]["status"], "MISSING_EARTH_OBSERVATION")

    def test_no_eligible_features_returns_unscored_diagnostic(self):
        real_power_only = record("power-only", [feature("air_temperature_2m_c_mean", 14, unit="°C")])
        temp_dir, repository = self.repository_with(real_power_only)
        with temp_dir:
            evaluation = evaluate_real_earth_analogs(self.target, {"elevation_m": 1}, repository=repository)
        self.assertEqual(evaluation.results, [])
        self.assertEqual(evaluation.skipped_candidate_count, 1)
        self.assertEqual(evaluation.candidate_diagnostics[0]["status"], "UNSCORED")
        self.assertEqual(evaluation.candidate_diagnostics[0]["criteria"][0]["status"], "UNAVAILABLE_REGISTRY")

    def test_stage_6f_terrain_scan_scores_real_repository_records(self):
        evaluation = evaluate_real_earth_analogs(
            {"relative_elevation_m": 1.0}, {"relative_elevation_m": 1}, repository=EarthDataRepository(),
        )
        self.assertGreaterEqual(len(evaluation.results), 1)
        self.assertTrue(all(item["data_status"] == "REAL" for item in evaluation.results))
        self.assertEqual(evaluation.requested_criteria[0]["status"], "ELIGIBLE_FOR_RECORD_CHECK")

    def test_score_boundaries_and_multiple_criteria(self):
        exact = record("exact", [feature("elevation_m", 100), feature("slope_deg", 5)])
        distant = record("distant", [feature("elevation_m", 1_000_000), feature("slope_deg", 90)])
        temp_dir, repository = self.repository_with(exact, distant)
        with temp_dir, self.enabled_features("elevation_m", "slope_deg"):
            evaluation = evaluate_real_earth_analogs(self.target, {"elevation_m": 4, "slope_deg": 1}, repository=repository)
        self.assertEqual(evaluation.results[0]["similarity_score"], 100.0)
        self.assertEqual(evaluation.results[0]["comparison_features"]["elevation_m"]["weight_applied"], 0.8)
        self.assertEqual(evaluation.results[1]["similarity_score"], 0.0)

    def test_real_mode_never_reads_simulated_csv_and_empty_repository_is_safe(self):
        with tempfile.TemporaryDirectory() as temp_dir, patch("app.services.similarity.DATA_PATH", Path(temp_dir) / "missing.csv"):
            evaluation = evaluate_real_earth_analogs(self.target, {"elevation_m": 1}, repository=EarthDataRepository(Path(temp_dir)))
        self.assertEqual(evaluation.results, [])
        self.assertEqual((evaluation.available_candidate_count, evaluation.skipped_candidate_count), (0, 0))

    def test_simulated_demo_remains_functional_and_isolated(self):
        results = find_simulated_earth_analogs(self.target, self.weights)
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["feature_sources"], {})
        self.assertEqual(results[0]["used_weight_total"], 1.0)

    def test_atacama_power_observations_are_not_scored_as_lunar_features(self):
        evaluation = evaluate_real_earth_analogs(self.target, self.weights, repository=EarthDataRepository())
        atacama = next(item for item in evaluation.candidate_diagnostics if item["site_id"] == "atacama-desert-power-2024")
        self.assertEqual(atacama["status"], "UNSCORED")
        self.assertEqual(evaluation.results, [])
        self.assertTrue(all(item["status"] == "UNAVAILABLE_REGISTRY" for item in atacama["criteria"]))

    def test_backward_compatible_tuple_function(self):
        complete = record("tuple-real", [feature("elevation_m", 100)])
        temp_dir, repository = self.repository_with(complete)
        with temp_dir, self.enabled_features("elevation_m"):
            results, available, skipped = find_real_earth_analogs(self.target, {"elevation_m": 1}, repository=repository)
        self.assertEqual((available, skipped), (1, 0))
        self.assertEqual(results[0]["similarity_score"], 100.0)
