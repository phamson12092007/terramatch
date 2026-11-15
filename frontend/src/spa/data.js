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
    label: "Di chuyển EVA có phi hành đoàn",
    short: "Lái xe có phi hành đoàn",
    description: "Ưu tiên độ dốc, độ gồ ghề và đá gốc cho các chuyến di chuyển bằng LTV có phi hành đoàn.",
    weights: { slope: 0.3, roughness: 0.25, geology: 0.25, albedoLight: 0.05, thermalShock: 0.1, horizonOcclusion: 0.05 },
    critical: ["slope", "geology"],
  },
  AUTONOMOUS_SCOUT: {
    label: "Trinh sát tự hành không người lái",
    short: "Tự hành",
    description: "Tăng trọng số cho điều kiện chiếu sáng, tầm nhìn camera và khả năng định vị khi xe hoạt động tự hành.",
    weights: { slope: 0.2, roughness: 0.15, geology: 0.1, albedoLight: 0.25, thermalShock: 0.1, horizonOcclusion: 0.2 },
    critical: ["slope", "albedoLight"],
  },
  WHEEL_TORTURE_TEST: {
    label: "Thử tải khắc nghiệt cho bánh xe và hệ thống treo",
    short: "Bánh xe và hệ thống treo",
    description: "Tập trung vào đá mafic, độ gồ ghề và tải trọng cơ học tác động lên bánh xe.",
    weights: { slope: 0.2, roughness: 0.35, geology: 0.3, albedoLight: 0, thermalShock: 0.15, horizonOcclusion: 0 },
    critical: ["roughness", "geology"],
  },
};

export const metricLabels = {
  slope: "Độ dốc",
  roughness: "Độ gồ ghề TRI",
  geology: "Đá mafic / đá dăm kết",
  albedoLight: "Độ phản xạ bề mặt",
  thermalShock: "Sốc nhiệt",
  horizonOcclusion: "Vật cản đường chân trời",
};

