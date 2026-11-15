import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from pydantic import ValidationError

from app.routers.lunar_data import (
    get_lunar_feature_availability,
    get_lunar_health,
    get_lunar_site,
    get_lunar_site_features,
    list_lunar_sites,
)
from app.routers.analogs import search_analogs
from app.schemas.analogs import AnalogSearchRequest
from app.schemas.lunar import LunarFeatureObservation, LunarLocation
from app.services.lunar_data import LunarDataRepository


EXPECTED_SAMPLES = {
    "shackleton-rim": (-89.9, 129.9, {"elevation_m": (2400, "m"), "slope_deg": (7, "°"), "surface_temp_k": (125, "K")} ),
    "amundsen-crater": (-84.6, 82.8, {"elevation_m": (-4200, "m"), "slope_deg": (12, "°"), "surface_temp_k": (110, "K")} ),
    "cabeus-crater": (-84.9, -42.3, {"elevation_m": (-3500, "m"), "slope_deg": (10, "°"), "surface_temp_k": (105, "K")} ),
    "malapert-massif": (-85.4, 0, {"elevation_m": (5000, "m"), "slope_deg": (8, "°"), "surface_temp_k": (135, "K")} ),
    "apollo-11": (0.674, 23.473, {"elevation_m": (0, "m"), "slope_deg": (4, "°"), "surface_temp_k": (250, "K")} ),
    "luna-17": (38.247, -35, {"elevation_m": (-1500, "m"), "slope_deg": (5, "°"), "surface_temp_k": (230, "K")} ),
}


def sample_location(site_id="sample-site"):
    return {
        "site_id": site_id, "name": "Sample site", "latitude": -80, "longitude": 10,
        "body": "Moon", "data_status": "SAMPLE", "features": [
            {"feature_key": "elevation_m", "value": 10, "unit": "m", "data_status": "SAMPLE", "observation_kind": "SAMPLE", "source": "Test sample"},
        ],
    }


class LunarSchemaTests(unittest.TestCase):
    def test_valid_location_supports_optional_provenance_and_multiple_observations(self):
        payload = sample_location()
        payload["features"].append({"feature_key": "elevation_m", "value": 12, "unit": "m", "data_status": "DERIVED", "observation_kind": "DERIVED", "source": "Derived test", "observation_time": datetime.now(timezone.utc).isoformat()})
        record = LunarLocation.model_validate(payload)
        self.assertEqual(len(record.features), 2)
        self.assertEqual(record.features[0].provenance.derivation_lineage, [])

    def test_invalid_coordinates_non_finite_values_and_feature_shape_are_rejected(self):
        with self.assertRaises(ValidationError):
            LunarLocation.model_validate({**sample_location(), "latitude": 91})
        with self.assertRaises(ValidationError):
            LunarFeatureObservation.model_validate({"feature_key": "x", "value": float("nan"), "unit": "m", "data_status": "SAMPLE", "observation_kind": "SAMPLE", "source": "test"})
        with self.assertRaises(ValidationError):
            LunarFeatureObservation.model_validate({"feature_key": "x", "value": 1, "data_status": "SAMPLE", "observation_kind": "SAMPLE", "source": "test"})


