import { useMemo, useState } from "react";
import { AlertTriangle, Database, Filter, Leaf, MapPin, Search, Waves } from "lucide-react";
import { searchEarthAnalogs } from "../api.js";
import BasinMap from "./BasinMap.jsx";

const referenceSites = [
  { id: "malapert-massif", name: "Malapert Massif", latitude: -85.4, longitude: 0.0 },
  { id: "cabeus-crater", name: "Cabeus Crater", latitude: -84.9, longitude: -42.3 },
  { id: "amundsen-crater", name: "Amundsen Crater", latitude: -84.6, longitude: 82.8 },
  { id: "shackleton-rim", name: "Shackleton Rim", latitude: -89.9, longitude: 129.9 },
];

const terrainCriteria = [
  ["relative_elevation_m", "Relative elevation", "m"],
  ["slope_deg_windowed", "Terrain slope", "°"],
  ["terrain_roughness_m_windowed", "Terrain roughness", "m"],
  ["local_relief_m", "Local relief", "m"],
];

const number = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : "—";

export default function RealTerrainSurvey() {
  const [targetId, setTargetId] = useState("malapert-massif");
  const [minimumScore, setMinimumScore] = useState(0);
  const [maximumSlope, setMaximumSlope] = useState(20);
  const [includeRoughness, setIncludeRoughness] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const target = referenceSites.find((site) => site.id === targetId) ?? referenceSites[0];
  const ranked = useMemo(() => (response?.results ?? []).filter((site) =>
    site.similarity_score >= minimumScore && (site.slope_deg == null || site.slope_deg <= maximumSlope),
  ).map((site) => ({
    ...site,
    id: site.site_id,
    lat: site.latitude,
    lon: site.longitude,
    score: site.similarity_score,
    place: site.country,
  })), [response, minimumScore, maximumSlope]);
  const selected = ranked.find((site) => site.id === selectedId) ?? ranked[0] ?? null;

  async function runSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResponse(null);
    setSelectedId(null);
    const criteriaWeights = { relative_elevation_m: 1, slope_deg_windowed: 1 };
    if (includeRoughness) {
      criteriaWeights.terrain_roughness_m_windowed = 1;
      criteriaWeights.local_relief_m = 1;
    }
    try {
      const result = await searchEarthAnalogs({
        site_id: target.id,
        latitude: target.latitude,
        longitude: target.longitude,
        research_device: "Lunar Terrain Vehicle",
        criteria_weights: criteriaWeights,
        top_k: 250,
      });
      setResponse(result);
    } catch (searchError) {
      setError(searchError.message || "The local terrain API could not complete the search.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="real-survey panel" aria-labelledby="real-survey-title">
      <div className="panel-heading">
        <div><span className="section-kicker">SOURCE-TRACEABLE SCREENING</span><h2 id="real-survey-title">Earth terrain analog search</h2></div>
        <span className="count-pill">NASA LOLA × SRTM</span>
      </div>
      <p className="real-survey-intro">Rank indexed Earth terrain samples against real lunar elevation and slope observations. This is a regional screening index, not a probability of mission success.</p>

      <form className="real-survey-controls" onSubmit={runSearch}>
        <label className="survey-field"><span>South-polar reference site</span>
          <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
            {referenceSites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}
          </select>
        </label>
        <label className="survey-field"><span>Minimum terrain similarity · {minimumScore}/100</span>
          <input type="range" min="0" max="95" step="5" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} />
        </label>
        <label className="survey-field"><span>Maximum Earth slope · {maximumSlope}°</span>
          <input type="range" min="5" max="35" step="1" value={maximumSlope} onChange={(event) => setMaximumSlope(Number(event.target.value))} />
        </label>
        <label className="survey-check"><input type="checkbox" checked={includeRoughness} onChange={(event) => setIncludeRoughness(event.target.checked)} /><span>Include experimental roughness and local relief metrics</span></label>
        <button className="survey-search" type="submit" disabled={loading}><Search size={16} />{loading ? "Searching real records…" : "Run terrain screening"}</button>
      </form>

      <div className="screening-filters" aria-label="Land cover and settlement exclusion status">
        <div className="screening-filter active"><Waves size={16} /><span><strong>Water</strong><small>Land-only SRTM sample coverage</small></span><b>Excluded at source</b></div>
        <div className="screening-filter unavailable"><Database size={16} /><span><strong>Dense population</strong><small>GHSL population mask is not in this local snapshot</small></span><b>Mask unavailable</b></div>
        <div className="screening-filter unavailable"><Leaf size={16} /><span><strong>Forest</strong><small>ESA WorldCover tree-cover mask is not in this local snapshot</small></span><b>Mask unavailable</b></div>
      </div>

      {!response && !error && <div className="survey-empty"><Filter size={18} /><span>Choose a lunar reference and run the search to view the source-backed terrain ranking.</span></div>}
      {error && <div className="survey-error"><AlertTriangle size={18} /><span>{error} Start the local preview with <code>Run-Local.bat</code> so the terrain API is available.</span></div>}
      {response && <>
        <div className="survey-result-summary"><strong>{ranked.length} matching samples</strong><span>{response.scored_candidate_count} scored from {response.available_candidate_count} indexed Earth records across five regions.</span></div>
        <div className="real-survey-grid">
          <div className="panel map-panel"><div className="panel-heading"><div><span className="section-kicker">EARTH / SCREENED SAMPLES</span><h3>Ranked terrain cells</h3></div><span className="map-status"><span /> Real observations</span></div>
            {ranked.length ? <BasinMap ranked={ranked.slice(0, 80)} selected={selected} onSelect={setSelectedId} /> : <p className="survey-empty">No samples meet the current thresholds.</p>}
          </div>
          <div className="panel real-results-panel"><div className="panel-heading"><div><span className="section-kicker">TOP MATCHES</span><h3>Observed terrain metrics</h3></div><span className="count-pill">{ranked.length}</span></div>
            <div className="real-results-list">{ranked.slice(0, 12).map((site, index) => <button type="button" className={`real-result-row ${selected?.id === site.id ? "selected" : ""}`} onClick={() => setSelectedId(site.id)} key={site.id}>
              <span className="rank-number">{String(index + 1).padStart(2, "0")}</span><span className="candidate-identity"><strong>{site.name}</strong><small>{site.country} · {number(site.latitude, 3)}°, {number(site.longitude, 3)}°</small></span><span className="candidate-score">{number(site.score, 1)}%</span>
            </button>)}</div>
            {selected && <div className="real-result-detail"><h4><MapPin size={14} /> {selected.name}</h4><p>{selected.country} · {selected.latitude.toFixed(4)}°, {selected.longitude.toFixed(4)}°</p><dl>
              {terrainCriteria.map(([key, label, unit]) => <div key={key}><dt>{label}</dt><dd>{number(selected.comparison_features?.[key]?.earth_value)} {unit}</dd></div>)}
            </dl><small>Terrain similarity: {number(selected.score, 1)}% (normalized screening score, not a probability). Only REAL-backed lunar and Earth measurements are used.</small></div>}
          </div>
        </div>
        <p className="panel-footnote"><AlertTriangle size={14} /> Forest and population exclusions remain unapplied until their open raster masks are downloaded and indexed. The current local search covers five SRTM regions, not the whole Earth.</p>
      </>}
    </section>
  );
}
