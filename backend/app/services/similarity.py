"""Explainable Earth-analogy scoring with strict real/demo separation.

The Feature Registry supplies physical mappings, canonical units, and
normalization scales. This module checks whether a particular record has a
usable observation and applies the documented distance formula.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.schemas.earth import EarthFeature
from app.services.earth_data import EarthDataRepository
from app.services.feature_registry import EarthFeatureDefinition, resolve_comparison_criterion


DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "earth" / "earth_analogs.csv"

# Legacy/default request shape only. These are lunar target keys, not a second
# source of Earth-feature metadata or normalization scales.
DEFAULT_CRITERIA_WEIGHTS = {
    "elevation_m": 0.40,
    "slope_deg": 0.35,
    "surface_temp_k": 0.25,
}
# Compatibility alias for callers that imported the old name.
WEIGHTS = DEFAULT_CRITERIA_WEIGHTS


@dataclass(frozen=True)
class ResolvedCriterion:
    requested_key: str
    definition: EarthFeatureDefinition
    lunar_feature_key: str
    configured_weight: float
    normalized_weight: float


@dataclass(frozen=True)
class SimilarityEvaluation:
    results: list[dict[str, Any]]
    available_candidate_count: int
    skipped_candidate_count: int
    scored_candidate_count: int
    requested_criteria: list[dict[str, Any]]
    candidate_diagnostics: list[dict[str, Any]]


def _finite_number(value: Any, label: str) -> float:
    if isinstance(value, bool):
        raise ValueError(f"{label} must be a finite number.")
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label} must be a finite number.") from error
    if not np.isfinite(number):
        raise ValueError(f"{label} must be a finite number.")
    return number


def _normalization_scale(definition: EarthFeatureDefinition) -> float:
    if definition.normalization_scale is None:
        raise ValueError(f"{definition.key} has no registered normalization scale.")
    scale = _finite_number(definition.normalization_scale, f"Normalization scale for {definition.key}")
    if scale <= 0:
        raise ValueError(f"Normalization scale for {definition.key} must be greater than zero.")
    return scale


def _resolve_criteria(
    criteria_weights: dict[str, float] | None,
    *,
    require_similarity_supported: bool,
) -> tuple[list[ResolvedCriterion], list[dict[str, Any]]]:
    """Validate criteria without hiding compatible-but-unavailable entries."""
    active_weights = criteria_weights if criteria_weights is not None else DEFAULT_CRITERIA_WEIGHTS
    if not isinstance(active_weights, dict) or not active_weights:
        raise ValueError("At least one evaluation criterion with a positive weight is required.")

    raw: list[tuple[str, EarthFeatureDefinition, float]] = []
    for requested_key, supplied_weight in active_weights.items():
        if not isinstance(requested_key, str) or not requested_key:
            raise ValueError("Evaluation criterion keys must be non-empty strings.")
        weight = _finite_number(supplied_weight, f"Weight for {requested_key}")
        if weight <= 0:
            raise ValueError(f"Weight for {requested_key} must be greater than zero.")
        definition = resolve_comparison_criterion(requested_key)
        if definition.lunar_compatibility != "COMPATIBLE" or not definition.lunar_feature_key:
            reason = definition.unavailable_reason or "It has no compatible lunar target feature."
            raise ValueError(f"Criterion {requested_key} is unsupported: {reason}")
        raw.append((requested_key, definition, weight))

    total = sum(weight for _, _, weight in raw)
    if not np.isfinite(total) or total <= 0:
        raise ValueError("The total criterion weight must be finite and greater than zero.")

    criteria: list[ResolvedCriterion] = []
    unavailable: list[dict[str, Any]] = []
    for requested_key, definition, weight in raw:
        normalized_weight = weight / total
        # Preserve registry integrity checks for configured scales even when a
        # feature is not yet scoreable. Planned metrics without a scale are
        # reported as planned rather than treated as malformed.
        if definition.normalization_scale is not None:
            _normalization_scale(definition)
        if require_similarity_supported and not definition.similarity_supported:
            unavailable.append({
                "criterion": requested_key,
                "earth_feature_key": definition.key,
                "lunar_feature_key": definition.lunar_feature_key,
                "status": "UNAVAILABLE_REGISTRY",
                "reason": definition.unavailable_reason or "This compatible feature is not enabled for similarity scoring.",
                "configured_weight": normalized_weight,
            })
            continue
        _normalization_scale(definition)
        criteria.append(ResolvedCriterion(
            requested_key=requested_key,
            definition=definition,
            lunar_feature_key=definition.lunar_feature_key,
            configured_weight=weight,
            normalized_weight=normalized_weight,
        ))
    return criteria, unavailable


def _target_value(target_features: dict[str, Any], criterion: ResolvedCriterion) -> float:
    if criterion.lunar_feature_key not in target_features:
        raise ValueError(
            f"Lunar target does not contain {criterion.lunar_feature_key} required by {criterion.requested_key}."
        )
    return _finite_number(target_features[criterion.lunar_feature_key], f"Lunar target value for {criterion.lunar_feature_key}")


def _earth_value(feature: EarthFeature, definition: EarthFeatureDefinition) -> float:
    if feature.value is None:
        raise ValueError("Observation has no value.")
    value = _finite_number(feature.value, f"Earth observation for {definition.key}")
    if feature.unit == definition.unit:
        return value
    conversion = definition.conversion
    if conversion and feature.unit == conversion.from_unit and definition.unit == conversion.to_unit:
        return _finite_number(conversion.convert(value), f"Converted Earth observation for {definition.key}")
    raise ValueError(f"Observation unit {feature.unit!r} does not match registered unit {definition.unit!r}.")


def _score_feature_set(used: list[dict[str, Any]]) -> float:
    if not used:
        raise ValueError("No eligible shared features are available for scoring.")
    configured_total = sum(item["configured_weight"] for item in used)
    if not np.isfinite(configured_total) or configured_total <= 0:
        raise ValueError("Eligible criterion weights must have a positive finite total.")

    weighted_distance = 0.0
    for item in used:
        applied_weight = item["configured_weight"] / configured_total
        item["weight_applied"] = applied_weight
        weighted_distance += applied_weight * item["normalized_difference"] ** 2
    score = (1.0 - np.sqrt(weighted_distance)) * 100.0
    return round(max(0.0, min(100.0, score)), 2)


def _requested_criterion_details(
    criteria: list[ResolvedCriterion], unavailable: list[dict[str, Any]], target_features: dict[str, Any],
) -> list[dict[str, Any]]:
    # Validate lunar inputs even when a compatible criterion is not currently
    # enabled. Otherwise NaN or a missing target could be hidden merely because
    # today's registry has no corresponding Earth observations yet.
    details: list[dict[str, Any]] = []
    for item in unavailable:
        definition = resolve_comparison_criterion(item["earth_feature_key"])
        criterion = ResolvedCriterion(
            requested_key=item["criterion"],
            definition=definition,
            lunar_feature_key=item["lunar_feature_key"],
            configured_weight=item["configured_weight"],
            normalized_weight=item["configured_weight"],
        )
        details.append({**item, "lunar_target_value": _target_value(target_features, criterion), "unit": definition.unit})
    for criterion in criteria:
        details.append({
            "criterion": criterion.requested_key,
            "earth_feature_key": criterion.definition.key,
            "lunar_feature_key": criterion.lunar_feature_key,
            "status": "ELIGIBLE_FOR_RECORD_CHECK",
            "reason": "Compatible registry feature; each Earth record still requires a REAL observation.",
            "configured_weight": criterion.normalized_weight,
            "lunar_target_value": _target_value(target_features, criterion),
            "unit": criterion.definition.unit,
        })
    return details


def evaluate_real_earth_analogs(
    target_features: dict[str, Any],
    criteria_weights: dict[str, float] | None = None,
    top_k: int = 5,
    repository: EarthDataRepository | None = None,
) -> SimilarityEvaluation:
    """Evaluate only REAL repository records; this function never reads the CSV."""
    if not isinstance(top_k, int) or isinstance(top_k, bool) or top_k < 1:
        raise ValueError("top_k must be a positive integer.")
    criteria, registry_unavailable = _resolve_criteria(criteria_weights, require_similarity_supported=True)
    criterion_details = _requested_criterion_details(criteria, registry_unavailable, target_features)
    records = (repository or EarthDataRepository()).list_records()
    results: list[dict[str, Any]] = []
    diagnostics: list[dict[str, Any]] = []

    for record in records:
        reasons = list(registry_unavailable)
        used: list[dict[str, Any]] = []
        by_key = {feature.key: feature for feature in record.features}
        for criterion in criteria:
            feature = by_key.get(criterion.definition.key)
            if feature is None:
                reasons.append({"criterion": criterion.requested_key, "earth_feature_key": criterion.definition.key, "status": "MISSING_EARTH_OBSERVATION", "reason": "The Earth location has no observation for this registered feature."})
                continue
            real_backed = feature.data_status == "REAL" or (
                feature.data_status == "DERIVED" and feature.provenance.quality.get("source_data_status") == "REAL"
            )
            if not real_backed:
                reasons.append({"criterion": criterion.requested_key, "earth_feature_key": criterion.definition.key, "status": "EARTH_OBSERVATION_NOT_REAL", "reason": f"Earth observation status is {feature.data_status}, not REAL-backed."})
                continue
            try:
                earth_value = _earth_value(feature, criterion.definition)
                lunar_value = _target_value(target_features, criterion)
                scale = _normalization_scale(criterion.definition)
            except ValueError as error:
                reasons.append({"criterion": criterion.requested_key, "earth_feature_key": criterion.definition.key, "status": "INVALID_EARTH_OBSERVATION", "reason": str(error)})
                continue
            used.append({
                "criterion": criterion.requested_key,
                "earth_feature_key": criterion.definition.key,
                "lunar_feature_key": criterion.lunar_feature_key,
                "lunar_value": lunar_value,
                "earth_value": earth_value,
                "unit": criterion.definition.unit,
                "normalized_difference": abs(earth_value - lunar_value) / scale,
                "configured_weight": criterion.normalized_weight,
                "weight_applied": 0.0,
                "feature_source": feature.provenance.model_dump(mode="json"),
                "acquisition_start": feature.provenance.acquisition_start.isoformat(),
                "acquisition_end": feature.provenance.acquisition_end.isoformat(),
            })

        if not used:
            diagnostics.append({"site_id": record.location_id, "name": record.name, "status": "UNSCORED", "reason": "No requested criterion had an eligible REAL Earth observation.", "criteria": reasons})
            continue
        score = _score_feature_set(used)
        comparison_features = {item["criterion"]: item for item in used}
        sources = {item["criterion"]: item["feature_source"] for item in used}
        results.append({
            "site_id": record.location_id,
            "name": record.name,
            "country": record.country_or_area or "Unspecified area",
            "latitude": record.latitude,
            "longitude": record.longitude,
            "elevation_m": comparison_features.get("elevation_m", {}).get("earth_value"),
            "slope_deg": comparison_features.get("slope_deg", {}).get("earth_value"),
            "surface_temp_k": comparison_features.get("surface_temp_k", {}).get("earth_value"),
            "similarity_score": score,
            "data_status": "REAL",
            "feature_sources": sources,
            "comparison_features": comparison_features,
            "unavailable_criteria": reasons,
            "used_weight_total": sum(item["configured_weight"] for item in used),
        })

    results.sort(key=lambda item: item["similarity_score"], reverse=True)
    return SimilarityEvaluation(
        results=results[:top_k],
        available_candidate_count=len(records),
        skipped_candidate_count=len(diagnostics),
        scored_candidate_count=len(results),
        requested_criteria=criterion_details,
        candidate_diagnostics=diagnostics,
    )


def find_real_earth_analogs(
    target_features: dict[str, Any], criteria_weights: dict[str, float] | None = None,
    top_k: int = 5, repository: EarthDataRepository | None = None,
) -> tuple[list[dict[str, Any]], int, int]:
    """Backward-compatible tuple view of :func:`evaluate_real_earth_analogs`."""
    evaluation = evaluate_real_earth_analogs(target_features, criteria_weights, top_k, repository)
    return evaluation.results, evaluation.available_candidate_count, evaluation.skipped_candidate_count


def find_simulated_earth_analogs(
    target_features: dict[str, Any], criteria_weights: dict[str, float] | None = None, top_k: int = 5,
) -> list[dict[str, Any]]:
    """Rank only the isolated, clearly labelled legacy demonstration dataset."""
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Earth analog dataset not found: {DATA_PATH}")
    if not isinstance(top_k, int) or isinstance(top_k, bool) or top_k < 1:
        raise ValueError("top_k must be a positive integer.")
    criteria, _ = _resolve_criteria(criteria_weights, require_similarity_supported=False)
    df = pd.read_csv(DATA_PATH)
    results: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        used: list[dict[str, Any]] = []
        for criterion in criteria:
            if criterion.lunar_feature_key not in row:
                raise ValueError(f"Simulated demo dataset lacks {criterion.lunar_feature_key}.")
            earth_value = _finite_number(row[criterion.lunar_feature_key], f"Simulated value for {criterion.lunar_feature_key}")
            lunar_value = _target_value(target_features, criterion)
            scale = _normalization_scale(criterion.definition)
            used.append({
                "criterion": criterion.requested_key, "earth_feature_key": criterion.definition.key,
                "lunar_feature_key": criterion.lunar_feature_key, "lunar_value": lunar_value,
                "earth_value": earth_value, "unit": criterion.definition.unit,
                "normalized_difference": abs(earth_value - lunar_value) / scale,
                "configured_weight": criterion.normalized_weight, "weight_applied": 0.0,
                "feature_source": {}, "acquisition_start": None, "acquisition_end": None,
            })
        score = _score_feature_set(used)
        comparison_features = {item["criterion"]: item for item in used}
        results.append({
            "site_id": row["site_id"], "name": row["name"], "country": row["country"],
            "latitude": float(row["latitude"]), "longitude": float(row["longitude"]),
            "elevation_m": float(row["elevation_m"]), "slope_deg": float(row["slope_deg"]),
            "surface_temp_k": float(row["surface_temp_k"]), "similarity_score": score,
            "data_status": row["data_status"], "feature_sources": {},
            "comparison_features": comparison_features, "unavailable_criteria": [], "used_weight_total": 1.0,
        })
    results.sort(key=lambda item: item["similarity_score"], reverse=True)
    return results[:top_k]


# Backwards-compatible name for existing callers while they migrate to explicit modes.
find_earth_analogs = find_simulated_earth_analogs
