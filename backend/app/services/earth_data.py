"""Storage and transformation boundary for real Earth observations.

This module intentionally does not call the similarity engine. Acquisition is
kept separate so simulated CSV search results remain stable until later stages.
"""

from __future__ import annotations

import json
import os
import re
import csv
import unicodedata
import hashlib
from dataclasses import dataclass
from itertools import combinations
from io import StringIO
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.earth import (
    EarthDataFetchRequest,
    EarthFeature,
    EarthLocationRecord,
    FeatureProvenance,
)
from app.services.nasa.power import PowerClient, PowerDailyResult
from app.services.nasa.modis import MODIS_PRODUCT
from app.services.nasa.srtm import SrtmFetchResult, SrtmTerrainCoverage, SrtmTile
from app.services.feature_registry import FEATURE_REGISTRY


DEFAULT_EARTH_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "earth"
LOCATION_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}$")
REGIONAL_TERRAIN_SUPPORT_WIDTH_M = 9476.05


@dataclass(frozen=True)
class LoadedEarthRecord:
    path: Path
    record: EarthLocationRecord


@dataclass(frozen=True)
class RepositoryScan:
    valid_records: tuple[LoadedEarthRecord, ...]
    invalid_diagnostics: tuple[dict, ...]


def _normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    return " ".join("".join(character for character in value if not unicodedata.combining(character)).casefold().split())


def _acquisition_periods(record: EarthLocationRecord) -> set[tuple[str, str]]:
    return {
        (feature.provenance.acquisition_start.isoformat(), feature.provenance.acquisition_end.isoformat())
        for feature in record.features
    }


