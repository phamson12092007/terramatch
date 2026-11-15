"""File-backed repository for Lunar reference data.

Reading never rewrites source records. Invalid files are omitted from normal
queries but remain visible through diagnostics.
"""

from __future__ import annotations

import os
import json
from dataclasses import dataclass
from math import isfinite
from pathlib import Path

from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.lunar import LunarDataStatus, LunarFeatureObservation, LunarLocation
from app.services.feature_registry import resolve_comparison_criterion


DEFAULT_LUNAR_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "lunar"


@dataclass(frozen=True)
class LoadedLunarRecord:
    path: Path
    record: LunarLocation


@dataclass(frozen=True)
class LunarRepositoryScan:
    valid_records: tuple[LoadedLunarRecord, ...]
    invalid_diagnostics: tuple[dict, ...]


@dataclass(frozen=True)
class LunarTargetResolution:
    target_features: dict[str, float]
    diagnostics: list[dict]


class LunarDataRepository:
    def __init__(self, base_dir: Path | None = None):
        configured_dir = os.getenv("TERRAMATCH_LUNAR_DATA_DIR")
        self.base_dir = base_dir or (Path(configured_dir) if configured_dir else DEFAULT_LUNAR_DATA_DIR)
        self.processed_sites_dir = self.base_dir / "processed" / "sites"

    def _scan(self) -> LunarRepositoryScan:
        if not self.processed_sites_dir.exists():
            return LunarRepositoryScan((), ())
        valid_records: list[LoadedLunarRecord] = []
        invalid_diagnostics: list[dict] = []
        for path in sorted(self.processed_sites_dir.glob("*.json")):
            try:
                record = LunarLocation.model_validate_json(path.read_text(encoding="utf-8"))
            except (OSError, ValueError, ValidationError) as error:
                invalid_diagnostics.append({"record": path.name, "status": "INVALID", "reason": str(error)})
                continue
            valid_records.append(LoadedLunarRecord(path=path, record=record))
        return LunarRepositoryScan(tuple(valid_records), tuple(invalid_diagnostics))

    def list_locations(self) -> list[LunarLocation]:
        return [loaded.record for loaded in self._scan().valid_records]

    def save_location(self, record: LunarLocation) -> LunarLocation:
        """Persist an explicitly prepared record without touching raw source files."""
        self.processed_sites_dir.mkdir(parents=True, exist_ok=True)
        target = self.processed_sites_dir / f"{record.site_id}.json"
        temporary = target.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(record.model_dump(mode="json"), indent=2), encoding="utf-8")
        temporary.replace(target)
        return record

    def get_invalid_record_diagnostics(self) -> list[dict]:
        return list(self._scan().invalid_diagnostics)

    def get_location(self, site_id: str) -> LunarLocation:
        records = [record for record in self.list_locations() if record.site_id == site_id]
        if not records:
            raise HTTPException(status_code=404, detail="Lunar site not found")
        if len(records) > 1:
            raise HTTPException(status_code=409, detail="Duplicate Lunar site ID; inspect repository health")
        return records[0]

    def get_observations(self, site_id: str, feature_key: str | None = None) -> list[LunarFeatureObservation]:
        observations = self.get_location(site_id).features
        if feature_key is None:
            return observations
        return [observation for observation in observations if observation.feature_key == feature_key]

    def get_terrain_observations(self, site_id: str) -> list[LunarFeatureObservation]:
        terrain_keys = {
            "relative_elevation_m",
            "slope_deg_windowed",
            "terrain_roughness_m_windowed",
            "local_relief_m",
        }
        return [item for item in self.get_observations(site_id) if item.feature_key in terrain_keys]

    def resolve_real_similarity_targets(
        self, site_id: str, criteria_weights: dict[str, float],
    ) -> LunarTargetResolution:
        """Resolve score inputs from repository observations, never request values.

        REAL observations are allowed directly. DERIVED observations are allowed
        only when their provenance identifies a REAL source. SAMPLE values never
        enter a REAL_ONLY search, even if a client submits matching numbers.
        """
        record = self.get_location(site_id)
        target_features: dict[str, float] = {}
        diagnostics: list[dict] = []
        for requested_key in criteria_weights:
            definition = resolve_comparison_criterion(requested_key)
            lunar_key = definition.lunar_feature_key
            detail = {
                "criterion": requested_key,
                "earth_feature_key": definition.key,
                "lunar_feature_key": lunar_key,
                "unit": definition.unit,
            }
            if not lunar_key:
                diagnostics.append({
                    **detail,
                    "status": "NO_COMPATIBLE_LUNAR_TARGET",
                    "reason": definition.unavailable_reason or "The registry has no compatible lunar target feature.",
                })
                continue
            observations = [item for item in record.features if item.feature_key == lunar_key]
            real_backed = [
                item for item in observations
                if item.data_status == "REAL"
                or (item.data_status == "DERIVED" and item.provenance.source_data_status == "REAL")
            ]
            if not real_backed:
                source_statuses = sorted({item.data_status for item in observations})
                diagnostics.append({
                    **detail,
                    "status": "LUNAR_TARGET_NOT_REAL",
                    "reason": (
                        "Only SAMPLE lunar observations are available; REAL_ONLY searches require a REAL observation "
                        "or a DERIVED observation with REAL provenance."
                        if observations else "This lunar site has no observation for the required target feature."
                    ),
                    "observed_statuses": source_statuses,
                })
                continue
            matching_unit = [item for item in real_backed if item.unit == definition.unit]
            if not matching_unit:
                diagnostics.append({
                    **detail,
                    "status": "LUNAR_TARGET_UNIT_MISMATCH",
                    "reason": f"Lunar observations use {sorted({item.unit for item in real_backed})}; expected {definition.unit}.",
                })
                continue
            valid = [item for item in matching_unit if item.value is not None and isfinite(item.value)]
            if not valid:
                diagnostics.append({
                    **detail,
                    "status": "LUNAR_TARGET_INVALID_VALUE",
                    "reason": "No REAL-backed lunar observation has a finite numeric value.",
                })
                continue
            selected = valid[-1]
            target_features[lunar_key] = float(selected.value)
        return LunarTargetResolution(target_features=target_features, diagnostics=diagnostics)

    def get_latest_observation(self, site_id: str, feature_key: str) -> LunarFeatureObservation | None:
        dated = [
            observation for observation in self.get_observations(site_id, feature_key)
            if observation.observation_time is not None
        ]
        return max(dated, key=lambda observation: observation.observation_time) if dated else None

    def get_observations_by_status(self, status: LunarDataStatus) -> list[LunarFeatureObservation]:
        return [
            observation
            for record in self.list_locations()
            for observation in record.features
            if observation.data_status == status
        ]

    def feature_availability(self) -> dict[str, dict]:
        availability: dict[str, dict] = {}
        for record in self.list_locations():
            for observation in record.features:
                item = availability.setdefault(observation.feature_key, {
                    "location_count": 0,
                    "observation_count": 0,
                    "status_counts": {status: 0 for status in ("SAMPLE", "REAL", "DERIVED")},
                    "units": [],
                })
                item["observation_count"] += 1
                item["status_counts"][observation.data_status] += 1
                if record.site_id not in item.setdefault("_site_ids", set()):
                    item["_site_ids"].add(record.site_id)
                if observation.unit not in item["units"]:
                    item["units"].append(observation.unit)
        for item in availability.values():
            item["location_count"] = len(item.pop("_site_ids"))
        return availability

    def get_health(self) -> dict:
        scan = self._scan()
        location_counts = {status: 0 for status in ("SAMPLE", "REAL", "DERIVED")}
        observation_counts = {status: 0 for status in ("SAMPLE", "REAL", "DERIVED")}
        for loaded in scan.valid_records:
            location_counts[loaded.record.data_status] += 1
            for observation in loaded.record.features:
                observation_counts[observation.data_status] += 1
        return {
            "valid_location_count": len(scan.valid_records),
            "invalid_records": list(scan.invalid_diagnostics),
            "location_status_counts": location_counts,
            "observation_status_counts": observation_counts,
        }
