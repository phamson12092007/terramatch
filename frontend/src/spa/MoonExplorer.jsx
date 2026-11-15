import { useMemo, useState } from "react";
import { ArrowUpRight, Database, Globe2, Map, MapPin, Search } from "lucide-react";
import LunarGlobe from "./LunarGlobe";
import LunarSouthPoleMap from "./LunarSouthPoleMap";
import { lunarSiteTerrainMetrics } from "./data";
import "./MoonExplorer.css";

const layerCatalog = {
  sites: {
    label: "Địa điểm",
    description: "Danh sách bên dưới gồm các vị trí tham chiếu, tọa độ và nguồn trích dẫn.",
    source: "Tọa độ địa điểm",
    sourceUrl: "https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf",
  },
  elevation: {
    label: "Độ cao LOLA",
    description: "Bản đồ địa hình tô màu từ LOLA, hiển thị cao độ và hình thái bề mặt vùng 75° Nam đến cực Nam.",
    source: "NASA Moon Trek · LRO LOLA Color Hillshade",
    sourceUrl: "https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_ClrShade_SPole75_30mp_v04/1.0.0/WMTSCapabilities.xml",
  },
  slope: {
    label: "Độ dốc",
    description: "Lớp độ dốc màu từ LOLA, độ phân giải 120 m/pixel, phủ vùng 75° Nam đến cực Nam.",
    source: "NASA Moon Trek · LRO LOLA Color Slope",
    sourceUrl: "https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_ClrSlope_SPole75S_120m/1.0.0/WMTSCapabilities.xml",
  },
  illumination: {
    label: "Chiếu sáng",
    description: "Tỷ lệ quan sát được Mặt Trời từ ảnh WAC trong một năm Mặt Trăng. Lớp bao phủ từ 88° Nam đến cực Nam.",
    source: "NASA LROC · WAC Percentage Illumination",
    sourceUrl: "https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_PCT_SOUTH",
  },
  psr: {
    label: "Vùng tối vĩnh viễn (PSR)",
    description: "Lớp chiếu sáng LOLA có vùng tối dạng mặt nạ, giúp nhận biết các khu vực cực Nam ít hoặc không nhận ánh sáng.",
    source: "NASA Moon Trek · LOLA Polar Illumination",
    sourceUrl: "https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_Illumination_SPole65S_240m/1.0.0/WMTSCapabilities.xml",
  },
};

const layerExplanations = {
  sites: {
    resolution: "Điểm địa danh · không phải raster",
    coverage: "Địa điểm tham chiếu đã có trong TerraMatch",
    meaning: "Chấm trên bản đồ là tọa độ của địa điểm được chọn. Bấm chấm hoặc tên trong danh sách để xem thông tin và nguồn.",
    limitation: "Điểm tọa độ không biểu diễn ranh giới miệng hố hay vùng khảo sát.",
  },
  elevation: {
    resolution: "30 m/pixel · LOLA",
    coverage: "75° Nam đến 90° Nam",
    meaning: "Ảnh tô màu địa hình thể hiện hình thái/cao độ tương đối; bóng đổ giả lập giúp nhìn rõ vành hố và sườn dốc.",
    limitation: "Đây là lớp màu địa hình, không phải truy vấn số mét tại từng điểm. Màu sắc theo thang của sản phẩm NASA.",
  },
  slope: {
    resolution: "120 m/pixel · LOLA",
    coverage: "75° Nam đến 90° Nam",
    meaning: "Mỗi pixel biểu diễn độ nghiêng địa hình; độ dốc thường được tính bằng độ (°). Khu vực dốc hơn khó di chuyển hơn.",
    limitation: "Thang màu được mã hóa trong raster NASA; bản xem này không hiển thị giá trị chính xác khi rê chuột.",
  },
  illumination: {
    resolution: "100 m/pixel · ảnh LROC WAC",
    coverage: "88° Nam đến 90° Nam",
    meaning: "Tỷ lệ quan sát thấy Mặt Trời trong các lần chụp suốt khoảng một năm Mặt Trăng. Giá trị cao gợi ý nơi có ánh sáng thường xuyên hơn.",
    limitation: "Đây là tỷ lệ từ chuỗi ảnh, không phải dự báo thời gian thực hay bảo đảm chiếu sáng tương lai. Độ phủ hẹp hơn các lớp LOLA.",
  },
  psr: {
    resolution: "240 m/pixel · LOLA",
    coverage: "65° Nam đến 90° Nam",
    meaning: "Lớp chiếu sáng vùng cực từ mô hình địa hình LOLA; vùng tối biểu thị nơi địa hình che khuất ánh sáng trong sản phẩm.",
    limitation: "Đây là sản phẩm chiếu sáng theo mô hình, không phải ảnh chụp bề mặt. Ranh giới PSR phụ thuộc tiêu chí và thời kỳ phân tích.",
  },
};

