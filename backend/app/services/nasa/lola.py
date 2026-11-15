"""NASA PDS LOLA LDEM_16 ingestion and reusable regional terrain metrics.

The parser intentionally supports only the verified PDS3 LDEM_16 product used
by Stage 6B. It reads the native simple-cylindrical raster directly, so no
unverified CRS conversion or interpolation is introduced.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from app.schemas.lunar import LunarFeatureObservation, LunarLocation, LunarProvenance
from app.services.terrain_processing import derive_regional_terrain_metrics


LOLA_SOURCE_URL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img"
LOLA_LABEL_URL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.lbl"
PROCESSING_VERSION = "terramatch-lola-terrain-v1"
SUPPORT_RADIUS_PIXELS = 2
MIN_VALID_RATIO = 0.90


@dataclass(frozen=True)
class LolaProductMetadata:
    product_id: str
    product_version: str
    data_set_id: str
    source_resolution_m: float
    lines: int
    line_samples: int
    scale_m_per_dn: float
    reference_radius_m: float
    minimum_dn: int
    maximum_dn: int
    source_crs: str
    start_time: str | None
    stop_time: str | None
    product_creation_time: str | None


@dataclass(frozen=True)
class TerrainCoverage:
    site_id: str
    center_covered: bool
    valid_elevation_data: bool
    local_window_coverage: str
    processing_status: str
    valid_pixel_count: int
    expected_pixel_count: int
    valid_pixel_ratio: float
    center_row: int
    center_column: int


def _label_value(label: str, key: str) -> str:
    # PDS3 labels commonly indent object members.  Anchor to a full label
    # field rather than accepting key names that only occur in comments.
    match = re.search(rf"^\s*{re.escape(key)}\s*=\s*(.+)$", label, flags=re.MULTILINE)
    if not match:
        raise ValueError(f"LOLA label is missing {key}")
    return match.group(1).strip().strip('"')


def parse_ldem16_label(path: Path) -> LolaProductMetadata:
    label = path.read_text(encoding="ascii")
    metadata = LolaProductMetadata(
        product_id=_label_value(label, "PRODUCT_ID"),
        product_version=_label_value(label, "PRODUCT_VERSION_ID"),
        data_set_id=_label_value(label, "DATA_SET_ID"),
        source_resolution_m=float(_label_value(label, "MAP_SCALE").split()[0]),
        lines=int(_label_value(label, "LINES")),
        line_samples=int(_label_value(label, "LINE_SAMPLES")),
        scale_m_per_dn=float(_label_value(label, "SCALING_FACTOR")),
        reference_radius_m=float(_label_value(label, "OFFSET").split()[0]),
        minimum_dn=int(_label_value(label, "MINIMUM")),
        maximum_dn=int(_label_value(label, "MAXIMUM")),
        source_crs=(
            f"{_label_value(label, 'MAP_PROJECTION_TYPE')}; "
            f"{_label_value(label, 'COORDINATE_SYSTEM_NAME')}; "
            f"east-positive longitude; 0–360°"
        ),
        start_time=_label_value(label, "START_TIME"),
        stop_time=_label_value(label, "STOP_TIME"),
        product_creation_time=_label_value(label, "PRODUCT_CREATION_TIME"),
    )
    if metadata.product_id != "LDEM_16" or metadata.data_set_id != "LRO-L-LOLA-4-GDR-V1.0":
        raise ValueError("Unsupported LOLA product: expected PDS LDEM_16 GDR")
    if (metadata.lines, metadata.line_samples, metadata.scale_m_per_dn) != (2880, 5760, 0.5):
        raise ValueError("Unsupported LDEM_16 geometry or scale")
    return metadata


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class LolaLdem16:
    def __init__(self, image_path: Path, label_path: Path):
        if not image_path.exists():
            raise FileNotFoundError(f"LOLA source raster is missing: {image_path.name}")
        self.image_path = image_path
        self.label_path = label_path
        self.metadata = parse_ldem16_label(label_path)
        expected_bytes = self.metadata.lines * self.metadata.line_samples * 2
        if image_path.stat().st_size != expected_bytes:
            raise ValueError("LOLA source raster size does not match verified label geometry")
        self.grid = np.memmap(image_path, dtype="<i2", mode="r", shape=(self.metadata.lines, self.metadata.line_samples))

    def _pixel_indices(self, latitude: float, longitude: float) -> tuple[int, int]:
        resolution = self.metadata.line_samples / 360
        row = int(round((90.0 - latitude) * resolution - 0.5))
        column = int(round((longitude % 360.0) * resolution - 0.5)) % self.metadata.line_samples
        return row, column

    def _window(self, latitude: float, longitude: float, radius_pixels: int) -> tuple[np.ndarray | None, TerrainCoverage]:
        row, column = self._pixel_indices(latitude, longitude)
        expected = (2 * radius_pixels + 1) ** 2
        center_covered = 0 <= row < self.metadata.lines
        if not center_covered:
            return None, TerrainCoverage("", False, False, "NO_COVERAGE", "NO_COVERAGE", 0, expected, 0.0, row, column)
        rows = np.arange(row - radius_pixels, row + radius_pixels + 1)
        if rows.min() < 0 or rows.max() >= self.metadata.lines:
            valid_rows = rows[(rows >= 0) & (rows < self.metadata.lines)]
            raw = self.grid[np.ix_(valid_rows, (np.arange(column - radius_pixels, column + radius_pixels + 1) % self.metadata.line_samples))]
            valid = (raw >= self.metadata.minimum_dn) & (raw <= self.metadata.maximum_dn)
            count = int(valid.sum())
            return None, TerrainCoverage("", True, bool(valid[self._pixel_indices(latitude, longitude)[0] - valid_rows[0], radius_pixels]), "PARTIAL_COVERAGE", "PARTIAL_COVERAGE", count, expected, count / expected, row, column)
        columns = np.arange(column - radius_pixels, column + radius_pixels + 1) % self.metadata.line_samples
        raw = np.asarray(self.grid[np.ix_(rows, columns)])
        valid = (raw >= self.metadata.minimum_dn) & (raw <= self.metadata.maximum_dn)
        count = int(valid.sum())
        ratio = count / expected
        center_valid = bool(valid[radius_pixels, radius_pixels])
        if not center_valid:
            status = "NO_COVERAGE"
        elif ratio < MIN_VALID_RATIO:
            status = "INSUFFICIENT_VALID_PIXELS"
        else:
            status = "COVERED"
        values = raw.astype(float) * self.metadata.scale_m_per_dn if status == "COVERED" else None
        return values, TerrainCoverage("", True, center_valid, "FULL" if status == "COVERED" else "PARTIAL_COVERAGE", status, count, expected, ratio, row, column)

    def coverage(self, site: LunarLocation, radius_pixels: int = SUPPORT_RADIUS_PIXELS) -> TerrainCoverage:
        _, coverage = self._window(site.latitude, site.longitude, radius_pixels)
        return replace(coverage, site_id=site.site_id)

    def derive_features(self, site: LunarLocation, radius_pixels: int = SUPPORT_RADIUS_PIXELS) -> tuple[list[LunarFeatureObservation], TerrainCoverage]:
        values, unnamed_coverage = self._window(site.latitude, site.longitude, radius_pixels)
        coverage = replace(unnamed_coverage, site_id=site.site_id)
        if values is None or coverage.processing_status != "COVERED":
            return [], coverage
        metrics = derive_regional_terrain_metrics(values, self.metadata.source_resolution_m)
        support_width_m = (2 * radius_pixels + 1) * self.metadata.source_resolution_m
        product_checksum = sha256_file(self.image_path)
        timestamp = datetime.now(timezone.utc)
        common_flags = {
            "valid_pixel_count": coverage.valid_pixel_count,
            "expected_pixel_count": coverage.expected_pixel_count,
            "valid_pixel_ratio": coverage.valid_pixel_ratio,
            "source_resolution_m": self.metadata.source_resolution_m,
            "support_width_m": support_width_m,
            "no_data_handling": "Pixels outside documented LDEM_16 MINIMUM..MAXIMUM DN are invalid; no interpolation is performed.",
            "uncertainty_method": "Not estimated: product and local derivation uncertainty were not combined.",
        }
        method = (
            f"Native LDEM_16 5×5 window ({support_width_m:.2f} m support): relative elevation is center minus local median; "
            "slope is least-squares plane gradient; roughness is population standard deviation of plane residuals; relief is max minus min."
        )
        provenance = LunarProvenance(
            source_data_status="REAL",
            source_reference="NASA PDS LOLA LDEM_16 Gridded Data Record",
            derivation_lineage=["LDEM_16 DN × 0.5 m", "Regional 5×5 terrain metrics"],
            source_url=LOLA_SOURCE_URL,
            product_id=self.metadata.product_id,
            product_version=self.metadata.product_version,
            source_file_name=self.image_path.name,
            source_checksum_sha256=product_checksum,
            processing_software=f"Python {PROCESSING_VERSION}",
            processing_parameters={"radius_pixels": radius_pixels, "minimum_valid_ratio": MIN_VALID_RATIO, "support_width_m": support_width_m},
            processing_timestamp=timestamp,
            source_crs=self.metadata.source_crs,
            processing_crs=self.metadata.source_crs,
        )
        observations = []
        for feature_key, value, unit in (
            ("relative_elevation_m", metrics["relative_elevation_m"], "m"),
            ("slope_deg_windowed", metrics["slope_deg_windowed"], "°"),
            ("terrain_roughness_m_windowed", metrics["terrain_roughness_m_windowed"], "m"),
            ("local_relief_m", metrics["local_relief_m"], "m"),
        ):
            observations.append(LunarFeatureObservation(
                feature_key=feature_key, value=value, unit=unit, data_status="DERIVED", observation_kind="DERIVED",
                source="NASA PDS / LRO LOLA LDEM_16", product_id=self.metadata.product_id,
                observation_period={"start": self.metadata.start_time, "end": self.metadata.stop_time},
                spatial_resolution_m=self.metadata.source_resolution_m, processing_method=method,
                quality_status="PASS", quality_flags={**common_flags, "coverage_status": coverage.processing_status},
                uncertainty=None, provenance=provenance,
            ))
        return observations, coverage

    def manifest(self, coverage: list[TerrainCoverage]) -> dict:
        return {
            "ingestion_timestamp": datetime.now(timezone.utc).isoformat(),
            "processing_version": PROCESSING_VERSION,
            "source": {
                "url": LOLA_SOURCE_URL,
                "label_url": LOLA_LABEL_URL,
                "file_name": self.image_path.name,
                "label_file_name": self.label_path.name,
                "sha256": sha256_file(self.image_path),
                "label_sha256": sha256_file(self.label_path),
                "metadata": asdict(self.metadata),
            },
            "processing_parameters": {"radius_pixels": SUPPORT_RADIUS_PIXELS, "minimum_valid_ratio": MIN_VALID_RATIO},
            "coverage_report": [asdict(item) for item in coverage],
        }


def write_lola_metadata_and_manifest(dataset: LolaLdem16, output_dir: Path, coverage: list[TerrainCoverage]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir = output_dir / "raw" / "lola" / "metadata"
    manifest_dir = output_dir / "manifests"
    metadata_dir.mkdir(parents=True, exist_ok=True)
    manifest_dir.mkdir(parents=True, exist_ok=True)
    (metadata_dir / "ldem_16_product_metadata.json").write_text(json.dumps(asdict(dataset.metadata), indent=2), encoding="utf-8")
    (manifest_dir / "lola_ingestion_manifest.json").write_text(json.dumps(dataset.manifest(coverage), indent=2), encoding="utf-8")
