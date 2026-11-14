
from pydantic import BaseModel, Field


class FeatureVector(BaseModel):
    elevation_m: float
    slope_deg: float = Field(ge=0, le=90)
    surface_temp_k: float = Field(gt=0, le=500)


class AnalogSearchRequest(BaseModel):
    planet: str = Field(default="Moon", pattern="^Moon$")
    site_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    target_features: FeatureVector
    research_device: str = Field(min_length=1, max_length=80)
    criteria_weights: dict[str, float] = Field(min_length=1)


class AnalogResult(BaseModel):
    site_id: str
    name: str
    country: str
    latitude: float
    longitude: float

    elevation_m: float
    slope_deg: float
    surface_temp_k: float

    similarity_score: float
    data_status: str

class AnalogSearchResponse(BaseModel):
    planet: str
    target_location: dict
    results: list[AnalogResult]
    message: str
