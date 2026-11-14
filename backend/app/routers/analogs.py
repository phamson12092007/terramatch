
from fastapi import APIRouter, HTTPException

from app.schemas.analogs import (
    AnalogSearchRequest,
    AnalogSearchResponse,
)
from app.services.similarity import find_earth_analogs
from app.site_catalog import validate_catalog_site


router = APIRouter(
    prefix="/api/analogs",
    tags=["Earth Analog Search"],
)


@router.post("/search", response_model=AnalogSearchResponse)
def search_analogs(request: AnalogSearchRequest):
    try:
        validate_catalog_site(
            request.planet,
            request.site_id,
            request.latitude,
            request.longitude,
        )
        results = find_earth_analogs(
            target_features=request.target_features.model_dump(),
            criteria_weights=request.criteria_weights,
            top_k=5,
        )

        return AnalogSearchResponse(
            planet=request.planet,
            target_location={
                "latitude": request.latitude,
                "longitude": request.longitude,
            },
            results=results,
            message=(
                f"Demo similarity search completed for {request.research_device}. "
                "All Earth dataset values are simulated."
            ),
        )

    except HTTPException:
        raise

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        )
