import csv
import io
import json
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
import tempfile
import os
from unittest.mock import patch

from app.schemas.earth import EarthDataFetchRequest, EarthLocationRecord
from app.services.earth_data import EarthDataRepository, merge_modis_point_csv
from app.services.nasa.modis import ModisAuthenticationError, ModisClient


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def read(self):
        return json.dumps(self.payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def request():
    return EarthDataFetchRequest(
        location_id="test-modis-site",
        name="Test MODIS Site",
        latitude=35.0,
        longitude=-80.0,
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 3),
    )


def record():
    return EarthLocationRecord(
        location_id="test-modis-site",
        name="Test MODIS Site",
        latitude=35.0,
        longitude=-80.0,
        data_status="MISSING",
        features=[],
        raw_response_path="",
        retrieved_at=datetime.now(timezone.utc),
    )


class ModisClientTests(unittest.TestCase):
    def test_requires_earthdata_token(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ModisAuthenticationError, "APPEEARS_TOKEN"):
                ModisClient(token="").submit_point_task(
                    location_id="test-modis-site", latitude=35, longitude=-80,
                    start_date=date(2024, 1, 1), end_date=date(2024, 1, 3),
                )

    def test_does_not_fall_back_to_the_srtm_token(self):
        with patch.dict(os.environ, {"EARTHDATA_TOKEN": "srtm-only-token"}, clear=True):
            with self.assertRaisesRegex(ModisAuthenticationError, "APPEEARS_TOKEN"):
                ModisClient().submit_point_task(
                    location_id="test-modis-site", latitude=35, longitude=-80,
                    start_date=date(2024, 1, 1), end_date=date(2024, 1, 3),
                )

    def test_reads_only_appeears_token_from_environment(self):
        captured = {}

        def opener(http_request, **_kwargs):
            captured["authorization"] = http_request.headers["Authorization"]
            return FakeResponse({"task_id": "abc-123", "status": "pending"})

        with patch.dict(os.environ, {"APPEEARS_TOKEN": "appeears-only-token", "EARTHDATA_TOKEN": "srtm-token"}, clear=True):
            ModisClient(opener=opener).submit_point_task(
                location_id="test-modis-site", latitude=35, longitude=-80,
                start_date=date(2024, 1, 1), end_date=date(2024, 1, 3),
            )
        self.assertEqual(captured["authorization"], "Bearer appeears-only-token")

    def test_submits_mod11a1_task_with_quality_layers(self):
        captured = {}

        def opener(http_request, **_kwargs):
            captured["url"] = http_request.full_url
            captured["payload"] = json.loads(http_request.data.decode("utf-8"))
            return FakeResponse({"task_id": "abc-123", "status": "pending"})

        response = ModisClient(token="test-token", opener=opener).submit_point_task(
            location_id="test-modis-site", latitude=35, longitude=-80,
            start_date=date(2024, 1, 1), end_date=date(2024, 1, 3),
        )

        self.assertEqual(response["task_id"], "abc-123")
        self.assertTrue(captured["url"].endswith("/task"))
        self.assertEqual(captured["payload"]["task_type"], "point")
        self.assertEqual({layer["layer"] for layer in captured["payload"]["params"]["layers"]}, {"LST_Day_1km", "QC_Day", "LST_Night_1km", "QC_Night"})


class ModisProcessingTests(unittest.TestCase):
    def test_applies_scale_factor_and_rejects_bad_quality(self):
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=["Date", "MOD11A1_061_LST_Day_1km", "MOD11A1_061_QC_Day", "MOD11A1_061_LST_Night_1km", "MOD11A1_061_QC_Night"])
        writer.writeheader()
        writer.writerow({"Date": "2024-01-01", "MOD11A1_061_LST_Day_1km": "15000", "MOD11A1_061_QC_Day": "0", "MOD11A1_061_LST_Night_1km": "14000", "MOD11A1_061_QC_Night": "0"})
        writer.writerow({"Date": "2024-01-02", "MOD11A1_061_LST_Day_1km": "15500", "MOD11A1_061_QC_Day": "2", "MOD11A1_061_LST_Night_1km": "14500", "MOD11A1_061_QC_Night": "4"})

        updated = merge_modis_point_csv(record(), output.getvalue().encode(), "https://example.test/task", request())

        self.assertEqual(updated.data_status, "REAL")
        self.assertEqual(updated.features[0].value, 300.0)
        self.assertEqual(updated.features[1].value, 280.0)
        self.assertEqual(updated.features[0].provenance.quality["rejected_observations"], 1)

    def test_marks_lacking_valid_observations_as_missing(self):
        content = "MOD11A1_061_LST_Day_1km,MOD11A1_061_QC_Day,MOD11A1_061_LST_Night_1km,MOD11A1_061_QC_Night\n0,0,0,0\n"
        updated = merge_modis_point_csv(record(), content.encode(), "https://example.test/task", request())
        self.assertEqual(updated.data_status, "MISSING")
        self.assertEqual(updated.features[0].data_status, "MISSING")

        with tempfile.TemporaryDirectory() as temp_dir:
            stored = EarthDataRepository(Path(temp_dir)).save(updated, {"csv": content}, provider="modis")
            self.assertTrue((Path(temp_dir) / stored.raw_response_path).exists())
