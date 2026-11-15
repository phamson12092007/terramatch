import "./Comparison.css";

function formatValue(value, digits = 3) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "--";
}

function EmptyComparison({ selectedLocation }) {
  const response = selectedLocation?.analogResult;
  const realMode = response?.data_source === "REAL";
  return <section className="section comparison-page">
    <h1>Comparison</h1>
    <div className="metric-card comparison-table-card">
      <h3>{realMode ? "No scored REAL comparison" : "No comparison data available"}</h3>
      <p>{realMode
        ? "No 0% score is displayed: the backend found no eligible shared REAL observations for the requested criteria."
        : "Return to Planet Explorer, select a location, and run Earth Analog Search first."}</p>
      {response?.requested_criteria?.length > 0 && <div className="comparison-diagnostics"><h3>Criteria status</h3>{response.requested_criteria.map((criterion) => <p key={criterion.criterion}><strong>{criterion.criterion.replaceAll("_", " ")}</strong> · {criterion.status.replaceAll("_", " ")}<br /><small>{criterion.reason}</small></p>)}</div>}
      {response?.candidate_diagnostics?.length > 0 && <div className="comparison-diagnostics"><h3>Location diagnostics</h3>{response.candidate_diagnostics.map((diagnostic) => <details key={diagnostic.site_id}><summary>{diagnostic.name} · {diagnostic.status}</summary><p>{diagnostic.reason}</p><ul>{diagnostic.criteria?.map((criterion, index) => <li key={`${criterion.criterion}-${index}`}>{criterion.criterion}: {criterion.reason}</li>)}</ul></details>)}</div>}
    </div>
  </section>;
}

export default function Comparison({ selectedLocation }) {
  const response = selectedLocation?.analogResult;
  const results = response?.results || [];
  const isRealData = response?.data_source === "REAL";
  if (!selectedLocation || results.length === 0) return <EmptyComparison selectedLocation={selectedLocation} />;

  return <section className="section comparison-page">
    <div className="section-heading"><div><h2>Location Comparison</h2><p>Backend-calculated feature comparisons and observation provenance.</p></div><span className="demo-label">{isRealData ? "REAL EARTH DATA" : "SIMULATED DATA"}</span></div>
    <div className="metric-card comparison-target"><span className="comparison-label">TARGET LOCATION</span><h2>{selectedLocation.siteName || selectedLocation.planet}</h2><p>{selectedLocation.planet} · {selectedLocation.research_device} · {selectedLocation.latitude}°, {selectedLocation.longitude}°</p></div>
    <div className="metric-card comparison-table-card">
      <h3>Ranked Earth analogs</h3>
      <p>Only criteria included in each backend result were evaluated. Weights and normalized differences below come directly from the API.</p>
      {results.map((result) => {
        const features = Object.values(result.comparison_features || {});
        return <details className="comparison-result" key={result.site_id} open>
          <summary><span><strong>{result.name}</strong> · {result.country}</span><span className="comparison-score">{formatValue(result.similarity_score, 2)}%</span></summary>
          <p className="result-meta">{result.latitude}°, {result.longitude}° · {result.data_status} · {features.length} criteria evaluated</p>
          <div className="comparison-table-wrapper"><table className="comparison-table"><thead><tr><th>Criterion</th><th>Moon value</th><th>Earth value</th><th>Unit</th><th>Normalized difference</th><th>Configured weight</th><th>Applied weight</th><th>Source</th><th>Observation period</th></tr></thead><tbody>{features.map((feature) => <tr key={feature.criterion}><td>{feature.criterion.replaceAll("_", " ")}</td><td>{formatValue(feature.lunar_value)}</td><td>{formatValue(feature.earth_value)}</td><td>{feature.unit}</td><td>{formatValue(feature.normalized_difference, 4)}</td><td>{formatValue(feature.configured_weight, 3)}</td><td>{formatValue(feature.weight_applied, 3)}</td><td>{feature.feature_source?.source_organization || "Simulated demo"}</td><td>{feature.acquisition_start && feature.acquisition_end ? `${feature.acquisition_start} to ${feature.acquisition_end}` : "Not applicable"}</td></tr>)}</tbody></table></div>
          {result.unavailable_criteria?.length > 0 && <div className="comparison-diagnostics"><h3>Unavailable for this location</h3>{result.unavailable_criteria.map((criterion, index) => <p key={`${criterion.criterion}-${index}`}><strong>{criterion.criterion}</strong>: {criterion.reason}</p>)}</div>}
        </details>;
      })}
    </div>
    <p className="comparison-disclaimer">{isRealData
      ? "REAL EARTH DATA: observations and provenance are returned by the backend. Lunar target values remain samples; a similarity score is not an exact lunar replication."
      : "SIMULATED DEMO: results are legacy demonstration data and are never mixed with REAL Earth observations."}</p>
  </section>;
}
