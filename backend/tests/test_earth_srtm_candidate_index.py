import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from app.schemas.earth import EarthLocationRecord
from app.services.earth_data import EarthDataRepository, merge_srtm_regional_terrain
from app.services.earth_srtm_candidate_index import build_srtm_candidate_index
from app.services.nasa.srtm import SrtmFetchResult


def _raw_tile():
    values = np.tile(np.arange(1001, dtype=np.int16), (1001, 1))
    return values.astype(">i2").tobytes()


class EarthSrtmCandidateIndexTests(unittest.TestCase):
    def test_builds_real_derived_samples_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            repository = EarthDataRepository(Path(temp_dir))
            source = SrtmFetchResult("N00E000", "https://example.test/N00E000.hgt", _raw_tile())
            raw_path = repository.save_binary_raw("srtm", "atacama-desert-power-2024", ".hgt", source.raw_bytes)
            raw_json = repository.base_dir / "raw" / "srtm" / "atacama-source.json"
            raw_json.parent.mkdir(parents=True, exist_ok=True)
            raw_json.write_text(json.dumps({"tile": source.tile_name, "source_url": source.source_url, "hgt_path": raw_path}), encoding="utf-8")
            parent = EarthLocationRecord(
                location_id="atacama-desert-power-2024", name="Atacama Desert", latitude=0.5, longitude=0.5,
                data_status="MISSING", features=[], raw_response_path="raw/srtm/atacama-source.json", retrieved_at=datetime.now(timezone.utc),
            )
            enriched, coverage = merge_srtm_regional_terrain(parent, source, support_width_m=30_000)
            self.assertEqual(coverage.processing_status, "COVERED")
            repository.save_derived(enriched)

            # Limit the test to its one prepared catalog parent.
            from unittest.mock import patch
            from app.services.earth_srtm_candidate_index import EARTH_TERRAIN_CATALOG
            with patch("app.services.earth_srtm_candidate_index.EARTH_TERRAIN_CATALOG", (EARTH_TERRAIN_CATALOG[0],)):
                first = build_srtm_candidate_index(repository)
                second = build_srtm_candidate_index(repository)
            self.assertEqual(first["created_count"], 25)
            self.assertEqual(second["created_count"], 0)
            self.assertEqual(second["skipped_existing_count"], 25)
