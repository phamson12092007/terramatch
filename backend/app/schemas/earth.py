"""Schemas for retrieved Earth observations and their provenance."""

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


DataStatus = Literal["REAL", "DERIVED", "PARTIAL", "MISSING", "SIMULATED"]


class FeatureProvenance(BaseModel):
    """Traceability metadata for one processed environmental feature."""

    source_organization: str
    dataset_name: str
    parameter_code: str
    source_url: str
    acquisition_start: date
    acquisition_end: date
    spatial_resolution: str | None = None
    temporal_resolution: str
    original_unit: str
    processed_unit: str
    processing_method: str
    quality: dict[str, Any] = Field(default_factory=dict)
    retrieved_at: datetime


class EarthFeature(BaseModel):
    key: str
    label: str
    value: float | None = None
    unit: str
    data_status: DataStatus
    provenance: FeatureProvenance


class EarthLocationRecord(BaseModel):
    location_id: str
    name: str
    country_or_area: str | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    description: str | None = None
    data_status: DataStatus
    features: list[EarthFeature]
    raw_response_path: str
    retrieved_at: datetime


class EarthDataFetchRequest(BaseModel):
    """A point request for a bounded, user-configurable NASA POWER period."""

    location_id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{1,63}$")
    name: str = Field(min_length=1, max_length=120)
    country_or_area: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_period(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class EarthDataStatusResponse(BaseModel):
    stored_locations: int
    sources: list[str]
    note: str


class ModisTaskResponse(BaseModel):
    task_id: str
    status: str
    message: str
