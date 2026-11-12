
from fastapi import APIRouter

from app.schemas.location import (
    LocationRequest,
    LocationResponse
)

router = APIRouter(
    prefix="/api/location",
    tags=["Location"]
)


@router.post("/inspect", response_model=LocationResponse)
def inspect_location(location: LocationRequest):

    return LocationResponse(
        planet=location.planet,
        latitude=location.latitude,
        longitude=location.longitude,
        data_status="pending",
        message=(
            "Coordinates validated successfully. "
            "Scientific datasets have not been retrieved yet."
        )
    )
