"""Read-only Lunar reference-data API."""

from fastapi import APIRouter

from app.schemas.lunar import LunarFeatureObservation, LunarHealthResponse, LunarLocation, LunarSiteSummary
from app.services.lunar_data import LunarDataRepository


router = APIRouter(prefix="/api/lunar", tags=["Lunar Reference Data"])


@router.get("/sites", response_model=list[LunarSiteSummary])
def list_lunar_sites():
    return [
        LunarSiteSummary(**location.model_dump(exclude={"features", "metadata"}))
        for location in LunarDataRepository().list_locations()
    ]


@router.get("/sites/{site_id}", response_model=LunarLocation)
def get_lunar_site(site_id: str):
    return LunarDataRepository().get_location(site_id)


@router.get("/sites/{site_id}/features", response_model=list[LunarFeatureObservation])
def get_lunar_site_features(site_id: str):
    return LunarDataRepository().get_observations(site_id)


@router.get("/sites/{site_id}/terrain", response_model=list[LunarFeatureObservation])
def get_lunar_site_terrain(site_id: str):
    return LunarDataRepository().get_terrain_observations(site_id)


@router.get("/features")
def get_lunar_feature_availability():
    return {"features": LunarDataRepository().feature_availability()}


@router.get("/health", response_model=LunarHealthResponse)
def get_lunar_health():
    return LunarDataRepository().get_health()
