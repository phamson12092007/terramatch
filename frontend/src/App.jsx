<<<<<<< HEAD
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
=======
import { useRef, useState } from "react";
import Comparison from "./Comparison";
import AnalogMap from "./AnalogMap";
import {
  Orbit,
  LayoutDashboard,
  Globe2,
  Search,
  ChartNoAxesCombined,
  Database,
  Settings,
  Bell,
  Moon,
  ArrowUpRight,
  Activity,
  Satellite,
} from "lucide-react";

import PlanetExplorer from "./PlanetExplorer";

const features = [
  { label: "Elevation", value: "--", unit: "meters", icon: Globe2 },
  { label: "Temperature", value: "--", unit: "Kelvin", icon: Activity },
  { label: "Slope", value: "--", unit: "degrees", icon: ChartNoAxesCombined },
  { label: "Instrument Data", value: "--", unit: "measurements", icon: Satellite },
];

function formatFeature(location, key, digits = 2) {
  const value = location.features?.find((feature) => feature.key === key)?.value;
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedEarthId, setSelectedEarthId] = useState(null);
  const earthMapRef = useRef(null);
  const openExplorer = () => setPage("explorer");

  const earthRecordsById = new Map(
    (selectedLocation?.earthLocations || []).map((location) => [location.location_id, location])
  );
  const rankedEarthRows = (selectedLocation?.analogResult?.results || []).map((result, index) => ({
    location: earthRecordsById.get(result.site_id),
    rank: index + 1,
    score: result.similarity_score,
  })).filter((row) => row.location);
  const earthRows = rankedEarthRows.length
    ? rankedEarthRows
    : (selectedLocation?.earthLocations || []).map((location) => ({ location, rank: null, score: null }));
  const earthMapResults = rankedEarthRows.map(({ location, rank, score }) => ({
    ...location,
    site_id: location.location_id,
    rank,
    similarity_score: score,
  }));

  const handleSearch = (location) => {
    setSelectedLocation(location);
    setSelectedEarthId(location.analogResult?.results?.[0]?.site_id || null);
    setPage("discovery");
  };
  const focusEarthLocation = (locationId) => {
    setSelectedEarthId(locationId);
    requestAnimationFrame(() => earthMapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "explorer", label: "Planet Explorer", icon: Globe2 },
    { id: "discovery", label: "Analog Discovery", icon: Search },
    { id: "comparison", label: "Comparison", icon: ChartNoAxesCombined },
    { id: "sources", label: "Data Sources", icon: Database },
  ];

  const pageTitles = {
    dashboard: "Dashboard",
    explorer: "Planet Explorer",
    discovery: "Analog Discovery",
    comparison: "Comparison",
    sources: "Data Sources",
  };
