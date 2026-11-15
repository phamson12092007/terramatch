import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Globe, MapPin, RotateCcw, Satellite, Search, SlidersHorizontal } from "lucide-react";
import { inspectLunarLocation, loadEarthFeatureCatalog, loadEarthLocations, loadLunarSiteFeatures, loadLunarSites, searchEarthAnalogs } from "./api";
import "./PlanetExplorer.css";

const SITE_COLORS = ["#67e8f9", "#a78bfa", "#fbbf24", "#fb7185", "#34d399", "#f97316"];
const DEVICES = [
  { id: "ltv", name: "LTV", label: "Xe địa hình Mặt Trăng", description: "Xe di chuyển trên địa hình", weights: { relative_elevation_m: 0.25, slope_deg_windowed: 0.45, terrain_roughness_m_windowed: 0.15, local_relief_m: 0.15 } },
  { id: "regolith-drill", name: "Drill", label: "Máy khoan đất Mặt Trăng", description: "Máy khoan lớp đất mặt", weights: { relative_elevation_m: 0.35, slope_deg_windowed: 0.25, terrain_roughness_m_windowed: 0.25, local_relief_m: 0.15 } },
];
const mapPosition = (location) => ({ left: `${((location.longitude + 180) / 360) * 100}%`, top: `${((90 - location.latitude) / 180) * 100}%` });
const SHORT_LABELS = {
  relative_elevation_m: "Độ cao tương đối",
  slope_deg_windowed: "Độ dốc",
  terrain_roughness_m_windowed: "Độ gồ ghề",
  local_relief_m: "Độ lồi lõm cục bộ",
};
const EXPERIMENTAL_CRITERIA = new Set(["terrain_roughness_m_windowed", "local_relief_m"]);

const isRealBacked = (observation) => observation.data_status === "REAL"
  || (observation.data_status === "DERIVED" && observation.provenance?.source_data_status === "REAL");

