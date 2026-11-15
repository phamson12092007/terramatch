import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, ArrowUpRight, ChartNoAxesCombined, Database, Globe2,
  LayoutDashboard, Orbit, Search, Settings,
} from "lucide-react";
import AnalogMap from "./AnalogMap";
import Comparison from "./Comparison";
import Dashboard from "./Dashboard";
import PlanetExplorer from "./PlanetExplorer";

const pages = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "explorer", label: "Planet Explorer", icon: Globe2 },
  { id: "discovery", label: "Analog Discovery", icon: Search },
  { id: "comparison", label: "Comparison", icon: ChartNoAxesCombined },
  { id: "sources", label: "Data Sources", icon: Database },
  { id: "settings", label: "Settings", icon: Settings },
];

const terrainColumns = [
  ["relative_elevation_m", "Elevation (m)"],
  ["slope_deg_windowed", "Slope (°)"],
  ["terrain_roughness_m_windowed", "Roughness (m)"],
  ["local_relief_m", "Relief (m)"],
];

const sources = [
  { name: "LRO · LOLA", description: "Lunar elevation and local terrain metrics from laser altimetry.", url: "https://lunar.gsfc.nasa.gov/lola/" },
  { name: "LRO · Diviner", description: "South-pole surface and subsurface temperatures, shown as site context.", url: "https://www.diviner.ucla.edu/" },
  { name: "NASA SRTM", description: "Processed Earth terrain observations used in the ranking.", url: "https://www.earthdata.nasa.gov/data/instruments/srtm" },
  { name: "NASA POWER", description: "Daily air temperature and solar measurements supported by the API.", url: "https://power.larc.nasa.gov/" },
  { name: "MODIS via AppEEARS", description: "Land-surface temperature observations supported by the API.", url: "https://appeears.earthdatacloud.nasa.gov/" },
];

const formatNumber = (value) => Number.isFinite(value) ? value.toFixed(2) : "—";