class EarthDataRepository:
    def __init__(self, base_dir: Path | None = None):
        configured_dir = os.getenv("TERRAMATCH_EARTH_DATA_DIR")
        self.base_dir = base_dir or (
            Path(configured_dir) if configured_dir else DEFAULT_EARTH_DATA_DIR
        )
        self.raw_dir = self.base_dir / "raw" / "power"
        self.processed_dir = self.base_dir / "processed"

    def save(self, record: EarthLocationRecord, raw_response: dict, provider: str = "power") -> EarthLocationRecord:
        raw_dir = self.base_dir / "raw" / provider
        raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        timestamp = record.retrieved_at.strftime("%Y%m%dT%H%M%SZ")
        raw_path = raw_dir / f"{record.location_id}-{timestamp}.json"
        self._write_json(raw_path, raw_response)

        stored_record = record.model_copy(
            update={"raw_response_path": raw_path.relative_to(self.base_dir).as_posix()}
        )
        self._write_json(
            self.processed_dir / f"{record.location_id}.json",
            stored_record.model_dump(mode="json"),
        )
        return stored_record

    def save_derived(self, record: EarthLocationRecord) -> EarthLocationRecord:
        """Persist a derived record that references an already-stored raw source.

        Candidate-index points share an immutable NASA source tile with their
        parent acquisition. Duplicating the binary or a JSON wrapper per point
        would obscure that lineage and waste storage.
        """
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self._write_json(
            self.processed_dir / f"{record.location_id}.json",
            record.model_dump(mode="json"),
        )
        return record

    def _scan(self) -> RepositoryScan:
        if not self.processed_dir.exists():
            return RepositoryScan((), ())
        valid_records: list[LoadedEarthRecord] = []
        invalid_diagnostics: list[dict] = []
        for path in sorted(self.processed_dir.glob("*.json")):
            try:
                record = EarthLocationRecord.model_validate_json(path.read_text(encoding="utf-8"))
            except (OSError, ValueError, ValidationError) as error:
                invalid_diagnostics.append({
                    "path": path.name,
                    "status": "INVALID",
                    "reason": str(error),
                })
                continue
            valid_records.append(LoadedEarthRecord(path=path, record=record))
        return RepositoryScan(tuple(valid_records), tuple(invalid_diagnostics))

    def list_records(self) -> list[EarthLocationRecord]:
        """Return schema-valid processed Earth records and omit invalid files.

        Invalid files are never treated as valid and remain inspectable via
        ``get_invalid_record_diagnostics``.
        """
        return [loaded.record for loaded in self._scan().valid_records]

    def get_record(self, location_id: str) -> EarthLocationRecord:
        if not LOCATION_ID_PATTERN.fullmatch(location_id):
            raise HTTPException(status_code=404, detail="Earth location not found")
        scan = self._scan()
        records = [loaded.record for loaded in scan.valid_records if loaded.record.location_id == location_id]
        if not records:
            raise HTTPException(status_code=404, detail="Earth location not found")
        if len(records) > 1:
            raise HTTPException(status_code=409, detail="Duplicate processed Earth location ID; inspect repository diagnostics")
        return records[0]

    def get_invalid_record_diagnostics(self) -> list[dict]:
        return list(self._scan().invalid_diagnostics)

    def get_duplicate_record_diagnostics(self) -> list[dict]:
        """Describe duplicate/related records without deleting or rewriting files."""
        diagnostics: list[dict] = []
        for left, right in combinations(self._scan().valid_records, 2):
            matching_fields = []
            if left.record.location_id == right.record.location_id:
                matching_fields.append("location_id")
            if _normalize_name(left.record.name) == _normalize_name(right.record.name):
                matching_fields.append("normalized_name")
            if left.record.latitude == right.record.latitude and left.record.longitude == right.record.longitude:
                matching_fields.append("coordinates")
            if not matching_fields:
                continue
            left_periods, right_periods = _acquisition_periods(left.record), _acquisition_periods(right.record)
            shared_periods = left_periods & right_periods
            feature_values_match = left.record.features == right.record.features
            if not shared_periods and "location_id" not in matching_fields:
                classification = "RELATED_DIFFERENT_PERIOD"
                reason = "Records describe the same name or coordinates but have different acquisition periods; they are retained separately."
            elif feature_values_match and shared_periods:
                classification = "EXACT_DUPLICATE"
                reason = "Matching identity fields, acquisition period, and feature values."
            else:
                classification = "POTENTIAL_CONFLICT"
                reason = "Matching identity fields with differing features or overlapping acquisition periods."
            diagnostics.append({
                "classification": classification,
                "reason": reason,
                "paths": [left.path.name, right.path.name],
                "location_ids": [left.record.location_id, right.record.location_id],
                "matching_fields": matching_fields,
                "shared_acquisition_periods": sorted(shared_periods),
                "differing_fields": [] if feature_values_match else ["features"],
            })
        return diagnostics

    def get_feature_availability(self, location_id: str) -> list[dict]:
        record = self.get_record(location_id)
        availability = []
        for feature in record.features:
            registered = FEATURE_REGISTRY.get(feature.key)
            availability.append({
                "key": feature.key,
                "value": feature.value,
                "unit": feature.unit,
                "data_status": feature.data_status,
                "registered": registered is not None,
                "source": feature.provenance.source_organization,
                "acquisition_start": feature.provenance.acquisition_start.isoformat(),
                "acquisition_end": feature.provenance.acquisition_end.isoformat(),
                "provenance": feature.provenance.model_dump(mode="json"),
                "quality": feature.provenance.quality,
            })
        return availability

    def get_feature_availability_across_locations(self) -> dict[str, dict]:
        summary = {
            key: {"registered": True, "locations_with_real_observation": 0, "locations_with_any_observation": 0}
            for key in FEATURE_REGISTRY
        }
        for record in self.list_records():
            for feature in record.features:
                item = summary.setdefault(feature.key, {"registered": False, "locations_with_real_observation": 0, "locations_with_any_observation": 0})
                item["locations_with_any_observation"] += 1
                if (
                    feature.value is not None
                    and (feature.data_status == "REAL" or (
                        feature.data_status == "DERIVED"
                        and feature.provenance.quality.get("source_data_status") == "REAL"
                    ))
                ):
                    item["locations_with_real_observation"] += 1
        return summary

    def count_locations_by_data_status(self) -> dict[str, int]:
        counts = {status: 0 for status in ("REAL", "PARTIAL", "MISSING", "SIMULATED")}
        for record in self.list_records():
            counts[record.data_status] += 1
        return counts

    def count_real_observations_by_feature(self) -> dict[str, int]:
        return {
            key: details["locations_with_real_observation"]
            for key, details in self.get_feature_availability_across_locations().items()
        }

    def get_diagnostics(self) -> dict:
        scan = self._scan()
        return {
            "valid_record_count": len(scan.valid_records),
            "invalid_records": list(scan.invalid_diagnostics),
            "duplicates": self.get_duplicate_record_diagnostics(),
            "location_status_counts": self.count_locations_by_data_status(),
            "real_observation_counts": self.count_real_observations_by_feature(),
        }

    def save_binary_raw(self, provider: str, location_id: str, suffix: str, content: bytes) -> str:
        raw_dir = self.base_dir / "raw" / provider
        raw_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        path = raw_dir / f"{location_id}-{timestamp}{suffix}"
        path.write_bytes(content)
        return path.relative_to(self.base_dir).as_posix()

    @staticmethod
    def _write_json(path: Path, content: object) -> None:
        temp_path = path.with_suffix(f"{path.suffix}.tmp")
        temp_path.write_text(json.dumps(content, indent=2, ensure_ascii=False), encoding="utf-8")
        temp_path.replace(path)


