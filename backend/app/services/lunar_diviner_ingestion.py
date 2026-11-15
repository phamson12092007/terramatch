"""Idempotently append verified Diviner PRP observations to south-polar sites."""

from __future__ import annotations

import json
from pathlib import Path

from app.schemas.lunar import LunarLocation
from app.services.lunar_data import LunarDataRepository
from app.services.nasa.diviner import DivinerPrpSouth, SOUTH_POLAR_MIN_LATITUDE


def _has_same_derivation(record: LunarLocation, feature_key: str, source_checksum: str) -> bool:
    return any(
        observation.feature_key == feature_key
        and observation.data_status == "DERIVED"
        and observation.provenance.source_checksum_sha256 == source_checksum
        for observation in record.features
    )


def ingest_diviner_south_polar_prp(
    repository: LunarDataRepository | None = None,
    data_dir: Path | None = None,
) -> dict:
    """Append (never replace) NASA Diviner-derived observations for polar sites."""
    repository = repository or LunarDataRepository(data_dir)
    base_dir = repository.base_dir
    dataset = DivinerPrpSouth(
        base_dir / "raw" / "diviner" / "dlre_prp_south.tab",
        base_dir / "raw" / "diviner" / "dlre_prp_south.lbl",
    )
    eligible_sites = [site for site in repository.list_locations() if site.latitude <= SOUTH_POLAR_MIN_LATITUDE]
    matches = dataset.nearest_matches(eligible_sites)
    checksum = dataset.manifest({})["source"]["sha256"]
    processed_sites = 0
    derived_counts: dict[str, int] = {}
    for record in eligible_sites:
        match = matches.get(record.site_id)
        if not match:
            continue
        observations = dataset.derive_features(record, match)
        new_observations = [
            item for item in observations
            if not _has_same_derivation(record, item.feature_key, checksum)
        ]
        if new_observations:
            repository.save_location(record.model_copy(update={"features": record.features + new_observations}))
            for observation in new_observations:
                derived_counts[observation.feature_key] = derived_counts.get(observation.feature_key, 0) + 1
        processed_sites += 1
    manifest_dir = base_dir / "manifests"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    (manifest_dir / "diviner_prp_south_ingestion_manifest.json").write_text(
        json.dumps(dataset.manifest(matches), indent=2), encoding="utf-8",
    )
    return {
        "eligible_sites": len(eligible_sites),
        "processed_sites": processed_sites,
        "derived_feature_counts": derived_counts,
        "matched_sites": sorted(matches),
    }