function Discovery({ location, navigate }) {
  const mapRef = useRef(null);
  const [focusedId, setFocusedId] = useState(null);
  const results = location?.analogResult.results;
  const rankedLocations = useMemo(() => {
    if (!results?.length) return [];
    const observations = new Map(location.earthLocations.map((item) => [item.location_id, item]));
    return results.map((result, index) => ({
      ...result,
      rank: index + 1,
      features: observations.get(result.site_id)?.features ?? [],
    }));
  }, [location, results]);

  function focusOnMap(siteId) {
    setFocusedId(siteId);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="workspace-page">
      <div className="page-heading">
        <div><h1>Analog Discovery</h1><p>Ranked Earth terrain for your selected lunar site.</p></div>
        <button className="secondary-button" onClick={() => navigate("explorer")}>Edit search</button>
      </div>
      {!location ? (
        <div className="dashboard-panel empty-panel">
          <h2>No search results yet</h2>
          <p>Choose a lunar location and equipment in Planet Explorer.</p>
          <button className="primary-button" onClick={() => navigate("explorer")}>Open Planet Explorer <ArrowRight size={16} /></button>
        </div>
      ) : (
        <>
          <div className="result-overview dashboard-panel">
            <div><span>Lunar target</span><h2>{location.siteName}</h2><p>{location.latitude}°, {location.longitude}° · {location.research_device}</p></div>
            <div><span>Earth data</span><h2>{location.refresh_from_nasa ? "NASA refresh" : "Local observations"}</h2><p>{location.analogResult.scored_candidate_count} of {location.analogResult.available_candidate_count} records scored</p></div>
          </div>
          <div className="discovery-table-card">
            <div className="result-heading">
              <div><h2>Ranked Earth matches</h2>{!rankedLocations.length && <p>{location.analogResult.message}</p>}</div>
              <button className="secondary-button" onClick={() => navigate("comparison")}>Compare features <ArrowRight size={15} /></button>
            </div>
            {rankedLocations.length > 0 && (
              <div className="discovery-table-scroll">
                <table className="discovery-table" aria-label="Ranked Earth matches">
                  <thead><tr><th>Rank</th><th>Location</th><th>Coordinates</th>{terrainColumns.map(([key, label]) => <th key={key}>{label}</th>)}<th>Score</th></tr></thead>
                  <tbody>{rankedLocations.map((result) => (
                    <tr key={result.site_id}>
                      <td>{result.rank}</td>
                      <td><strong>{result.name}</strong><small>{result.country}</small></td>
                      <td><button className="coordinate-link" onClick={() => focusOnMap(result.site_id)} aria-label={`Show ${result.name} on the Earth map`}>{result.latitude}°, {result.longitude}°</button></td>
                      {terrainColumns.map(([key]) => <td key={key}>{formatNumber(result.features.find((feature) => feature.key === key)?.value)}</td>)}
                      <td className="score-cell">{formatNumber(result.similarity_score)}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
          {rankedLocations.length > 0 && (
            <div className="earth-map-card dashboard-panel" ref={mapRef}>
              <h2>Earth map</h2>
              <p className="map-caption">Select a row’s coordinates or a map marker to locate a match.</p>
              <AnalogMap results={rankedLocations} selectedId={focusedId} onSelect={setFocusedId} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [explorerOpened, setExplorerOpened] = useState(false);
  const [location, setLocation] = useState(null);
  const [refreshFromNasa, setRefreshFromNasa] = useState(false);
  const label = pages.find((item) => item.id === page).label;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  function navigate(destination) {
    if (destination === "explorer") setExplorerOpened(true);
    setPage(destination);
  }

  function handleSearch(result) {
    setLocation(result);
    setPage((current) => current === "explorer" ? "discovery" : current);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="brand" aria-label="TerraMatch home" onClick={() => navigate("dashboard")}>
          <span className="brand-icon"><Orbit size={25} /></span>
          <span><strong>TerraMatch</strong><small>Lunar analog research</small></span>
        </button>
        <nav aria-label="Workspace" className="workspace-nav">
          {pages.map(({ id, label: name, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? "active" : ""}`} aria-current={page === id ? "page" : undefined} onClick={() => navigate(id)}>
              <Icon size={18} /> <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><span className="sidebar-version">TerraMatch · Local review</span></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{label}</strong></div>
          <div className="data-status"><span />{refreshFromNasa ? "NASA refresh enabled" : "Local data"}</div>
        </header>
        {page === "dashboard" && <Dashboard navigate={navigate} />}
        {explorerOpened && (
          <div hidden={page !== "explorer"}><PlanetExplorer onSearch={handleSearch} refreshFromNasa={refreshFromNasa} /></div>
        )}
        {page === "discovery" && <Discovery location={location} navigate={navigate} />}
        {page === "comparison" && <Comparison selectedLocation={location} />}
        {page === "sources" && (
          <section className="workspace-page">
            <div className="page-heading"><div><h1>Data Sources</h1><p>Datasets used to inspect lunar sites and compare Earth terrain.</p></div></div>
            <div className="source-grid">{sources.map(({ name, description, url }) => (
              <article className="dashboard-panel" key={name}><h2>{name}</h2><p>{description}</p><a className="text-button" href={url} target="_blank" rel="noreferrer">Source documentation <ArrowUpRight size={15} /></a></article>
            ))}</div>
          </section>
        )}
        {page === "settings" && (
          <section className="workspace-page">
            <div className="page-heading"><div><h1>Settings</h1><p>Choose how TerraMatch retrieves Earth observations.</p></div></div>
            <div className="dashboard-panel settings-panel">
              <label><input type="checkbox" checked={refreshFromNasa} onChange={(event) => setRefreshFromNasa(event.target.checked)} /> Refresh NASA SRTM before each search</label>
              <p>The live refresh requires network access and an Earthdata token configured on the local backend. The default uses the processed observations bundled with this review.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

