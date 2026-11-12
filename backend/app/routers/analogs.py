
from fastapi import APIRouter, HTTPException

from app.schemas.analogs import (
    AnalogSearchRequest,
    AnalogSearchResponse,
)
from app.services.similarity import find_earth_analogs


router = APIRouter(
    prefix="/api/analogs",
    tags=["Earth Analog Search"],
)


@router.post("/search", response_model=AnalogSearchResponse)
def search_analogs(request: AnalogSearchRequest):
    try:
        results = find_earth_analogs(
            target_features=request.target_features.model_dump(),
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
                "Demo similarity search completed. "
                "All Earth dataset values are simulated."
            ),
        )

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
