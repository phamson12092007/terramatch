"""Compatibility validation backed by the Lunar reference repository."""

from fastapi import HTTPException

from app.services.lunar_data import LunarDataRepository


def validate_catalog_site(planet: str, site_id: str, latitude: float, longitude: float):
    if planet != "Moon":
        raise HTTPException(status_code=422, detail="Select a catalogued Lunar research site.")
    try:
        site = LunarDataRepository().get_location(site_id)
    except HTTPException as error:
        if error.status_code == 404:
            raise HTTPException(status_code=422, detail="Select a catalogued research site.") from error
        raise
    if abs(latitude - site.latitude) > 0.0001 or abs(longitude - site.longitude) > 0.0001:
        raise HTTPException(status_code=422, detail="Coordinates must match the selected research site.")
