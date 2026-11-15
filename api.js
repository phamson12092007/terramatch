const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new Error("Lỗi mạng: không thể kết nối đến API TerraMatch.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw new Error(`Yêu cầu thất bại (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const detail = typeof payload?.detail === "string"
      ? payload.detail
      : `Yêu cầu thất bại (HTTP ${response.status}).`;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function loadEarthFeatureCatalog() {
  const payload = await request("/api/earth/features");
  if (!isObject(payload) || !Array.isArray(payload.features)) {
    throw new Error("Phản hồi danh mục tiêu chí không hợp lệ.");
  }
  return payload;
}

export async function loadLunarSites() {
  const payload = await request("/api/lunar/sites");
  if (!Array.isArray(payload)) throw new Error("Phản hồi danh sách địa điểm Mặt Trăng không hợp lệ.");
  return payload;
}

export async function loadLunarSiteFeatures(siteId) {
  const payload = await request(`/api/lunar/sites/${encodeURIComponent(siteId)}/features`);
  if (!Array.isArray(payload)) throw new Error("Phản hồi dữ liệu đặc điểm Mặt Trăng không hợp lệ.");
  return payload;
}

export async function loadEarthLocations() {
  const payload = await request("/api/earth/locations");
  if (!Array.isArray(payload)) throw new Error("Phản hồi danh sách địa điểm Trái Đất không hợp lệ.");
  return payload;
}

export async function inspectLunarLocation(payload) {
  const response = await request("/api/location/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!isObject(response)) throw new Error("Phản hồi thông tin địa điểm Mặt Trăng không hợp lệ.");
  return response;
}

export async function searchEarthAnalogs(payload) {
  const response = await request("/api/analogs/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!isObject(response) || !Array.isArray(response.results)) {
    throw new Error("Phản hồi tìm kiếm địa hình tương tự không hợp lệ.");
  }
  return response;
}