export const lunarSites = [
  {
    site_id: "shackleton-rim", name: "Shackleton Rim", reference: "NASA Site 04",
    latitude: -89.7668, longitude: -171.87, category: "south-pole", kind: "Vành miệng hố va chạm / điểm tham chiếu",
    summary: "Vành Shackleton được ghi nhận là một điểm tham chiếu trong Sổ tay dữ liệu bề mặt Mặt Trăng.",
    source: "NASA Lunar Surface Data Book, Table A2-2 (2023)", sourceUrl: "https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf",
    sourceNote: "Tọa độ điểm 04; bảng cho biết tâm đa giác ban đầu có độ chính xác khoảng 5–10 m.", data_status: "NGUỒN NASA",
  },
  {
    site_id: "malapert-massif", name: "Malapert Massif", reference: "NASA Site 23",
    latitude: -85.9948, longitude: -0.23578, category: "south-pole", kind: "Khối núi / điểm tham chiếu",
    summary: "Điểm 23 trên khối núi Malapert, vùng cao nguyên gần cực Nam Mặt Trăng.",
    source: "NASA Lunar Surface Data Book, Table A2-2 (2023)", sourceUrl: "https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf",
    sourceNote: "Tọa độ điểm 23; bảng cho biết tâm đa giác ban đầu có độ chính xác khoảng 5–10 m.", data_status: "NGUỒN NASA",
  },
  {
    site_id: "cabeus-crater", name: "Cabeus Crater", reference: "LCROSS impact target (approx.)",
    latitude: -84.9, longitude: -35.5, category: "south-pole", reference: "Mục tiêu va chạm LCROSS (xấp xỉ)", kind: "Hố va chạm / mục tiêu LCROSS",
    summary: "Hố va chạm gần cực Nam được chọn làm mục tiêu LCROSS để khảo sát các vật chất dễ bay hơi.",
    source: "NASA NTRS, LCROSS target description", sourceUrl: "https://ntrs.nasa.gov/citations/20250003292",
    sourceNote: "Tọa độ gần đúng tại tâm mục tiêu LCROSS; vị trí này không xác định toàn bộ ranh giới hố va chạm.", data_status: "NGUỒN NASA",
  },
  {
    site_id: "amundsen-crater", name: "Amundsen Crater", reference: "NASA Amundsen 1",
    latitude: -83.9046, longitude: 89.53545, category: "south-pole", kind: "Hố va chạm / điểm tham chiếu",
    summary: "Amundsen 1 có trong danh mục các đặc điểm địa hình vùng cực Nam của NASA.",
    source: "NASA Lunar Surface Data Book, Table A2-2 (2023)", sourceUrl: "https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf",
    sourceNote: "Sử dụng tọa độ Amundsen 1 trong danh mục; tọa độ này không đại diện cho toàn bộ hố va chạm.", data_status: "NGUỒN NASA",
  },
  {
    site_id: "apollo-11", name: "Apollo 11", reference: "Mare Tranquillitatis",
    latitude: 0.67416, longitude: 23.47314, category: "heritage", kind: "Địa điểm hạ cánh lịch sử",
    summary: "Vị trí tàu đổ bộ Mặt Trăng Eagle của sứ mệnh Apollo 11 hạ cánh.",
    source: "NASA NSSDC, Apollo Landing Site Coordinates", sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
    sourceNote: "Tọa độ điểm hạ cánh Apollo 11 theo bảng NSSDC.", data_status: "NGUỒN NASA",
  },
  {
    site_id: "luna-17", name: "Luna 17", reference: "Mare Imbrium",
    latitude: 38.23764, longitude: -35.00163, category: "heritage", kind: "Địa điểm hạ cánh lịch sử",
    summary: "Vị trí tàu Luna 17 và xe tự hành Lunokhod 1 hạ cánh.",
    source: "NASA NSSDC, Table of Anthropogenic Impacts and Spacecraft on the Moon", sourceUrl: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html",
    sourceNote: "NSSDC ghi kinh độ 35,00163° Tây; hệ thống lưu kinh độ Tây dưới dạng số âm để thống nhất.", data_status: "NGUỒN NASA",
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
    id: "H3-SPA-01", name: "Haughton Impact Basin", place: "Đảo Devon, Canada",
    lat: 75.383, lon: -89.667, type: "Bồn trũng va chạm vùng cực",
    slopeDeg: 10.5, roughnessTRI: 0.72, maficBrecciaScore: 0.94,
    surfaceAlbedo: 0.14, skinThermalShockC: 21.5, horizonOcclusionDeg: 4.8,
    ndvi: 0.02, minSunAngleDeg: 2.2, logisticsTier: "Tier 3 · Remote Arctic",
    bestTestingWindow: "Tháng 9 – tháng 10", description: "Đá dăm kết va chạm, góc chiếu Mặt Trời thấp và địa hình bồn trũng phù hợp để thử nghiệm cảm biến tự hành.",
  },
  {
    id: "H3-SPA-02", name: "Askja & Holuhraun", place: "Ai-xơ-len",
    lat: 65.033, lon: -16.75, type: "Bồn trũng núi lửa và đồng bằng đá bazan",
    slopeDeg: 9.2, roughnessTRI: 0.7, maficBrecciaScore: 0.96,
    surfaceAlbedo: 0.09, skinThermalShockC: 22, horizonOcclusionDeg: 5.2,
    ndvi: 0.01, minSunAngleDeg: 3.5, logisticsTier: "Tier 2 · Highland access",
    bestTestingWindow: "Tháng 10 – tháng 11", description: "Đá bazan sẫm màu và tro núi lửa sắc cạnh mô phỏng môi trường thử nghiệm cơ học của bồn trũng SPA.",
  },
  {
    id: "H3-SPA-03", name: "Sudbury Basin Rim", place: "Ontario, Canada",
    lat: 46.616, lon: -81.183, type: "Vành bồn trũng va chạm nhiều vòng",
    slopeDeg: 8, roughnessTRI: 0.6, maficBrecciaScore: 0.98,
    surfaceAlbedo: 0.12, skinThermalShockC: 19.5, horizonOcclusionDeg: 3.8,
    ndvi: 0.18, minSunAngleDeg: 20, logisticsTier: "Tier 1 · Road access",
    bestTestingWindow: "Tháng 11 và tháng 3", description: "Địa hình đá norit và vật chất nóng chảy do va chạm khiến khu vực này phù hợp để thử vật liệu và bánh xe.",
  },
  {
    id: "H3-SPA-04", name: "Lunar Crater Basin", place: "Nevada, Hoa Kỳ",
    lat: 38.384, lon: -116.069, type: "Hố núi lửa và bồn trũng đá bazan",
    slopeDeg: 11, roughnessTRI: 0.68, maficBrecciaScore: 0.91,
    surfaceAlbedo: 0.11, skinThermalShockC: 26.5, horizonOcclusionDeg: 5.5,
    ndvi: 0.06, minSunAngleDeg: 28, logisticsTier: "Tier 1 · Road access",
    bestTestingWindow: "Tháng 11 – tháng 2", description: "Đá bazan khô, biên độ nhiệt lớn và vành hố va chạm tạo ra các đường chân trời bị che khuất.",
  },
  {
    id: "H3-SPA-05", name: "Black Point Basin", place: "Arizona, Hoa Kỳ",
    lat: 35.688, lon: -111.465, type: "Đồng bằng bazan và vùng có nhiều hố va chạm",
    slopeDeg: 8.8, roughnessTRI: 0.66, maficBrecciaScore: 0.9,
    surfaceAlbedo: 0.1, skinThermalShockC: 27, horizonOcclusionDeg: 4,
    ndvi: 0.07, minSunAngleDeg: 31, logisticsTier: "Tier 1 · Vehicle access",
    bestTestingWindow: "Tháng 12 – tháng 1", description: "Đá bazan sẫm màu cùng các tuyến đường dễ tiếp cận, thích hợp để thử bánh xe và hệ thống treo.",
  },
  {
    id: "H3-SPA-06", name: "Lonar Impact Crater", place: "Bẫy Deccan, Ấn Độ",
    lat: 19.976, lon: 76.508, type: "Hố va chạm trên nền đá bazan",
    slopeDeg: 14, roughnessTRI: 0.74, maficBrecciaScore: 0.95,
    surfaceAlbedo: 0.11, skinThermalShockC: 23, horizonOcclusionDeg: 6.2,
    ndvi: 0.19, minSunAngleDeg: 46.5, logisticsTier: "Tier 2 · Regional roads",
    bestTestingWindow: "Tháng 12 – tháng 2", description: "Va chạm vào đá bazan tạo ra đá dăm kết có liên quan đến đặc tính cơ học của bồn trũng SPA.",
  },
];
