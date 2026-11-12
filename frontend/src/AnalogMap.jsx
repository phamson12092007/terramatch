
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import "./AnalogMap.css";

function FitBounds({ results }) {
  const map = useMap();

  useEffect(() => {
    if (results.length > 0) {
      const bounds = results.map((item) => [
        Number(item.latitude),
        Number(item.longitude),
      ]);

      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 5,
      });
    }
  }, [results, map]);

  return null;
}

// Di chuyển bản đồ đến địa điểm đang được chọn
function PanToSelected({ results, selectedId }) {
  const map = useMap();

  useEffect(() => {
    const selected = results.find(
      (item) => item.site_id === selectedId
    );

    if (selected) {
      map.flyTo(
        [Number(selected.latitude), Number(selected.longitude)],
        Math.max(map.getZoom(), 5),
        { duration: 0.8 }
      );
    }
  }, [selectedId, results, map]);

  return null;
}

export default function AnalogMap({
  results = [],
  selectedId,
  onSelect,
}) {
  const validResults = results.filter(
    (item) =>
      Number.isFinite(Number(item.latitude)) &&
      Number.isFinite(Number(item.longitude))
  );

  return (
    <div className="analog-map-container">
      {validResults.length > 0 ? (
        <MapContainer
          center={[20, 0]}
          zoom={2}
          scrollWheelZoom={true}
          className="analog-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds results={validResults} />

          <PanToSelected
            results={validResults}
            selectedId={selectedId}
          />

          {validResults.map((result, index) => {
            const isSelected = result.site_id === selectedId;

            return (
              <CircleMarker
                key={result.site_id}
                center={[
                  Number(result.latitude),
                  Number(result.longitude),
                ]}
                radius={isSelected ? 15 : 9}
                eventHandlers={{
                  click: () => onSelect?.(result.site_id),
                }}
                pathOptions={{
                  color: isSelected ? "#facc15" : "#38bdf8",
                  fillColor: isSelected ? "#facc15" : "#0ea5e9",
                  fillOpacity: 0.9,
                  weight: isSelected ? 4 : 2,
                }}
              >
                <Popup>
                  <div className="analog-popup">
                    <strong>
                      #{index + 1} {result.name}
                    </strong>

                    <p>{result.country}</p>
                    <p>Similarity: {result.similarity_score}%</p>
                    <p>
                      Coordinates: {result.latitude},{" "}
                      {result.longitude}
                    </p>
                    <small>Dataset: {result.data_status}</small>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      ) : (
        <div className="map-empty">
          No valid Earth analog coordinates available.
        </div>
      )}
    </div>
  );
}