class LunarRepositoryTests(unittest.TestCase):
    def test_migration_preserves_every_original_sample_value_and_unit(self):
        repository = LunarDataRepository()
        records = {record.site_id: record for record in repository.list_locations()}
        self.assertEqual(set(records), set(EXPECTED_SAMPLES))
        for site_id, (latitude, longitude, expected_features) in EXPECTED_SAMPLES.items():
            record = records[site_id]
            self.assertEqual((record.latitude, record.longitude), (latitude, longitude))
            self.assertEqual(record.data_status, "SAMPLE")
            actual_samples = {
                item.feature_key: (item.value, item.unit)
                for item in record.features if item.data_status == "SAMPLE"
            }
            self.assertEqual(actual_samples, expected_features)
        self.assertEqual(len(repository.get_observations_by_status("SAMPLE")), 18)

    def test_repository_queries_latest_status_counts_and_invalid_diagnostics(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            sites_dir = Path(temp_dir) / "processed" / "sites"
            sites_dir.mkdir(parents=True)
            base = sample_location("query-site")
            base["features"].append({"feature_key": "elevation_m", "value": 11, "unit": "m", "data_status": "DERIVED", "observation_kind": "DERIVED", "source": "Test derivation", "observation_time": "2025-01-02T00:00:00Z"})
            (sites_dir / "query-site.json").write_text(json.dumps(base), encoding="utf-8")
            (sites_dir / "invalid.json").write_text("{not json", encoding="utf-8")
            repository = LunarDataRepository(Path(temp_dir))
            self.assertEqual(len(repository.get_observations("query-site", "elevation_m")), 2)
            self.assertEqual(repository.get_latest_observation("query-site", "elevation_m").value, 11)
            self.assertEqual(len(repository.get_observations_by_status("SAMPLE")), 1)
            self.assertEqual(repository.get_health()["observation_status_counts"]["DERIVED"], 1)
            self.assertEqual(len(repository.get_invalid_record_diagnostics() if hasattr(repository, "get_invalid_record_diagnostics") else repository.get_health()["invalid_records"]), 1)
        with tempfile.TemporaryDirectory() as temp_dir:
            self.assertEqual(LunarDataRepository(Path(temp_dir)).list_locations(), [])

    def test_real_only_target_resolution_never_uses_sample_values(self):
        repository = LunarDataRepository()
        sample_target = repository.resolve_real_similarity_targets("shackleton-rim", {"elevation_m": 1})
        self.assertEqual(sample_target.target_features, {})
        self.assertEqual(sample_target.diagnostics[0]["status"], "LUNAR_TARGET_NOT_REAL")

        derived_target = repository.resolve_real_similarity_targets("apollo-11", {"relative_elevation_m": 1})
        self.assertEqual(derived_target.diagnostics, [])
        self.assertIn("relative_elevation_m", derived_target.target_features)

    def test_lola_terrain_features_cover_only_qc_passing_sites(self):
        repository = LunarDataRepository()
        self.assertEqual(len(repository.get_terrain_observations("shackleton-rim")), 0)
        for site_id in set(EXPECTED_SAMPLES) - {"shackleton-rim"}:
            observations = repository.get_terrain_observations(site_id)
            self.assertEqual({item.feature_key for item in observations}, {
                "relative_elevation_m", "slope_deg_windowed", "terrain_roughness_m_windowed", "local_relief_m",
            })
            self.assertTrue(all(item.data_status == "DERIVED" for item in observations))
            self.assertTrue(all(item.provenance.source_data_status == "REAL" for item in observations))

    def test_diviner_prp_features_cover_the_south_polar_reference_sites(self):
        repository = LunarDataRepository()
        expected = {"subsurface_temp_2cm_k_annual_mean", "surface_temp_k_annual_max"}
        for site_id in {"shackleton-rim", "amundsen-crater", "cabeus-crater", "malapert-massif"}:
            observations = [item for item in repository.get_observations(site_id) if item.product_id == "DLRE_PRP_SOUTH.TAB"]
            self.assertTrue(expected.issubset({item.feature_key for item in observations}))
            self.assertTrue(all(item.data_status == "DERIVED" for item in observations))
            self.assertTrue(all(item.provenance.source_data_status == "REAL" for item in observations))
        self.assertFalse(any(
            item.product_id == "DLRE_PRP_SOUTH.TAB"
            for item in repository.get_observations("apollo-11")
        ))

    def test_real_only_search_ignores_client_target_values(self):
        response = search_analogs(AnalogSearchRequest(
            site_id="shackleton-rim", latitude=-89.9, longitude=129.9,
            target_features={"elevation_m": 999999, "slope_deg": 0, "surface_temp_k": 1},
            research_device="LTV", criteria_weights={"elevation_m": 1}, earth_data_mode="REAL_ONLY",
        ))
        self.assertEqual(response.results, [])
        self.assertEqual(response.candidate_diagnostics[0]["status"], "UNSCORED_LUNAR_TARGET")
        self.assertEqual(response.requested_criteria[0]["status"], "LUNAR_TARGET_NOT_REAL")


class LunarApiTests(unittest.TestCase):
    def test_read_only_api_returns_sites_features_availability_and_health(self):
        self.assertEqual(len(list_lunar_sites()), 6)
        self.assertEqual(get_lunar_site("shackleton-rim").site_id, "shackleton-rim")
        self.assertEqual(len(get_lunar_site_features("shackleton-rim")), 6)
        self.assertEqual(len(get_lunar_site_features("apollo-11")), 7)
        self.assertEqual(get_lunar_feature_availability()["features"]["elevation_m"]["location_count"], 6)
        health = get_lunar_health()
        self.assertEqual(health["valid_location_count"], 6)
        self.assertEqual(health["observation_status_counts"]["SAMPLE"], 18)
        self.assertEqual(health["observation_status_counts"]["DERIVED"], 31)
        with self.assertRaises(HTTPException) as unknown:
            get_lunar_site("unknown-site")
        self.assertEqual(unknown.exception.status_code, 404)
