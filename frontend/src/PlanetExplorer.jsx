import { useMemo, useState } from "react";
import { Check, Globe, MapPin, RotateCcw, Satellite, Search, SlidersHorizontal } from "lucide-react";
import "./PlanetExplorer.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const LOCATIONS = {
  Moon: [
    { id: "shackleton-rim", name: "Shackleton Rim", lat: -89.9, lon: 129.9, color: "#67e8f9", features: { elevation_m: 2400, slope_deg: 7, surface_temp_k: 125 } },
    { id: "amundsen-crater", name: "Amundsen Crater", lat: -84.6, lon: 82.8, color: "#a78bfa", features: { elevation_m: -4200, slope_deg: 12, surface_temp_k: 110 } },
    { id: "cabeus-crater", name: "Cabeus Crater", lat: -84.9, lon: -42.3, color: "#fbbf24", features: { elevation_m: -3500, slope_deg: 10, surface_temp_k: 105 } },
    { id: "malapert-massif", name: "Malapert Massif", lat: -85.4, lon: 0, color: "#fb7185", features: { elevation_m: 5000, slope_deg: 8, surface_temp_k: 135 } },
    { id: "apollo-11", name: "Apollo 11", lat: 0.674, lon: 23.473, color: "#34d399", features: { elevation_m: 0, slope_deg: 4, surface_temp_k: 250 } },
    { id: "luna-17", name: "Luna 17", lat: 38.247, lon: -35, color: "#f97316", features: { elevation_m: -1500, slope_deg: 5, surface_temp_k: 230 } },
  ],
};
const CRITERIA = [
  { key: "elevation_m", label: "Terrain elevation", unit: "m" },
  { key: "slope_deg", label: "Surface slope", unit: "°" },
  { key: "surface_temp_k", label: "Surface temperature", unit: "K" },
];
const DEVICES = [
  { id: "ltv", name: "LTV", description: "Lunar Terrain Vehicle", weights: { elevation_m: 0.3, slope_deg: 0.5, surface_temp_k: 0.2 } },
  { id: "regolith-drill", name: "Regolith Drill", description: "Subsurface sampling equipment", weights: { elevation_m: 0.15, slope_deg: 0.35, surface_temp_k: 0.5 } },
];
const mapPosition = (location) => ({ left: `${((location.lon + 180) / 360) * 100}%`, top: `${((90 - location.lat) / 180) * 100}%` });

