"""SRTMGL1.003 tile retrieval and defensible local terrain calculations."""

from __future__ import annotations

import json
import math
import os
import zipfile
from dataclasses import dataclass
from io import BytesIO
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np

from app.services.terrain_processing import derive_regional_terrain_metrics


CMR_GRANULE_URL = "https://cmr.earthdata.nasa.gov/search/granules.json"
SRTM_SHORT_NAME = "SRTMGL1"
SRTM_VERSION = "003"


class SrtmServiceError(RuntimeError):
    pass


class SrtmCoverageError(SrtmServiceError):
    pass


class SrtmAuthenticationError(SrtmServiceError):
    pass


def tile_name(latitude: float, longitude: float) -> str:
    if not (-56 <= latitude <= 60):
        raise SrtmCoverageError("SRTMGL1 does not cover this latitude; no terrain value was inferred")
    lat_degrees = math.floor(latitude)
    lon_degrees = math.floor(longitude)
    return f"{'N' if lat_degrees >= 0 else 'S'}{abs(lat_degrees):02d}{'E' if lon_degrees >= 0 else 'W'}{abs(lon_degrees):03d}"


@dataclass(frozen=True)
class SrtmFetchResult:
    tile_name: str
    source_url: str
    raw_bytes: bytes


@dataclass(frozen=True)
class SrtmTerrainCoverage:
    tile_name: str
    center_covered: bool
    processing_status: str
    valid_pixel_count: int
    expected_pixel_count: int
    valid_pixel_ratio: float
    center_row: int
    center_column: int
    east_west_resolution_m: float
    north_south_resolution_m: float
    support_width_m: float


