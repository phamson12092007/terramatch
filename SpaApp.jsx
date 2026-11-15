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
      <div className="panel-heading"><div><span className="section-kicker">Địa hình tương tự trên Trái Đất</span><h2 id="candidate-title">Các địa điểm xếp hạng</h2></div><span className="count-pill">6 khu vực</span></div>
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
      <p className="panel-footnote"><Info size={14} /> Điểm số sử dụng bộ dữ liệu minh họa trong thiết kế kỹ thuật của nhóm.</p>
    </section>
  );
}

function SiteDetail({ site, modeKey }) {
  const h3Index = latLngToCell(site.lat, site.lon, 4);
  const lowSun = site.minSunAngleDeg > 10;
  return (
    <section className="panel detail-panel" aria-labelledby="detail-title">
      <div className="panel-heading">
        <div><span className="section-kicker">Ô lưới đang chọn</span><h2 id="detail-title">{site.name}</h2></div>
        <span className="large-score">{site.score}<small>%</small></span>
      </div>
      <div className="site-subtitle"><MapPin size={14} /> {site.place} <span>·</span> {site.lat.toFixed(3)}°, {site.lon.toFixed(3)}°</div>
      <p className="site-description">{site.description}</p>
      <div className="detail-meta">
        <div><span>Ô H3</span><strong>{h3Index}</strong></div>
        <div><span>Hậu cần</span><strong>{site.logisticsTier}</strong></div>
        <div><span>Thời gian thử nghiệm</span><strong>{site.bestTestingWindow}</strong></div>
      </div>
      <div className="subsection-heading"><h3>Tiêu chí tương đồng</h3><span>G‑GD · {modes[modeKey].short}</span></div>
      <MetricBars result={site} />
      {site.rolloverHazard && <div className="hazard"><ShieldAlert size={17} /><span>Độ dốc vượt quá 20°. Điểm số đã được áp dụng hệ số an toàn 0,65.</span></div>}
      {lowSun && <div className="mitigation"><Sparkles size={16} /><span>Để thử cảm biến ở góc chiếu Mặt Trời thấp, hãy chọn thời điểm gần bình minh hoặc hoàng hôn và đo góc chiếu sáng tại địa điểm.</span></div>}
      <p className="panel-footnote">Địa chất, suất phản chiếu và các giá trị nhiệt trong danh mục là dữ liệu mẫu của nhóm. Điểm số không phải phép đo đã kiểm chứng tại ô H3 này.</p>
    </section>
  );
}

