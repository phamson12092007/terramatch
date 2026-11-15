import unittest
from unittest.mock import patch

from app.routers.analogs import search_analogs
from app.schemas.analogs import AnalogSearchRequest


class AnalogRefreshTests(unittest.TestCase):
    def test_real_search_refreshes_nasa_srtm_only_when_requested(self):
        request = AnalogSearchRequest(
            site_id="apollo-11",
            latitude=0.674,
            longitude=23.473,
            research_device="LTV",
            criteria_weights={"relative_elevation_m": 0.4, "slope_deg_windowed": 0.6},
            earth_data_mode="REAL_ONLY",
            refresh_from_nasa=True,
        )
        with patch("app.routers.analogs.ingest_earth_terrain_catalog") as ingest, patch("app.routers.analogs.build_srtm_candidate_index") as build:
            response = search_analogs(request)
        ingest.assert_called_once_with(force_refresh=True)
        build.assert_called_once_with(force_rebuild=True)
        self.assertEqual(response.data_source, "REAL")
        self.assertIn("NASA SRTM was refreshed", response.message)
