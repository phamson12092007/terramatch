import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from urllib.error import URLError

from pydantic import ValidationError

from app.schemas.earth import EarthDataFetchRequest
from app.services.earth_data import EarthDataRepository, acquire_power_data
from app.services.nasa.power import PowerClient, PowerServiceError


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def read(self):
        return json.dumps(self.payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def sample_payload():
    return {
        "header": {"fill_value": -999},
        "properties": {
            "parameter": {
                "T2M": {"20240101": 10.0, "20240102": -999, "20240103": 14.0},
                "T2M_MIN": {"20240101": 1.0, "20240102": 2.0, "20240103": 3.0},
                "T2M_MAX": {"20240101": 19.0, "20240102": 20.0, "20240103": 21.0},
                "ALLSKY_SFC_SW_DWN": {"20240101": 4.0, "20240102": 5.0, "20240103": 6.0},
            }
        },
    }


class PowerClientTests(unittest.TestCase):
    def test_parses_valid_values_and_excludes_fill_values(self):
        client = PowerClient(opener=lambda *_args, **_kwargs: FakeResponse(sample_payload()))

        result = client.fetch_daily_point(35.0, -80.0, date(2024, 1, 1), date(2024, 1, 3))

        temperature = result.parameter_summaries["T2M"]
        self.assertEqual(temperature.values, [10.0, 14.0])
        self.assertEqual(temperature.missing_days, 1)
        self.assertEqual(PowerClient.mean(temperature), 12.0)
        self.assertIn("time-standard=UTC", result.request_url)
        self.assertIn("parameters=T2M%2CT2M_MIN%2CT2M_MAX%2CALLSKY_SFC_SW_DWN", result.request_url)

    def test_raises_clear_error_for_network_failure(self):
        def unavailable(*_args, **_kwargs):
            raise URLError("offline")

        client = PowerClient(opener=unavailable)
        with self.assertRaisesRegex(PowerServiceError, "could not be reached"):
            client.fetch_daily_point(35.0, -80.0, date(2024, 1, 1), date(2024, 1, 3))

    def test_rejects_invalid_response_shape(self):
        client = PowerClient(opener=lambda *_args, **_kwargs: FakeResponse({"unexpected": "payload"}))

        with self.assertRaisesRegex(PowerServiceError, "does not contain daily parameters"):
            client.fetch_daily_point(35.0, -80.0, date(2024, 1, 1), date(2024, 1, 3))


class EarthDataAcquisitionTests(unittest.TestCase):
    def test_stores_real_power_features_with_provenance(self):
        request = EarthDataFetchRequest(
            location_id="test-desert",
            name="Test Desert",
            country_or_area="Test Country",
            latitude=35.0,
            longitude=-80.0,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 3),
        )
        client = PowerClient(opener=lambda *_args, **_kwargs: FakeResponse(sample_payload()))

        with tempfile.TemporaryDirectory() as temp_dir:
            repository = EarthDataRepository(Path(temp_dir))
            record = acquire_power_data(request, client=client, repository=repository)

            self.assertEqual(record.data_status, "REAL")
            self.assertEqual(record.features[0].key, "air_temperature_2m_c_mean")
            self.assertEqual(record.features[0].value, 12.0)
            self.assertEqual(record.features[0].provenance.parameter_code, "T2M")
            self.assertEqual(record.features[-1].unit, "MJ/m²/day")
            self.assertEqual(repository.get_record("test-desert").name, "Test Desert")
            self.assertTrue((Path(temp_dir) / record.raw_response_path).exists())

    def test_rejects_reversed_acquisition_period(self):
        with self.assertRaises(ValidationError):
            EarthDataFetchRequest(
                location_id="invalid-period",
                name="Invalid",
                latitude=0,
                longitude=0,
                start_date=date(2024, 2, 1),
                end_date=date(2024, 1, 1),
            )

    def test_marks_a_missing_power_parameter_as_partial(self):
        payload = sample_payload()
        del payload["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]
        request = EarthDataFetchRequest(
            location_id="partial-desert",
            name="Partial Desert",
            latitude=35.0,
            longitude=-80.0,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 3),
        )
        client = PowerClient(opener=lambda *_args, **_kwargs: FakeResponse(payload))

        with tempfile.TemporaryDirectory() as temp_dir:
            record = acquire_power_data(request, client=client, repository=EarthDataRepository(Path(temp_dir)))

        self.assertEqual(record.data_status, "PARTIAL")
        self.assertEqual(record.features[-1].data_status, "MISSING")
        self.assertIsNone(record.features[-1].value)

    def test_rejects_invalid_coordinates(self):
        with self.assertRaises(ValidationError):
            EarthDataFetchRequest(
                location_id="outside-earth",
                name="Outside Earth",
                latitude=91,
                longitude=0,
                start_date=date(2024, 1, 1),
                end_date=date(2024, 1, 3),
            )
