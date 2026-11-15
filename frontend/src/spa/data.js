export const target = {
  name: "South Pole–Aitken Basin",
  region: "53°S – 88°S",
  equipment: "Lunar Terrain Vehicle",
  metrics: {
    slope: { mean: 9.5, std: 5.5 },
    roughness: { mean: 0.68, std: 0.2 },
    geology: { mean: 0.95, std: 0.15 },
    albedoLight: { mean: 0.1, std: 0.06 },
    thermalShock: { mean: 25, std: 8 },
    horizonOcclusion: { mean: 4.5, std: 2.5 },
  },
};

export const modes = {
  CREWED_TRAVERSE: {
    label: "Crewed EVA traverse",
    short: "Crewed driving",
    description: "Prioritizes slope, roughness, and bedrock for crewed LTV traverses.",
    weights: { slope: 0.3, roughness: 0.25, geology: 0.25, albedoLight: 0.05, thermalShock: 0.1, horizonOcclusion: 0.05 },
    critical: ["slope", "geology"],
  },
  AUTONOMOUS_SCOUT: {
    label: "Uncrewed autonomous scouting",
    short: "Autonomous",
    description: "Weights lighting, camera visibility, and localization more heavily for autonomous operations.",
    weights: { slope: 0.2, roughness: 0.15, geology: 0.1, albedoLight: 0.25, thermalShock: 0.1, horizonOcclusion: 0.2 },
    critical: ["slope", "albedoLight"],
  },
  WHEEL_TORTURE_TEST: {
    label: "Wheel & suspension stress test",
    short: "Wheels & suspension",
    description: "Focuses on mafic rock, roughness, and mechanical wheel loads.",
    weights: { slope: 0.2, roughness: 0.35, geology: 0.3, albedoLight: 0, thermalShock: 0.15, horizonOcclusion: 0 },
    critical: ["roughness", "geology"],
  },
};

export const metricLabels = {
  slope: "Slope",
  roughness: "TRI roughness",
  geology: "Mafic rock / breccia",
  albedoLight: "Surface reflectance",
  thermalShock: "Thermal shock",
  horizonOcclusion: "Horizon occlusion",
};

export const lunarSites = [
  {
    site_id: "shackleton-rim", name: "Shackleton Rim", reference: "NASA Site 04",
    latitude: -89.7668, longitude: -171.87, category: "south-pole", kind: "Impact crater rim / reference point",
    summary: "Shackleton Rim is listed as a reference site in the Lunar Surface Data Book.",
    source: "NASA Lunar Surface Data Book, Table A2-2 (2023)", sourceUrl: "https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf",
    sourceNote: "Site 04 coordinates; the table reports approximately 5–10 m accuracy for the original polygon centroid.", data_status: "NASA SOURCE",
  },
  {
    site_id: "malapert-massif", name: "Malapert Massif", reference: "NASA Site 23",
    latitude: -85.9948, longitude: -0.23578, category: "south-pole", kind: "Massif / reference point",
    summary: "Site 23 on Malapert Massif, a highland region near the lunar south pole.",
    source: "NASA Lunar Surface Data Book, Table A2-2 (2023)", sourceUrl: "https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf",
    sourceNote: "Site 23 coordinates; the table reports approximately 5–10 m accuracy for the original polygon centroid.", data_status: "NASA SOURCE",
  },
  {
    site_id: "cabeus-crater", name: "Cabeus Crater", reference: "LCROSS impact target (approx.)",
    latitude: -84.9, longitude: -35.5, category: "south-pole", reference: "LCROSS impact target (approx.)", kind: "Crater / LCROSS impact target",
    summary: "A crater near the south pole selected as the LCROSS impact target to investigate volatile materials.",
    source: "NASA NTRS, LCROSS target description", sourceUrl: "https://ntrs.nasa.gov/citations/20250003292",
    sourceNote: "Approximate coordinates for the LCROSS target center; these do not define the full crater boundary.", data_status: "NASA SOURCE",
  },
  {
    site_id: "amundsen-crater", name: "Amundsen Crater", reference: "NASA Amundsen 1",
    latitude: -83.9046, longitude: 89.53545, category: "south-pole", kind: "Crater / reference point",
    summary: "Amundsen 1 is listed in NASA's catalog of south-polar features.",
    source: "NASA Lunar Surface Data Book, Table A2-2 (2023)", sourceUrl: "https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf",
    sourceNote: "Uses catalog coordinates for Amundsen 1; these do not represent the entire crater.", data_status: "NASA SOURCE",
  },
  {
    site_id: "apollo-11", name: "Apollo 11", reference: "Mare Tranquillitatis",
    latitude: 0.67416, longitude: 23.47314, category: "heritage", kind: "Historic landing site",
    summary: "Landing location of the Apollo 11 Lunar Module Eagle.",
    source: "NASA NSSDC, Apollo Landing Site Coordinates", sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
    sourceNote: "Apollo 11 landing coordinates from the NSSDC table.", data_status: "NASA SOURCE",
  },
  {
    site_id: "luna-17", name: "Luna 17", reference: "Mare Imbrium",
    latitude: 38.23764, longitude: -35.00163, category: "heritage", kind: "Historic landing site",
    summary: "Landing location of Luna 17 and the Lunokhod 1 rover.",
    source: "NASA NSSDC, Table of Anthropogenic Impacts and Spacecraft on the Moon", sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html",
    sourceNote: "NSSDC lists 35.00163°W; west longitudes are stored as negative values for consistency.", data_status: "NASA SOURCE",
  },
];

