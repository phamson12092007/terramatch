import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(frontendDir, "..");
const earthDir = path.join(projectDir, "backend", "data", "earth", "processed");
const lunarDir = path.join(projectDir, "backend", "data", "lunar", "processed", "sites");
const port = Number(process.env.TERRAMATCH_API_PORT || 8000);
const criteria = {
  relative_elevation_m: { label: "Relative local elevation", unit: "m", scale: 500, experimental: false },
  slope_deg_windowed: { label: "Windowed terrain slope", unit: "°", scale: 10, experimental: false },
  terrain_roughness_m_windowed: { label: "Windowed terrain roughness", unit: "m", scale: 100, experimental: true },
  local_relief_m: { label: "Local relief", unit: "m", scale: 1000, experimental: true },
};

async function readJsonDirectory(directory) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(names.map(async (name) => JSON.parse(await readFile(path.join(directory, name), "utf8"))));
}

const earthRecordsPromise = readJsonDirectory(earthDir);
const lunarRecordsPromise = readJsonDirectory(lunarDir);
const isRealBacked = (observation) => observation.data_status === "REAL"
  || (observation.data_status === "DERIVED" && observation.provenance?.quality?.source_data_status === "REAL");
const isRealLunar = (observation) => observation.data_status === "REAL"
  || (observation.data_status === "DERIVED" && observation.provenance?.source_data_status === "REAL");
const finite = (value) => typeof value === "number" && Number.isFinite(value);

async function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("Request body is too large.");
  }
  return JSON.parse(body || "{}");
}

