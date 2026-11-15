import math
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from app.schemas.lunar import LunarFeatureObservation
from app.services.lunar_data import LunarDataRepository
from app.services.lunar_lola_ingestion import ingest_lola_terrain
from app.services.nasa.lola import TerrainCoverage, derive_regional_terrain_metrics, parse_ldem16_label


class LolaTerrainMetricTests(unittest.TestCase):
    def test_plane_metrics_use_documented_regional_support(self):
        resolution_m = 2.0
        coordinates = (np.arange(5) - 2) * resolution_m
        x, y = np.meshgrid(coordinates, coordinates)
        values = 100.0 + 0.01 * x + 0.02 * y

        metrics = derive_regional_terrain_metrics(values, resolution_m)

        self.assertAlmostEqual(metrics["relative_elevation_m"], 0.0)
        self.assertAlmostEqual(metrics["slope_deg_windowed"], math.degrees(math.atan(math.hypot(0.01, 0.02))))
        self.assertAlmostEqual(metrics["terrain_roughness_m_windowed"], 0.0)
        self.assertAlmostEqual(metrics["local_relief_m"], 0.24)

    def test_incomplete_windows_are_rejected_without_interpolation(self):
        with self.assertRaisesRegex(ValueError, "finite"):
            derive_regional_terrain_metrics(np.array([[1.0, 2.0, 3.0], [4.0, np.nan, 6.0], [7.0, 8.0, 9.0]]), 1.0)

    def test_verified_label_identifies_the_exact_lola_product(self):
        label = Path(__file__).resolve().parents[1] / "data" / "lunar" / "raw" / "lola" / "ldem_16.lbl"
        metadata = parse_ldem16_label(label)
        self.assertEqual(metadata.product_id, "LDEM_16")
        self.assertEqual(metadata.data_set_id, "LRO-L-LOLA-4-GDR-V1.0")
        self.assertEqual((metadata.lines, metadata.line_samples), (2880, 5760))

    def test_ingestion_appends_real_backed_derivation_without_replacing_samples(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            base = Path(temp_dir)
            sites = base / "processed" / "sites"
            sites.mkdir(parents=True)
            (sites / "fixture-site.json").write_text(json.dumps({
                "site_id": "fixture-site", "name": "Fixture", "latitude": -70, "longitude": 10,
                "body": "Moon", "data_status": "SAMPLE", "features": [{
                    "feature_key": "elevation_m", "value": 10, "unit": "m", "data_status": "SAMPLE",
                    "observation_kind": "SAMPLE", "source": "Fixture sample",
                }],
            }), encoding="utf-8")

            class FakeDataset:
                def __init__(self, *_):
                    pass

                def manifest(self, _):
                    return {"source": {"sha256": "verified-source"}}

                def derive_features(self, _):
                    observation = LunarFeatureObservation(
                        feature_key="relative_elevation_m", value=1, unit="m", data_status="DERIVED",
                        observation_kind="DERIVED", source="NASA PDS", provenance={
                            "source_data_status": "REAL", "source_checksum_sha256": "verified-source",
                        },
                    )
                    coverage = TerrainCoverage("fixture-site", True, True, "FULL", "COVERED", 25, 25, 1.0, 1, 1)
                    return [observation], coverage

            repository = LunarDataRepository(base)
            with patch("app.services.lunar_lola_ingestion.LolaLdem16", FakeDataset), patch("app.services.lunar_lola_ingestion.write_lola_metadata_and_manifest"):
                first = ingest_lola_terrain(repository)
                second = ingest_lola_terrain(repository)
            record = repository.get_location("fixture-site")
            self.assertEqual(first["derived_feature_counts"], {"relative_elevation_m": 1})
            self.assertEqual(second["derived_feature_counts"], {})
            self.assertEqual([item.data_status for item in record.features], ["SAMPLE", "DERIVED"])
