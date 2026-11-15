import unittest

from app.routers.earth_data import get_earth_feature_catalog


class EarthFeatureCatalogApiTests(unittest.TestCase):
    def test_catalog_exposes_registry_metadata_and_observation_availability(self):
        response = get_earth_feature_catalog()

        self.assertIn("features", response)
        self.assertIn("repository_diagnostics", response)
        elevation = next(feature for feature in response["features"] if feature["key"] == "elevation_m")
        power_air = next(feature for feature in response["features"] if feature["key"] == "air_temperature_2m_c_mean")

        self.assertEqual(elevation["lunar_feature_key"], "elevation_m")
        self.assertEqual(elevation["observation_availability"]["locations_with_real_observation"], 0)
        self.assertEqual(power_air["lunar_compatibility"], "UNSUPPORTED")
        self.assertEqual(power_air["observation_availability"]["locations_with_real_observation"], 1)
