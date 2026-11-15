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
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { id: "explorer", label: "Khám phá Mặt Trăng", icon: Globe2 },
  { id: "discovery", label: "Tìm địa hình tương tự", icon: Search },
  { id: "comparison", label: "So sánh", icon: ChartNoAxesCombined },
  { id: "sources", label: "Nguồn dữ liệu", icon: Database },
  { id: "settings", label: "Cài đặt", icon: Settings },
];

const terrainColumns = [
  ["relative_elevation_m", "Độ cao (m)"],
  ["slope_deg_windowed", "Độ dốc (°)"],
  ["terrain_roughness_m_windowed", "Độ gồ ghề (m)"],
  ["local_relief_m", "Độ lồi lõm (m)"],
];

const sources = [
  { name: "LRO · LOLA", description: "Dữ liệu độ cao Mặt Trăng và chỉ số địa hình cục bộ từ phép đo cao độ bằng laser.", url: "https://lunar.gsfc.nasa.gov/lola/" },
  { name: "LRO · Diviner", description: "Nhiệt độ bề mặt và dưới bề mặt vùng cực Nam, dùng làm thông tin tham khảo cho địa điểm.", url: "https://www.diviner.ucla.edu/" },
  { name: "NASA SRTM", description: "Dữ liệu địa hình Trái Đất đã xử lý, dùng để xếp hạng địa điểm.", url: "https://www.earthdata.nasa.gov/data/instruments/srtm" },
  { name: "NASA POWER", description: "API hỗ trợ dữ liệu đo nhiệt độ không khí và bức xạ Mặt Trời hằng ngày.", url: "https://power.larc.nasa.gov/" },
  { name: "MODIS qua AppEEARS", description: "API hỗ trợ dữ liệu quan trắc nhiệt độ bề mặt đất.", url: "https://appeears.earthdatacloud.nasa.gov/" },
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
        <div><h1>Tìm địa hình tương tự</h1><p>Các địa hình trên Trái Đất được xếp hạng theo địa điểm Mặt Trăng bạn chọn.</p></div>
        <button className="secondary-button" onClick={() => navigate("explorer")}>Sửa lựa chọn</button>
      </div>
      {!location ? (
        <div className="dashboard-panel empty-panel">
          <h2>Chưa có kết quả tìm kiếm</h2>
          <p>Hãy chọn địa điểm trên Mặt Trăng và thiết bị cần khảo sát.</p>
          <button className="primary-button" onClick={() => navigate("explorer")}>Mở khám phá Mặt Trăng <ArrowRight size={16} /></button>
        </div>
      ) : (
        <>
          <div className="result-overview dashboard-panel">
              <div><span>Mục tiêu trên Mặt Trăng</span><h2>{location.siteName}</h2><p>{location.latitude}°, {location.longitude}° · {location.research_device}</p></div>
              <div><span>Dữ liệu Trái Đất</span><h2>{location.refresh_from_nasa ? "Đã làm mới từ NASA" : "Dữ liệu quan trắc cục bộ"}</h2><p>Đã chấm điểm {location.analogResult.scored_candidate_count}/{location.analogResult.available_candidate_count} bản ghi</p></div>
          </div>
          <div className="discovery-table-card">
            <div className="result-heading">
              <div><h2>Các địa điểm tương đồng xếp hạng</h2>{!rankedLocations.length && <p>{location.analogResult.message}</p>}</div>
              <button className="secondary-button" onClick={() => navigate("comparison")}>So sánh đặc điểm <ArrowRight size={15} /></button>
            </div>
            {rankedLocations.length > 0 && (
              <div className="discovery-table-scroll">
                <table className="discovery-table" aria-label="Các địa điểm tương đồng xếp hạng">
                  <thead><tr><th>Hạng</th><th>Địa điểm</th><th>Tọa độ</th>{terrainColumns.map(([key, label]) => <th key={key}>{label}</th>)}<th>Điểm</th></tr></thead>
                  <tbody>{rankedLocations.map((result) => (
                    <tr key={result.site_id}>
                      <td>{result.rank}</td>
                      <td><strong>{result.name}</strong><small>{result.country}</small></td>
                      <td><button className="coordinate-link" onClick={() => focusOnMap(result.site_id)} aria-label={`Hiện ${result.name} trên bản đồ Trái Đất`}>{result.latitude}°, {result.longitude}°</button></td>
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
              <h2>Bản đồ Trái Đất</h2>
              <p className="map-caption">Chọn tọa độ trong bảng hoặc điểm đánh dấu trên bản đồ để xem địa điểm tương đồng.</p>
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
        <button className="brand" aria-label="Trang chủ TerraMatch" onClick={() => navigate("dashboard")}>
          <span className="brand-icon"><Orbit size={25} /></span>
          <span><strong>TerraMatch</strong><small>Nghiên cứu địa hình tương tự Mặt Trăng</small></span>
        </button>
        <nav aria-label="Không gian làm việc" className="workspace-nav">
          {pages.map(({ id, label: name, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? "active" : ""}`} aria-current={page === id ? "page" : undefined} onClick={() => navigate(id)}>
              <Icon size={18} /> <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><span className="sidebar-version">TerraMatch · Bản xem trước cục bộ</span></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">Không gian làm việc <span>/</span> <strong>{label}</strong></div>
          <div className="data-status"><span />{refreshFromNasa ? "Đã bật làm mới dữ liệu NASA" : "Dữ liệu cục bộ"}</div>
        </header>
        {page === "dashboard" && <Dashboard navigate={navigate} />}
        {explorerOpened && (
          <div hidden={page !== "explorer"}><PlanetExplorer onSearch={handleSearch} refreshFromNasa={refreshFromNasa} /></div>
        )}
        {page === "discovery" && <Discovery location={location} navigate={navigate} />}
        {page === "comparison" && <Comparison selectedLocation={location} />}
        {page === "sources" && (
          <section className="workspace-page">
            <div className="page-heading"><div><h1>Nguồn dữ liệu</h1><p>Bộ dữ liệu dùng để khảo sát địa điểm trên Mặt Trăng và so sánh địa hình Trái Đất.</p></div></div>
            <div className="source-grid">{sources.map(({ name, description, url }) => (
              <article className="dashboard-panel" key={name}><h2>{name}</h2><p>{description}</p><a className="text-button" href={url} target="_blank" rel="noreferrer">Tài liệu nguồn <ArrowUpRight size={15} /></a></article>
            ))}</div>
          </section>
        )}
        {page === "settings" && (
          <section className="workspace-page">
            <div className="page-heading"><div><h1>Cài đặt</h1><p>Chọn cách TerraMatch lấy dữ liệu quan trắc Trái Đất.</p></div></div>
            <div className="dashboard-panel settings-panel">
              <label><input type="checkbox" checked={refreshFromNasa} onChange={(event) => setRefreshFromNasa(event.target.checked)} /> Làm mới dữ liệu NASA SRTM trước mỗi lần tìm kiếm</label>
              <p>Làm mới dữ liệu trực tuyến cần kết nối mạng và mã truy cập Earthdata được cấu hình trong máy chủ cục bộ. Mặc định, ứng dụng dùng dữ liệu quan trắc đã xử lý kèm theo bản xem trước này.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

