
from fastapi import APIRouter

from app.schemas.location import (
    LocationRequest,
    LocationResponse
)
from app.site_catalog import validate_catalog_site

router = APIRouter(
    prefix="/api/location",
    tags=["Location"]
)


@router.post("/inspect", response_model=LocationResponse)
def inspect_location(location: LocationRequest):
    validate_catalog_site(
        location.planet,
        location.site_id,
        location.latitude,
        location.longitude,
    )

    return LocationResponse(
        planet=location.planet,
        latitude=location.latitude,
        longitude=location.longitude,
        data_status="pending",
        message=(
            "Catalogued research site validated successfully. "
            "Scientific datasets have not been retrieved yet."
        )
    )
