import { useEffect, useMemo, useState } from "react";
import { Check, Globe, MapPin, RotateCcw, Satellite, Search } from "lucide-react";
import { inspectLunarLocation, loadEarthFeatureCatalog, loadEarthLocations, loadLunarSiteFeatures, loadLunarSites, searchEarthAnalogs } from "./api";
import "./PlanetExplorer.css";

const SITE_COLORS = ["#67e8f9", "#a78bfa", "#fbbf24", "#fb7185", "#34d399", "#f97316"];
const DEVICES = [
  { id: "ltv", name: "LTV", description: "Terrain vehicle", weights: { relative_elevation_m: 0.4, slope_deg_windowed: 0.6 } },
  { id: "regolith-drill", name: "Drill", description: "Regolith drill", weights: { relative_elevation_m: 0.55, slope_deg_windowed: 0.45 } },
];
const mapPosition = (location) => ({ left: `${((location.longitude + 180) / 360) * 100}%`, top: `${((90 - location.latitude) / 180) * 100}%` });
const SHORT_LABELS = {
  relative_elevation_m: "Elevation",
  slope_deg_windowed: "Slope",
  terrain_roughness_m_windowed: "Roughness",
  local_relief_m: "Relief",
};

const isRealBacked = (observation) => observation.data_status === "REAL"
  || (observation.data_status === "DERIVED" && observation.provenance?.source_data_status === "REAL");

export default function PlanetExplorer({ onSearch }) {
  const planet = "Moon";
  const [selectedSite, setSelectedSite] = useState(null);
  const [deviceId, setDeviceId] = useState("ltv");
  const [featureCatalog, setFeatureCatalog] = useState([]);
  const [earthLocations, setEarthLocations] = useState([]);
  const [lunarSites, setLunarSites] = useState([]);
  const [isLoadingSiteFeatures, setIsLoadingSiteFeatures] = useState(false);
  const [catalogState, setCatalogState] = useState("loading");
  const [catalogError, setCatalogError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [apiError, setApiError] = useState("");
  const activeDevice = DEVICES.find((device) => device.id === deviceId);

  useEffect(() => {
    let active = true;
    Promise.all([loadEarthFeatureCatalog(), loadEarthLocations(), loadLunarSites()])
      .then(([catalog, locations, sites]) => {
        if (!active) return;
        setFeatureCatalog(catalog.features);
        setEarthLocations(locations);
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

  const criteriaWeights = activeDevice?.weights || {};
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
  const canSearch = selectedSite && catalogState === "ready";

  const handleSearch = async () => {
    if (!selectedSite) return setApiError("Choose one of the available research locations first.");
    setIsSearching(true); setApiError("");
    const requestData = { planet, site_id: selectedSite.site_id, latitude: selectedSite.latitude, longitude: selectedSite.longitude };
    const researchConfiguration = {
      research_device: activeDevice.name,
      criteria_weights: criteriaWeights,
      // The product UI always requests traceable observations. The backend
      // may return fewer than five results (or no score) rather than filling
      // the ranking with the legacy simulated corpus.
      earth_data_mode: "REAL_ONLY",
    };
    try {
      const apiResult = await inspectLunarLocation(requestData);
      const analogResult = await searchEarthAnalogs({
        ...requestData,
        ...researchConfiguration,
        target_features: selectedSite.targetFeatures,
      });
      onSearch?.({
        ...requestData, siteName: selectedSite.name, apiResult, analogResult, demoFeatures: selectedSite.targetFeatures,
        featureCatalog, earthLocations, ...researchConfiguration,
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
        <div className="device-list">{DEVICES.map((device) => <button key={device.id} className={deviceId === device.id ? "device-card active" : "device-card"} onClick={() => setDeviceId(device.id)}><span className="device-select">{deviceId === device.id && <Check size={13} />}</span><span><strong>{device.name}</strong><small>{device.description}</small></span></button>)}</div>
        <div className="criteria-heading"><Globe size={16} /> Data available</div>
        {catalogState === "loading" && <p className="selection-hint">Loading feature availability…</p>}
        {catalogState === "error" && <p className="api-error">Unable to load reference data: {catalogError}</p>}
        <div className="criteria-list">{sharedData.map((feature) => <div className="criterion data-item" key={feature.key}>{SHORT_LABELS[feature.key] || feature.label}</div>)}</div>
        {selectedSite && !isLoadingSiteFeatures && sharedData.length === 0 && <p className="selection-hint">No shared measured data here yet.</p>}
        {selectedSite ? <div className="selected-location"><div className="status-indicator" /><div><strong>{selectedSite.name}</strong><p>{selectedSite.latitude}°, {selectedSite.longitude}° · Catalog point</p>{realLolaFeatures.length ? <small className="terrain-source">LOLA terrain: {realLolaFeatures.length} REAL-backed features</small> : <small className="terrain-source">LOLA terrain: no complete local support window at this location.</small>}{divinerMean && divinerMax && <small className="terrain-source">Diviner: {divinerMean.value.toFixed(1)} K mean (2 cm) · {divinerMax.value.toFixed(1)} K annual max</small>}</div></div> : <p className="selection-hint">No site selected. Choose a marker from the map.</p>}
        {isLoadingSiteFeatures && <p className="selection-hint">Loading Lunar reference features…</p>}
        {apiError && <p className="api-error">{apiError}</p>}<button className="reset-action" onClick={resetSelection}><RotateCcw size={15} /> Clear</button><button className="search-action" onClick={handleSearch} disabled={!canSearch || isSearching || isLoadingSiteFeatures}><Search size={17} /> {isSearching ? "Searching…" : "Search"}</button>
      </aside>
    </div>
  </section>;
}
