import { useMemo, useState } from "react";
import { latLngToCell } from "h3-js";
import {
  ArrowRight, ArrowUpRight, Check, ChevronRight, Compass, Database,
  Globe2, Hexagon, Info, MapPin, Menu, Moon, ShieldAlert, SlidersHorizontal,
  Sparkles, X,
} from "lucide-react";
import BasinMap from "./BasinMap";
import TraverseProfile from "./TraverseProfile";
import { candidates, lunarSites, metricLabels, modes, target } from "./data";
import { evaluateCandidate } from "./scoring";
import MoonExplorer from "./MoonExplorer";
import "./SpaApp.css";

const formatScore = (score) => `${score}%`;

const dataSources = [
  {
    name: "NASA Moon Trek · LRO LOLA & WAC",
    description: "Các ô bản đồ địa hình, độ dốc, chiếu sáng và ảnh ghép vùng cực Nam được tải trực tiếp khi mở bản đồ Mặt Trăng.",
    url: "https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_ClrShade_SPole75_30mp_v04/1.0.0/WMTSCapabilities.xml",
    category: "Bản đồ Mặt Trăng",
  },
  {
    name: "NASA PDS · LRO LOLA LDEM_16",
    description: "Mô hình cao độ dùng để tính cao độ tương đối, độ dốc, độ gồ ghề và chênh cao cục bộ tại các điểm tham chiếu.",
    url: "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img",
    category: "Số liệu địa hình Mặt Trăng",
  },
  {
    name: "NASA NTRS & NSSDC · tọa độ địa điểm",
    description: "Tọa độ các điểm tham chiếu, vị trí Apollo 11 và Luna 17 trong danh mục địa điểm của ứng dụng.",
    url: "https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf",
    category: "Danh mục địa điểm",
  },
  {
    name: "Natural Earth · land polygons",
    description: "Lớp ranh giới đất liền hiển thị làm bản đồ nền cho các khu vực tương đồng trên Trái Đất.",
    url: "https://www.naturalearthdata.com/",
    category: "Bản đồ Trái Đất",
  },
  {
    name: "Open-Meteo · Copernicus DEM GLO-90",
    description: "API cao độ được gọi theo yêu cầu để tạo trắc dọc 10 km cho khu vực ứng viên đang chọn.",
    url: "https://open-meteo.com/en/docs/elevation-api",
    category: "Địa hình Trái Đất",
  },
  {
    name: "NASA EOSDIS / LP DAAC · SRTMGL1.003",
    description: "Nguồn địa hình SRTM mà pipeline dữ liệu phía máy chủ dùng để lập chỉ mục các địa điểm tương tự trên Trái Đất.",
    url: "https://www.earthdata.nasa.gov/data/instruments/srtm",
    category: "Pipeline dữ liệu cục bộ",
  },
  {
    name: "NASA POWER · Daily API",
    description: "Nguồn quan trắc nhiệt độ không khí và bức xạ Mặt Trời cho quy trình làm giàu dữ liệu Trái Đất khi được bật.",
    url: "https://power.larc.nasa.gov/",
    category: "Pipeline dữ liệu cục bộ",
  },
  {
    name: "NASA AppEEARS · MODIS",
    description: "Nguồn nhiệt độ bề mặt đất MODIS mà quy trình lấy dữ liệu Trái Đất có thể truy vấn.",
    url: "https://appeears.earthdatacloud.nasa.gov/",
    category: "Pipeline dữ liệu cục bộ",
  },
  {
    name: "NASA PDS · LRO Diviner PRP",
    description: "Sản phẩm nhiệt độ vùng cực Nam dùng trong bộ nạp dữ liệu Mặt Trăng phía máy chủ.",
    url: "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/",
    category: "Pipeline dữ liệu cục bộ",
  },
];

