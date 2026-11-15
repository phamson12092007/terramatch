import unittest

from app.services.feature_registry import (
    CELSIUS_TO_KELVIN,
    get_all_features,
    get_comparison_explanation,
    get_feature,
    get_similarity_eligible_features,
    validate_similarity_criterion,
)


class FeatureRegistryTests(unittest.TestCase):
    def test_contains_all_required_feature_keys(self):
        keys = {feature.key for feature in get_all_features()}
        self.assertEqual(keys, {
            "elevation_m", "slope_deg", "terrain_roughness_m",
            "land_surface_temperature_day_k_mean", "land_surface_temperature_night_k_mean",
            "air_temperature_2m_c_mean", "air_temperature_2m_c_min", "air_temperature_2m_c_max",
            "all_sky_surface_shortwave_down_mj_m2_day_mean",
            "relative_elevation_m", "slope_deg_windowed", "terrain_roughness_m_windowed", "local_relief_m",
        })

    def test_units_and_availability_are_correct(self):
        self.assertEqual(get_feature("elevation_m").unit, "m")
        self.assertEqual(get_feature("slope_deg").unit, "°")
        self.assertEqual(get_feature("land_surface_temperature_day_k_mean").unit, "K")
        self.assertEqual(get_feature("all_sky_surface_shortwave_down_mj_m2_day_mean").unit, "MJ/m²/day")
        self.assertEqual(get_feature("air_temperature_2m_c_mean").data_availability, "AVAILABLE")
        self.assertEqual(get_feature("elevation_m").data_availability, "PLANNED")
        self.assertEqual(get_feature("land_surface_temperature_day_k_mean").data_availability, "PLANNED")

    def test_stage_6f_enables_only_resolution_robust_terrain_features(self):
        for key, unit in {
            "relative_elevation_m": "m",
            "slope_deg_windowed": "°",
            "terrain_roughness_m_windowed": "m",
            "local_relief_m": "m",
        }.items():
            feature = get_feature(key)
            self.assertEqual(feature.unit, unit)
            self.assertEqual(feature.data_availability, "AVAILABLE")
            self.assertEqual(feature.lunar_compatibility, "COMPATIBLE")
        self.assertTrue(get_feature("relative_elevation_m").similarity_supported)
        self.assertTrue(get_feature("slope_deg_windowed").similarity_supported)
        self.assertFalse(get_feature("terrain_roughness_m_windowed").similarity_supported)
        self.assertFalse(get_feature("local_relief_m").similarity_supported)
        self.assertIn("resolution-sensitive", get_feature("terrain_roughness_m_windowed").unavailable_reason)

    def test_power_features_are_not_made_comparable_by_unit_conversion(self):
        power_feature = get_feature("air_temperature_2m_c_mean")
        self.assertEqual(power_feature.lunar_compatibility, "UNSUPPORTED")
        self.assertFalse(power_feature.similarity_supported)
        self.assertEqual(CELSIUS_TO_KELVIN.convert(0), 273.15)
        with self.assertRaisesRegex(ValueError, "air-temperature target"):
            validate_similarity_criterion("air_temperature_2m_c_mean")

    def test_planned_lunar_mappings_and_eligible_terrain_scoring_are_distinct(self):
        self.assertEqual(get_feature("elevation_m").lunar_feature_key, "elevation_m")
        self.assertEqual(get_feature("land_surface_temperature_day_k_mean").lunar_feature_key, "surface_temp_k")
        self.assertEqual(
            {feature.key for feature in get_similarity_eligible_features()},
            {"relative_elevation_m", "slope_deg_windowed"},
        )
        self.assertIn("not terrain illumination", get_comparison_explanation("all_sky_surface_shortwave_down_mj_m2_day_mean"))
