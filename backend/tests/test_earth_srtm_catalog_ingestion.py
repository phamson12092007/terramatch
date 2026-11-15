import tempfile
import unittest
from pathlib import Path

import numpy as np

from app.services.earth_data import EarthDataRepository
from app.services.earth_srtm_catalog_ingestion import EARTH_TERRAIN_CATALOG, ingest_earth_terrain_catalog
from app.services.nasa.srtm import SrtmFetchResult, tile_name


def _raw_tile():
    values = np.tile(np.arange(1001, dtype=np.int16), (1001, 1))
    return values.astype(">i2").tobytes()


class _FakeSrtmClient:
    def fetch_tile(self, latitude, longitude):
        return SrtmFetchResult(
            tile_name(latitude, longitude),
            "https://example.test/SRTMGL1.hgt",
            _raw_tile(),
        )


class EarthTerrainCatalogIngestionTests(unittest.TestCase):
    def test_ingestion_persists_each_catalog_site_once(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            repository = EarthDataRepository(Path(temp_dir))
            client = _FakeSrtmClient()
            first = ingest_earth_terrain_catalog(repository, client)
            second = ingest_earth_terrain_catalog(repository, client)

            self.assertEqual(set(first["ingested"]), {site.location_id for site in EARTH_TERRAIN_CATALOG})
            self.assertEqual(second["ingested"], [])
            self.assertEqual(set(second["skipped_existing"]), {site.location_id for site in EARTH_TERRAIN_CATALOG})
            self.assertEqual(len(repository.list_records()), len(EARTH_TERRAIN_CATALOG))
