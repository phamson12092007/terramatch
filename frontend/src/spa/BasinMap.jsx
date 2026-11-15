import { useEffect, useMemo, useState } from "react";
import { cellToBoundary, latLngToCell } from "h3-js";
import { CircleMarker, GeoJSON, MapContainer, Polygon, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const landStyle = { color: "#344956", weight: 0.7, fillColor: "#243a42", fillOpacity: 1 };

function FollowSelection({ selected }) {
  const map = useMap();

  useEffect(() => {
    if (selected) map.flyTo([selected.lat, selected.lon], 5, { duration: 0.55 });
  }, [map, selected]);

  return null;
}

function MapControls({ candidates, selected }) {
  const map = useMap();

  return (
    <div className="map-controls">
      <button type="button" onClick={() => map.fitBounds(candidates.map(({ lat, lon }) => [lat, lon]), { padding: [32, 32], maxZoom: 3 })}>Show all regions</button>
      {selected && <button type="button" onClick={() => map.flyTo([selected.lat, selected.lon], 6)}>Zoom to selected cell</button>}
    </div>
  );
}

export default function BasinMap({ ranked, selected, onSelect }) {
  const [land, setLand] = useState(null);
  const hexes = useMemo(() => ranked.map((site) => {
    const h3Index = latLngToCell(site.lat, site.lon, 4);
    return { ...site, h3Index, boundary: cellToBoundary(h3Index) };
  }), [ranked]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/media/world-land.json", { signal: controller.signal })
      .then((response) => response.json())
      .then(setLand)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div className="spa-map-wrap">
      <MapContainer center={[48, -30]} zoom={2} minZoom={2} maxZoom={9} scrollWheelZoom={false} className="spa-map">
        {land && <GeoJSON data={land} style={landStyle} interactive={false} pane="tilePane" />}
        {hexes.map((site) => (
          <Polygon
            key={site.id}
            positions={site.boundary}
            eventHandlers={{ click: () => onSelect(site.id) }}
            pathOptions={{
              color: selected?.id === site.id ? "#f7c96a" : "#65d3c0",
              fillColor: selected?.id === site.id ? "#f7c96a" : "#54bbaa",
              fillOpacity: selected?.id === site.id ? 0.47 : 0.3,
              weight: selected?.id === site.id ? 3 : 2,
            }}
          />
        ))}
        {ranked.map((site) => (
          <CircleMarker
            key={site.id}
            center={[site.lat, site.lon]}
            radius={selected?.id === site.id ? 9 : 6}
            eventHandlers={{ click: () => onSelect(site.id) }}
            pathOptions={{
              color: "#0a1922",
              fillColor: selected?.id === site.id ? "#f7c96a" : "#66dac5",
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip direction="top">{site.name} · similarity {site.score}%</Tooltip>
          </CircleMarker>
        ))}
        <FollowSelection selected={selected} />
        <MapControls candidates={ranked} selected={selected} />
      </MapContainer>
      <div className="map-attribution"><a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> · H3 resolution 4</div>
    </div>
  );
}
