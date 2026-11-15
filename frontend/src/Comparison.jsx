import "./Comparison.css";

function formatValue(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function EmptyComparison({ selectedLocation }) {
  const response = selectedLocation?.analogResult;
  const realMode = response?.data_source === "REAL";
  return <section className="workspace-page comparison-page">
    <div className="page-heading"><div><h1>Comparison</h1><p>Review measurements and applied weights for each terrain candidate.</p></div></div>
    <div className="metric-card comparison-table-card">
      <h3>{realMode ? "No eligible real observations to compare" : "No comparison results yet"}</h3>
      <p>{realMode
        ? "The selected criteria have no shared, eligible observations for scoring."
        : "Return to Moon explorer, select a lunar reference site, and run a terrain search."}</p>
      {response?.requested_criteria?.length > 0 && <div className="comparison-diagnostics"><h3>Criterion status</h3>{response.requested_criteria.map((criterion) => <p key={criterion.criterion}><strong>{criterion.criterion.replaceAll("_", " ")}</strong> · {criterion.status.replaceAll("_", " ")}<br /><small>{criterion.reason}</small></p>)}</div>}
      {response?.candidate_diagnostics?.length > 0 && <div className="comparison-diagnostics"><h3>Candidate diagnostics</h3>{response.candidate_diagnostics.map((diagnostic) => <details key={diagnostic.site_id}><summary>{diagnostic.name} · {diagnostic.status}</summary><p>{diagnostic.reason}</p><ul>{diagnostic.criteria?.map((criterion, index) => <li key={`${criterion.criterion}-${index}`}>{criterion.criterion}: {criterion.reason}</li>)}</ul></details>)}</div>}
    </div>
  </section>;
}

export default function Comparison({ selectedLocation }) {
  const response = selectedLocation?.analogResult;
  const results = response?.results || [];
  const isRealData = response?.data_source === "REAL";
  if (!selectedLocation || results.length === 0) return <EmptyComparison selectedLocation={selectedLocation} />;

  return <section className="workspace-page comparison-page">
    <div className="page-heading"><div><h1>Site comparison</h1><p>Measured values, weights, and observation provenance for each candidate.</p></div><span className="demo-label">{isRealData ? "REAL OBSERVATIONS" : "SIMULATED DATA"}</span></div>
    <div className="metric-card comparison-target"><span className="comparison-label">LUNAR TARGET</span><h2>{selectedLocation.siteName || selectedLocation.planet}</h2><p>{selectedLocation.planet} · {selectedLocation.research_device} · {selectedLocation.latitude}°, {selectedLocation.longitude}°</p></div>
    <div className="metric-card comparison-table-card">
      <h3>Earth terrain candidates</h3>
      <p>Expand a candidate to inspect normalized differences, applied weights, source, and observation period.</p>
      {results.map((result) => {
        const features = Object.values(result.comparison_features || {});
        return <details className="comparison-result" key={result.site_id} open>
          <summary><span><strong>{result.name}</strong> · {result.country}</span><span className="comparison-score">{formatValue(result.similarity_score, 2)} / 100</span></summary>
          <p className="result-meta">{result.latitude}°, {result.longitude}° · {result.data_status} · {features.length} criteria scored</p>
          <div className="comparison-table-wrapper"><table className="comparison-table"><thead><tr><th>Criterion</th><th>Lunar value</th><th>Earth value</th><th>Unit</th><th>Normalized difference</th><th>Configured weight</th><th>Applied weight</th><th>Source</th><th>Observation period</th></tr></thead><tbody>{features.map((feature) => <tr key={feature.criterion}><td>{feature.criterion.replaceAll("_", " ")}</td><td>{formatValue(feature.lunar_value)}</td><td>{formatValue(feature.earth_value)}</td><td>{feature.unit}</td><td>{formatValue(feature.normalized_difference, 4)}</td><td>{formatValue(feature.configured_weight, 3)}</td><td>{formatValue(feature.weight_applied, 3)}</td><td>{feature.feature_source?.source_organization || "No source metadata"}</td><td>{feature.acquisition_start && feature.acquisition_end ? `${feature.acquisition_start} to ${feature.acquisition_end}` : "Not applicable"}</td></tr>)}</tbody></table></div>
          {result.unavailable_criteria?.length > 0 && <div className="comparison-diagnostics"><h3>Criteria unavailable at this location</h3>{result.unavailable_criteria.map((criterion, index) => <p key={`${criterion.criterion}-${index}`}><strong>{criterion.criterion}</strong>: {criterion.reason}</p>)}</div>}
        </details>;
      })}
    </div>
    {response.limitations?.length > 0 && <ul className="comparison-disclaimer">{response.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>}
    {isRealData && <p className="comparison-disclaimer">The 0–100 terrain screening index is a normalized distance score, not a probability or a validated prediction of field performance.</p>}
  </section>;
}