def merge_modis_point_csv(
    record: EarthLocationRecord,
    csv_bytes: bytes,
    source_url: str,
    request: EarthDataFetchRequest,
) -> EarthLocationRecord:
    """Add QA-validated MOD11A1 LST summaries to an existing Earth record."""
    try:
        rows = list(csv.DictReader(StringIO(csv_bytes.decode("utf-8-sig"))))
    except UnicodeDecodeError as error:
        raise ValueError("AppEEARS output is not UTF-8 CSV") from error
    if not rows:
        raise ValueError("AppEEARS output contains no point observations")

    def column(row: dict, suffix: str):
        return next((key for key in row if key.endswith(suffix)), None)

    day_values: list[float] = []
    night_values: list[float] = []
    counts = {"total_rows": len(rows), "day_good": 0, "day_rejected": 0, "night_good": 0, "night_rejected": 0}
    for row in rows:
        day_column, day_quality = column(row, "LST_Day_1km"), column(row, "QC_Day")
        night_column, night_quality = column(row, "LST_Night_1km"), column(row, "QC_Night")
        for value_column, quality_column, values, good_key, rejected_key in (
            (day_column, day_quality, day_values, "day_good", "day_rejected"),
            (night_column, night_quality, night_values, "night_good", "night_rejected"),
        ):
            try:
                packed_value = int(float(row[value_column])) if value_column else 0
                qa_value = int(float(row[quality_column])) if quality_column else 255
            except (TypeError, ValueError):
                counts[rejected_key] += 1
                continue
            # MOD11A1: mandatory QA bits 0-1 == 00 and data-quality bits 2-3 == 00.
            if packed_value == 0 or (qa_value & 0b11) != 0 or ((qa_value >> 2) & 0b11) != 0:
                counts[rejected_key] += 1
                continue
            values.append(packed_value * 0.02)  # MOD11A1 scale factor; output is Kelvin.
            counts[good_key] += 1

    retrieved_at = datetime.now(timezone.utc)
    def feature(key: str, label: str, values: list[float], qa_prefix: str) -> EarthFeature:
        value = sum(values) / len(values) if values else None
        return EarthFeature(
            key=key,
            label=label,
            value=value,
            unit="K",
            data_status="REAL" if value is not None else "MISSING",
            provenance=FeatureProvenance(
                source_organization="NASA EOSDIS / LP DAAC via AppEEARS",
                dataset_name="MODIS/Terra Land Surface Temperature/Emissivity Daily L3 Global 1km SIN Grid V061",
                parameter_code="LST_Day_1km" if qa_prefix == "day" else "LST_Night_1km",
                source_url=source_url,
                acquisition_start=request.start_date,
                acquisition_end=request.end_date,
                spatial_resolution="1 km (MOD11A1.061 sinusoidal grid)",
                temporal_resolution="Daily clear-sky point sample",
                original_unit="Packed uint16 × 0.02 K",
                processed_unit="K",
                processing_method="MOD11A1 packed LST values multiplied by 0.02; only mandatory-QA=00 and data-quality=00 observations are retained.",
                quality={"valid_observations": counts[f"{qa_prefix}_good"], "rejected_observations": counts[f"{qa_prefix}_rejected"], "product": MODIS_PRODUCT},
                retrieved_at=retrieved_at,
            ),
        )

    modis_features = [
        feature("land_surface_temperature_day_k_mean", "Mean daytime land-surface temperature", day_values, "day"),
        feature("land_surface_temperature_night_k_mean", "Mean nighttime land-surface temperature", night_values, "night"),
    ]
    existing_features = [item for item in record.features if not item.key.startswith("land_surface_temperature_")]
    all_features = existing_features + modis_features
    available = sum(item.value is not None for item in all_features)
    status = "REAL" if available == len(all_features) else "PARTIAL" if available else "MISSING"
    return record.model_copy(update={"features": all_features, "data_status": status, "retrieved_at": retrieved_at})


