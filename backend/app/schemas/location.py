from typing import Literal
from pydantic import BaseModel, Field


class LocationRequest(BaseModel):
    planet: Literal["Moon", "Mars"]

    latitude: float = Field(
        ge=-90,
        le=90
    )

    longitude: float = Field(
        ge=-180,
        le=180
    )


class LocationResponse(BaseModel):
    planet: str
    latitude: float
    longitude: float
    data_status: str
    message: str