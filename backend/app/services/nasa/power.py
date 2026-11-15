"""Client for NASA POWER daily point data.

POWER's T2M is air temperature at two metres. It is deliberately kept separate
from MODIS land-surface temperature, which will be added by a later provider.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import date
from statistics import fmean
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen


POWER_DAILY_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
POWER_PARAMETERS = ("T2M", "T2M_MIN", "T2M_MAX", "ALLSKY_SFC_SW_DWN")


class PowerServiceError(RuntimeError):
    """Expected external-service failure; safe to expose as a 502 summary."""


@dataclass(frozen=True)
class PowerParameterSummary:
    code: str
    values: list[float]
    missing_days: int


@dataclass(frozen=True)
class PowerDailyResult:
    request_url: str
    raw_response: dict[str, Any]
    retrieved_at_iso: str
    parameter_summaries: dict[str, PowerParameterSummary]


class PowerClient:
    """Small stdlib-only client with an injectable opener for deterministic tests."""

    def __init__(
        self,
        timeout_seconds: float = 20.0,
        opener: Callable[..., Any] = urlopen,
    ):
        self.timeout_seconds = timeout_seconds
        self._opener = opener

    def fetch_daily_point(
        self,
        latitude: float,
        longitude: float,
        start_date: date,
        end_date: date,
    ) -> PowerDailyResult:
        query = urlencode(
            {
                "parameters": ",".join(POWER_PARAMETERS),
                "community": "RE",
                "longitude": f"{longitude:.6f}",
                "latitude": f"{latitude:.6f}",
                "start": start_date.strftime("%Y%m%d"),
                "end": end_date.strftime("%Y%m%d"),
                "format": "JSON",
                "time-standard": "UTC",
            }
        )
        request_url = f"{POWER_DAILY_URL}?{query}"

        try:
            with self._opener(request_url, timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8")
        except HTTPError as error:
            raise PowerServiceError(f"NASA POWER returned HTTP {error.code}") from error
        except (URLError, TimeoutError, OSError) as error:
            raise PowerServiceError("NASA POWER could not be reached") from error

        try:
            payload = json.loads(body)
        except json.JSONDecodeError as error:
            raise PowerServiceError("NASA POWER returned invalid JSON") from error

        parameters = payload.get("properties", {}).get("parameter")
        if not isinstance(parameters, dict):
            raise PowerServiceError("NASA POWER response does not contain daily parameters")

        fill_value = payload.get("header", {}).get("fill_value", -999)
        summaries = {
            code: self._summarize_parameter(code, parameters.get(code), fill_value)
            for code in POWER_PARAMETERS
        }
        return PowerDailyResult(
            request_url=request_url,
            raw_response=payload,
            retrieved_at_iso=self._utc_now_iso(),
            parameter_summaries=summaries,
        )

    @staticmethod
    def _summarize_parameter(
        code: str,
        series: Any,
        fill_value: Any,
    ) -> PowerParameterSummary:
        if not isinstance(series, dict):
            return PowerParameterSummary(code=code, values=[], missing_days=0)

        valid_values: list[float] = []
        missing_days = 0
        try:
            normalized_fill_value = float(fill_value)
        except (TypeError, ValueError):
            normalized_fill_value = -999.0

        for value in series.values():
            try:
                numeric_value = float(value)
            except (TypeError, ValueError):
                missing_days += 1
                continue
            if (
                not math.isfinite(numeric_value)
                or numeric_value == normalized_fill_value
                or numeric_value <= -900
            ):
                missing_days += 1
                continue
            valid_values.append(numeric_value)

        return PowerParameterSummary(
            code=code,
            values=valid_values,
            missing_days=missing_days,
        )

    @staticmethod
    def mean(summary: PowerParameterSummary) -> float | None:
        return fmean(summary.values) if summary.values else None

    @staticmethod
    def minimum(summary: PowerParameterSummary) -> float | None:
        return min(summary.values) if summary.values else None

    @staticmethod
    def maximum(summary: PowerParameterSummary) -> float | None:
        return max(summary.values) if summary.values else None

    @staticmethod
    def _utc_now_iso() -> str:
        from datetime import datetime, timezone

        return datetime.now(timezone.utc).isoformat()
