import tempfile
import unittest
from pathlib import Path

from app.schemas.lunar import LunarLocation
from app.services.nasa.diviner import (
    DIVINER_DATASET_ID,
    DIVINER_PRODUCT_ID,
    DivinerPrpMatch,
    DivinerPrpMetadata,
    DivinerPrpSouth,
    parse_prp_south_label,
)


class DivinerPrpTests(unittest.TestCase):
    def test_verified_label_identifies_exact_south_polar_product(self):
        label = Path(__file__).resolve().parents[1] / "data" / "lunar" / "raw" / "diviner" / "dlre_prp_south.lbl"
        metadata = parse_prp_south_label(label)
        self.assertEqual(metadata.product_id, DIVINER_PRODUCT_ID)
        self.assertEqual(metadata.data_set_id, DIVINER_DATASET_ID)
        self.assertEqual(metadata.record_bytes, 210)
        self.assertEqual(metadata.file_records, 2_880_000)

    def test_derived_features_keep_thermal_quantities_distinct(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            dataset = object.__new__(DivinerPrpSouth)
            dataset.table_path = Path(temp_dir) / "fixture.tab"
            dataset.table_path.write_bytes(b"fixture")
            dataset.metadata = DivinerPrpMetadata(
                product_id=DIVINER_PRODUCT_ID,
                product_version="2",
                data_set_id=DIVINER_DATASET_ID,
                record_bytes=210,
                file_records=2_880_000,
                product_creation_time="2018-02-21T12:00:00",
                source_crs="fixture CRS",
            )
            site = LunarLocation(site_id="fixture-site", name="Fixture", latitude=-85, longitude=0, data_status="SAMPLE")
            match = DivinerPrpMatch(
                site_id="fixture-site", triangle_longitude_deg=0, triangle_latitude_deg=-85,
                triangle_altitude_km=0, distance_km=0.1, annual_mean_temp_2cm_k=80,
                annual_max_surface_temp_k=240, ice_stability_depth_m=None,
            )
            observations = dataset.derive_features(site, match)
        self.assertEqual([item.feature_key for item in observations], [
            "subsurface_temp_2cm_k_annual_mean", "surface_temp_k_annual_max",
        ])
        self.assertTrue(all(item.data_status == "DERIVED" for item in observations))
        self.assertTrue(all(item.provenance.source_data_status == "REAL" for item in observations))
        self.assertNotIn("surface_temp_k", [item.feature_key for item in observations])
