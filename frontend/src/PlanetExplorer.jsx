import { useEffect, useMemo, useState } from "react";
import { Check, Globe, MapPin, RotateCcw, Satellite, Search, SlidersHorizontal } from "lucide-react";
import { inspectLunarLocation, loadEarthFeatureCatalog, loadEarthLocations, loadLunarSiteFeatures, loadLunarSites, searchEarthAnalogs } from "./api";
import "./PlanetExplorer.css";

const SITE_COLORS = ["#67e8f9", "#a78bfa", "#fbbf24", "#fb7185", "#34d399", "#f97316"];
const DEVICES = [
  { id: "ltv", name: "LTV", description: "Terrain vehicle", weights: { relative_elevation_m: 0.25, slope_deg_windowed: 0.45, terrain_roughness_m_windowed: 0.15, local_relief_m: 0.15 } },
  { id: "regolith-drill", name: "Drill", description: "Regolith drill", weights: { relative_elevation_m: 0.35, slope_deg_windowed: 0.25, terrain_roughness_m_windowed: 0.25, local_relief_m: 0.15 } },
];
const mapPosition = (location) => ({ left: `${((location.longitude + 180) / 360) * 100}%`, top: `${((90 - location.latitude) / 180) * 100}%` });
const SHORT_LABELS = {
  relative_elevation_m: "Elevation",
  slope_deg_windowed: "Slope",
  terrain_roughness_m_windowed: "Roughness",
  local_relief_m: "Relief",
};
const EXPERIMENTAL_CRITERIA = new Set(["terrain_roughness_m_windowed", "local_relief_m"]);

const isRealBacked = (observation) => observation.data_status === "REAL"
  || (observation.data_status === "DERIVED" && observation.provenance?.source_data_status === "REAL");

