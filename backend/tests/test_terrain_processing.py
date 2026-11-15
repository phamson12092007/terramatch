import math
import unittest

import numpy as np

from app.services.terrain_processing import derive_regional_terrain_metrics


class SharedTerrainProcessingTests(unittest.TestCase):
    def test_fits_slope_in_metric_coordinates(self):
        x, y = np.meshgrid((np.arange(5) - 2) * 10.0, (np.arange(5) - 2) * 20.0)
        values = 50 + 0.01 * x + 0.02 * y
        result = derive_regional_terrain_metrics(values, 10.0, 20.0)
        self.assertAlmostEqual(result["slope_deg_windowed"], math.degrees(math.atan(math.hypot(0.01, 0.02))))
        self.assertAlmostEqual(result["relative_elevation_m"], 0.0)
        self.assertAlmostEqual(result["terrain_roughness_m_windowed"], 0.0)
