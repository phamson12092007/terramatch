"""Single source of truth for TerraMatch Earth-feature semantics.

Availability describes whether a provider can currently supply the Earth
observation. Compatibility describes whether the current lunar *sample* schema
has a physically comparable target. They are deliberately independent.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Callable, Literal


DataAvailability = Literal["AVAILABLE", "PLANNED"]
LunarCompatibility = Literal["COMPATIBLE", "UNSUPPORTED"]


@dataclass(frozen=True)
class UnitConversion:
    from_unit: str
    to_unit: str
    formula: str
    convert: Callable[[float], float]


@dataclass(frozen=True)
class EarthFeatureDefinition:
    key: str
    label: str
    category: str
    unit: str
    description: str
    source: str
    data_availability: DataAvailability
    lunar_compatibility: LunarCompatibility
    similarity_supported: bool
    normalization_scale: float | None
    conversion: UnitConversion | None
    unavailable_reason: str | None
    lunar_feature_key: str | None
    lunar_source: str | None = None
    earth_equivalent_candidate: str | None = None
    scientific_classification: str | None = None
    comparison_method: str | None = None
    required_spatial_support_m: float | None = None
    processing_method: str | None = None

    def as_dict(self) -> dict:
        value = asdict(self)
        if self.conversion:
            value["conversion"].pop("convert")
        return value


CELSIUS_TO_KELVIN = UnitConversion(
    from_unit="°C",
    to_unit="K",
    formula="K = °C + 273.15",
    convert=lambda value: value + 273.15,
)


# Do not mark a compatible planned feature as scoreable. A later integration
# stage can make it eligible only after a REAL observation has been retrieved.
FEATURE_REGISTRY: dict[str, EarthFeatureDefinition] = {
    "elevation_m": EarthFeatureDefinition(
        key="elevation_m",
        label="Elevation",
        category="Terrain",
        unit="m",
        description="Surface elevation from a validated DEM observation.",
        source="NASA SRTM",
        data_availability="PLANNED",
        lunar_compatibility="COMPATIBLE",
        similarity_supported=False,
        normalization_scale=5000,
        conversion=None,
        unavailable_reason="SRTM observations have not yet been retrieved and validated for the current Earth records.",
        lunar_feature_key="elevation_m",
    ),
    "slope_deg": EarthFeatureDefinition(
        key="slope_deg",
        label="Local terrain slope",
        category="Terrain",
        unit="°",
        description="Slope derived from a validated DEM neighborhood.",
        source="Derived from NASA SRTM DEM",
        data_availability="PLANNED",
        lunar_compatibility="COMPATIBLE",
        similarity_supported=False,
        normalization_scale=45,
        conversion=None,
        unavailable_reason="SRTM-derived slope has not yet been retrieved and validated for the current Earth records.",
        lunar_feature_key="slope_deg",
    ),
    "terrain_roughness_m": EarthFeatureDefinition(
        key="terrain_roughness_m",
        label="Local terrain roughness",
        category="Terrain",
        unit="m",
        description="Terrain variability derived from a local DEM neighborhood.",
        source="Derived from NASA SRTM DEM",
        data_availability="PLANNED",
        lunar_compatibility="UNSUPPORTED",
        similarity_supported=False,
        normalization_scale=None,
        conversion=None,
        unavailable_reason="The current lunar sample schema has no terrain-roughness target feature.",
        lunar_feature_key=None,
    ),
    "land_surface_temperature_day_k_mean": EarthFeatureDefinition(
        key="land_surface_temperature_day_k_mean",
        label="Mean daytime land-surface temperature",
        category="Thermal",
        unit="K",
        description="Quality-validated MODIS daytime land-surface temperature mean.",
        source="NASA MODIS MOD11A1.061",
        data_availability="PLANNED",
        lunar_compatibility="COMPATIBLE",
        similarity_supported=False,
        normalization_scale=200,
        conversion=None,
        unavailable_reason="MODIS land-surface-temperature observations have not yet been retrieved and validated for the current Earth records.",
        lunar_feature_key="surface_temp_k",
    ),
    "land_surface_temperature_night_k_mean": EarthFeatureDefinition(
        key="land_surface_temperature_night_k_mean",
        label="Mean nighttime land-surface temperature",
        category="Thermal",
        unit="K",
        description="Quality-validated MODIS nighttime land-surface temperature mean.",
        source="NASA MODIS MOD11A1.061",
        data_availability="PLANNED",
        lunar_compatibility="UNSUPPORTED",
        similarity_supported=False,
        normalization_scale=None,
        conversion=None,
        unavailable_reason="The current lunar sample schema has a single surface-temperature sample and no nighttime counterpart.",
        lunar_feature_key=None,
    ),
    "air_temperature_2m_c_mean": EarthFeatureDefinition(
        key="air_temperature_2m_c_mean",
        label="Mean air temperature at 2 m",
        category="Thermal",
        unit="°C",
        description="NASA POWER two-metre air temperature mean; not land-surface temperature.",
        source="NASA POWER",
        data_availability="AVAILABLE",
        lunar_compatibility="UNSUPPORTED",
        similarity_supported=False,
        normalization_scale=None,
        conversion=CELSIUS_TO_KELVIN,
        unavailable_reason="The current lunar sample schema has no air-temperature target. Converting units does not make air and surface temperatures comparable.",
        lunar_feature_key=None,
    ),
    "air_temperature_2m_c_min": EarthFeatureDefinition(
        key="air_temperature_2m_c_min",
        label="Minimum air temperature at 2 m",
        category="Thermal",
        unit="°C",
        description="NASA POWER two-metre daily air-temperature minimum over the requested period.",
        source="NASA POWER",
        data_availability="AVAILABLE",
        lunar_compatibility="UNSUPPORTED",
        similarity_supported=False,
        normalization_scale=None,
        conversion=CELSIUS_TO_KELVIN,
        unavailable_reason="The current lunar sample schema has no minimum air-temperature target.",
        lunar_feature_key=None,
    ),
    "air_temperature_2m_c_max": EarthFeatureDefinition(
        key="air_temperature_2m_c_max",
        label="Maximum air temperature at 2 m",
        category="Thermal",
        unit="°C",
        description="NASA POWER two-metre daily air-temperature maximum over the requested period.",
        source="NASA POWER",
        data_availability="AVAILABLE",
        lunar_compatibility="UNSUPPORTED",
        similarity_supported=False,
        normalization_scale=None,
        conversion=CELSIUS_TO_KELVIN,
        unavailable_reason="The current lunar sample schema has no maximum air-temperature target.",
        lunar_feature_key=None,
    ),
    "all_sky_surface_shortwave_down_mj_m2_day_mean": EarthFeatureDefinition(
        key="all_sky_surface_shortwave_down_mj_m2_day_mean",
        label="Mean all-sky surface shortwave downward radiation",
        category="Solar and Illumination",
        unit="MJ/m²/day",
        description="NASA POWER downward shortwave radiation at the surface, averaged over the requested period.",
        source="NASA POWER",
        data_availability="AVAILABLE",
        lunar_compatibility="UNSUPPORTED",
        similarity_supported=False,
        normalization_scale=None,
        conversion=None,
        unavailable_reason="The current lunar sample schema has no comparable solar-radiation feature; this value is not terrain illumination, shadow duration, or solar incidence angle.",
        lunar_feature_key=None,
    ),
    "relative_elevation_m": EarthFeatureDefinition(
        key="relative_elevation_m",
        label="Relative local elevation",
        category="Terrain",
        unit="m",
        description="Center elevation relative to a documented local DEM neighborhood.",
        source="NASA SRTMGL1.003 regional DEM metric",
        data_availability="AVAILABLE",
        lunar_compatibility="COMPATIBLE",
        similarity_supported=True,
        normalization_scale=500,
        conversion=None,
        unavailable_reason=None,
        lunar_feature_key="relative_elevation_m",
        lunar_source="NASA PDS / LRO LOLA LDEM_16",
        earth_equivalent_candidate="SRTMGL1.003-derived local relative elevation",
        scientific_classification="Stage 6F terrain-screening compatible",
        comparison_method="Center elevation minus local median over the documented 9.476 km nominal support; the local reference removes the absolute vertical datum.",
        required_spatial_support_m=9476.05,
        processing_method="Native DEM regional support targeted at 9.476 km; no resampling or NoData interpolation.",
    ),
    "slope_deg_windowed": EarthFeatureDefinition(
        key="slope_deg_windowed",
        label="Windowed terrain slope",
        category="Terrain",
        unit="°",
        description="Least-squares planar slope over a documented DEM support window.",
        source="NASA SRTMGL1.003 regional DEM metric",
        data_availability="AVAILABLE",
        lunar_compatibility="COMPATIBLE",
        similarity_supported=True,
        normalization_scale=10,
        conversion=None,
        unavailable_reason=None,
        lunar_feature_key="slope_deg_windowed",
        lunar_source="NASA PDS / LRO LOLA LDEM_16",
        earth_equivalent_candidate="SRTMGL1.003 least-squares windowed slope",
        scientific_classification="Stage 6F terrain-screening compatible",
        comparison_method="Least-squares plane gradient over the documented 9.476 km nominal support.",
        required_spatial_support_m=9476.05,
        processing_method="Native DEM regional support targeted at 9.476 km; no resampling or NoData interpolation.",
    ),
    "terrain_roughness_m_windowed": EarthFeatureDefinition(
        key="terrain_roughness_m_windowed",
        label="Windowed terrain roughness",
        category="Terrain",
        unit="m",
        description="Population standard deviation of DEM residuals from a fitted local plane.",
        source="NASA SRTMGL1.003 regional DEM metric",
        data_availability="AVAILABLE",
        lunar_compatibility="COMPATIBLE",
        similarity_supported=True,
        normalization_scale=100,
        conversion=None,
        unavailable_reason=None,
        lunar_feature_key="terrain_roughness_m_windowed",
        lunar_source="NASA PDS / LRO LOLA LDEM_16",
        earth_equivalent_candidate="SRTMGL1.003 plane-residual roughness",
        scientific_classification="Experimental terrain-screening compatible",
        comparison_method="Population standard deviation of local plane residuals over identical physical support.",
        required_spatial_support_m=9476.05,
        processing_method="Native DEM 5×5 regional window; Earth implementation must use the same documented support.",
    ),
    "local_relief_m": EarthFeatureDefinition(
        key="local_relief_m",
        label="Local relief",
        category="Terrain",
        unit="m",
        description="Maximum minus minimum elevation within a documented DEM neighborhood.",
        source="NASA SRTMGL1.003 regional DEM metric",
        data_availability="AVAILABLE",
        lunar_compatibility="COMPATIBLE",
        similarity_supported=True,
        normalization_scale=1000,
        conversion=None,
        unavailable_reason=None,
        lunar_feature_key="local_relief_m",
        lunar_source="NASA PDS / LRO LOLA LDEM_16",
        earth_equivalent_candidate="SRTMGL1.003 local elevation range",
        scientific_classification="Experimental terrain-screening compatible",
        comparison_method="Maximum minus minimum elevation over identical physical support.",
        required_spatial_support_m=9476.05,
        processing_method="Native DEM 5×5 regional window; Earth implementation must use the same documented support.",
    ),
}


def get_all_features() -> tuple[EarthFeatureDefinition, ...]:
    """Return every registered Earth feature in stable registry order."""
    return tuple(FEATURE_REGISTRY.values())


def get_feature(key: str) -> EarthFeatureDefinition:
    try:
        return FEATURE_REGISTRY[key]
    except KeyError as error:
        raise ValueError(f"Unsupported Earth feature: {key}") from error


def resolve_comparison_criterion(key: str) -> EarthFeatureDefinition:
    """Resolve an Earth key or lunar-target key to one Earth feature.

    API callers historically send lunar target keys (such as
    ``surface_temp_k``), while records use Earth observation keys (such as
    ``land_surface_temperature_day_k_mean``).  Centralizing that mapping here
    prevents the similarity service from maintaining a duplicate mapping.
    """
    direct = FEATURE_REGISTRY.get(key)
    if direct is not None:
        return direct

    matches = [feature for feature in get_all_features() if feature.lunar_feature_key == key]
    if not matches:
        raise ValueError(f"Unknown comparison criterion: {key}")
    if len(matches) > 1:
        raise ValueError(
            f"Comparison criterion {key} is ambiguous; select one registered Earth feature explicitly."
        )
    return matches[0]


def get_similarity_eligible_features() -> tuple[EarthFeatureDefinition, ...]:
    """Return only currently scoreable registry entries.

    This does not inspect a particular location. It intentionally returns no
    planned feature until its provider is represented as available here.
    """
    return tuple(feature for feature in get_all_features() if feature.similarity_supported)


def validate_similarity_criterion(key: str) -> EarthFeatureDefinition:
    feature = resolve_comparison_criterion(key)
    if not feature.similarity_supported:
        reason = feature.unavailable_reason or "This feature is not available for similarity comparison."
        raise ValueError(reason)
    return feature


def get_comparison_explanation(key: str) -> str:
    feature = get_feature(key)
    if feature.similarity_supported:
        return f"{feature.label} is available for similarity comparison."
    return feature.unavailable_reason or "This feature is not available for similarity comparison."