export default function PlanetExplorer({ onSearch }) {
  const planet = "Moon";
  const [selectedSite, setSelectedSite] = useState(null);
  const [deviceId, setDeviceId] = useState("ltv");
  const [selectedCriteria, setSelectedCriteria] = useState(() => Object.keys(DEVICES[0].weights));
  const [customWeights, setCustomWeights] = useState(() => ({ ...DEVICES[0].weights }));
  const [featureCatalog, setFeatureCatalog] = useState([]);
  const [lunarSites, setLunarSites] = useState([]);
  const [isLoadingSiteFeatures, setIsLoadingSiteFeatures] = useState(false);
  const [catalogState, setCatalogState] = useState("loading");
  const [catalogError, setCatalogError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [apiError, setApiError] = useState("");
  const activeDevice = DEVICES.find((device) => device.id === deviceId);

  useEffect(() => {
    let active = true;
    Promise.all([loadEarthFeatureCatalog(), loadLunarSites()])
      .then(([catalog, sites]) => {
        if (!active) return;
        setFeatureCatalog(catalog.features);
        setLunarSites(sites);
        setCatalogState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setCatalogError(error.message);
        setCatalogState("error");
      });
    return () => { active = false; };
  }, []);

  const sharedData = useMemo(() => {
    if (!selectedSite?.features) return [];
    const lunarKeys = new Set(selectedSite.features.filter(isRealBacked).map((item) => item.feature_key));
    return featureCatalog.filter((feature) => feature.lunar_feature_key
      && lunarKeys.has(feature.lunar_feature_key)
      && (feature.observation_availability?.locations_with_real_observation || 0) > 0);
  }, [featureCatalog, selectedSite]);

  const scoreableCriteria = useMemo(
    () => sharedData.filter((feature) => feature.similarity_supported),
    [sharedData],
  );
  const criteriaWeights = useMemo(
    () => Object.fromEntries(scoreableCriteria
      .filter((feature) => selectedCriteria.includes(feature.key))
      .map((feature) => [feature.key, Math.max(0.05, Number(customWeights[feature.key]) || 1)])),
    [customWeights, scoreableCriteria, selectedCriteria],
  );
  const selectedWeightTotal = Object.values(criteriaWeights).reduce((total, weight) => total + weight, 0);
  const realLolaFeatures = selectedSite?.features?.filter((item) => item.product_id === "LDEM_16" && isRealBacked(item)) || [];
  const divinerFeatures = selectedSite?.features?.filter((item) => item.product_id === "DLRE_PRP_SOUTH.TAB" && isRealBacked(item)) || [];
  const divinerMean = divinerFeatures.find((item) => item.feature_key === "subsurface_temp_2cm_k_annual_mean");
  const divinerMax = divinerFeatures.find((item) => item.feature_key === "surface_temp_k_annual_max");
  const resetSelection = () => { setSelectedSite(null); setApiError(""); };
  const selectSite = async (site) => {
    setApiError("");
    setIsLoadingSiteFeatures(true);
    try {
      const observations = await loadLunarSiteFeatures(site.site_id);
      const features = Object.fromEntries(observations.filter((item) => item.value !== null).map((item) => [item.feature_key, item.value]));
      setSelectedSite({ ...site, features: observations, targetFeatures: features });
    } catch (error) {
      setSelectedSite(null);
      setApiError(error.message);
    } finally { setIsLoadingSiteFeatures(false); }
  };
  const selectDevice = (device) => {
    setDeviceId(device.id);
    setSelectedCriteria(Object.keys(device.weights));
    setCustomWeights({ ...device.weights });
  };
  const toggleCriterion = (key) => {
    setSelectedCriteria((current) => {
      if (current.includes(key)) return current.length === 1 ? current : current.filter((item) => item !== key);
      return [...current, key];
    });
  };
  const updateWeight = (key, value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    setCustomWeights((current) => ({ ...current, [key]: Math.min(1, Math.max(0.05, numericValue)) }));
  };
  const canSearch = selectedSite && catalogState === "ready" && Object.keys(criteriaWeights).length > 0;

  const handleSearch = async () => {
    if (!selectedSite) return setApiError("Choose one of the available research locations first.");
    if (!Object.keys(criteriaWeights).length) return setApiError("Choose at least one scoring criterion.");
    setIsSearching(true); setApiError("");
    const requestData = { planet, site_id: selectedSite.site_id, latitude: selectedSite.latitude, longitude: selectedSite.longitude };
    const researchConfiguration = {
      research_device: activeDevice.name,
      criteria_weights: criteriaWeights,
      // The product UI always requests traceable observations. The backend
      // may return fewer than five results (or no score) rather than filling
      // the ranking with the legacy simulated corpus.
      earth_data_mode: "REAL_ONLY",
      refresh_from_nasa: true,
    };
    try {
      const apiResult = await inspectLunarLocation(requestData);
      const analogResult = await searchEarthAnalogs({
        ...requestData,
        ...researchConfiguration,
        target_features: selectedSite.targetFeatures,
      });
      const refreshedEarthLocations = await loadEarthLocations();
      onSearch?.({
        ...requestData, siteName: selectedSite.name, apiResult, analogResult, demoFeatures: selectedSite.targetFeatures,
        featureCatalog, earthLocations: refreshedEarthLocations, ...researchConfiguration,
      });
    } catch (error) {
      setApiError(error.status === 422 ? `Validation error: ${error.message}` : error.message);
    } finally { setIsSearching(false); }
  };

  return <section className="planet-explorer">
    <div className="explorer-header"><span className="eyebrow">MISSION PLANNING</span><h1>Planet Explorer</h1><p>Choose a lunar site and equipment.</p></div>
    <div className="explorer-content">
      <div className="map-section">
        <div className="section-heading"><div><h2><Globe size={18} /> Moon research locations</h2><p>South-pole sites are prioritized; select a labeled marker to continue.</p></div></div>
        <div className={`coordinate-map ${planet.toLowerCase()}-map`} aria-label={`${planet} map with available research sites`}><div className="map-grid" />
          {lunarSites.map((location, index) => <button className={`site-marker ${selectedSite?.site_id === location.site_id ? "selected" : ""}`} key={location.site_id} onClick={() => selectSite(location)} style={mapPosition(location)} title={`Select ${location.name}`}><span className="site-dot" style={{ background: SITE_COLORS[index % SITE_COLORS.length] }} /><span className="site-name">{location.name}</span></button>)}
          {selectedSite && <div className="map-marker" style={mapPosition(selectedSite)}><MapPin size={30} /></div>}
          <div className="map-instruction"><MapPin size={17} /> Select a labeled research site</div>
        </div>
        <div className="map-legend"><span><i className="legend-dot" /> Available research site</span><span>Only catalogued sites have sufficient data for analysis.</span></div>
        <div className="site-picker">{lunarSites.map((location, index) => <button key={location.site_id} className={selectedSite?.site_id === location.site_id ? "site-chip active" : "site-chip"} onClick={() => selectSite(location)}><i style={{ background: SITE_COLORS[index % SITE_COLORS.length] }} /> {location.name}</button>)}</div>
      </div>
      <aside className="research-panel">
        <div className="section-heading"><div><h2><Satellite size={18} /> Device</h2><p>Choose equipment.</p></div></div>
        <div className="device-list">{DEVICES.map((device) => <button key={device.id} className={deviceId === device.id ? "device-card active" : "device-card"} onClick={() => selectDevice(device)}><span className="device-select">{deviceId === device.id && <Check size={13} />}</span><span><strong>{device.name}</strong><small>{device.description}</small></span></button>)}</div>
        <div className="criteria-heading"><SlidersHorizontal size={16} /> Criteria</div>
        {catalogState === "loading" && <p className="selection-hint">Loading feature availability…</p>}
        {catalogState === "error" && <p className="api-error">Unable to load reference data: {catalogError}</p>}
        {sharedData.length > 0 && <><p className="selection-hint">Select metrics and set their relative weights.</p><div className="criteria-table"><div className="criteria-table-header"><span>Metric</span><span>Use</span><span>Weight</span></div>{sharedData.map((feature) => {
          const canScore = feature.similarity_supported;
          const isSelected = canScore && selectedCriteria.includes(feature.key);
          const weight = customWeights[feature.key] ?? activeDevice?.weights[feature.key] ?? 1;
          const normalizedWeight = selectedWeightTotal ? Math.round(((criteriaWeights[feature.key] || 0) / selectedWeightTotal) * 100) : 0;
          const experimental = EXPERIMENTAL_CRITERIA.has(feature.key);
          return <div className={`criterion-row ${isSelected ? "active" : ""}`} key={feature.key}>
            <div className="criterion-name"><strong>{SHORT_LABELS[feature.key] || feature.label}</strong><small className={experimental ? "experimental" : ""}>{canScore ? (experimental ? "Experimental" : "Ready") : "View only"}</small></div>
            <label className="criterion-toggle"><input aria-label={`Use ${SHORT_LABELS[feature.key] || feature.label}`} type="checkbox" checked={isSelected} disabled={!canScore || (isSelected && selectedCriteria.length === 1)} onChange={() => toggleCriterion(feature.key)} /></label>
            {isSelected ? <div className="weight-control"><input aria-label={`${SHORT_LABELS[feature.key] || feature.label} weight`} type="range" min="0.05" max="1" step="0.05" value={weight} onChange={(event) => updateWeight(feature.key, event.target.value)} /><input className="weight-input" aria-label={`${SHORT_LABELS[feature.key] || feature.label} numeric weight`} type="number" min="0.05" max="1" step="0.05" value={weight} onChange={(event) => updateWeight(feature.key, event.target.value)} /><small className="weight-percent">{normalizedWeight}%</small></div> : <span className="weight-empty">—</span>}
          </div>;
        })}</div></>}
        {selectedSite && !isLoadingSiteFeatures && sharedData.length === 0 && <p className="selection-hint">No shared measured data here yet.</p>}
        {selectedSite ? <div className="selected-location"><div className="status-indicator" /><div><strong>{selectedSite.name}</strong><p>{selectedSite.latitude}°, {selectedSite.longitude}° · Catalog point</p>{realLolaFeatures.length ? <small className="terrain-source">LOLA terrain: {realLolaFeatures.length} REAL-backed features</small> : <small className="terrain-source">LOLA terrain: no complete local support window at this location.</small>}{divinerMean && divinerMax && <small className="terrain-source">Diviner: {divinerMean.value.toFixed(1)} K mean (2 cm) · {divinerMax.value.toFixed(1)} K annual max</small>}</div></div> : <p className="selection-hint">No site selected. Choose a marker from the map.</p>}
        {isLoadingSiteFeatures && <p className="selection-hint">Loading Lunar reference features…</p>}
        {apiError && <p className="api-error">{apiError}</p>}<button className="reset-action" onClick={resetSelection}><RotateCcw size={15} /> Clear</button><button className="search-action" onClick={handleSearch} disabled={!canSearch || isSearching || isLoadingSiteFeatures}><Search size={17} /> {isSearching ? "Searching…" : "Search"}</button>
      </aside>
    </div>
  </section>;
}