def merge_srtm_terrain(record: EarthLocationRecord, result: SrtmFetchResult) -> EarthLocationRecord:
    """Calculate elevation, 3×3-window slope, and roughness without filling voids."""
    retrieved_at = datetime.now(timezone.utc)
    values = SrtmTile.from_hgt(result.tile_name, result.raw_bytes).terrain_at(record.latitude, record.longitude)
    definitions = [
        ("elevation_m", "Elevation", values["elevation_m"], "m"),
        ("slope_deg", "Local terrain slope", values["slope_deg"], "°"),
        ("terrain_roughness_m", "Local terrain roughness", values["terrain_roughness_m"], "m"),
    ]
    terrain_features = [
        EarthFeature(
            key=key,
            label=label,
            value=value,
            unit=unit,
            data_status="REAL",
            provenance=FeatureProvenance(
                source_organization="NASA EOSDIS / LP DAAC",
                dataset_name="NASA Shuttle Radar Topography Mission Global 1 arc second V003 (SRTMGL1.003)",
                parameter_code="SRTMGL1",
                source_url=result.source_url,
                acquisition_start=datetime(2000, 2, 11).date(),
                acquisition_end=datetime(2000, 2, 21).date(),
                spatial_resolution="1 arc-second (~30 m at the equator)",
                temporal_resolution="Static DEM from the SRTM mission",
                original_unit="m",
                processed_unit=unit,
                processing_method="Elevation sampled at the HGT grid point; slope is central-difference gradient over a valid 3×3 neighborhood; roughness is population standard deviation of that neighborhood.",
                quality={"tile": result.tile_name, "void_handling": "Any void in the 3×3 window rejects the calculation; no interpolation is performed."},
                retrieved_at=retrieved_at,
            ),
        )
        for key, label, value, unit in definitions
    ]
    existing = [item for item in record.features if item.key not in {"elevation_m", "slope_deg", "terrain_roughness_m"}]
    features = existing + terrain_features
    available = sum(item.value is not None for item in features)
    status = "REAL" if available == len(features) else "PARTIAL" if available else "MISSING"
    return record.model_copy(update={"features": features, "data_status": status, "retrieved_at": retrieved_at})


