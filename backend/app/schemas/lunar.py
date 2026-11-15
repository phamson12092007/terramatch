"""Schemas for traceable Lunar reference locations and observations."""

from __future__ import annotations

from datetime import datetime
from math import isfinite
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


LunarDataStatus = Literal["SAMPLE", "REAL", "DERIVED"]
ObservationKind = Literal["SAMPLE", "MEASURED", "DERIVED"]


class ObservationPeriod(BaseModel):
    start: datetime | None = None
    end: datetime | None = None

    @model_validator(mode="after")
    def validate_order(self):
        if self.start and self.end and self.end < self.start:
            raise ValueError("observation period end must be on or after start")
        return self


class LunarProvenance(BaseModel):
    """Source lineage; optional fields remain absent when source metadata is unknown."""

    source_data_status: LunarDataStatus | None = None
    source_reference: str | None = None
    derivation_lineage: list[str] = Field(default_factory=list)
    source_url: str | None = None
    product_id: str | None = None
    product_version: str | None = None
    source_file_name: str | None = None
    source_checksum_sha256: str | None = None
    processing_software: str | None = None
    processing_parameters: dict[str, Any] = Field(default_factory=dict)
    processing_timestamp: datetime | None = None
    source_crs: str | None = None
    processing_crs: str | None = None


class LunarFeatureObservation(BaseModel):
    feature_key: str = Field(min_length=1, max_length=160)
    value: float | None = None
    unit: str = Field(min_length=1, max_length=80)
    data_status: LunarDataStatus
    observation_kind: ObservationKind
    source: str = Field(min_length=1, max_length=240)
    product_id: str | None = Field(default=None, max_length=240)
    observation_time: datetime | None = None
    observation_period: ObservationPeriod | None = None
    spatial_resolution_m: float | None = Field(default=None, gt=0)
    processing_method: str | None = Field(default=None, max_length=1000)
    quality_status: str | None = Field(default=None, max_length=120)
    quality_flags: dict[str, Any] = Field(default_factory=dict)
    uncertainty: float | None = Field(default=None, ge=0)
    provenance: LunarProvenance = Field(default_factory=LunarProvenance)

    @field_validator("value", "spatial_resolution_m", "uncertainty")
    @classmethod
    def validate_finite_number(cls, value: float | None):
        if value is not None and not isfinite(value):
            raise ValueError("numeric observation values must be finite")
        return value

    @model_validator(mode="after")
    def validate_status_kind(self):
        if self.data_status == "SAMPLE" and self.observation_kind != "SAMPLE":
            raise ValueError("SAMPLE data_status requires SAMPLE observation_kind")
        if self.observation_kind == "DERIVED" and self.data_status != "DERIVED":
            raise ValueError("DERIVED observation_kind requires DERIVED data_status")
        return self


class LunarLocation(BaseModel):
    site_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,63}$")
    name: str = Field(min_length=1, max_length=160)
    region: str | None = Field(default=None, max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    body: Literal["Moon"] = "Moon"
    description: str | None = Field(default=None, max_length=1000)
    data_status: LunarDataStatus
    features: list[LunarFeatureObservation] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("latitude", "longitude")
    @classmethod
    def validate_finite_coordinate(cls, value: float):
        if not isfinite(value):
            raise ValueError("coordinates must be finite")
        return value


class LunarSiteSummary(BaseModel):
    site_id: str
    name: str
    region: str | None = None
    latitude: float
    longitude: float
    body: Literal["Moon"]
    description: str | None = None
    data_status: LunarDataStatus


class LunarHealthResponse(BaseModel):
    valid_location_count: int
    invalid_records: list[dict]
    location_status_counts: dict[str, int]
    observation_status_counts: dict[str, int]
