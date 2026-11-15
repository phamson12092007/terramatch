
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class FeatureVector(BaseModel):
    # The registry owns the valid comparison keys.  Preserve additional lunar
    # feature values here so a new registered feature does not require a
    # schema redeploy before it can be evaluated.
    model_config = ConfigDict(extra="allow")

    elevation_m: float | None = None
    slope_deg: float | None = Field(default=None, ge=0, le=90)
    surface_temp_k: float | None = Field(default=None, gt=0, le=500)


class AnalogSearchRequest(BaseModel):
    planet: str = Field(default="Moon", pattern="^Moon$")
    site_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    target_features: FeatureVector = Field(default_factory=FeatureVector)
    research_device: str = Field(min_length=1, max_length=80)
    criteria_weights: dict[str, float] = Field(min_length=1)
    earth_data_mode: Literal["REAL_ONLY", "SIMULATED_DEMO"] = "REAL_ONLY"
    refresh_from_nasa: bool = False


class AnalogResult(BaseModel):
    site_id: str
    name: str
    country: str
    latitude: float
    longitude: float

    elevation_m: float | None = None
    slope_deg: float | None = None
    surface_temp_k: float | None = None

    similarity_score: float
    data_status: str
    feature_sources: dict[str, dict] = Field(default_factory=dict)
    comparison_features: dict[str, dict] = Field(default_factory=dict)
    unavailable_criteria: list[dict] = Field(default_factory=list)
    used_weight_total: float | None = None

class AnalogSearchResponse(BaseModel):
    planet: str
    target_location: dict
    results: list[AnalogResult]
    data_source: Literal["REAL", "SIMULATED"]
    available_candidate_count: int
    skipped_candidate_count: int
    scored_candidate_count: int = 0
    requested_criteria: list[dict] = Field(default_factory=list)
    candidate_diagnostics: list[dict] = Field(default_factory=list)
    limitations: list[str]
    message: str