def merge_srtm_regional_terrain(
    record: EarthLocationRecord,
    result: SrtmFetchResult,
    *,
    support_width_m: float = REGIONAL_TERRAIN_SUPPORT_WIDTH_M,
) -> tuple[EarthLocationRecord, SrtmTerrainCoverage]:
    """Append Stage 6C-compatible terrain features from one verified HGT tile.

    This does not modify the legacy point/3×3 SRTM features. If coverage is
    incomplete, it returns the original record and diagnostic rather than
    inventing a partial metric.
    """
    metrics, coverage = SrtmTile.from_hgt(result.tile_name, result.raw_bytes).regional_terrain_at(
        record.latitude, record.longitude, support_width_m,
    )
    if metrics is None:
        return record, coverage
    retrieved_at = datetime.now(timezone.utc)
    acquisition_start = datetime(2000, 2, 11).date()
    acquisition_end = datetime(2000, 2, 21).date()
    coverage_details = {
        "source_data_status": "REAL",
        "coverage": coverage.__dict__,
        "source_crs": "Geographic latitude/longitude grid (SRTM HGT)",
        "processing_crs": "Local metric tangent-plane approximation at site latitude",
        "resampling": "None; native HGT samples only.",
        "void_handling": "Any NoData sample in the required window rejects all regional metrics; no interpolation.",
        "vertical_datum": "Not inferred from HGT bytes; consult the verified SRTMGL1 product documentation for vertical reference.",
    }
    definitions = (
        ("relative_elevation_m", "Relative local elevation", metrics["relative_elevation_m"], "m"),
        ("slope_deg_windowed", "Windowed terrain slope", metrics["slope_deg_windowed"], "°"),
        ("terrain_roughness_m_windowed", "Windowed terrain roughness", metrics["terrain_roughness_m_windowed"], "m"),
        ("local_relief_m", "Local relief", metrics["local_relief_m"], "m"),
    )
    terrain_features = [
        EarthFeature(
            key=key,
            label=label,
            value=value,
            unit=unit,
            data_status="DERIVED",
            provenance=FeatureProvenance(
                source_organization="NASA EOSDIS / LP DAAC",
                dataset_name="NASA Shuttle Radar Topography Mission Global 1 arc second V003 (SRTMGL1.003)",
                parameter_code="SRTMGL1.003",
                source_url=result.source_url,
                acquisition_start=acquisition_start,
                acquisition_end=acquisition_end,
                spatial_resolution=(
                    f"Native 1 arc-second HGT; local spacing {coverage.east_west_resolution_m:.3f} m east-west, "
                    f"{coverage.north_south_resolution_m:.3f} m north-south"
                ),
                temporal_resolution="Static DEM from the SRTM mission",
                original_unit="m",
                processed_unit=unit,
                processing_method=(
                    f"Native complete regional window targeting {support_width_m:.2f} m physical support; "
                    "relative elevation is center minus median, slope is a least-squares metric-plane gradient, "
                    "roughness is plane-residual population standard deviation, and relief is max minus min."
                ),
                quality=coverage_details,
                retrieved_at=retrieved_at,
            ),
        )
        for key, label, value, unit in definitions
    ]
    replaced_keys = {item[0] for item in definitions}
    features = [item for item in record.features if item.key not in replaced_keys] + terrain_features
    available = sum(item.value is not None for item in features)
    status = "REAL" if available == len(features) else "PARTIAL" if available else "MISSING"
    return record.model_copy(update={"features": features, "data_status": status, "retrieved_at": retrieved_at}), coverage


def write_srtm_regional_manifest(
    repository: EarthDataRepository,
    record: EarthLocationRecord,
    result: SrtmFetchResult,
    raw_path: str,
    coverage: SrtmTerrainCoverage,
    *,
    support_width_m: float = REGIONAL_TERRAIN_SUPPORT_WIDTH_M,
) -> str:
    """Persist public provenance without exposing an absolute filesystem path."""
    manifest_dir = repository.base_dir / "manifests"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc)
    manifest_path = manifest_dir / f"srtm-regional-{record.location_id}-{timestamp.strftime('%Y%m%dT%H%M%SZ')}.json"
    payload = {
        "provider": "NASA EOSDIS / LP DAAC",
        "product_id": "SRTMGL1.003",
        "tile_name": result.tile_name,
        "source_url": result.source_url,
        "download_timestamp": timestamp.isoformat(),
        "raw_file": raw_path,
        "sha256": hashlib.sha256(result.raw_bytes).hexdigest(),
        "source_crs": "Geographic latitude/longitude grid (SRTM HGT)",
        "vertical_datum": "Not inferred from HGT bytes; consult verified product documentation.",
        "processing_crs": "Local metric tangent-plane approximation at site latitude",
        "processing_parameters": {"support_width_m": support_width_m, "resampling": "None", "no_data_handling": "Reject incomplete windows"},
        "coverage": coverage.__dict__,
        "output_location_id": record.location_id,
        "output_feature_keys": ["relative_elevation_m", "slope_deg_windowed", "terrain_roughness_m_windowed", "local_relief_m"],
    }
    repository._write_json(manifest_path, payload)
    return manifest_path.relative_to(repository.base_dir).as_posix()