export default function PlanetExplorer({ onSearch }) {
  const planet = "Moon";
  const [selectedSite, setSelectedSite] = useState(null);
  const [deviceId, setDeviceId] = useState("ltv");
  const [selectedCriteria, setSelectedCriteria] = useState(CRITERIA.map(({ key }) => key));
  const [isSearching, setIsSearching] = useState(false);
  const [apiError, setApiError] = useState("");
  const activeDevice = DEVICES.find((device) => device.id === deviceId);
  const isCustom = deviceId === "custom";
  const criteriaWeights = useMemo(() => {
    if (activeDevice) return activeDevice.weights;
    return Object.fromEntries(selectedCriteria.map((item) => [item, Number((1 / selectedCriteria.length).toFixed(3))]));
  }, [activeDevice, selectedCriteria]);
  const resetSelection = () => { setSelectedSite(null); setApiError(""); };
  const selectSite = (site) => { setSelectedSite(site); setApiError(""); };
  const toggleCriterion = (criterion) => setSelectedCriteria((current) => (
    current.includes(criterion) ? (current.length === 1 ? current : current.filter((item) => item !== criterion)) : [...current, criterion]
  ));

  const handleSearch = async () => {
    if (!selectedSite) return setApiError("Choose one of the available research locations first.");
    setIsSearching(true); setApiError("");
    const requestData = { planet, site_id: selectedSite.id, latitude: selectedSite.lat, longitude: selectedSite.lon };
    const researchConfiguration = { research_device: activeDevice?.name || "Custom criteria", criteria_weights: criteriaWeights };
    try {
      const locationResponse = await fetch(`${API_BASE_URL}/api/location/inspect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestData) });
      if (!locationResponse.ok) throw new Error("Location validation failed");
      const locationResult = await locationResponse.json();
      const analogResponse = await fetch(`${API_BASE_URL}/api/analogs/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...requestData, target_features: selectedSite.features, ...researchConfiguration }) });
      if (!analogResponse.ok) throw new Error("Earth Analog search failed");
      const analogResult = await analogResponse.json();
      onSearch?.({ ...requestData, siteName: selectedSite.name, apiResult: locationResult, analogResult, demoFeatures: selectedSite.features, ...researchConfiguration });
    } catch (error) {
      console.error("TerraMatch API error:", error);
      setApiError(`${error.message}. Please check whether the backend is running.`);
    } finally { setIsSearching(false); }
  };

  return <section className="planet-explorer">
    <div className="explorer-header"><span className="eyebrow">MISSION PLANNING</span><h1>Planet Explorer</h1><p>Evaluate verified research locations against the needs of a mission device.</p></div>
    <div className="explorer-content">
      <div className="map-section">
        <div className="section-heading"><div><h2><Globe size={18} /> Moon research locations</h2><p>South-pole sites are prioritized; select a labeled marker to continue.</p></div></div>
        <div className={`coordinate-map ${planet.toLowerCase()}-map`} aria-label={`${planet} map with available research sites`}><div className="map-grid" />
          {LOCATIONS[planet].map((location) => <button className={`site-marker ${selectedSite?.id === location.id ? "selected" : ""}`} key={location.id} onClick={() => selectSite(location)} style={mapPosition(location)} title={`Select ${location.name}`}><span className="site-dot" style={{ background: location.color }} /><span className="site-name">{location.name}</span></button>)}
          {selectedSite && <div className="map-marker" style={mapPosition(selectedSite)}><MapPin size={30} /></div>}
          <div className="map-instruction"><MapPin size={17} /> Select a labeled research site</div>
        </div>
        <div className="map-legend"><span><i className="legend-dot" /> Available research site</span><span>Only catalogued sites have sufficient data for analysis.</span></div>
        <div className="site-picker">{LOCATIONS[planet].map((location) => <button key={location.id} className={selectedSite?.id === location.id ? "site-chip active" : "site-chip"} onClick={() => selectSite(location)}><i style={{ background: location.color }} /> {location.name}</button>)}</div>
      </div>
      <aside className="research-panel">
        <div className="section-heading"><div><h2><Satellite size={18} /> Research device</h2><p>Each device applies its own suitability weighting.</p></div></div>
        <div className="device-list">{DEVICES.map((device) => <button key={device.id} className={deviceId === device.id ? "device-card active" : "device-card"} onClick={() => setDeviceId(device.id)}><span className="device-select">{deviceId === device.id && <Check size={13} />}</span><span><strong>{device.name}</strong><small>{device.description}</small></span></button>)}<button className={isCustom ? "device-card active" : "device-card"} onClick={() => setDeviceId("custom")}><span className="device-select">{isCustom && <Check size={13} />}</span><span><strong>Custom evaluation</strong><small>Choose the criteria to include</small></span></button></div>
        <div className="criteria-heading"><SlidersHorizontal size={16} /> Evaluation criteria</div>
        <div className="criteria-list">{CRITERIA.map((criterion) => { const enabled = activeDevice ? Object.hasOwn(activeDevice.weights, criterion.key) : selectedCriteria.includes(criterion.key); const weight = criteriaWeights[criterion.key]; return <label className={!isCustom ? "criterion disabled" : "criterion"} key={criterion.key}><input type="checkbox" checked={enabled} disabled={!isCustom} onChange={() => toggleCriterion(criterion.key)} /><span>{criterion.label}<small>{criterion.unit}</small></span>{weight !== undefined && <strong>{Math.round(weight * 100)}%</strong>}</label>; })}</div>
        {selectedSite ? <div className="selected-location"><div className="status-indicator" /><div><strong>{selectedSite.name}</strong><p>{selectedSite.lat}°, {selectedSite.lon}°</p></div></div> : <p className="selection-hint">No site selected. Choose a marker from the map.</p>}
        {apiError && <p className="api-error">{apiError}</p>}<button className="reset-action" onClick={resetSelection}><RotateCcw size={15} /> Clear selected site</button><button className="search-action" onClick={handleSearch} disabled={!selectedSite || isSearching}><Search size={17} /> {isSearching ? "Connecting to server..." : "Evaluate Earth Analogs"}</button>
      </aside>
    </div>
  </section>;
}
