import AnalogMap from "./AnalogMap";
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
  Mars,
  ArrowUpRight,
  Activity,
  Satellite,
  MapPin,
} from "lucide-react";

import PlanetExplorer from "./PlanetExplorer";

const features = [
  { label: "Elevation", value: "--", unit: "meters", icon: Globe2 },
  { label: "Temperature", value: "--", unit: "Kelvin", icon: Activity },
  { label: "Slope", value: "--", unit: "degrees", icon: ChartNoAxesCombined },
  { label: "Instrument Data", value: "--", unit: "measurements", icon: Satellite },
];

function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedPlanet, setSelectedPlanet] = useState("Moon");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAnalogId, setSelectedAnalogId] = useState(null);
  const openExplorer = (planet = "Moon") => {
    setSelectedPlanet(planet);
    setPage("explorer");
  };

  const handleSearch = (location) => {
    setSelectedLocation(location);
    setSelectedAnalogId(null);
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
                  Discover Earth locations that resemble the Moon and Mars
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
                  onClick={() => openExplorer("Moon")}
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

                <button
                  className="planet-card mars-card"
                  onClick={() => openExplorer("Mars")}
                >
                  <div className="planet-visual mars-visual">
                    <Mars size={74} strokeWidth={0.8} />
                  </div>

                  <div className="planet-info">
                    <span className="planet-tag">RED PLANET</span>
                    <h3>Mars</h3>
                    <p>Analyze Martian geology and environmental data.</p>
                    <span className="explore-link">
                      Explore Mars <ArrowUpRight size={16} />
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
                  ["01", "Select Location", "Choose a point on Moon or Mars"],
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
          <PlanetExplorer
            key={selectedPlanet}
            initialPlanet={selectedPlanet}
            onSearch={handleSearch}
          />
        )}

        {page === "discovery" && (
          <section className="section discovery-page">
            <div className="section-heading">
              <div>
                <h2>Analog Discovery</h2>
                <p>Planetary location inspection result.</p>
              </div>
            </div>

            {selectedLocation ? (
              <>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-top">
                      <span>Planet</span>
                      <Globe2 size={19} />
                    </div>
                    <h3>{selectedLocation.planet}</h3>
                    <p>Selected planetary body</p>
                  </div>

                  <div className="metric-card">
                    <div className="metric-top">
                      <span>Latitude</span>
                      <MapPin size={19} />
                    </div>
                    <h3>{selectedLocation.latitude}°</h3>
                    <p>Latitude coordinate</p>
                  </div>

                  <div className="metric-card">
                    <div className="metric-top">
                      <span>Longitude</span>
                      <MapPin size={19} />
                    </div>
                    <h3>{selectedLocation.longitude}°</h3>
                    <p>Longitude coordinate</p>
                  </div>

                  <div className="metric-card">
                    <div className="metric-top">
                      <span>API Status</span>
                      <Activity size={19} />
                    </div>
                    <h3>Validated</h3>
                    <p>Backend response received</p>
                  </div>
                </div>

                <div className="metric-card" style={{ marginTop: "20px" }}>
                  <h3>Backend Response</h3>
                  <p>
                    Data status: {selectedLocation.apiResult?.data_status}
                  </p>
                  <p>{selectedLocation.apiResult?.message}</p>
                </div>


                <div className="metric-card" style={{ marginTop: "20px" }}>
                  <h3>Earth Analog Search</h3>

                  <p>
                    Top 5 locations ranked by similarity to the selected
                    planetary location.
                  </p>

                  <p style={{ color: "#f59e0b", fontSize: "13px" }}>
                    DEMO MODE — Target characteristics and Earth dataset
                    are simulated.
                  </p>

                  {selectedLocation.analogResult?.results?.length > 0 ? (
                    <div style={{ marginTop: "20px" }}>
                      {selectedLocation.analogResult.results.map((result, index) => (
                    <div
                      key={result.site_id}
                      onClick={() => setSelectedAnalogId(result.site_id)}
                      style={{
                        padding: "16px",
                        marginBottom: "12px",
                        border: selectedAnalogId === result.site_id
                          ? "2px solid #facc15"
                          : "1px solid rgba(255,255,255,0.12)",
                        borderRadius: "12px",
                        cursor: "pointer",
                        background: selectedAnalogId === result.site_id
                          ? "rgba(250,204,21,0.08)"
                          : "transparent",
                        transition: "all 0.2s ease",
                      }}
                    >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <div>
                              <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                                RANK #{index + 1}
                              </span>

                              <h3 style={{ margin: "5px 0" }}>
                                {result.name}
                              </h3>

                              <p>{result.country}</p>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <h2 style={{ color: "#38bdf8", margin: 0 }}>
                                {result.similarity_score}%
                              </h2>
                              <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                                Similarity
                              </span>
                            </div>
                          </div>

                          <p style={{ marginTop: "12px" }}>
                            Coordinates: {result.latitude}°, {result.longitude}°
                          </p>

                          <p style={{ fontSize: "12px", color: "#f59e0b" }}>
                            Dataset: {result.data_status}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No analog results available.</p>
                  )}

                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                    {selectedLocation.analogResult?.message}
                  </p>
                  <div style={{ marginTop: "24px" }}>
                    <h3>Earth Analog Geographic Distribution</h3>

                    <p style={{ color: "#94a3b8", marginBottom: "12px" }}>
                      Select a marker or a location above to explore its position.
                    </p>

                    <AnalogMap
                      results={selectedLocation.analogResult?.results || []}
                      selectedId={selectedAnalogId}
                      onSelect={setSelectedAnalogId}
                    />
                  </div>
                </div>

              </>
            ) : (
              <div className="metric-card">
                <h3>No location selected</h3>
                <p>
                  Return to Planet Explorer and select a Moon or Mars
                  location first.
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
              NASA scientific datasets and instrument information will be
              displayed here.
            </p>
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
