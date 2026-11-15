"""Ingest a small, traceable catalog of real SRTM terrain reference sites."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.schemas.earth import EarthLocationRecord
from app.services.earth_data import (
    EarthDataRepository,
    merge_srtm_regional_terrain,
    write_srtm_regional_manifest,
)
from app.services.nasa.srtm import SrtmClient


@dataclass(frozen=True)
class EarthTerrainCatalogSite:
    location_id: str
    name: str
    country_or_area: str
    latitude: float
    longitude: float
    description: str


# These coordinates are fixed catalog query points. Their environmental values
# come only from the retrieved SRTM tile; the names do not assert a NASA
# landing-site recommendation or a pre-scored lunar analogy.
EARTH_TERRAIN_CATALOG: tuple[EarthTerrainCatalogSite, ...] = (
    EarthTerrainCatalogSite(
        "atacama-desert-power-2024", "Atacama Desert", "Chile", -23.5, -68.2,
        "Existing TerraMatch reference point in the Atacama Desert.",
    ),
    EarthTerrainCatalogSite(
        "death-valley-srtm", "Death Valley", "United States", 36.2404, -116.8258,
        "Fixed terrain reference point in Death Valley for SRTM extraction.",
    ),
    EarthTerrainCatalogSite(
        "amboy-crater-srtm", "Amboy Crater", "United States", 34.5560, -115.7810,
        "Fixed volcanic-terrain reference point for SRTM extraction.",
    ),
    EarthTerrainCatalogSite(
        "mauna-kea-srtm", "Mauna Kea", "United States", 19.8207, -155.4681,
        "Fixed highland-volcanic terrain reference point for SRTM extraction.",
    ),
    EarthTerrainCatalogSite(
        "wadi-rum-srtm", "Wadi Rum", "Jordan", 29.5767, 35.4195,
        "Fixed arid-terrain reference point for SRTM extraction.",
    ),
)


def _is_real_regional_terrain(record: EarthLocationRecord) -> bool:
    expected = {
        "relative_elevation_m",
        "slope_deg_windowed",
        "terrain_roughness_m_windowed",
        "local_relief_m",
    }
    actual = {
        feature.key
        for feature in record.features
        if feature.data_status == "DERIVED"
        and feature.provenance.quality.get("source_data_status") == "REAL"
    }
    return expected.issubset(actual)


def _new_record(site: EarthTerrainCatalogSite) -> EarthLocationRecord:
    return EarthLocationRecord(
        location_id=site.location_id,
        name=site.name,
        country_or_area=site.country_or_area,
        latitude=site.latitude,
        longitude=site.longitude,
        description=site.description,
        data_status="MISSING",
        features=[],
        raw_response_path="",
        retrieved_at=datetime.now(timezone.utc),
    )


def ingest_earth_terrain_catalog(
    repository: EarthDataRepository | None = None,
    client: SrtmClient | None = None,
) -> dict:
    """Fetch only missing SRTM regional terrain; never replace a valid result."""
    repository = repository or EarthDataRepository()
    client = client or SrtmClient()
    existing = {record.location_id: record for record in repository.list_records()}
    ingested: list[str] = []
    skipped: list[str] = []
    no_coverage: list[dict] = []

    for site in EARTH_TERRAIN_CATALOG:
        record = existing.get(site.location_id, _new_record(site))
        if _is_real_regional_terrain(record):
            skipped.append(site.location_id)
            continue
        result = client.fetch_tile(site.latitude, site.longitude)
        raw_path = repository.save_binary_raw("srtm", site.location_id, ".hgt", result.raw_bytes)
        enriched, coverage = merge_srtm_regional_terrain(record, result)
        manifest = write_srtm_regional_manifest(repository, record, result, raw_path, coverage)
        if coverage.processing_status != "COVERED":
            repository.save(
                record,
                {"tile": result.tile_name, "source_url": result.source_url, "hgt_path": raw_path, "manifest": manifest, "coverage": coverage.__dict__},
                provider="srtm",
            )
            no_coverage.append({"location_id": site.location_id, "coverage": coverage.__dict__, "manifest": manifest})
            continue
        repository.save(
            enriched,
            {"tile": result.tile_name, "source_url": result.source_url, "hgt_path": raw_path, "manifest": manifest},
            provider="srtm",
        )
        ingested.append(site.location_id)

    return {"ingested": ingested, "skipped_existing": skipped, "no_coverage": no_coverage}
