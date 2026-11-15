"""Read the verified NASA PDS Diviner south-polar resource product.

The PRP is an archival, fixed-width ASCII table.  This module deliberately
uses the field offsets published in its PDS4 product label rather than trying
to infer columns from whitespace.  It only reports the nearest archived mesh
element; it does not interpolate or manufacture a value between elements.
"""

from __future__ import annotations

import hashlib
import math
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.schemas.lunar import LunarFeatureObservation, LunarLocation, LunarProvenance


DIVINER_PRP_SOUTH_URL = (
    "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/"
    "data_derived_prp/dlre_prp_south.tab"
)
DIVINER_PRP_SOUTH_LABEL_URL = (
    "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/"
    "data_derived_prp/dlre_prp_south.lbl"
)
DIVINER_PRP_SOUTH_PDS4_LABEL_URL = (
    "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/"
    "data_derived_prp/dlre_prp_south.xml"
)
DIVINER_DATASET_ID = "LRO-L-DLRE-5-PRP-V2.0"
DIVINER_PRODUCT_ID = "DLRE_PRP_SOUTH.TAB"
DIVINER_PROCESSING_VERSION = "terramatch-diviner-prp-v1"
SOUTH_POLAR_MIN_LATITUDE = -80.0

# PDS4 ``field_location`` is one-based.  The line records include CRLF.
RECORD_BYTES = 210
HEADER_RECORDS = 1
RECORD_COUNT = 2_880_000
LON_SLICE = slice(126, 141)
LAT_SLICE = slice(143, 158)
ALT_SLICE = slice(160, 175)
TEMP_AVG_SLICE = slice(177, 185)
TEMP_MAX_SLICE = slice(187, 195)
ICE_DEPTH_SLICE = slice(197, 208)


@dataclass(frozen=True)
class DivinerPrpMetadata:
    product_id: str
    product_version: str
    data_set_id: str
    record_bytes: int
    file_records: int
    product_creation_time: str
    source_crs: str


@dataclass(frozen=True)
class DivinerPrpMatch:
    site_id: str
    triangle_longitude_deg: float
    triangle_latitude_deg: float
    triangle_altitude_km: float
    distance_km: float
    annual_mean_temp_2cm_k: float
    annual_max_surface_temp_k: float
    ice_stability_depth_m: float | None


def _label_value(label: str, key: str) -> str:
    match = re.search(rf"^\s*{re.escape(key)}\s*=\s*(.+)$", label, flags=re.MULTILINE)
    if not match:
        raise ValueError(f"Diviner label is missing {key}")
    return match.group(1).strip().strip('"').strip("'")


def parse_prp_south_label(path: Path) -> DivinerPrpMetadata:
    label = path.read_text(encoding="ascii")
    metadata = DivinerPrpMetadata(
        product_id=_label_value(label, "PRODUCT_ID"),
        product_version=_label_value(label, "PRODUCT_VERSION_ID"),
        data_set_id=_label_value(label, "DATA_SET_ID"),
        record_bytes=int(_label_value(label, "RECORD_BYTES")),
        file_records=int(_label_value(label, "FILE_RECORDS")),
        product_creation_time=_label_value(label, "PRODUCT_CREATION_TIME"),
        source_crs="Moon-centered, planetocentric latitude; east-positive longitude; 1737.4 km spherical reference radius",
    )
    if (
        metadata.product_id != DIVINER_PRODUCT_ID
        or metadata.data_set_id != DIVINER_DATASET_ID
        or metadata.record_bytes != RECORD_BYTES
        or metadata.file_records != RECORD_COUNT
    ):
        raise ValueError("Unsupported Diviner PRP product geometry or identifier")
    return metadata


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _float_field(record: bytes, field: slice) -> float:
    return float(record[field].decode("ascii").strip().rstrip(","))


def _angular_distance_km(latitude: float, longitude: float, other_latitude: float, other_longitude: float) -> float:
    """Great-circle distance on the PRP's documented 1737.4 km reference sphere."""
    lat1, lon1, lat2, lon2 = map(math.radians, (latitude, longitude, other_latitude, other_longitude))
    cosine = math.sin(lat1) * math.sin(lat2) + math.cos(lat1) * math.cos(lat2) * math.cos(lon1 - lon2)
    return 1737.4 * math.acos(max(-1.0, min(1.0, cosine)))


