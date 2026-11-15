import { useState } from "react";
import Comparison from "./Comparison";
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

  const handleSearch = (location) => {
    setSelectedLocation(location);
    setPage("discovery");
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

  return (
    <div className="app">
      <aside className="sidebar">
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
                    <tbody>{earthRows.map(({ location, rank, score }) => <tr key={location.location_id}><td>{rank || "—"}</td><td>{location.name}</td><td>{location.latitude}°, {location.longitude}°</td><td>{formatFeature(location, "relative_elevation_m")}</td><td>{formatFeature(location, "slope_deg_windowed")}</td><td>{formatFeature(location, "terrain_roughness_m_windowed")}</td><td>{formatFeature(location, "local_relief_m")}</td><td>{Number.isFinite(score) ? `${score.toFixed(2)}%` : "—"}</td><td>{location.data_status}</td></tr>)}</tbody>
                  </table></div> : <p className="discovery-empty">No REAL Earth observations available.</p>}
                </div>

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
      </main>
    </div>
  );
}

export default App;
