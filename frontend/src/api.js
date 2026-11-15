<<<<<<< HEAD
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
=======
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
>>>>>>> 57867d0c2fff0fbaf799359e8f5ffbe1c509c587

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new Error("Network error: unable to reach the TerraMatch API.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`);
  }

  if (!response.ok) {
    const detail = typeof payload?.detail === "string"
      ? payload.detail
      : `Request failed with HTTP ${response.status}.`;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function loadEarthFeatureCatalog() {
  const payload = await request("/api/earth/features");
  if (!isObject(payload) || !Array.isArray(payload.features)) {
    throw new Error("The feature catalog response is invalid.");
  }
  return payload;
}

export async function loadLunarSites() {
  const payload = await request("/api/lunar/sites");
  if (!Array.isArray(payload)) throw new Error("The Lunar sites response is invalid.");
  return payload;
}

export async function loadLunarSiteFeatures(siteId) {
  const payload = await request(`/api/lunar/sites/${encodeURIComponent(siteId)}/features`);
  if (!Array.isArray(payload)) throw new Error("The Lunar feature response is invalid.");
  return payload;
}

export async function loadEarthLocations() {
  const payload = await request("/api/earth/locations");
  if (!Array.isArray(payload)) throw new Error("The Earth locations response is invalid.");
  return payload;
}

export async function inspectLunarLocation(payload) {
  const response = await request("/api/location/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!isObject(response)) throw new Error("The lunar-location response is invalid.");
  return response;
}

export async function searchEarthAnalogs(payload) {
  const response = await request("/api/analogs/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!isObject(response) || !Array.isArray(response.results)) {
    throw new Error("The analog-search response is invalid.");
  }
  return response;
}