def acquire_power_data(
    request: EarthDataFetchRequest,
    client: PowerClient | None = None,
    repository: EarthDataRepository | None = None,
) -> EarthLocationRecord:
    client = client or PowerClient()
    repository = repository or EarthDataRepository()
    result = client.fetch_daily_point(
        request.latitude,
        request.longitude,
        request.start_date,
        request.end_date,
    )
    record = build_power_record(request, result)
    return repository.save(record, result.raw_response)


def build_power_record(
    request: EarthDataFetchRequest,
    result: PowerDailyResult,
) -> EarthLocationRecord:
    summaries = result.parameter_summaries
    retrieved_at = datetime.fromisoformat(result.retrieved_at_iso)
    feature_definitions = [
        (
            "air_temperature_2m_c_mean",
            "Mean air temperature at 2 m",
            "T2M",
            "°C",
            PowerClient.mean(summaries["T2M"]),
            "Arithmetic mean of valid NASA POWER daily T2M values; this is air temperature, not land-surface temperature.",
        ),
        (
            "air_temperature_2m_c_min",
            "Minimum air temperature at 2 m",
            "T2M_MIN",
            "°C",
            PowerClient.minimum(summaries["T2M_MIN"]),
            "Minimum of valid NASA POWER daily T2M_MIN values; this is air temperature, not land-surface temperature.",
        ),
        (
            "air_temperature_2m_c_max",
            "Maximum air temperature at 2 m",
            "T2M_MAX",
            "°C",
            PowerClient.maximum(summaries["T2M_MAX"]),
            "Maximum of valid NASA POWER daily T2M_MAX values; this is air temperature, not land-surface temperature.",
        ),
        (
            "all_sky_surface_shortwave_down_mj_m2_day_mean",
            "Mean all-sky surface shortwave downward radiation",
            "ALLSKY_SFC_SW_DWN",
            "MJ/m²/day",
            PowerClient.mean(summaries["ALLSKY_SFC_SW_DWN"]),
            "Arithmetic mean of valid daily radiation values. This is not local terrain illumination, shadow duration, or solar incidence angle.",
        ),
    ]

    features = []
    for key, label, code, unit, value, processing_method in feature_definitions:
        summary = summaries[code]
        feature_status = "REAL" if value is not None else "MISSING"
        features.append(
            EarthFeature(
                key=key,
                label=label,
                value=value,
                unit=unit,
                data_status=feature_status,
                provenance=FeatureProvenance(
                    source_organization="NASA POWER",
                    dataset_name="NASA POWER Daily Point API",
                    parameter_code=code,
                    source_url=result.request_url,
                    acquisition_start=request.start_date,
                    acquisition_end=request.end_date,
                    spatial_resolution="Original NASA POWER source grid; see POWER response metadata.",
                    temporal_resolution="Daily, UTC",
                    original_unit=unit,
                    processed_unit=unit,
                    processing_method=processing_method,
                    quality={
                        "valid_days": len(summary.values),
                        "missing_days": summary.missing_days,
                        "fill_value_rule": "Values equal to POWER fill value or <= -900 are excluded.",
                    },
                    retrieved_at=retrieved_at,
                ),
            )
        )

    available_features = sum(feature.value is not None for feature in features)
    data_status = "REAL" if available_features == len(features) else "PARTIAL" if available_features else "MISSING"
    return EarthLocationRecord(
        location_id=request.location_id,
        name=request.name,
        country_or_area=request.country_or_area,
        latitude=request.latitude,
        longitude=request.longitude,
        description=request.description,
        data_status=data_status,
        features=features,
        raw_response_path="",
        retrieved_at=retrieved_at,
    )
