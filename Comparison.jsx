import "./Comparison.css";

function formatValue(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function EmptyComparison({ selectedLocation }) {
  const response = selectedLocation?.analogResult;
  const realMode = response?.data_source === "REAL";
  return <section className="workspace-page comparison-page">
    <div className="page-heading"><div><h1>So sánh</h1><p>Kiểm tra số liệu đo và trọng số của từng địa điểm tương đồng.</p></div></div>
    <div className="metric-card comparison-table-card">
      <h3>{realMode ? "Chưa có dữ liệu thực để so sánh" : "Chưa có dữ liệu so sánh"}</h3>
      <p>{realMode
        ? "Các tiêu chí đã chọn không có dữ liệu quan trắc chung phù hợp để chấm điểm."
        : "Quay lại mục Khám phá Mặt Trăng, chọn một địa điểm rồi chạy tìm kiếm địa hình tương tự."}</p>
      {response?.requested_criteria?.length > 0 && <div className="comparison-diagnostics"><h3>Trạng thái tiêu chí</h3>{response.requested_criteria.map((criterion) => <p key={criterion.criterion}><strong>{criterion.criterion.replaceAll("_", " ")}</strong> · {criterion.status.replaceAll("_", " ")}<br /><small>{criterion.reason}</small></p>)}</div>}
      {response?.candidate_diagnostics?.length > 0 && <div className="comparison-diagnostics"><h3>Thông tin chẩn đoán địa điểm</h3>{response.candidate_diagnostics.map((diagnostic) => <details key={diagnostic.site_id}><summary>{diagnostic.name} · {diagnostic.status}</summary><p>{diagnostic.reason}</p><ul>{diagnostic.criteria?.map((criterion, index) => <li key={`${criterion.criterion}-${index}`}>{criterion.criterion}: {criterion.reason}</li>)}</ul></details>)}</div>}
    </div>
  </section>;
}

export default function Comparison({ selectedLocation }) {
  const response = selectedLocation?.analogResult;
  const results = response?.results || [];
  const isRealData = response?.data_source === "REAL";
  if (!selectedLocation || results.length === 0) return <EmptyComparison selectedLocation={selectedLocation} />;

  return <section className="workspace-page comparison-page">
    <div className="page-heading"><div><h1>So sánh địa điểm</h1><p>Số liệu đo, trọng số và nguồn quan trắc của từng địa điểm tương đồng.</p></div><span className="demo-label">{isRealData ? "DỮ LIỆU THỰC TẾ" : "DỮ LIỆU MÔ PHỎNG"}</span></div>
    <div className="metric-card comparison-target"><span className="comparison-label">ĐỊA ĐIỂM MỤC TIÊU</span><h2>{selectedLocation.siteName || selectedLocation.planet}</h2><p>{selectedLocation.planet} · {selectedLocation.research_device} · {selectedLocation.latitude}°, {selectedLocation.longitude}°</p></div>
    <div className="metric-card comparison-table-card">
      <h3>Các địa điểm tương tự trên Trái Đất</h3>
      <p>Mở một địa điểm để xem chênh lệch chuẩn hóa, trọng số áp dụng và thời gian quan trắc.</p>
      {results.map((result) => {
        const features = Object.values(result.comparison_features || {});
        return <details className="comparison-result" key={result.site_id} open>
          <summary><span><strong>{result.name}</strong> · {result.country}</span><span className="comparison-score">{formatValue(result.similarity_score, 2)}%</span></summary>
          <p className="result-meta">{result.latitude}°, {result.longitude}° · {result.data_status} · {features.length} tiêu chí được đánh giá</p>
          <div className="comparison-table-wrapper"><table className="comparison-table"><thead><tr><th>Tiêu chí</th><th>Giá trị trên Mặt Trăng</th><th>Giá trị trên Trái Đất</th><th>Đơn vị</th><th>Chênh lệch chuẩn hóa</th><th>Trọng số cấu hình</th><th>Trọng số áp dụng</th><th>Nguồn</th><th>Thời gian quan trắc</th></tr></thead><tbody>{features.map((feature) => <tr key={feature.criterion}><td>{feature.criterion.replaceAll("_", " ")}</td><td>{formatValue(feature.lunar_value)}</td><td>{formatValue(feature.earth_value)}</td><td>{feature.unit}</td><td>{formatValue(feature.normalized_difference, 4)}</td><td>{formatValue(feature.configured_weight, 3)}</td><td>{formatValue(feature.weight_applied, 3)}</td><td>{feature.feature_source?.source_organization || "Dữ liệu minh họa"}</td><td>{feature.acquisition_start && feature.acquisition_end ? `${feature.acquisition_start} đến ${feature.acquisition_end}` : "Không áp dụng"}</td></tr>)}</tbody></table></div>
          {result.unavailable_criteria?.length > 0 && <div className="comparison-diagnostics"><h3>Tiêu chí chưa có dữ liệu tại địa điểm này</h3>{result.unavailable_criteria.map((criterion, index) => <p key={`${criterion.criterion}-${index}`}><strong>{criterion.criterion}</strong>: {criterion.reason}</p>)}</div>}
        </details>;
      })}
    </div>
    {response.limitations?.length > 0 && <ul className="comparison-disclaimer">{response.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>}
  </section>;
}
