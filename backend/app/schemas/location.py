from pydantic import BaseModel, Field


class LocationRequest(BaseModel):
    planet: str = Field(default="Moon", pattern="^Moon$")
    site_id: str

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