// Recomputed at the displayed NASA reference coordinates from LOLA LDEM_16
// (PDS v3.1); each neighborhood metric uses the native 5x5 pixel window.
export const lunarSiteTerrainMetrics = {
  source: "NASA PDS / LRO LOLA LDEM_16 v3.1",
  sourceUrl: "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img",
  resolutionM: 1895.21,
  supportM: 9476.05,
  validPixels: 25,
  expectedPixels: 25,
  values: {
    "shackleton-rim": { elevationM: 771, relativeElevationM: -133.5, slopeDeg: 3.3070385774796516, roughnessM: 142.49537676710779, localReliefM: 609.5 },
    "malapert-massif": { elevationM: 4695.5, relativeElevationM: 273.5, slopeDeg: 2.097197534859807, roughnessM: 351.43832659515095, localReliefM: 1018 },
    "cabeus-crater": { elevationM: -2860, relativeElevationM: 0, slopeDeg: 4.383936968886815, roughnessM: 88.97381974491144, localReliefM: 646.5 },
    "amundsen-crater": { elevationM: -3632.5, relativeElevationM: -1, slopeDeg: 0.017557935534875144, roughnessM: 2.0755240302149884, localReliefM: 9 },
  },
};

export const candidates = [
  {
    id: "H3-SPA-01", name: "Haughton Impact Basin", place: "Devon Island, Canada",
    lat: 75.383, lon: -89.667, type: "Polar impact basin",
    slopeDeg: 10.5, roughnessTRI: 0.72, maficBrecciaScore: 0.94,
    surfaceAlbedo: 0.14, skinThermalShockC: 21.5, horizonOcclusionDeg: 4.8,
    ndvi: 0.02, minSunAngleDeg: 2.2, logisticsTier: "Tier 3 · Remote Arctic",
    bestTestingWindow: "September – October", description: "Impact breccia, low solar angles, and basin terrain support autonomous sensor testing.",
  },
  {
    id: "H3-SPA-02", name: "Askja & Holuhraun", place: "Iceland",
    lat: 65.033, lon: -16.75, type: "Volcanic basin and basalt plain",
    slopeDeg: 9.2, roughnessTRI: 0.7, maficBrecciaScore: 0.96,
    surfaceAlbedo: 0.09, skinThermalShockC: 22, horizonOcclusionDeg: 5.2,
    ndvi: 0.01, minSunAngleDeg: 3.5, logisticsTier: "Tier 2 · Highland access",
    bestTestingWindow: "October – November", description: "Dark basalt and sharp volcanic ash approximate SPA's mechanical test environment.",
  },
  {
    id: "H3-SPA-03", name: "Sudbury Basin Rim", place: "Ontario, Canada",
    lat: 46.616, lon: -81.183, type: "Multi-ring impact basin rim",
    slopeDeg: 8, roughnessTRI: 0.6, maficBrecciaScore: 0.98,
    surfaceAlbedo: 0.12, skinThermalShockC: 19.5, horizonOcclusionDeg: 3.8,
    ndvi: 0.18, minSunAngleDeg: 20, logisticsTier: "Tier 1 · Road access",
    bestTestingWindow: "November and March", description: "Norite and impact-melt terrain make this region suitable for materials and wheel testing.",
  },
  {
    id: "H3-SPA-04", name: "Lunar Crater Basin", place: "Nevada, United States",
    lat: 38.384, lon: -116.069, type: "Volcanic crater and basalt basin",
    slopeDeg: 11, roughnessTRI: 0.68, maficBrecciaScore: 0.91,
    surfaceAlbedo: 0.11, skinThermalShockC: 26.5, horizonOcclusionDeg: 5.5,
    ndvi: 0.06, minSunAngleDeg: 28, logisticsTier: "Tier 1 · Road access",
    bestTestingWindow: "November – February", description: "Dry basalt, large temperature swings, and crater rims create obstructed horizons.",
  },
  {
    id: "H3-SPA-05", name: "Black Point Basin", place: "Arizona, United States",
    lat: 35.688, lon: -111.465, type: "Basalt plain and crater field",
    slopeDeg: 8.8, roughnessTRI: 0.66, maficBrecciaScore: 0.9,
    surfaceAlbedo: 0.1, skinThermalShockC: 27, horizonOcclusionDeg: 4,
    ndvi: 0.07, minSunAngleDeg: 31, logisticsTier: "Tier 1 · Vehicle access",
    bestTestingWindow: "December – January", description: "Dark basalt and accessible routes are suitable for wheel and suspension testing.",
  },
  {
    id: "H3-SPA-06", name: "Lonar Impact Crater", place: "Deccan Traps, India",
    lat: 19.976, lon: 76.508, type: "Impact crater in basalt",
    slopeDeg: 14, roughnessTRI: 0.74, maficBrecciaScore: 0.95,
    surfaceAlbedo: 0.11, skinThermalShockC: 23, horizonOcclusionDeg: 6.2,
    ndvi: 0.19, minSunAngleDeg: 46.5, logisticsTier: "Tier 2 · Regional roads",
    bestTestingWindow: "December – February", description: "Impact into basalt creates breccia relevant to the mechanical properties of the SPA basin.",
  },
];