function MetricBars({ result }) {
  const metrics = [
    ["slope", `${result.slopeDeg}°`],
    ["roughness", result.roughnessTRI.toFixed(2)],
    ["geology", result.maficBrecciaScore.toFixed(2)],
    ["albedoLight", result.surfaceAlbedo.toFixed(2)],
    ["thermalShock", `${result.skinThermalShockC}°C`],
    ["horizonOcclusion", `${result.horizonOcclusionDeg}°`],
  ];

  return (
    <div className="metric-list">
      {metrics.map(([key, value]) => (
        <div className="metric-line" key={key}>
          <div className="metric-line-label"><span>{metricLabels[key]}</span><strong>{value}</strong></div>
          <div className="metric-track"><span style={{ width: `${result.breakdown[key]}%` }} /></div>
          <small>{result.breakdown[key]}%</small>
        </div>
      ))}
    </div>
  );
}

function CandidateList({ ranked, selectedId, onSelect }) {
  return (
    <section className="panel candidate-panel" aria-labelledby="candidate-title">
      <div className="panel-heading"><div><span className="section-kicker">Earth analogs</span><h2 id="candidate-title">Ranked candidates</h2></div><span className="count-pill">6 regions</span></div>
      <div className="candidate-list">
        {ranked.map((site, index) => (
          <button
            type="button"
            className={`candidate-row ${selectedId === site.id ? "selected" : ""}`}
            key={site.id}
            onClick={() => onSelect(site.id)}
            aria-pressed={selectedId === site.id}
          >
            <span className="rank-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="candidate-identity"><strong>{site.name}</strong><small>{site.place}</small></span>
            <span className="candidate-score">{formatScore(site.score)}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="panel-footnote"><Info size={14} /> Scores use the illustrative dataset from the team's technical design.</p>
    </section>
  );
}

function SiteDetail({ site, modeKey }) {
  const h3Index = latLngToCell(site.lat, site.lon, 4);
  const lowSun = site.minSunAngleDeg > 10;
  return (
    <section className="panel detail-panel" aria-labelledby="detail-title">
      <div className="panel-heading">
        <div><span className="section-kicker">Selected grid cell</span><h2 id="detail-title">{site.name}</h2></div>
        <span className="large-score">{site.score}<small>%</small></span>
      </div>
      <div className="site-subtitle"><MapPin size={14} /> {site.place} <span>·</span> {site.lat.toFixed(3)}°, {site.lon.toFixed(3)}°</div>
      <p className="site-description">{site.description}</p>{site.image && (
  <div className="site-photo-wrap">
    <img src={site.image} alt={site.name} className="site-photo" />
    <small>Ảnh vệ tinh / thực tế · Nguồn: NASA / Public Domain</small>
  </div>
)}    
      <div className="detail-meta">
        <div><span>H3 cell</span><strong>{h3Index}</strong></div>
        <div><span>Logistics</span><strong>{site.logisticsTier}</strong></div>
        <div><span>Test window</span><strong>{site.bestTestingWindow}</strong></div>
      </div>
      <div className="subsection-heading"><h3>Similarity criteria</h3><span>G‑GD · {modes[modeKey].short}</span></div>
      <MetricBars result={site} />
      {site.rolloverHazard && <div className="hazard"><ShieldAlert size={17} /><span>Slope exceeds 20°. A 0.65 safety factor has been applied to the score.</span></div>}
      {lowSun && <div className="mitigation"><Sparkles size={16} /><span>To test sensors at low solar angles, choose a time near sunrise or sunset and measure the illumination angle on site.</span></div>}
      <p className="panel-footnote">Geology, albedo, and thermal values in this catalog are sample data from the team. Scores are not verified measurements for this H3 cell.</p>
    </section>
  );
}

function TargetCard() {
  return (
    <section className="target-card">
      <div className="target-graphic"><img src="/media/lunar-disk.jpg" alt="" /></div>
      <div className="target-content">
        <span className="section-kicker">Mission target / Moon</span>
        <h2>{target.name}</h2>
        <p>Test the Lunar Terrain Vehicle in south-polar basin terrain, mafic rock, and low-angle sunlight.</p>
        <div className="target-tags"><span><Moon size={13} /> {target.region}</span><span><Compass size={13} /> NASA LTV</span><a href="https://science.nasa.gov/moon/daily-moon-guide/" target="_blank" rel="noreferrer">Lunar imagery · NASA SVS <ArrowUpRight size={12} /></a></div>
      </div>
    </section>
  );
}

export default function SpaApp() {
  const [modeKey, setModeKey] = useState("CREWED_TRAVERSE");
  const [selectedId, setSelectedId] = useState(candidates[1].id);
  const [selectedLunarSiteId, setSelectedLunarSiteId] = useState("shackleton-rim");
  const [activeSection, setActiveSection] = useState("overview");
  const [marsOpen, setMarsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const ranked = useMemo(
    () => candidates.map((candidate) => ({ ...candidate, ...evaluateCandidate(candidate, modeKey) }))
      .sort((a, b) => b.score - a.score),
    [modeKey],
  );
  const selected = ranked.find((candidate) => candidate.id === selectedId) ?? ranked[0];
  const dualSite = ranked[0].score < 85
    ? {
      mechanics: [...ranked].sort((a, b) => (b.breakdown.roughness + b.breakdown.geology) - (a.breakdown.roughness + a.breakdown.geology))[0],
      optics: [...ranked].sort((a, b) => (b.breakdown.albedoLight + b.breakdown.horizonOcclusion) - (a.breakdown.albedoLight + a.breakdown.horizonOcclusion))[0],
    }
    : null;
  const navigation = [
    { id: "overview", label: "Analog explorer", icon: Globe2 },
    { id: "mission", label: "SPA target", icon: Moon },
    { id: "lunar-sites", label: "Lunar locations", icon: MapPin },
    { id: "candidates", label: "Candidate grid", icon: Hexagon },
    { id: "analysis", label: "LTV analysis", icon: SlidersHorizontal },
    { id: "sources", label: "Data sources", icon: Database },
  ];

  return (
    <div className="spa-shell">
      <aside className={`spa-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <a className="spa-brand" href="#overview" onClick={() => setActiveSection("overview")}><span><Hexagon size={22} /></span><strong>ACS<span>.</span>AEROTECH</strong></a>
        <p className="sidebar-caption">Mission control</p>
        <nav aria-label="Research navigation">
          {navigation.map(({ id, label, icon: Icon }) => <a key={id} className={activeSection === id ? "active" : ""} href={`#${id}`} aria-current={activeSection === id ? "location" : undefined} onClick={() => { setActiveSection(id); setMobileNavOpen(false); }}><Icon size={17} /> {label}</a>)}
        </nav>
        <div className="sidebar-bottom"><span className="online-dot" /> Technical preview <small>NASA Space Apps Challenge 2026</small></div>
      </aside>
      <main className="spa-main" id="overview">
        <header className="spa-topbar">
          <button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileNavOpen(!mobileNavOpen)}><Menu size={21} /></button>
          <div className="topbar-route">Workspace <ChevronRight size={13} /> <strong>SPA Basin analog explorer</strong></div>
          <div className="topbar-right"><span className="preview-badge"><span /> Design prototype</span><span className="project-name">PROJECT ACS / 2026</span></div>
        </header>
        <div className="spa-content">
          <div className="page-intro">
            <div><span className="eyebrow"><span /> EARTH ANALOG DISCOVERY</span><h1>Find Earth terrain<br /><em>to test the LTV.</em></h1><p>Scan candidate sites for terrain similar to the South Pole–Aitken Basin and the Lunar Terrain Vehicle's operating needs.</p></div>
            <button className="mars-button" onClick={() => setMarsOpen(true)}><span>Mars cross-compatible</span> Jezero Crater <ArrowUpRight size={16} /></button>
          </div>
          <div id="mission"><TargetCard /></div>
          <div className="section-title lunar-section-title" id="lunar-sites"><div><span className="section-kicker">Mission context / Moon</span><h2>Explore the Moon</h2></div><p>Rotate the 3D globe to explore the entire Moon and its south-polar reference sites.</p></div>
          <MoonExplorer sites={lunarSites} selectedSiteId={selectedLunarSiteId} onSelect={(site) => setSelectedLunarSiteId(site.site_id)} />
          <div className="section-title" id="analysis"><div><span className="section-kicker">01 / LTV configuration</span><h2>Operating modes</h2></div><p>Weights and critical criteria vary by test scenario.</p></div>
          <div className="mode-grid" role="group" aria-label="LTV operating modes">
            {Object.entries(modes).map(([key, mode]) => (
              <button type="button" key={key} className={`mode-card ${key === modeKey ? "active" : ""}`} onClick={() => setModeKey(key)} aria-pressed={key === modeKey}>
                <span className="mode-top"><span className="mode-icon">{key === modeKey ? <Check size={15} /> : <Compass size={15} />}</span><span className="mode-index">0{Object.keys(modes).indexOf(key) + 1}</span></span>
                <strong>{mode.label}</strong><small>{mode.short}</small>
              </button>
            ))}
          </div>
          <p className="mode-description"><Info size={15} /> {modes[modeKey].description}</p>
          <div className="section-title" id="candidates"><div><span className="section-kicker">02 / Geospatial scan</span><h2>H3 grid map</h2></div><p>Select a map cell or list item to view its analysis.</p></div>
          <div className="explorer-grid">
            <div className="panel map-panel"><div className="panel-heading"><div><span className="section-kicker">Earth / candidate regions</span><h2>6 candidate basins</h2></div><span className="map-status"><span /> H3 res 4</span></div><BasinMap ranked={ranked} selected={selected} onSelect={setSelectedId} /><div className="map-legend"><span><i /> Selected cell</span><span><i /> Other candidates</span></div></div>
            <CandidateList ranked={ranked} selectedId={selected.id} onSelect={setSelectedId} />
          </div>
          <div className="analysis-grid">
            <SiteDetail site={selected} modeKey={modeKey} />
            <div className="analysis-side"><TraverseProfile site={selected} />
              {dualSite && <section className="panel pairing-panel"><span className="section-kicker">Dual-site testing</span><h2>Complementary site pair</h2><p>Top score is below 85%. Pair two sites to separate mechanical and optical test objectives.</p><div><span>Mechanical</span><strong>{dualSite.mechanics.name}</strong></div><div><span>Optical</span><strong>{dualSite.optics.name}</strong></div></section>}
              <section className="panel method-panel"><span className="section-kicker">Method / G‑GD</span><h2>Scoring method</h2><p>Gaussian scores are calculated per criterion, then adjusted by critical-criterion penalties and a safety factor when slope exceeds 20°. The sample includes NDVI for vegetation filtering. Land-cover data for filtering water and urban areas is not yet available.</p><a href="https://h3geo.org/docs/" target="_blank" rel="noreferrer">H3 documentation <ArrowRight size={15} /></a></section>
            </div>
          </div>
          <section className="panel data-sources-panel" id="sources" aria-labelledby="data-sources-title">
            <div className="data-sources-heading"><div><span className="section-kicker">Traceability</span><h2 id="data-sources-title">Data sources</h2></div><p>Liên kết trực tiếp đến mọi nguồn dữ liệu và dịch vụ dữ liệu mà dự án sử dụng.</p></div>
            <div className="data-sources-list">
              {dataSources.map(({ name, description, url, category }) => (
                <article className="data-source-card" key={name}>
                  <span>{category}</span>
                  <h3>{name}</h3>
                  <p>{description}</p>
                  <a href={url} target="_blank" rel="noreferrer">Mở nguồn <ArrowUpRight size={14} /></a>
                </article>
              ))}
            </div>
          </section>
          <footer className="spa-footer"><span>ACS.AEROTECH · Technical prototype</span><span>Candidate locations and simulated metrics are based on the team's design document.</span></footer>
        </div>
      </main>
      {marsOpen && <div className="modal-backdrop" role="presentation" onClick={() => setMarsOpen(false)}><div className="mars-modal" role="dialog" aria-modal="true" aria-labelledby="mars-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={() => setMarsOpen(false)}><X size={19} /></button><span className="section-kicker">Cross-compatible mode</span><h2 id="mars-title">Jezero Crater · Mars</h2><p>The design document identifies Jezero as a cross-compatible target for impact-basin rover testing. Mars parameters and datasets are not yet available for G‑GD scoring, so this screen introduces a potential extension.</p><button className="secondary-action" onClick={() => setMarsOpen(false)}>Back to SPA analysis <ArrowRight size={15} /></button></div></div>}
    </div>
  );
}
