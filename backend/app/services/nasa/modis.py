"""NASA AppEEARS client for MOD11A1.061 point-sample tasks.

AppEEARS runs point samples asynchronously. This client submits a task and lets
the caller check/ingest it later instead of keeping an HTTP request open.
"""

from __future__ import annotations

import json
import os
from datetime import date
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


APPEEARS_API_URL = "https://appeears.earthdatacloud.nasa.gov/api/"
MODIS_PRODUCT = "MOD11A1.061"
MODIS_LAYERS = ("LST_Day_1km", "QC_Day", "LST_Night_1km", "QC_Night")


class ModisServiceError(RuntimeError):
    pass


class ModisAuthenticationError(ModisServiceError):
    pass


class ModisClient:
    def __init__(self, token: str | None = None, timeout_seconds: float = 30.0, opener: Callable[..., Any] = urlopen):
        self.token = token or os.getenv("APPEEARS_TOKEN")
        self.timeout_seconds = timeout_seconds
        self._opener = opener

    def submit_point_task(self, *, location_id: str, latitude: float, longitude: float, start_date: date, end_date: date) -> dict:
        payload = {
            "task_type": "point",
            "task_name": f"terramatch-{location_id}",
            "params": {
                "dates": [{"startDate": start_date.strftime("%m-%d-%Y"), "endDate": end_date.strftime("%m-%d-%Y")}],
                "layers": [{"product": MODIS_PRODUCT, "layer": layer} for layer in MODIS_LAYERS],
                "coordinates": [{"id": location_id, "latitude": latitude, "longitude": longitude}],
            },
        }
        return self._json_request("task", method="POST", payload=payload)

    def get_task(self, task_id: str) -> dict:
        return self._json_request(f"task/{task_id}")

    def get_bundle(self, task_id: str) -> dict:
        return self._json_request(f"bundle/{task_id}")

    def download_file(self, task_id: str, file_id: str) -> bytes:
        return self._request(f"bundle/{task_id}/{file_id}")

    def _json_request(self, path: str, method: str = "GET", payload: dict | None = None) -> dict:
        body = self._request(path, method=method, payload=payload)
        try:
            response = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ModisServiceError("AppEEARS returned invalid JSON") from error
        if not isinstance(response, dict):
            raise ModisServiceError("AppEEARS returned an unexpected response")
        return response

    def _request(self, path: str, method: str = "GET", payload: dict | None = None) -> bytes:
        if not self.token:
            raise ModisAuthenticationError("APPEEARS_TOKEN is required for NASA AppEEARS MODIS requests")
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = Request(
            f"{APPEEARS_API_URL}{path}",
            data=data,
            method=method,
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"},
        )
        try:
            with self._opener(request, timeout=self.timeout_seconds) as response:
                return response.read()
        except HTTPError as error:
            if error.code in (401, 403):
                raise ModisAuthenticationError("Earthdata token was rejected or has expired") from error
            raise ModisServiceError(f"AppEEARS returned HTTP {error.code}") from error
        except (URLError, TimeoutError, OSError) as error:
            raise ModisServiceError("AppEEARS could not be reached") from error
