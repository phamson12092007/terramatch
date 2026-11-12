
from typing import Literal
from pydantic import BaseModel, Field


class FeatureVector(BaseModel):
    elevation_m: float
    slope_deg: float = Field(ge=0, le=90)
    surface_temp_k: float = Field(gt=0, le=500)


class AnalogSearchRequest(BaseModel):
    planet: Literal["Moon", "Mars"]
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    target_features: FeatureVector


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