class SrtmClient:
    def __init__(self, token: str | None = None, timeout_seconds: float = 45, opener: Callable[..., Any] = urlopen):
        self.token = token or os.getenv("EARTHDATA_TOKEN")
        self.timeout_seconds = timeout_seconds
        self._opener = opener

    def fetch_tile(self, latitude: float, longitude: float) -> SrtmFetchResult:
        name = tile_name(latitude, longitude)
        query = urlencode({"short_name": SRTM_SHORT_NAME, "version": SRTM_VERSION, "producer_granule_id": f"{name}.SRTMGL1.hgt"})
        catalog = self._get_json(f"{CMR_GRANULE_URL}?{query}", authenticated=False)
        entries = catalog.get("feed", {}).get("entry", [])
        if not entries:
            raise SrtmCoverageError(f"No SRTMGL1 tile is available for {name}")
        links = entries[0].get("links", [])
        source_url = next((item.get("href") for item in links if str(item.get("href", "")).lower().endswith((".hgt", ".hgt.zip"))), None)
        if not source_url:
            raise SrtmServiceError("CMR did not provide a downloadable SRTM HGT link")
        raw = self._get_bytes(source_url, authenticated=True)
        if raw[:2] == b"PK":
            with zipfile.ZipFile(BytesIO(raw)) as archive:
                hgt_file = next((item for item in archive.namelist() if item.lower().endswith(".hgt")), None)
                if not hgt_file:
                    raise SrtmServiceError("SRTM archive does not contain an HGT file")
                raw = archive.read(hgt_file)
        return SrtmFetchResult(tile_name=name, source_url=source_url, raw_bytes=raw)

    def _get_json(self, url: str, authenticated: bool) -> dict:
        try:
            return json.loads(self._get_bytes(url, authenticated=authenticated).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise SrtmServiceError("SRTM catalog returned invalid JSON") from error

    def _get_bytes(self, url: str, authenticated: bool) -> bytes:
        if authenticated and not self.token:
            raise SrtmAuthenticationError("EARTHDATA_TOKEN is required to download protected SRTM tiles")
        headers = {"Authorization": f"Bearer {self.token}"} if authenticated else {}
        try:
            with self._opener(Request(url, headers=headers), timeout=self.timeout_seconds) as response:
                return response.read()
        except HTTPError as error:
            if error.code in (401, 403):
                raise SrtmAuthenticationError("Earthdata token was rejected or has expired") from error
            raise SrtmServiceError(f"SRTM request returned HTTP {error.code}") from error
        except (URLError, TimeoutError, OSError) as error:
            raise SrtmServiceError("SRTM data service could not be reached") from error


class SrtmTile:
    """One HGT tile. HGT samples are ordered north-to-south, then west-to-east."""

    VOID = -32768

    def __init__(self, name: str, samples: np.ndarray):
        self.name = name
        self.samples = samples
        self.size = samples.shape[0]
        self.south = int(name[1:3]) * (1 if name[0] == "N" else -1)
        self.west = int(name[4:7]) * (1 if name[3] == "E" else -1)

    @classmethod
    def from_hgt(cls, name: str, raw_bytes: bytes) -> "SrtmTile":
        if len(raw_bytes) % 2:
            raise SrtmServiceError("SRTM HGT file has an invalid byte length")
        sample_count = len(raw_bytes) // 2
        size = math.isqrt(sample_count)
        if size < 3 or size * size != sample_count:
            raise SrtmServiceError("SRTM HGT file is not a square elevation grid")
        return cls(name, np.frombuffer(raw_bytes, dtype=">i2").reshape((size, size)))

    def terrain_at(self, latitude: float, longitude: float) -> dict[str, float]:
        if not (self.south <= latitude <= self.south + 1 and self.west <= longitude <= self.west + 1):
            raise SrtmCoverageError("Coordinate is outside the downloaded SRTM tile")
        row = round((self.south + 1 - latitude) * (self.size - 1))
        col = round((longitude - self.west) * (self.size - 1))
        if row < 1 or row >= self.size - 1 or col < 1 or col >= self.size - 1:
            raise SrtmCoverageError("Coordinate falls on a tile edge; a complete slope window is unavailable")
        window = self.samples[row - 1:row + 2, col - 1:col + 2].astype(float)
        if np.any(window == self.VOID):
            raise SrtmCoverageError("SRTM has void pixels in the local terrain window")
        spacing_lat_m = 111_320 / (self.size - 1)
        spacing_lon_m = spacing_lat_m * math.cos(math.radians(latitude))
        dz_dx = (window[1, 2] - window[1, 0]) / (2 * spacing_lon_m)
        dz_dy = (window[0, 1] - window[2, 1]) / (2 * spacing_lat_m)
        slope = math.degrees(math.atan(math.hypot(dz_dx, dz_dy)))
        return {"elevation_m": float(window[1, 1]), "slope_deg": slope, "terrain_roughness_m": float(np.std(window, ddof=0))}

    def regional_terrain_at(
        self, latitude: float, longitude: float, support_width_m: float,
    ) -> tuple[dict[str, float] | None, SrtmTerrainCoverage]:
        """Return Stage 6B-compatible regional metrics from a full SRTM window.

        The input HGT grid is geographic, but the fitted terrain plane uses a
        local metric approximation at the requested latitude. A window is
        rejected at tile edges or when any NoData sample occurs; it is never
        clipped, filled, or resampled.
        """
        if support_width_m <= 0 or not math.isfinite(support_width_m):
            raise ValueError("support_width_m must be a positive finite number")
        if not (self.south <= latitude <= self.south + 1 and self.west <= longitude <= self.west + 1):
            raise SrtmCoverageError("Coordinate is outside the downloaded SRTM tile")
        row = round((self.south + 1 - latitude) * (self.size - 1))
        col = round((longitude - self.west) * (self.size - 1))
        north_south_resolution_m = 111_320 / (self.size - 1)
        east_west_resolution_m = north_south_resolution_m * math.cos(math.radians(latitude))
        if east_west_resolution_m <= 0:
            raise SrtmCoverageError("SRTM geographic grid has no usable local east-west metric spacing at this latitude")
        radius = math.ceil((support_width_m / 2) / min(east_west_resolution_m, north_south_resolution_m))
        expected = (2 * radius + 1) ** 2
        if row - radius < 0 or row + radius >= self.size or col - radius < 0 or col + radius >= self.size:
            return None, SrtmTerrainCoverage(
                self.name, True, "PARTIAL_COVERAGE", 0, expected, 0.0, row, col,
                east_west_resolution_m, north_south_resolution_m, support_width_m,
            )
        window = self.samples[row - radius:row + radius + 1, col - radius:col + radius + 1].astype(float)
        valid = window != self.VOID
        valid_count = int(valid.sum())
        if valid_count != expected:
            return None, SrtmTerrainCoverage(
                self.name, True, "INSUFFICIENT_VALID_PIXELS", valid_count, expected, valid_count / expected,
                row, col, east_west_resolution_m, north_south_resolution_m, support_width_m,
            )
        return derive_regional_terrain_metrics(window, east_west_resolution_m, north_south_resolution_m), SrtmTerrainCoverage(
            self.name, True, "COVERED", valid_count, expected, 1.0, row, col,
            east_west_resolution_m, north_south_resolution_m, support_width_m,
        )
