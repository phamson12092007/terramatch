import { CircleMarker, GeoJSON, MapContainer, Popup, useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./AnalogMap.css";

const landStyle = { color: "#635a84", weight: 1, fillColor: "#37334f", fillOpacity: 1 };

function FitResults({ results }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(results.map(({ latitude, longitude }) => [latitude, longitude]), {
      padding: [35, 35],
      maxZoom: 5,
    });
  }, [map, results]);

  return null;
}

function FocusSelected({ results, selectedId }) {
  const map = useMap();

  useEffect(() => {
    const result = results.find((item) => item.site_id === selectedId);
    if (result) map.panTo([result.latitude, result.longitude]);
  }, [map, results, selectedId]);

  return null;
}

export default function AnalogMap({ results, selectedId, onSelect }) {
  const [land, setLand] = useState(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/media/world-land.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load the Earth basemap.");
        return response.json();
      })
      .then(setLand)
      .catch(() => {
        if (!controller.signal.aborted) setMapError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="analog-map-container">
      <MapContainer center={[20, 0]} zoom={2} minZoom={1} maxZoom={8} scrollWheelZoom={false} className="analog-map">
        {land && <GeoJSON data={land} style={landStyle} interactive={false} pane="tilePane" />}
        <FitResults results={results} />
        <FocusSelected results={results} selectedId={selectedId} />
        {results.map((result) => {
          const selected = result.site_id === selectedId;
          return (
            <CircleMarker
              key={result.site_id}
              center={[result.latitude, result.longitude]}
              radius={selected ? 11 : 7}
              eventHandlers={{ click: () => onSelect(result.site_id) }}
              pathOptions={{
                color: selected ? "#fff0b7" : "#dfd1ff",
                fillColor: selected ? "#edbd56" : "#9d87f8",
                fillOpacity: 0.9,
                weight: selected ? 3 : 2,
              }}
            >
              <Popup>
                <div className="analog-popup">
                  <strong>#{result.rank} {result.name}</strong>
                  <p>{result.country} · index {result.similarity_score.toFixed(2)} / 100</p>
                  <small>{result.latitude}°, {result.longitude}°</small>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="earth-basemap-credit">
        {mapError ? "Basemap unavailable" : <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Basemap · Natural Earth</a>}
      </div>
    </div>
  );
}

