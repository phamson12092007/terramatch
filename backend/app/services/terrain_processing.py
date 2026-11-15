"""Shared, source-agnostic regional DEM terrain calculations.

The caller is responsible for extracting a complete, metric-grid window and
for documenting its CRS and support. This module deliberately performs no
interpolation, reprojection, or NoData filling.
"""

from __future__ import annotations

import numpy as np


def derive_regional_terrain_metrics(
    values_m: np.ndarray,
    east_west_resolution_m: float,
    north_south_resolution_m: float | None = None,
) -> dict[str, float]:
    """Calculate the four Stage 6B/6C metrics from a complete square DEM window.

    Slope is fitted in metric coordinates, never longitude/latitude degrees.
    Roughness is the population standard deviation of residuals from that
    plane. The center must be the geometric center of the supplied grid.
    """
    north_south_resolution_m = north_south_resolution_m or east_west_resolution_m
    if values_m.ndim != 2 or values_m.shape[0] != values_m.shape[1] or values_m.shape[0] < 3:
        raise ValueError("Terrain window must be a square grid of at least 3×3 pixels")
    if (
        not np.isfinite(values_m).all()
        or not np.isfinite(east_west_resolution_m)
        or not np.isfinite(north_south_resolution_m)
        or east_west_resolution_m <= 0
        or north_south_resolution_m <= 0
    ):
        raise ValueError("Terrain window values and resolution must be finite")
    center_index = values_m.shape[0] // 2
    center = values_m[center_index, center_index]
    x_coordinates = (np.arange(values_m.shape[1]) - center_index) * east_west_resolution_m
    y_coordinates = (np.arange(values_m.shape[0]) - center_index) * north_south_resolution_m
    x, y = np.meshgrid(x_coordinates, y_coordinates)
    design = np.column_stack([np.ones(values_m.size), x.ravel(), y.ravel()])
    coefficients, *_ = np.linalg.lstsq(design, values_m.ravel(), rcond=None)
    fitted = (design @ coefficients).reshape(values_m.shape)
    return {
        "relative_elevation_m": float(center - np.median(values_m)),
        "slope_deg_windowed": float(np.degrees(np.arctan(np.hypot(coefficients[1], coefficients[2])))),
        "terrain_roughness_m_windowed": float(np.std(values_m - fitted, ddof=0)),
        "local_relief_m": float(np.max(values_m) - np.min(values_m)),
    }
