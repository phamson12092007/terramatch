"""Idempotent integration of verified LOLA terrain features into Lunar records."""

from __future__ import annotations

from pathlib import Path

from app.schemas.lunar import LunarLocation
from app.services.lunar_data import DEFAULT_LUNAR_DATA_DIR, LunarDataRepository
from app.services.nasa.lola import LolaLdem16, TerrainCoverage, write_lola_metadata_and_manifest


def _has_same_derivation(record: LunarLocation, feature_key: str, source_checksum: str) -> bool:
    return any(
        observation.feature_key == feature_key
        and observation.data_status == "DERIVED"
        and observation.provenance.source_checksum_sha256 == source_checksum
        for observation in record.features
    )


def ingest_lola_terrain(
    repository: LunarDataRepository | None = None,
    data_dir: Path | None = None,
) -> dict:
    """Append, never replace, LOLA-derived features for covered Lunar sites."""
    repository = repository or LunarDataRepository(data_dir)
    base_dir = repository.base_dir
    dataset = LolaLdem16(
        base_dir / "raw" / "lola" / "ldem_16.img",
        base_dir / "raw" / "lola" / "ldem_16.lbl",
    )
    checksum = dataset.manifest([])["source"]["sha256"]
    coverage_report: list[TerrainCoverage] = []
    derived_counts: dict[str, int] = {}
    processed_sites = 0
    skipped_sites = 0
    for record in repository.list_locations():
        observations, coverage = dataset.derive_features(record)
        coverage_report.append(coverage)
        if not observations:
            skipped_sites += 1
            continue
        new_observations = [
            observation for observation in observations
            if not _has_same_derivation(record, observation.feature_key, checksum)
        ]
        if new_observations:
            repository.save_location(record.model_copy(update={"features": record.features + new_observations}))
            for observation in new_observations:
                derived_counts[observation.feature_key] = derived_counts.get(observation.feature_key, 0) + 1
        processed_sites += 1
    write_lola_metadata_and_manifest(dataset, base_dir, coverage_report)
    return {
        "processed_sites": processed_sites,
        "sites_without_sufficient_coverage": skipped_sites,
        "derived_feature_counts": derived_counts,
        "coverage_report": [coverage.__dict__ for coverage in coverage_report],
    }
