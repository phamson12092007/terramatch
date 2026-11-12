import "./Comparison.css";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
function formatValue(value, digits = 1) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  const number = Number(value);

  return Number.isFinite(number) ? number.toFixed(digits) : "--";
}

function getDifference(earthValue, targetValue) {
  if (
    earthValue === null ||
    earthValue === undefined ||
    targetValue === null ||
    targetValue === undefined
  ) {
    return "--";
  }

  const earth = Number(earthValue);
  const target = Number(targetValue);

  if (!Number.isFinite(earth) || !Number.isFinite(target)) {
    return "--";
  }

  return formatValue(Math.abs(earth - target));
}

export default function Comparison({ selectedLocation }) {
  const target = selectedLocation?.demoFeatures;
  const results = selectedLocation?.analogResult?.results || [];

  if (!selectedLocation || !target || results.length === 0) {
    return (
      <section className="section">
        <h1>Comparison</h1>
        <div className="metric-card">
          <h3>No comparison data available</h3>
          <p>
            Return to Planet Explorer, select a location,
            and run Earth Analog Search first.
          </p>
        </div>
      </section>
    );
  }

  const features = [
    {
      key: "elevation_m",
      label: "Elevation",
      unit: "m",
    },
    {
      key: "slope_deg",
      label: "Slope",
      unit: "°",
    },
    {
      key: "surface_temp_k",
      label: "Surface Temperature",
      unit: "K",
    },
  ];
    const chartConfigs = [
    {
      key: "elevation_m",
      title: "Elevation Comparison",
      unit: "m",
      targetValue: Number(target.elevation_m),
      data: results.map((result) => ({
        name: result.name,
        value: Number(result.elevation_m),
      })),
    },
    {
      key: "slope_deg",
      title: "Slope Comparison",
      unit: "°",
      targetValue: Number(target.slope_deg),
      data: results.map((result) => ({
        name: result.name,
        value: Number(result.slope_deg),
      })),
    },
    {
      key: "surface_temp_k",
      title: "Surface Temperature Comparison",
      unit: "K",
      targetValue: Number(target.surface_temp_k),
      data: results.map((result) => ({
        name: result.name,
        value: Number(result.surface_temp_k),
      })),
    },
  ];
  const explanationData = results.map((result) => {
  const metrics = [
    {
      key: "elevation_m",
      label: "Elevation",
      weight: 0.4,
      scale: 5000,
      targetValue: Number(target.elevation_m),
      analogValue: Number(result.elevation_m),
    },
    {
      key: "slope_deg",
      label: "Slope",
      weight: 0.35,
      scale: 45,
      targetValue: Number(target.slope_deg),
      analogValue: Number(result.slope_deg),
    },
    {
      key: "surface_temp_k",
      label: "Surface Temperature",
      weight: 0.25,
      scale: 200,
      targetValue: Number(target.surface_temp_k),
      analogValue: Number(result.surface_temp_k),
    },
  ];

  const contributions = metrics.map((metric) => {
    const difference =
      (metric.analogValue - metric.targetValue) / metric.scale;

    return {
      label: metric.label,
      weight: metric.weight,
      contribution: metric.weight * difference ** 2,
    };
  });

  const totalDifference = contributions.reduce(
    (sum, item) => sum + item.contribution,
    0
  );

  return {
    site_id: result.site_id,
    name: result.name,
    contributions: contributions.map((item) => ({
      ...item,
      percentage:
        totalDifference === 0
          ? 0
          : (item.contribution / totalDifference) * 100,
    })),
  };
});

  return (
    <section className="section comparison-page">
      <div className="section-heading">
        <div>
          <h2>Location Comparison</h2>
          <p>
            Compare the selected planetary location with
            discovered Earth analogs.
          </p>
        </div>
        <span className="demo-label">SIMULATED DATA</span>
      </div>

      <div className="metric-card comparison-target">
        <span className="comparison-label">TARGET LOCATION</span>
        <h2>{selectedLocation.planet}</h2>
        <p>
          Latitude: {selectedLocation.latitude}° ·
          Longitude: {selectedLocation.longitude}°
        </p>
      </div>

      <div className="comparison-feature-grid">
        {features.map((feature) => (
          <div className="metric-card" key={feature.key}>
            <span>{feature.label}</span>
            <h2>
              {formatValue(target[feature.key])}
              <small> {feature.unit}</small>
            </h2>
            <p>Target characteristic</p>
          </div>
        ))}
      </div>

      <div className="metric-card comparison-table-card">
        <h3>Earth Analog Comparison</h3>
        <p>
          Absolute difference shows how far each Earth value
          is from the target value. Smaller differences mean
          closer values for that feature.
        </p>

        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Earth Location</th>
                <th>Elevation (m)</th>
                <th>Slope (°)</th>
                <th>Temperature (K)</th>
                <th>Similarity</th>
              </tr>
            </thead>

            <tbody>
              {results.map((result) => (
                <tr key={result.site_id}>
                  <td>
                    <strong>{result.name}</strong>
                    <small>{result.country}</small>
                  </td>

                  <td>
                    {formatValue(result.elevation_m)}
                    <small>
                      Δ {getDifference(
                        result.elevation_m,
                        target.elevation_m
                      )} m
                    </small>
                  </td>

                  <td>
                    {formatValue(result.slope_deg)}
                    <small>
                      Δ {getDifference(
                        result.slope_deg,
                        target.slope_deg
                      )}°
                    </small>
                  </td>

                  <td>
                    {formatValue(result.surface_temp_k)}
                    <small>
                      Δ {getDifference(
                        result.surface_temp_k,
                        target.surface_temp_k
                      )} K
                    </small>
                  </td>

                  <td>
                    <strong className="comparison-score">
                      {formatValue(result.similarity_score)}%
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="comparison-charts-section">
        <div className="section-heading">
          <div>
            <h2>Visual Data Comparison</h2>
            <p>
              Compare the target characteristics with each Earth analog.
            </p>
          </div>
        </div>

        <div className="comparison-charts-grid">
          {chartConfigs.map((chart) => {
            const chartData = [
              {
                name: "Target",
                value: chart.targetValue,
              },
              ...chart.data,
            ];

            return (
              <div className="metric-card comparison-chart-card" key={chart.key}>
                <h3>{chart.title}</h3>

                <p className="chart-unit">
                  Measurement unit: {chart.unit}
                </p>

                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={chartData}
                    margin={{
                      top: 20,
                      right: 15,
                      left: 5,
                      bottom: 45,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#334155"
                    />

                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      tick={{ fontSize: 11 }}
                    />

                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fontSize: 11 }}
                    />

                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#f8fafc",
                      }}
                      formatter={(value) => [
                        `${value} ${chart.unit}`,
                        "Value",
                      ]}
                    />

                    <Legend />

                    <Bar
                      dataKey="value"
                      name="Measured feature (demo)"
                      fill="#38bdf8"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </div>
      <div className="comparison-explanation">
  <h2>Why Are These Locations Similar?</h2>

  <p className="explanation-description">
    Breakdown of the features contributing to the difference
    between the target location and each Earth analog.
  </p>

    <div className="explanation-grid">
        {explanationData.map((site) => (
        <div className="metric-card explanation-card" key={site.site_id}>
            <h3>{site.name}</h3>

            {site.contributions
            .sort((a, b) => b.percentage - a.percentage)
            .map((item) => (
                <div className="contribution-item" key={item.label}>
                <div className="contribution-header">
                    <span>{item.label}</span>
                    <strong>{item.percentage.toFixed(1)}%</strong>
                </div>

                <div className="contribution-track">
                    <div
                    className="contribution-fill"
                    style={{ width: `${item.percentage}%` }}
                    />
                </div>
                </div>
            ))}

            <p className="contribution-note">
            A higher percentage means this feature contributes
            more to the overall difference.
            </p>
        </div>
        ))}
    </div>
    </div>
      <p className="comparison-disclaimer">
        DEMO MODE: Target characteristics and Earth analog
        measurements are simulated. Similarity scores are
        algorithmic estimates, not scientific validation
        or NASA endorsements.
      </p>
    </section>
  );
}