class DivinerPrpSouth:
    def __init__(self, table_path: Path, label_path: Path):
        if not table_path.exists():
            raise FileNotFoundError(f"Diviner source table is missing: {table_path.name}")
        self.table_path = table_path
        self.label_path = label_path
        self.metadata = parse_prp_south_label(label_path)
        expected_size = RECORD_BYTES * (HEADER_RECORDS + RECORD_COUNT)
        if table_path.stat().st_size != expected_size:
            raise ValueError("Diviner source table size does not match its verified label geometry")

    def nearest_matches(self, sites: list[LunarLocation]) -> dict[str, DivinerPrpMatch]:
        """Return one archived PRP mesh element nearest each requested site.

        The source contains a 2.88-million-triangle mesh; a sequential fixed
        width scan keeps peak memory small and makes the selected source record
        reproducible.  Only south-polar locations covered by the product are
        accepted.
        """
        targets = [site for site in sites if site.latitude <= SOUTH_POLAR_MIN_LATITUDE]
        if not targets:
            return {}
        nearest: dict[str, tuple[float, tuple[float, float, float, float, float, float]]] = {}
        with self.table_path.open("rb") as source:
            header = source.read(RECORD_BYTES)
            if b"tri_clon" not in header or b"temp_avg" not in header:
                raise ValueError("Diviner source header does not match the verified PRP schema")
            for _ in range(RECORD_COUNT):
                record = source.read(RECORD_BYTES)
                if len(record) != RECORD_BYTES:
                    raise ValueError("Diviner source table ended before its documented record count")
                longitude = _float_field(record, LON_SLICE)
                latitude = _float_field(record, LAT_SLICE)
                for site in targets:
                    distance = _angular_distance_km(site.latitude, site.longitude, latitude, longitude)
                    previous = nearest.get(site.site_id)
                    if previous is None or distance < previous[0]:
                        nearest[site.site_id] = (
                            distance,
                            (
                                longitude,
                                latitude,
                                _float_field(record, ALT_SLICE),
                                _float_field(record, TEMP_AVG_SLICE),
                                _float_field(record, TEMP_MAX_SLICE),
                                _float_field(record, ICE_DEPTH_SLICE),
                            ),
                        )
        return {
            site_id: DivinerPrpMatch(
                site_id=site_id,
                triangle_longitude_deg=values[0],
                triangle_latitude_deg=values[1],
                triangle_altitude_km=values[2],
                distance_km=distance,
                annual_mean_temp_2cm_k=values[3],
                annual_max_surface_temp_k=values[4],
                ice_stability_depth_m=None if values[5] == -999.0 else values[5],
            )
            for site_id, (distance, values) in nearest.items()
        }

    def derive_features(self, site: LunarLocation, match: DivinerPrpMatch) -> list[LunarFeatureObservation]:
        checksum = sha256_file(self.table_path)
        provenance = LunarProvenance(
            source_data_status="REAL",
            source_reference="NASA PDS / LRO Diviner South Polar Resource Product",
            derivation_lineage=[
                "NASA Diviner PRP level-4 thermal model product",
                "Nearest documented triangular mesh-element centre; no interpolation",
            ],
            source_url=DIVINER_PRP_SOUTH_URL,
            product_id=self.metadata.product_id,
            product_version=self.metadata.product_version,
            source_file_name=self.table_path.name,
            source_checksum_sha256=checksum,
            processing_software=f"Python {DIVINER_PROCESSING_VERSION}",
            processing_parameters={
                "selection_method": "nearest triangle centre by great-circle distance",
                "triangle_centre_longitude_deg": match.triangle_longitude_deg,
                "triangle_centre_latitude_deg": match.triangle_latitude_deg,
                "distance_to_site_km": match.distance_km,
                "ice_depth_invalid_value_m": -999.0,
            },
            processing_timestamp=datetime.now(timezone.utc),
            source_crs=self.metadata.source_crs,
            processing_crs=self.metadata.source_crs,
        )
        flags = {
            "triangle_centre_longitude_deg": match.triangle_longitude_deg,
            "triangle_centre_latitude_deg": match.triangle_latitude_deg,
            "triangle_centre_altitude_km": match.triangle_altitude_km,
            "distance_to_site_km": match.distance_km,
            "selection_method": "Nearest PRP mesh-element centre; no interpolation.",
            "source_level": "NASA Level 4 / CODMAC Level 5 model-derived product",
            "uncertainty_method": "Not supplied in the archived PRP; no uncertainty is inferred by TerraMatch.",
        }
        observations = [
            LunarFeatureObservation(
                feature_key="subsurface_temp_2cm_k_annual_mean",
                value=match.annual_mean_temp_2cm_k,
                unit="K",
                data_status="DERIVED",
                observation_kind="DERIVED",
                source="NASA PDS / LRO Diviner PRP",
                product_id=self.metadata.product_id,
                spatial_resolution_m=None,
                processing_method="NASA annual thermal-model value at 2 cm depth; nearest PRP triangular mesh element.",
                quality_status="PASS",
                quality_flags=flags,
                provenance=provenance,
            ),
            LunarFeatureObservation(
                feature_key="surface_temp_k_annual_max",
                value=match.annual_max_surface_temp_k,
                unit="K",
                data_status="DERIVED",
                observation_kind="DERIVED",
                source="NASA PDS / LRO Diviner PRP",
                product_id=self.metadata.product_id,
                processing_method="NASA annual maximum surface thermal-model value; nearest PRP triangular mesh element.",
                quality_status="PASS",
                quality_flags=flags,
                provenance=provenance,
            ),
        ]
        if match.ice_stability_depth_m is not None:
            observations.append(LunarFeatureObservation(
                feature_key="water_ice_stability_depth_m",
                value=match.ice_stability_depth_m,
                unit="m",
                data_status="DERIVED",
                observation_kind="DERIVED",
                source="NASA PDS / LRO Diviner PRP",
                product_id=self.metadata.product_id,
                processing_method="NASA modelled water-ice stability depth; nearest PRP triangular mesh element.",
                quality_status="PASS",
                quality_flags=flags,
                provenance=provenance,
            ))
        return observations

    def manifest(self, matches: dict[str, DivinerPrpMatch]) -> dict:
        return {
            "ingestion_timestamp": datetime.now(timezone.utc).isoformat(),
            "processing_version": DIVINER_PROCESSING_VERSION,
            "source": {
                "url": DIVINER_PRP_SOUTH_URL,
                "pds3_label_url": DIVINER_PRP_SOUTH_LABEL_URL,
                "pds4_label_url": DIVINER_PRP_SOUTH_PDS4_LABEL_URL,
                "file_name": self.table_path.name,
                "label_file_name": self.label_path.name,
                "sha256": sha256_file(self.table_path),
                "label_sha256": sha256_file(self.label_path),
                "metadata": asdict(self.metadata),
            },
            "selection": {
                "method": "nearest triangle centre by great-circle distance; no interpolation",
                "eligible_site_latitude_lte": SOUTH_POLAR_MIN_LATITUDE,
                "matches": {site_id: asdict(match) for site_id, match in matches.items()},
            },
        }