export default function PlanetExplorer({ onSearch, refreshFromNasa }) {
  const planet = "Moon";
  const planetLabel = "Mặt Trăng";
  const [selectedSite, setSelectedSite] = useState(null);
  const [deviceId, setDeviceId] = useState("ltv");
  const [selectedCriteria, setSelectedCriteria] = useState(() => Object.keys(DEVICES[0].weights));
  const [customWeights, setCustomWeights] = useState(() => ({ ...DEVICES[0].weights }));
  const [featureCatalog, setFeatureCatalog] = useState([]);
  const [lunarSites, setLunarSites] = useState([]);
  const [isLoadingSiteFeatures, setIsLoadingSiteFeatures] = useState(false);
  const [catalogState, setCatalogState] = useState("loading");
  const [catalogError, setCatalogError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [apiError, setApiError] = useState("");
  const selectionRequest = useRef(0);
  const activeDevice = DEVICES.find((device) => device.id === deviceId);

  useEffect(() => {
    let active = true;
    Promise.all([loadEarthFeatureCatalog(), loadLunarSites()])
      .then(([catalog, sites]) => {
        if (!active) return;
        setFeatureCatalog(catalog.features);
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

  const scoreableCriteria = useMemo(
    () => sharedData.filter((feature) => feature.similarity_supported),
    [sharedData],
  );
  const criteriaWeights = useMemo(
    () => Object.fromEntries(scoreableCriteria
      .filter((feature) => selectedCriteria.includes(feature.key))
      .map((feature) => [feature.key, Math.max(0.05, Number(customWeights[feature.key]) || 1)])),
    [customWeights, scoreableCriteria, selectedCriteria],
  );
  const selectedWeightTotal = Object.values(criteriaWeights).reduce((total, weight) => total + weight, 0);
  const realLolaFeatures = selectedSite?.features?.filter((item) => item.product_id === "LDEM_16" && isRealBacked(item)) || [];
  const divinerFeatures = selectedSite?.features?.filter((item) => item.product_id === "DLRE_PRP_SOUTH.TAB" && isRealBacked(item)) || [];
  const divinerMean = divinerFeatures.find((item) => item.feature_key === "subsurface_temp_2cm_k_annual_mean");
  const divinerMax = divinerFeatures.find((item) => item.feature_key === "surface_temp_k_annual_max");
  const resetSelection = () => {
    selectionRequest.current += 1;
    setSelectedSite(null);
    setIsLoadingSiteFeatures(false);
    setApiError("");
  };
  const selectSite = async (site) => {
    const requestId = ++selectionRequest.current;
    setApiError("");
    setIsLoadingSiteFeatures(true);
    try {
      const observations = await loadLunarSiteFeatures(site.site_id);
      if (selectionRequest.current !== requestId) return;
      const features = Object.fromEntries(observations.filter((item) => item.value !== null).map((item) => [item.feature_key, item.value]));
      setSelectedSite({ ...site, features: observations, targetFeatures: features });
    } catch (error) {
      if (selectionRequest.current === requestId) {
        setSelectedSite(null);
        setApiError(error.message);
      }
    } finally {
      if (selectionRequest.current === requestId) setIsLoadingSiteFeatures(false);
    }
  };
  const selectDevice = (device) => {
    setDeviceId(device.id);
    setSelectedCriteria(Object.keys(device.weights));
    setCustomWeights({ ...device.weights });
  };
  const toggleCriterion = (key) => {
    setSelectedCriteria((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      return [...current, key];
    });
  };
  const updateWeight = (key, value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    setCustomWeights((current) => ({ ...current, [key]: Math.min(1, Math.max(0.05, numericValue)) }));
  };
  const activeCriteriaCount = Object.keys(criteriaWeights).length;
  const canSearch = selectedSite && catalogState === "ready" && activeCriteriaCount > 0;

  const handleSearch = async () => {
    if (!selectedSite) return setApiError("Trước tiên, hãy chọn một địa điểm nghiên cứu có trong danh sách.");
    if (!Object.keys(criteriaWeights).length) return setApiError("Hãy chọn ít nhất một tiêu chí chấm điểm.");
    setIsSearching(true); setApiError("");
    const requestData = { planet, site_id: selectedSite.site_id, latitude: selectedSite.latitude, longitude: selectedSite.longitude };
    const researchConfiguration = {
      research_device: activeDevice.name,
      criteria_weights: criteriaWeights,
      earth_data_mode: "REAL_ONLY",
      refresh_from_nasa: refreshFromNasa,
    };
    try {
      const apiResult = await inspectLunarLocation(requestData);
      const analogResult = await searchEarthAnalogs({
        ...requestData,
        ...researchConfiguration,
        target_features: selectedSite.targetFeatures,
      });
      const refreshedEarthLocations = await loadEarthLocations();
      onSearch?.({
        ...requestData, siteName: selectedSite.name, apiResult, analogResult, demoFeatures: selectedSite.targetFeatures,
        featureCatalog, earthLocations: refreshedEarthLocations, ...researchConfiguration,
      });
    } catch (error) {
      setApiError(error.status === 422 ? `Lỗi xác thực: ${error.message}` : error.message);
    } finally { setIsSearching(false); }
  };

  return <section className="planet-explorer">
    <div className="page-heading"><div><h1>Khám phá Mặt Trăng</h1><p>Chọn địa điểm trên Mặt Trăng và thiết bị phục vụ tìm kiếm.</p></div></div>
    <div className="explorer-content">
      <div className="map-section">
        <div className="section-heading"><div><h2><Globe size={18} /> Địa điểm nghiên cứu trên Mặt Trăng</h2><p>Chọn một điểm đánh dấu hoặc chọn địa điểm trong danh sách.</p></div></div>
        <div className={`coordinate-map ${planet.toLowerCase()}-map`} aria-label={`Bản đồ ${planetLabel} với các địa điểm nghiên cứu hiện có`}><div className="map-grid" />
          {lunarSites.map((location, index) => <button className={`site-marker ${selectedSite?.site_id === location.site_id ? "selected" : ""}`} key={location.site_id} onClick={() => selectSite(location)} disabled={isSearching} style={mapPosition(location)} aria-label={`Chọn ${location.name} trên bản đồ`} title={location.name}><span className="site-dot" style={{ background: SITE_COLORS[index % SITE_COLORS.length] }} /></button>)}
          {selectedSite && <div className="map-marker" style={mapPosition(selectedSite)}><MapPin size={30} /></div>}
        </div>
        <div className="map-legend"><span>Kinh độ −180° đến 180°</span><a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noreferrer">Ảnh ghép LROC · NASA SVS</a></div>
        <div className="site-picker">{lunarSites.map((location, index) => <button key={location.site_id} className={selectedSite?.site_id === location.site_id ? "site-chip active" : "site-chip"} onClick={() => selectSite(location)} disabled={isSearching} aria-pressed={selectedSite?.site_id === location.site_id}><i style={{ background: SITE_COLORS[index % SITE_COLORS.length] }} /> {location.name}</button>)}</div>
      </div>
      <aside className="research-panel">
        <div className="section-heading"><div><h2><Satellite size={18} /> Thiết bị</h2><p>Mỗi thiết bị có bộ trọng số khởi đầu riêng.</p></div></div>
        <div className="device-list">{DEVICES.map((device) => <button key={device.id} className={deviceId === device.id ? "device-card active" : "device-card"} onClick={() => selectDevice(device)} disabled={isSearching} aria-pressed={deviceId === device.id}><span className="device-select">{deviceId === device.id && <Check size={13} />}</span><span><strong>{device.label}</strong><small>{device.description}</small></span></button>)}</div>
        <div className="criteria-heading"><SlidersHorizontal size={16} /> Tiêu chí</div>
        {catalogState === "loading" && <p className="selection-hint">Đang tải thông tin tiêu chí…</p>}
        {catalogState === "error" && <p className="api-error">Không thể tải dữ liệu tham chiếu: {catalogError}</p>}
        {sharedData.length > 0 && <><p className="selection-hint">Chọn chỉ số và thiết lập trọng số tương đối.</p><div className="criteria-table"><div className="criteria-table-header"><span>Chỉ số</span><span>Dùng</span><span>Trọng số</span></div>{sharedData.map((feature) => {
          const canScore = feature.similarity_supported;
          const isSelected = canScore && selectedCriteria.includes(feature.key);
          const weight = customWeights[feature.key] ?? activeDevice?.weights[feature.key] ?? 1;
          const normalizedWeight = selectedWeightTotal ? Math.round(((criteriaWeights[feature.key] || 0) / selectedWeightTotal) * 100) : 0;
          const experimental = EXPERIMENTAL_CRITERIA.has(feature.key);
          return <div className={`criterion-row ${isSelected ? "active" : ""}`} key={feature.key}>
            <div className="criterion-name"><strong>{SHORT_LABELS[feature.key] || feature.label}</strong><small className={experimental ? "experimental" : ""}>{canScore ? (experimental ? "Thử nghiệm" : "Sẵn sàng") : "Chỉ xem"}</small></div>
            <label className="criterion-toggle"><input aria-label={`Dùng ${SHORT_LABELS[feature.key] || feature.label}`} type="checkbox" checked={isSelected} disabled={isSearching || !canScore || (isSelected && activeCriteriaCount === 1)} onChange={() => toggleCriterion(feature.key)} /></label>
            {isSelected ? <div className="weight-control"><input aria-label={`Trọng số ${SHORT_LABELS[feature.key] || feature.label}`} type="range" min="0.05" max="1" step="0.05" value={weight} onChange={(event) => updateWeight(feature.key, event.target.value)} /><input className="weight-input" aria-label={`Trọng số số học ${SHORT_LABELS[feature.key] || feature.label}`} type="number" min="0.05" max="1" step="0.05" value={weight} onChange={(event) => updateWeight(feature.key, event.target.value)} /><small className="weight-percent">{normalizedWeight}%</small></div> : <span className="weight-empty">—</span>}
          </div>;
        })}</div></>}
        {selectedSite && !isLoadingSiteFeatures && sharedData.length === 0 && <p className="selection-hint">Địa điểm này chưa có tiêu chí địa hình để xếp hạng. Hãy thử Apollo 11 để chạy tìm kiếm.</p>}
        {selectedSite ? <div className="selected-location"><div className="status-indicator" /><div><strong>{selectedSite.name}</strong><p>{selectedSite.latitude}°, {selectedSite.longitude}° · Điểm trong danh mục</p>{realLolaFeatures.length ? <small className="terrain-source">Địa hình LOLA: {realLolaFeatures.length} tiêu chí có dữ liệu thực</small> : <small className="terrain-source">Địa hình LOLA: chưa có đủ dữ liệu cục bộ cho khu vực này.</small>}{divinerMean && divinerMax && <small className="terrain-source">Diviner: trung bình {divinerMean.value.toFixed(1)} K (ở độ sâu 2 cm) · cực đại năm {divinerMax.value.toFixed(1)} K</small>}</div></div> : <p className="selection-hint">Chọn địa điểm trên Mặt Trăng để xem các tiêu chí hiện có.</p>}
        {isLoadingSiteFeatures && <p className="selection-hint">Đang tải đặc điểm tham chiếu Mặt Trăng…</p>}
        {apiError && <p className="api-error" role="alert">{apiError}</p>}
        <button className="search-action primary-button" onClick={handleSearch} disabled={!canSearch || isSearching || isLoadingSiteFeatures}><Search size={17} /> {isSearching ? "Đang tìm kiếm…" : "Tìm địa hình tương tự trên Trái Đất"}</button>
        {(selectedSite || isLoadingSiteFeatures) && <button className="reset-action" onClick={resetSelection} disabled={isSearching}><RotateCcw size={15} /> Bỏ chọn</button>}
      </aside>
    </div>
  </section>;
}
