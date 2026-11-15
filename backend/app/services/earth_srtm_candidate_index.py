"""Build a dense, REAL-only SRTM terrain candidate index from downloaded tiles."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from app.schemas.earth import EarthLocationRecord
from app.services.earth_data import EarthDataRepository, merge_srtm_regional_terrain
from app.services.earth_srtm_catalog_ingestion import EARTH_TERRAIN_CATALOG
from app.services.nasa.srtm import SrtmFetchResult, SrtmTile


# Five centres per dimension give 25 independent, interior samples per tile.
# They are deliberately away from tile edges so the documented 9.476 km
# support can be complete without filling or clipping a DEM window.
GRID_FRACTIONS = (0.20, 0.35, 0.50, 0.65, 0.80)
REQUIRED_KEYS = {
    "relative_elevation_m",
    "slope_deg_windowed",
    "terrain_roughness_m_windowed",
    "local_relief_m",
}


def _has_real_terrain(record: EarthLocationRecord) -> bool:
    return REQUIRED_KEYS.issubset({
        feature.key for feature in record.features
        if feature.data_status == "DERIVED"
        and feature.provenance.quality.get("source_data_status") == "REAL"
    })


def _source_result(repository: EarthDataRepository, record: EarthLocationRecord) -> SrtmFetchResult:
    if not record.raw_response_path:
        raise ValueError(f"{record.location_id} has no stored SRTM source reference")
    response_path = repository.base_dir / record.raw_response_path
    try:
        source = json.loads(response_path.read_text(encoding="utf-8"))
        raw_path = repository.base_dir / source["hgt_path"]
        return SrtmFetchResult(
            tile_name=str(source["tile"]),
            source_url=str(source["source_url"]),
            raw_bytes=raw_path.read_bytes(),
        )
    except (OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise ValueError(f"{record.location_id} has an invalid stored SRTM source reference") from error


def _candidate_id(parent_id: str, row: int, column: int) -> str:
    return f"{parent_id}-g{row}{column}"


def _candidate_record(
    parent: EarthLocationRecord,
    tile: SrtmTile,
    row: int,
    column: int,
) -> EarthLocationRecord:
    return EarthLocationRecord(
        location_id=_candidate_id(parent.location_id, row, column),
        name=f"{parent.name} · SRTM sample {row + 1}-{column + 1}",
        country_or_area=parent.country_or_area,
        latitude=tile.south + GRID_FRACTIONS[row],
        longitude=tile.west + GRID_FRACTIONS[column],
        description=(
            f"REAL SRTMGL1.003 regional terrain sample within source tile {tile.name}; "
            f"derived from the same archived NASA tile as {parent.name}."
        ),
        data_status="MISSING",
        features=[],
        raw_response_path=parent.raw_response_path,
        retrieved_at=datetime.now(timezone.utc),
    )


def build_srtm_candidate_index(repository: EarthDataRepository | None = None) -> dict:
    """Index real regional-terrain samples from each downloaded catalog tile.

    No network request is made here. The function only samples HGT files that
    were previously downloaded from NASA and whose source manifests already
    exist. Existing REAL samples are retained unchanged, making rebuilds safe.
    """
    repository = repository or EarthDataRepository()
    records = {record.location_id: record for record in repository.list_records()}
    created: list[str] = []
    skipped: list[str] = []
    no_coverage: list[str] = []

    for site in EARTH_TERRAIN_CATALOG:
        parent = records.get(site.location_id)
        if parent is None or not _has_real_terrain(parent):
            continue
        result = _source_result(repository, parent)
        tile = SrtmTile.from_hgt(result.tile_name, result.raw_bytes)
        for row in range(len(GRID_FRACTIONS)):
            for column in range(len(GRID_FRACTIONS)):
                candidate_id = _candidate_id(parent.location_id, row, column)
                existing = records.get(candidate_id)
                if existing and _has_real_terrain(existing):
                    skipped.append(candidate_id)
                    continue
                candidate = _candidate_record(parent, tile, row, column)
                enriched, coverage = merge_srtm_regional_terrain(candidate, result)
                if coverage.processing_status != "COVERED":
                    no_coverage.append(candidate_id)
                    continue
                repository.save_derived(enriched)
                records[candidate_id] = enriched
                created.append(candidate_id)

    return {
        "created_count": len(created),
        "skipped_existing_count": len(skipped),
        "no_coverage_count": len(no_coverage),
        "created_location_ids": created,
    }