>>>>>>> 57867d0c2fff0fbaf799359e8f5ffbe1c509c587

  return (
    <div className="app">
      <aside className="sidebar">
<<<<<<< HEAD
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
=======
        <div className="brand">
          <div className="brand-icon">
            <Orbit size={25} />
          </div>
          <div>
            <h2>TERRAMATCH</h2>
            <span>SPACE ANALOG DISCOVERY</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => setPage(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => setPage("settings")}
          >
            <Settings size={18} />
            Settings
          </button>

          <div className="status">
            <span className="status-dot" />
            SYSTEM READY
          </div>

          <p>TerraMatch v0.1.0</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {pageTitles[page] || "Settings"}
          </div>

          <div className="top-actions">
            <button className="icon-button">
              <Bell size={18} />
            </button>
            <div className="user-avatar">TM</div>
          </div>
        </header>

        {page === "dashboard" && (
          <>
            <section className="welcome">
              <div>
                <div className="eyebrow">
                  <span /> NASA SPACE ANALOG RESEARCH
                </div>

                <h1>
                  Explore Beyond <span>Earth.</span>
                </h1>

                <p>
                  Discover Earth locations that resemble the Moon
                  through scientific data and intelligent analysis.
                </p>
              </div>

              <div className="welcome-icon">
                <Orbit size={76} strokeWidth={1} />
              </div>
            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Select a planetary body</h2>
                  <p>Choose a world to begin your exploration.</p>
                </div>
              </div>

              <div className="planet-grid">
                <button
                  className="planet-card moon-card"
                  onClick={openExplorer}
                >
                  <div className="planet-visual moon-visual">
                    <Moon size={74} strokeWidth={0.8} />
                  </div>

                  <div className="planet-info">
                    <span className="planet-tag">
                      TERRESTRIAL SATELLITE
                    </span>
                    <h3>The Moon</h3>
                    <p>Explore lunar terrain and surface conditions.</p>
                    <span className="explore-link">
                      Explore Moon <ArrowUpRight size={16} />
                    </span>
                  </div>
                </button>

              </div>
            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Planetary data overview</h2>
                  <p>
                    Scientific measurements for your selected location.
                  </p>
                </div>
                <span className="demo-label">AWAITING LOCATION</span>
              </div>

              <div className="metrics-grid">
                {features.map(({ label, value, unit, icon: Icon }) => (
                  <div className="metric-card" key={label}>
                    <div className="metric-top">
                      <span>{label}</span>
                      <Icon size={19} />
                    </div>
                    <h3>{value}</h3>
                    <p>{unit}</p>
                  </div>
                ))}
              </div>


            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>Discovery workflow</h2>
                  <p>
                    From planetary measurements to Earth analog locations.
                  </p>
                </div>
              </div>

              <div className="workflow">
                {[
                  ["01", "Select Location", "Choose a catalogued lunar research site"],
                  ["02", "Analyze Data", "Retrieve scientific measurements"],
                  ["03", "Find Analogs", "Rank similar locations on Earth"],
                  ["04", "Compare Results", "Review evidence and limitations"],
                ].map(([number, title, description]) => (
                  <div className="workflow-step" key={number}>
                    <span>{number}</span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
            </section>

            <footer>
              <span>(c) 2026 TERRAMATCH</span>
              <span>Scientific discovery through planetary data</span>
            </footer>
          </>
        )}

        {page === "explorer" && (
          <PlanetExplorer onSearch={handleSearch} />
        )}

        {page === "discovery" && (
          <section className="section discovery-page">
            <div className="section-heading">
              <div>
                <h2>Analog Discovery</h2>
              </div>
            </div>

            {selectedLocation ? (
              <>
                <div className="discovery-table-card">
                  <table className="discovery-table">
                    <thead><tr><th>Moon site</th><th>Coordinates</th><th>Device</th><th>Earth data</th></tr></thead>
                    <tbody><tr><td>{selectedLocation.siteName || selectedLocation.site_id}</td><td>{selectedLocation.latitude}°, {selectedLocation.longitude}°</td><td>{selectedLocation.research_device}</td><td>{selectedLocation.analogResult?.data_source || "—"}</td></tr></tbody>
                  </table>
                </div>

                <div className="discovery-table-card">
                  <h3>Earth observations</h3>
                  {earthRows.length ? <div className="discovery-table-scroll"><table className="discovery-table">
                    <thead><tr><th>Rank</th><th>Location</th><th>Coordinates</th><th>Elevation (m)</th><th>Slope (°)</th><th>Roughness (m)</th><th>Relief (m)</th><th>Score</th><th>Status</th></tr></thead>
                    <tbody>{earthRows.map(({ location, rank, score }) => <tr key={location.location_id}><td>{rank || "—"}</td><td>{location.name}</td><td><button className="coordinate-link" onClick={() => focusEarthLocation(location.location_id)} aria-label={`Show ${location.name} on the Earth map`}>{location.latitude}°, {location.longitude}°</button></td><td>{formatFeature(location, "relative_elevation_m")}</td><td>{formatFeature(location, "slope_deg_windowed")}</td><td>{formatFeature(location, "terrain_roughness_m_windowed")}</td><td>{formatFeature(location, "local_relief_m")}</td><td>{Number.isFinite(score) ? `${score.toFixed(2)}%` : "—"}</td><td>{location.data_status}</td></tr>)}</tbody>
                  </table></div> : <p className="discovery-empty">No REAL Earth observations available.</p>}
                </div>

                {earthMapResults.length > 0 && <div className="earth-map-card" ref={earthMapRef} tabIndex="-1"><div className="earth-map-heading"><div><h3>Earth map</h3><p>Select a coordinate above or a marker to inspect a ranked location.</p></div></div><AnalogMap results={earthMapResults} selectedId={selectedEarthId} onSelect={setSelectedEarthId} /></div>}

              </>
            ) : (
              <div className="metric-card">
                <h3>No location selected</h3>
                <p>
                  Return to Planet Explorer and select a lunar location first.
                </p>
              </div>
            )}

            <button
              className="search-action"
              style={{ maxWidth: "250px", marginTop: "20px" }}
              onClick={() => setPage("explorer")}
            >
              Back to Planet Explorer
            </button>
          </section>
        )}

        {page === "comparison" && (
          <Comparison selectedLocation={selectedLocation} />
        )}

        {page === "sources" && (
          <section className="section">
            <h1>Data Sources</h1>
            <p>
              TerraMatch keeps NASA POWER, MODIS, and SRTM records separate
              from the legacy simulated dataset. Real results show their
              feature-level provenance in Analog Discovery.
            </p>
            <div className="metrics-grid" style={{ marginTop: "20px" }}>
              <div className="metric-card"><h3>NASA POWER</h3><p>Daily solar and two-metre air-temperature observations.</p></div>
              <div className="metric-card"><h3>MODIS LST</h3><p>QA-validated MOD11A1.061 daytime/nighttime land-surface temperature.</p></div>
              <div className="metric-card"><h3>SRTM Terrain</h3><p>Elevation, local slope, and roughness from valid SRTMGL1 terrain windows.</p></div>
              <div className="metric-card"><h3>Demo Dataset</h3><p>Separate legacy examples, available only when explicitly selected.</p></div>
            </div>
          </section>
        )}

        {page === "settings" && (
          <section className="section">
            <h1>Settings</h1>
            <p>TerraMatch application settings.</p>
          </section>
        )}
>>>>>>> 57867d0c2fff0fbaf799359e8f5ffbe1c509c587
      </main>
    </div>
  );
}

<<<<<<< HEAD
=======
export default App;
>>>>>>> 57867d0c2fff0fbaf799359e8f5ffbe1c509c587
