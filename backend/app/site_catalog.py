"""Curated planetary sites that have enough data for TerraMatch demos."""

from fastapi import HTTPException


SITE_CATALOG = {
    "Moon": {
        "shackleton-rim": (-89.9, 129.9),
        "amundsen-crater": (-84.6, 82.8),
        "cabeus-crater": (-84.9, -42.3),
        "malapert-massif": (-85.4, 0.0),
        "apollo-11": (0.674, 23.473),
        "luna-17": (38.247, -35.0),
    },
}


def validate_catalog_site(planet: str, site_id: str, latitude: float, longitude: float):
    site = SITE_CATALOG.get(planet, {}).get(site_id)
    if not site:
        raise HTTPException(status_code=422, detail="Select a catalogued research site.")

    expected_latitude, expected_longitude = site
    if abs(latitude - expected_latitude) > 0.0001 or abs(longitude - expected_longitude) > 0.0001:
        raise HTTPException(status_code=422, detail="Coordinates must match the selected research site.")
