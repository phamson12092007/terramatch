import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from app.schemas.earth import EarthLocationRecord
from app.services.earth_data import EarthDataRepository, merge_srtm_regional_terrain, merge_srtm_terrain
from app.services.nasa.srtm import SrtmAuthenticationError, SrtmCoverageError, SrtmFetchResult, SrtmTile, tile_name


def raw_tile(void=False):
    values = np.tile(np.arange(5, dtype=np.int16) * 10, (5, 1))
    if void:
        values[1, 1] = -32768
    return values.astype(">i2").tobytes()


def record():
    return EarthLocationRecord(
        location_id="srtm-test",
        name="SRTM Test",
        latitude=0.5,
        longitude=0.5,
        data_status="MISSING",
        features=[],
        raw_response_path="",
        retrieved_at=datetime.now(timezone.utc),
    )


class SrtmTerrainTests(unittest.TestCase):
    def test_calculates_terrain_from_valid_hgt_window(self):
        terrain = SrtmTile.from_hgt("N00E000", raw_tile()).terrain_at(0.5, 0.5)
        self.assertEqual(terrain["elevation_m"], 20.0)
        self.assertGreater(terrain["slope_deg"], 0)
        self.assertGreater(terrain["terrain_roughness_m"], 0)

    def test_rejects_void_and_outside_coverage(self):
        with self.assertRaises(SrtmCoverageError):
            SrtmTile.from_hgt("N00E000", raw_tile(void=True)).terrain_at(0.5, 0.5)
        with self.assertRaises(SrtmCoverageError):
            tile_name(-56.1, 0)

    def test_regional_metrics_use_metric_grid_and_report_coverage(self):
        tile = SrtmTile.from_hgt("N00E000", raw_tile())
        metrics, coverage = tile.regional_terrain_at(0.5, 0.5, 30_000)
        self.assertEqual(coverage.processing_status, "COVERED")
        self.assertEqual(coverage.valid_pixel_count, coverage.expected_pixel_count)
        self.assertEqual(set(metrics), {
            "relative_elevation_m", "slope_deg_windowed", "terrain_roughness_m_windowed", "local_relief_m",
        })
        self.assertGreater(metrics["slope_deg_windowed"], 0)

    def test_regional_metrics_reject_tile_edge_and_void_windows(self):
        metrics, coverage = SrtmTile.from_hgt("N00E000", raw_tile()).regional_terrain_at(0.99, 0.5, 30_000)
        self.assertIsNone(metrics)
        self.assertEqual(coverage.processing_status, "PARTIAL_COVERAGE")
        metrics, coverage = SrtmTile.from_hgt("N00E000", raw_tile(void=True)).regional_terrain_at(0.5, 0.5, 30_000)
        self.assertIsNone(metrics)
        self.assertEqual(coverage.processing_status, "INSUFFICIENT_VALID_PIXELS")

    def test_merges_features_and_keeps_raw_binary_separate(self):
        result = SrtmFetchResult("N00E000", "https://example.test/N00E000.hgt", raw_tile())
        enriched = merge_srtm_terrain(record(), result)
        self.assertEqual(enriched.data_status, "REAL")
        self.assertEqual({feature.key for feature in enriched.features}, {"elevation_m", "slope_deg", "terrain_roughness_m"})

        with tempfile.TemporaryDirectory() as temp_dir:
            repository = EarthDataRepository(Path(temp_dir))
            raw_path = repository.save_binary_raw("srtm", "srtm-test", ".hgt", result.raw_bytes)
            self.assertTrue((Path(temp_dir) / raw_path).exists())

    def test_regional_merge_keeps_existing_features_and_reports_processing_metadata(self):
        original = record().model_copy(update={"features": []})
        result = SrtmFetchResult("N00E000", "https://example.test/N00E000.hgt", raw_tile())
        enriched, coverage = merge_srtm_regional_terrain(original, result, support_width_m=30_000)
        self.assertEqual(coverage.processing_status, "COVERED")
        self.assertEqual({feature.key for feature in enriched.features}, {
            "relative_elevation_m", "slope_deg_windowed", "terrain_roughness_m_windowed", "local_relief_m",
        })
        self.assertTrue(all(feature.data_status == "DERIVED" for feature in enriched.features))
        self.assertTrue(all(feature.provenance.quality["source_data_status"] == "REAL" for feature in enriched.features))
        self.assertEqual(enriched.features[0].provenance.quality["resampling"], "None; native HGT samples only.")