function scoreRealRecords(earthRecords, lunarRecord, requestedWeights, deviceName, refreshRequested, requestedTopK = 5) {
  if (refreshRequested) {
    const error = new Error("NASA refresh is unavailable in the bundled local preview. Use the Python API ingestion workflow to download new source data.");
    error.status = 501;
    throw error;
  }
  const weights = Object.entries(requestedWeights || {});
  if (!weights.length || weights.some(([key, weight]) => !criteria[key] || !finite(weight) || weight <= 0)) {
    const error = new Error("Choose one or more supported criteria with positive weights.");
    error.status = 422;
    throw error;
  }
  const totalWeight = weights.reduce((total, item) => total + item[1], 0);
  const lunarByKey = new Map(lunarRecord.features.map((feature) => [feature.feature_key, feature]));
  const requestedCriteria = [];
  const validWeights = [];
  for (const [key, weight] of weights) {
    const definition = criteria[key];
    const lunarFeature = lunarByKey.get(key);
    const target = lunarFeature && isRealLunar(lunarFeature) && lunarFeature.unit === definition.unit && finite(lunarFeature.value)
      ? lunarFeature.value : null;
    requestedCriteria.push({
      criterion: key,
      earth_feature_key: key,
      lunar_feature_key: key,
      status: target === null ? "LUNAR_TARGET_NOT_REAL" : "ELIGIBLE_FOR_RECORD_CHECK",
      reason: target === null ? "No compatible REAL-backed lunar observation is available for this criterion." : "REAL-backed lunar value; each Earth record is checked separately.",
      configured_weight: weight / totalWeight,
      lunar_target_value: target,
      unit: definition.unit,
    });
    if (target !== null) validWeights.push({ key, weight: weight / totalWeight, target, definition });
  }
  if (!validWeights.length) {
    return {
      results: [], available_candidate_count: earthRecords.length, skipped_candidate_count: earthRecords.length,
      scored_candidate_count: 0, requested_criteria: requestedCriteria,
      candidate_diagnostics: [{ site_id: lunarRecord.site_id, name: lunarRecord.name, status: "UNSCORED_LUNAR_TARGET", reason: "The selected lunar site has no REAL-backed value for the requested criteria." }],
      message: "No real-data search was scored because the selected lunar site lacks eligible measurements.",
    };
  }

  const candidateDiagnostics = [];
  const results = [];
  for (const record of earthRecords) {
    const observations = new Map(record.features.map((feature) => [feature.key, feature]));
    const unavailable = [];
    const used = [];
    for (const criterion of validWeights) {
      const observation = observations.get(criterion.key);
      if (!observation) {
        unavailable.push({ criterion: criterion.key, earth_feature_key: criterion.key, status: "MISSING_EARTH_OBSERVATION", reason: "No observation exists for this Earth location." });
        continue;
      }
      if (!isRealBacked(observation)) {
        unavailable.push({ criterion: criterion.key, earth_feature_key: criterion.key, status: "EARTH_OBSERVATION_NOT_REAL", reason: `Observation status ${observation.data_status} is not backed by REAL source data.` });
        continue;
      }
      if (observation.unit !== criterion.definition.unit || !finite(observation.value)) {
        unavailable.push({ criterion: criterion.key, earth_feature_key: criterion.key, status: "INVALID_EARTH_OBSERVATION", reason: "The source value is missing, non-numeric, or uses an incompatible unit." });
        continue;
      }
      used.push({
        criterion: criterion.key,
        earth_feature_key: criterion.key,
        lunar_feature_key: criterion.key,
        lunar_value: criterion.target,
        earth_value: observation.value,
        unit: criterion.definition.unit,
        normalized_difference: Math.abs(observation.value - criterion.target) / criterion.definition.scale,
        configured_weight: criterion.weight,
        weight_applied: 0,
        feature_source: observation.provenance,
        acquisition_start: observation.provenance.acquisition_start,
        acquisition_end: observation.provenance.acquisition_end,
      });
    }
    if (!used.length) {
      candidateDiagnostics.push({ site_id: record.location_id, name: record.name, status: "UNSCORED", reason: "No requested criterion has an eligible REAL Earth observation.", criteria: unavailable });
      continue;
    }
    const availableWeight = used.reduce((total, item) => total + item.configured_weight, 0);
    let squaredDistance = 0;
    for (const item of used) {
      item.weight_applied = item.configured_weight / availableWeight;
      squaredDistance += item.weight_applied * item.normalized_difference ** 2;
    }
    const similarity = Math.max(0, Math.min(100, (1 - Math.sqrt(squaredDistance)) * 100));
    const byCriterion = Object.fromEntries(used.map((item) => [item.criterion, item]));
    results.push({
      site_id: record.location_id,
      name: record.name,
      country: record.country_or_area || "Unspecified area",
      latitude: record.latitude,
      longitude: record.longitude,
      elevation_m: byCriterion.relative_elevation_m?.earth_value ?? null,
      slope_deg: byCriterion.slope_deg_windowed?.earth_value ?? null,
      surface_temp_k: null,
      similarity_score: Math.round(similarity * 100) / 100,
      data_status: "REAL",
      feature_sources: Object.fromEntries(used.map((item) => [item.criterion, item.feature_source])),
      comparison_features: byCriterion,
      unavailable_criteria: unavailable,
      used_weight_total: used.reduce((total, item) => total + item.configured_weight, 0),
    });
  }
  results.sort((a, b) => b.similarity_score - a.similarity_score);
  return {
      results: results.slice(0, Math.max(1, Math.min(1000, Number.isInteger(requestedTopK) ? requestedTopK : 5))),
    available_candidate_count: earthRecords.length,
    skipped_candidate_count: candidateDiagnostics.length,
    scored_candidate_count: results.length,
    requested_criteria: requestedCriteria,
    candidate_diagnostics: candidateDiagnostics,
    message: `Real-data search completed for ${deviceName}. ${results.length} of ${earthRecords.length} processed Earth records were scored; ${candidateDiagnostics.length} had no eligible requested criteria.`,
  };
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "OPTIONS") return sendJson(response, 204, {});
    if (request.method === "GET" && url.pathname === "/api/health") {
      return sendJson(response, 200, { status: "healthy", project: "TerraMatch", data_mode: "REAL_ONLY_LOCAL_SNAPSHOT" });
    }
    if (request.method === "GET" && url.pathname === "/api/lunar/sites") {
      const sites = await lunarRecordsPromise;
      return sendJson(response, 200, sites.map(({ features, metadata, ...site }) => site));
    }
    if (request.method === "GET" && url.pathname === "/api/earth/locations") {
      return sendJson(response, 200, await earthRecordsPromise);
    }
    if (request.method === "GET" && url.pathname === "/api/earth/features") {
      const earthRecords = await earthRecordsPromise;
      const lunarSites = await lunarRecordsPromise;
      const features = Object.entries(criteria).map(([key, definition]) => {
        const matchingRecords = earthRecords.filter((record) => record.features.some((feature) => feature.key === key && isRealBacked(feature)));
        const matchingEarth = matchingRecords.flatMap((record) => record.features.filter((feature) => feature.key === key && isRealBacked(feature)));
        const matchingMoon = lunarSites.filter((site) => site.features.some((feature) => feature.feature_key === key && isRealLunar(feature)));
        return {
          key, label: definition.label, category: "Terrain", unit: definition.unit,
          description: "Source-traceable terrain metric derived from a regional DEM window.",
          source: "NASA SRTMGL1.003", data_availability: "AVAILABLE",
          lunar_compatibility: "COMPATIBLE", similarity_supported: true,
          normalization_scale: definition.scale, lunar_feature_key: key,
          scientific_classification: definition.experimental ? "Experimental terrain-screening compatible" : "Terrain-screening compatible",
          unavailable_reason: null,
          observation_availability: {
            locations_with_real_observation: matchingRecords.length,
            observation_count: matchingEarth.length,
            lunar_locations_with_real_observation: matchingMoon.length,
          },
        };
      });
      return sendJson(response, 200, { features, repository_diagnostics: { local_records: earthRecords.length, indexed_regions: 5 } });
    }
    const lunarFeatureMatch = url.pathname.match(/^\/api\/lunar\/sites\/([^/]+)\/features$/);
    if (request.method === "GET" && lunarFeatureMatch) {
      const site = (await lunarRecordsPromise).find((item) => item.site_id === decodeURIComponent(lunarFeatureMatch[1]));
      if (!site) return sendJson(response, 404, { detail: "Lunar site not found." });
      return sendJson(response, 200, site.features);
    }
    if (request.method === "POST" && url.pathname === "/api/location/inspect") {
      const body = await readBody(request);
      const site = (await lunarRecordsPromise).find((item) => item.site_id === body.site_id);
      if (!site || site.latitude !== body.latitude || site.longitude !== body.longitude) return sendJson(response, 422, { detail: "The lunar location does not match a catalogued reference site." });
      return sendJson(response, 200, { planet: "Moon", latitude: site.latitude, longitude: site.longitude, data_status: site.data_status, message: "Catalogued lunar reference site validated." });
    }
    if (request.method === "POST" && url.pathname === "/api/analogs/search") {
      const body = await readBody(request);
      const lunarRecord = (await lunarRecordsPromise).find((item) => item.site_id === body.site_id);
      if (!lunarRecord || lunarRecord.latitude !== body.latitude || lunarRecord.longitude !== body.longitude) return sendJson(response, 422, { detail: "The lunar target must match a catalogued reference site." });
      const evaluation = scoreRealRecords(await earthRecordsPromise, lunarRecord, body.criteria_weights, body.research_device, body.refresh_from_nasa, body.top_k);
      return sendJson(response, 200, {
        planet: "Moon", target_location: { latitude: lunarRecord.latitude, longitude: lunarRecord.longitude },
        ...evaluation, data_source: "REAL",
        limitations: [
          "Only compatible REAL-backed lunar and Earth observations contribute to a score.",
          "This local snapshot indexes five NASA SRTM terrain regions; it is not a global exhaustive search.",
          "The 0–100 screening index is a normalized distance score, not a probability or validated performance prediction.",
          "Earth analogs do not reproduce lunar gravity, vacuum, radiation, or atmosphere.",
        ],
      });
    }
    return sendJson(response, 404, { detail: "Local API route not found." });
  } catch (error) {
    return sendJson(response, error.status || 500, { detail: error.message || "Local API error." });
  }
});

server.listen(port, "127.0.0.1", () => console.log(`TerraMatch local data API listening on http://127.0.0.1:${port}`));