function TargetCard() {
  return (
    <section className="target-card">
      <div className="target-graphic"><img src="/media/lunar-disk.jpg" alt="" /></div>
      <div className="target-content">
        <span className="section-kicker">Mục tiêu nhiệm vụ / Mặt Trăng</span>
        <h2>{target.name}</h2>
        <p>Thử nghiệm xe địa hình Mặt Trăng trên địa hình bồn trũng vùng cực Nam, đá mafic và khu vực có góc chiếu Mặt Trời thấp.</p>
        <div className="target-tags"><span><Moon size={13} /> {target.region}</span><span><Compass size={13} /> Xe LTV của NASA</span><a href="https://science.nasa.gov/moon/daily-moon-guide/" target="_blank" rel="noreferrer">Ảnh Mặt Trăng · NASA SVS <ArrowUpRight size={12} /></a></div>
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
    { id: "overview", label: "Khám phá địa hình tương tự", icon: Globe2 },
    { id: "mission", label: "Mục tiêu SPA", icon: Moon },
    { id: "lunar-sites", label: "Địa điểm trên Mặt Trăng", icon: MapPin },
    { id: "candidates", label: "Lưới địa điểm ứng viên", icon: Hexagon },
    { id: "analysis", label: "Phân tích LTV", icon: SlidersHorizontal },
    { id: "sources", label: "Nguồn dữ liệu", icon: Database },
  ];

  return (
    <div className="spa-shell">
      <aside className={`spa-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <a className="spa-brand" href="#overview" onClick={() => setActiveSection("overview")}><span><Hexagon size={22} /></span><strong>ACS<span>.</span>AEROTECH</strong></a>
        <p className="sidebar-caption">Trung tâm điều khiển nhiệm vụ</p>
        <nav aria-label="Điều hướng nghiên cứu">
          {navigation.map(({ id, label, icon: Icon }) => <a key={id} className={activeSection === id ? "active" : ""} href={`#${id}`} aria-current={activeSection === id ? "location" : undefined} onClick={() => { setActiveSection(id); setMobileNavOpen(false); }}><Icon size={17} /> {label}</a>)}
        </nav>
        <div className="sidebar-bottom"><span className="online-dot" /> Bản xem trước kỹ thuật <small>NASA Space Apps Challenge 2026</small></div>
      </aside>
      <main className="spa-main" id="overview">
        <header className="spa-topbar">
          <button className="mobile-menu" aria-label="Mở trình đơn" onClick={() => setMobileNavOpen(!mobileNavOpen)}><Menu size={21} /></button>
          <div className="topbar-route">Không gian làm việc <ChevronRight size={13} /> <strong>Khám phá địa hình tương tự bồn trũng SPA</strong></div>
          <div className="topbar-right"><span className="preview-badge"><span /> Bản mẫu thiết kế</span><span className="project-name">DỰ ÁN ACS / 2026</span></div>
        </header>
        <div className="spa-content">
          <div className="page-intro">
            <div><span className="eyebrow"><span /> KHÁM PHÁ ĐỊA HÌNH TƯƠNG TỰ TRÊN TRÁI ĐẤT</span><h1>Tìm địa hình trên Trái Đất<br /><em>để thử nghiệm xe LTV.</em></h1><p>Tìm các khu vực có địa hình tương đồng với bồn trũng Nam Cực–Aitken và phù hợp với yêu cầu vận hành của xe địa hình Mặt Trăng.</p></div>
            <button className="mars-button" onClick={() => setMarsOpen(true)}><span>Có thể mở rộng sang Sao Hỏa</span> Hố Jezero <ArrowUpRight size={16} /></button>
          </div>
          <div id="mission"><TargetCard /></div>
          <div className="section-title lunar-section-title" id="lunar-sites"><div><span className="section-kicker">Bối cảnh nhiệm vụ / Mặt Trăng</span><h2>Khám phá Mặt Trăng</h2></div><p>Xoay khối cầu 3D để khám phá toàn bộ Mặt Trăng và các điểm tham chiếu ở vùng cực Nam.</p></div>
          <MoonExplorer sites={lunarSites} selectedSiteId={selectedLunarSiteId} onSelect={(site) => setSelectedLunarSiteId(site.site_id)} />
          <div className="section-title" id="analysis"><div><span className="section-kicker">01 / Cấu hình LTV</span><h2>Chế độ vận hành</h2></div><p>Trọng số và tiêu chí quan trọng thay đổi theo từng kịch bản thử nghiệm.</p></div>
          <div className="mode-grid" role="group" aria-label="Các chế độ vận hành của LTV">
            {Object.entries(modes).map(([key, mode]) => (
              <button type="button" key={key} className={`mode-card ${key === modeKey ? "active" : ""}`} onClick={() => setModeKey(key)} aria-pressed={key === modeKey}>
                <span className="mode-top"><span className="mode-icon">{key === modeKey ? <Check size={15} /> : <Compass size={15} />}</span><span className="mode-index">0{Object.keys(modes).indexOf(key) + 1}</span></span>
                <strong>{mode.label}</strong><small>{mode.short}</small>
              </button>
            ))}
          </div>
          <p className="mode-description"><Info size={15} /> {modes[modeKey].description}</p>
          <div className="section-title" id="candidates"><div><span className="section-kicker">02 / Khảo sát không gian địa lý</span><h2>Bản đồ lưới H3</h2></div><p>Chọn một ô trên bản đồ hoặc một địa điểm trong danh sách để xem phân tích.</p></div>
          <div className="explorer-grid">
            <div className="panel map-panel"><div className="panel-heading"><div><span className="section-kicker">Trái Đất / khu vực ứng viên</span><h2>6 bồn trũng tiềm năng</h2></div><span className="map-status"><span /> H3 cấp 4</span></div><BasinMap ranked={ranked} selected={selected} onSelect={setSelectedId} /><div className="map-legend"><span><i /> Ô đang chọn</span><span><i /> Các địa điểm khác</span></div></div>
            <CandidateList ranked={ranked} selectedId={selected.id} onSelect={setSelectedId} />
          </div>
          <div className="analysis-grid">
            <SiteDetail site={selected} modeKey={modeKey} />
            <div className="analysis-side"><TraverseProfile site={selected} />
              {dualSite && <section className="panel pairing-panel"><span className="section-kicker">Thử nghiệm tại hai địa điểm</span><h2>Cặp địa điểm bổ trợ</h2><p>Điểm cao nhất dưới 85%. Kết hợp hai địa điểm để tách riêng mục tiêu thử nghiệm cơ học và quang học.</p><div><span>Cơ học</span><strong>{dualSite.mechanics.name}</strong></div><div><span>Quang học</span><strong>{dualSite.optics.name}</strong></div></section>}
              <section className="panel method-panel" id="sources"><span className="section-kicker">Phương pháp / G‑GD</span><h2>Phương pháp chấm điểm</h2><p>Điểm Gaussian được tính cho từng tiêu chí, sau đó điều chỉnh theo mức phạt của tiêu chí quan trọng và hệ số an toàn khi độ dốc vượt 20°. Bộ dữ liệu mẫu có chỉ số NDVI để lọc thảm thực vật. Hiện chưa có dữ liệu lớp phủ mặt đất để lọc vùng nước và đô thị.</p><a href="https://h3geo.org/docs/" target="_blank" rel="noreferrer">Tài liệu H3 <ArrowRight size={15} /></a><a href="https://open-meteo.com/en/docs/elevation-api" target="_blank" rel="noreferrer">Mô hình độ cao Copernicus qua Open-Meteo <ArrowRight size={15} /></a></section>
            </div>
          </div>
          <footer className="spa-footer"><span>ACS.AEROTECH · Bản mẫu kỹ thuật</span><span>Địa điểm ứng viên và chỉ số mô phỏng dựa trên tài liệu thiết kế của nhóm.</span></footer>
        </div>
      </main>
      {marsOpen && <div className="modal-backdrop" role="presentation" onClick={() => setMarsOpen(false)}><div className="mars-modal" role="dialog" aria-modal="true" aria-labelledby="mars-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Đóng" onClick={() => setMarsOpen(false)}><X size={19} /></button><span className="section-kicker">Khả năng mở rộng sang hành tinh khác</span><h2 id="mars-title">Hố Jezero · Sao Hỏa</h2><p>Tài liệu thiết kế xác định Jezero là mục tiêu có thể mở rộng để thử nghiệm xe tự hành trên địa hình bồn trũng va chạm. Các tham số và bộ dữ liệu Sao Hỏa chưa có để chấm điểm G‑GD; màn hình này giới thiệu hướng phát triển tiềm năng.</p><button className="secondary-action" onClick={() => setMarsOpen(false)}>Quay lại phân tích SPA <ArrowRight size={15} /></button></div></div>}
    </div>
  );
}