function formatCoordinate(value, positive, negative) {
  const number = Number(value);
  return `${Math.abs(number).toFixed(4)}°${number < 0 ? negative : positive}`;
}

export default function MoonExplorer({ sites = [], selectedSiteId, onSelect }) {
  const [query, setQuery] = useState("");
  const [showMarkers, setShowMarkers] = useState(true);
  const [activeLayer, setActiveLayer] = useState("sites");
  const [viewMode, setViewMode] = useState("south-pole");

  const filteredSites = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    return sites.filter((site) => {
      const matchesSouthPole = Number(site.latitude) < -70;
      const matchesQuery = !normalizedQuery
        || `${site.name} ${site.reference ?? ""} ${site.kind ?? ""}`.toLocaleLowerCase("vi").includes(normalizedQuery);
      return matchesSouthPole && matchesQuery;
    });
  }, [sites, query]);

  const selectedSite = filteredSites.find((site) => site.site_id === selectedSiteId) ?? filteredSites[0];
  const selectedTerrainMetrics = selectedSite ? lunarSiteTerrainMetrics.values[selectedSite.site_id] : null;
  const activeLayerInfo = layerCatalog[activeLayer];
  const activeLayerExplanation = layerExplanations[activeLayer];
  const southPoleCount = filteredSites.filter((site) => Number(site.latitude) < -70).length;
  const visibleSouthPoleSites = filteredSites.filter((site) => Number(site.latitude) < -70);

  const selectSite = (site) => onSelect?.(site);

  return (
    <section className="moon-explorer" aria-label="Khám phá Mặt Trăng trên khối cầu 3D">
      <div className="polar-toolbar">
        <label className="polar-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Tìm địa điểm trên Mặt Trăng</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm địa điểm…" />
        </label>
        <div className="explorer-view-toggle" role="group" aria-label="Chế độ bản đồ">
          <button type="button" className={viewMode === "globe" ? "active" : ""} aria-pressed={viewMode === "globe"} onClick={() => setViewMode("globe")}><Globe2 size={13} /> Khối cầu 3D</button>
          <button type="button" className={viewMode === "south-pole" ? "active" : ""} aria-pressed={viewMode === "south-pole"} onClick={() => setViewMode("south-pole")}><Map size={13} /> Bản đồ cực Nam</button>
        </div>
        <label className="explorer-marker-toggle"><input type="checkbox" checked={showMarkers} onChange={(event) => setShowMarkers(event.target.checked)} /> Hiện điểm đánh dấu</label>
        <span className="explorer-count">{filteredSites.length} địa điểm</span>
      </div>

      <div className="moon-explorer-layout">
        <div className="moon-globe-column">
          {viewMode === "globe"
            ? <LunarGlobe sites={filteredSites} selectedSiteId={selectedSite?.site_id} onSelect={selectSite} showMarkers={showMarkers} />
            : <LunarSouthPoleMap sites={visibleSouthPoleSites} selectedSiteId={selectedSite?.site_id} onSelect={selectSite} showMarkers={showMarkers} activeLayer={activeLayer} />}
          <div className="south-pole-context">
            <span className="south-pole-context-icon"><MapPin size={15} /></span>
            {viewMode === "globe"
              ? <div><strong>Cực Nam trên toàn cảnh Mặt Trăng</strong><p>{southPoleCount} điểm tham chiếu ở vùng cực Nam đang hiển thị. Chọn một địa điểm trong danh sách hoặc nhấn vào điểm đánh dấu để xoay đến đó.</p></div>
              : <div><strong>Ảnh ghép Cực Nam LRO WAC</strong><p>{southPoleCount} địa điểm phù hợp bộ lọc được đặt trên lớp ảnh NASA Moon Trek, phủ từ 60° Nam đến 90° Nam. Cần kết nối Internet để tải các ô bản đồ.</p></div>}
          </div>
        </div>

        <aside className="moon-explorer-inspector" aria-label="Thông tin địa điểm">
          <div className="polar-layer-picker">
            <div className="polar-card-heading"><span className="section-kicker">Lớp dữ liệu</span><span className="layer-status-pill">Nguồn mở</span></div>
            <div className="layer-options" role="group" aria-label="Chọn lớp dữ liệu">
              {Object.entries(layerCatalog).map(([key, layer]) => (
                <button key={key} type="button" className={activeLayer === key ? "active" : ""} aria-pressed={activeLayer === key} onClick={() => { setActiveLayer(key); if (key !== "sites") { setViewMode("south-pole"); setSiteFilter("south-pole"); } }}>{layer.label}</button>
              ))}
            </div>
            <p>{activeLayerInfo.description}</p>
            <a href={activeLayerInfo.sourceUrl} target="_blank" rel="noreferrer">{activeLayerInfo.source} <ArrowUpRight size={13} /></a>
            <div className="layer-explanation" aria-live="polite">
              <div className="layer-explanation-title">Cách đọc lớp dữ liệu</div>
              <div className="layer-facts"><span><strong>Độ phân giải</strong>{activeLayerExplanation.resolution}</span><span><strong>Phạm vi</strong>{activeLayerExplanation.coverage}</span></div>
              <p>{activeLayerExplanation.meaning}</p>
              <small>{activeLayerExplanation.limitation}</small>
            </div>
            {activeLayer !== "sites" && <div className="layer-status layer-status-live" role="status"><Database size={15} /><span><strong>Đang hiển thị lớp {activeLayerInfo.label.toLocaleLowerCase("vi")}.</strong> Ô ảnh được tải trực tiếp từ NASA Moon Trek.</span></div>}
          </div>

          <div className="polar-selected" aria-live="polite" aria-atomic="true">
            <div className="polar-card-heading"><span className="section-kicker">Địa điểm đang chọn</span><span className="verified-pill">Có trích dẫn nguồn</span></div>
            {selectedSite ? <>
              <h3><MapPin size={16} /> {selectedSite.name}</h3>
              <p className="polar-reference">{selectedSite.reference} · {selectedSite.kind}</p>
              <p className="polar-coordinates"><span>Vĩ độ {formatCoordinate(selectedSite.latitude, "B", "N")}</span><span>Kinh độ {formatCoordinate(selectedSite.longitude, "Đ", "T")}</span></p>
              <p className="polar-site-summary">{selectedSite.summary}</p>
              <div className="selected-terrain-profile">
                <div className="selected-terrain-heading">Số liệu địa hình tại tọa độ điểm</div>
                {selectedTerrainMetrics ? <>
                  <div className="terrain-profile-grid">
                    <div><strong>Cao độ so với bán kính chuẩn</strong><span>{selectedTerrainMetrics.elevationM.toLocaleString("vi-VN")} m</span></div>
                    <div><strong>Độ cao tương đối với nền cục bộ</strong><span>{selectedTerrainMetrics.relativeElevationM.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} m</span></div>
                    <div><strong>Độ dốc trung bình</strong><span>{selectedTerrainMetrics.slopeDeg.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}°</span></div>
                    <div><strong>Độ gồ ghề địa hình</strong><span>{selectedTerrainMetrics.roughnessM.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} m</span></div>
                    <div><strong>Chênh cao cục bộ</strong><span>{selectedTerrainMetrics.localReliefM.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} m</span></div>
                    <div><strong>Mẫu raster hợp lệ</strong><span>{lunarSiteTerrainMetrics.validPixels}/{lunarSiteTerrainMetrics.expectedPixels} pixel</span></div>
                  </div>
                  <small>Cao độ tham chiếu mặt cầu bán kính 1.737,4 km. Các chỉ số cục bộ tính trên cửa sổ 5×5 pixel (~{lunarSiteTerrainMetrics.supportM.toLocaleString("vi-VN", { maximumFractionDigits: 0 })} m), độ phân giải nguồn {lunarSiteTerrainMetrics.resolutionM.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} m/pixel. {selectedSite.kind}.</small>
                  <a className="polar-source-link" href={lunarSiteTerrainMetrics.sourceUrl} target="_blank" rel="noreferrer">Số liệu: {lunarSiteTerrainMetrics.source} <ArrowUpRight size={13} /></a>
                </> : <small>Chưa có pixel LOLA hợp lệ cho địa điểm này.</small>}
              </div>
              <small className="polar-source-note">{selectedSite.sourceNote}</small>
              <a className="polar-source-link" href={selectedSite.sourceUrl} target="_blank" rel="noreferrer">Nguồn: {selectedSite.source} <ArrowUpRight size={13} /></a>
            </> : <p>Không tìm thấy địa điểm phù hợp. Hãy đổi bộ lọc hoặc từ khóa tìm kiếm.</p>}
          </div>

          <div className="explorer-site-list">
            <div className="polar-card-heading"><span className="section-kicker">Danh sách địa điểm</span><span>{filteredSites.length}</span></div>
            <div className="explorer-site-grid">
              {filteredSites.map((site) => (
                <button key={site.site_id} type="button" className={selectedSite?.site_id === site.site_id ? "active" : ""} onClick={() => selectSite(site)} aria-pressed={selectedSite?.site_id === site.site_id}>
                  <span><strong>{site.name}</strong><small>{Number(site.latitude) < -70 ? "Vùng cực Nam" : "Điểm hạ cánh lịch sử"} · {site.reference}</small></span><MapPin size={14} aria-hidden="true" />
                </button>
              ))}
              {!filteredSites.length && <p>Không tìm thấy địa điểm phù hợp.</p>}
            </div>
          </div>
          <p className="polar-data-note">Các lớp địa hình, độ dốc, chiếu sáng và bóng vùng cực Nam dùng dữ liệu LRO LOLA/WAC công khai qua NASA Moon Trek. Tọa độ địa điểm là các điểm tham chiếu theo nguồn trích dẫn.</p>
        </aside>
      </div>
    </section>
  );
}
