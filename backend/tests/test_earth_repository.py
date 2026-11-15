import json
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

from app.schemas.earth import EarthFeature, EarthLocationRecord, FeatureProvenance
from app.services.earth_data import EarthDataRepository


def provenance(start=date(2024, 1, 1), end=date(2024, 1, 2)):
    return FeatureProvenance(
        source_organization="NASA POWER",
        dataset_name="Test POWER",
        parameter_code="T2M",
        source_url="https://example.test/power",
        acquisition_start=start,
        acquisition_end=end,
        temporal_resolution="Daily, UTC",
        original_unit="°C",
        processed_unit="°C",
        processing_method="Test fixture",
        quality={"valid_days": 2},
        retrieved_at=datetime.now(timezone.utc),
    )


def record(location_id="test-site", name="Test Site", latitude=1, longitude=2, start=date(2024, 1, 1), feature_key="air_temperature_2m_c_mean"):
    return EarthLocationRecord(
        location_id=location_id,
        name=name,
        latitude=latitude,
        longitude=longitude,
        data_status="REAL",
        raw_response_path="",
        retrieved_at=datetime.now(timezone.utc),
        features=[EarthFeature(
            key=feature_key,
            label=feature_key,
            value=12.5,
            unit="°C",
            data_status="REAL",
            provenance=provenance(start),
        )],
    )


class EarthRepositoryTests(unittest.TestCase):
    def test_loads_existing_atacama_record_with_preserved_provenance(self):
        repository = EarthDataRepository()
        atacama = repository.get_record("atacama-desert-power-2024")
        features = {feature.key: feature for feature in atacama.features}

        self.assertEqual(atacama.name, "Atacama Desert")
        self.assertEqual(features["air_temperature_2m_c_mean"].unit, "°C")
        self.assertEqual(features["air_temperature_2m_c_mean"].data_status, "REAL")
        self.assertEqual(features["air_temperature_2m_c_mean"].provenance.parameter_code, "T2M")
        self.assertEqual(features["all_sky_surface_shortwave_down_mj_m2_day_mean"].provenance.processed_unit, "MJ/m²/day")

    def test_loads_multiple_locations_and_feature_availability(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            repository = EarthDataRepository(Path(temp_dir))
            repository.save(record("one", "One", 1, 2), {"fixture": 1})
            repository.save(record("two", "Two", 3, 4), {"fixture": 2})

            self.assertEqual([item.location_id for item in repository.list_records()], ["one", "two"])
            availability = repository.get_feature_availability("one")
            self.assertEqual(availability[0]["key"], "air_temperature_2m_c_mean")
            self.assertTrue(availability[0]["registered"])
            self.assertEqual(availability[0]["provenance"]["parameter_code"], "T2M")
            self.assertEqual(repository.count_real_observations_by_feature()["air_temperature_2m_c_mean"], 2)

    def test_invalid_json_and_invalid_coordinates_are_diagnostic_not_valid(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            processed = Path(temp_dir) / "processed"
            processed.mkdir()
            (processed / "broken.json").write_text("{not-json", encoding="utf-8")
            invalid_coordinate = record().model_dump(mode="json")
            invalid_coordinate["latitude"] = 91
            (processed / "bad-coordinate.json").write_text(json.dumps(invalid_coordinate), encoding="utf-8")
            repository = EarthDataRepository(Path(temp_dir))

            self.assertEqual(repository.list_records(), [])
            diagnostics = repository.get_invalid_record_diagnostics()
            self.assertEqual({item["path"] for item in diagnostics}, {"broken.json", "bad-coordinate.json"})

    def test_unknown_feature_is_preserved_but_not_registered(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            repository = EarthDataRepository(Path(temp_dir))
            repository.save(record(feature_key="future_unrecognized_feature"), {"fixture": "unknown"})

            availability = repository.get_feature_availability("test-site")
            self.assertFalse(availability[0]["registered"])
            self.assertEqual(repository.count_real_observations_by_feature()["future_unrecognized_feature"], 1)

    def test_duplicate_id_and_coordinate_conflicts_are_reported_without_deletion(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            repository = EarthDataRepository(Path(temp_dir))
            first = repository.save(record("duplicate", "Atacama Desert", -23.5, -68.2), {"fixture": "first"})
            duplicate_path = Path(temp_dir) / "processed" / "alternate-duplicate.json"
            duplicate_path.write_text((Path(temp_dir) / "processed" / "duplicate.json").read_text(encoding="utf-8"), encoding="utf-8")
            repository.save(record("same-place-new-period", " atacama   desert ", -23.5, -68.2, date(2025, 1, 1)), {"fixture": "later"})

            diagnostics = repository.get_duplicate_record_diagnostics()
            classifications = {item["classification"] for item in diagnostics}
            self.assertIn("EXACT_DUPLICATE", classifications)
            self.assertIn("RELATED_DIFFERENT_PERIOD", classifications)
            self.assertTrue((Path(temp_dir) / first.raw_response_path).exists())

    def test_empty_repository_and_status_diagnostics(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            repository = EarthDataRepository(Path(temp_dir))
            diagnostics = repository.get_diagnostics()
            self.assertEqual(diagnostics["valid_record_count"], 0)
            self.assertEqual(diagnostics["invalid_records"], [])
            self.assertEqual(diagnostics["location_status_counts"], {"REAL": 0, "PARTIAL": 0, "MISSING": 0, "SIMULATED": 0})
