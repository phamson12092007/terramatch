import { useEffect, useMemo } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./LunarSouthPoleMap.css";

const MOON_RADIUS_METRES = 1_737_400;
const TILE_ORIGIN_METRES = 1_095_930;
const BASE_RESOLUTION = 8_561.953125;
const MAP_LIMIT = 1_095_600;

const TILE_URL = "https://trek.nasa.gov/tiles/Moon/SP/LRO_WAC_Mosaic_SPole60_100m_v02/1.0.0/default/default028mm/{z}/{y}/{x}.png";
const DATA_LAYER_URLS = {
  elevation: "https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_ClrShade_SPole75_30mp_v04/1.0.0/default/default028mm/{z}/{y}/{x}.png",
  slope: "https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_ClrSlope_SPole75S_120m/1.0.0/default/default028mm/{z}/{y}/{x}.png",
  illumination: "https://trek.nasa.gov/tiles/Moon/SP/WAC_POLE_ILL_PCT_SOUTH_100M/1.0.0/default/default028mm/{z}/{y}/{x}.png",
  psr: "https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_Illumination_SPole65S_240m/1.0.0/default/default028mm/{z}/{y}/{x}.png",
};
const QUICKMAP_URL = "https://quickmap.lroc.im-ldi.com/layers?prjExtent=-370998.640336%2C-137150.5966324%2C378080.0413933%2C229897.957415&selectedFeature=3113%2C1918&earthShadowEnabled=true&proj=27&stack=3314%2C3113&defs=N4IgzAjBYgXKB7ADgQwMYEsAuBPOEBfAGnEgBY5FVNd8CCg";

const lunarProjection = {
  project(latLng) {
    return L.point(latLng.lng, latLng.lat);
  },
  unproject(point) {
    return L.latLng(point.y, point.x);
  },
  bounds: L.bounds(
    L.point(-TILE_ORIGIN_METRES, -TILE_ORIGIN_METRES),
    L.point(TILE_ORIGIN_METRES * 3, TILE_ORIGIN_METRES),
  ),
};

const southPolarCrs = L.extend({}, L.CRS.Simple, {
  projection: lunarProjection,
  transformation: new L.Transformation(
    1 / BASE_RESOLUTION,
    TILE_ORIGIN_METRES / BASE_RESOLUTION,
    -1 / BASE_RESOLUTION,
    TILE_ORIGIN_METRES / BASE_RESOLUTION,
  ),
  scale: (zoom) => 2 ** zoom,
  zoom: (scale) => Math.log(scale) / Math.LN2,
  infinite: false,
});

function projectSouthPole(latitude, longitude) {
  const angularDistance = ((90 + Number(latitude)) * Math.PI) / 180;
  const radius = 2 * MOON_RADIUS_METRES * Math.tan(angularDistance / 2);
  const longitudeRadians = (Number(longitude) * Math.PI) / 180;
  return L.latLng(
    radius * Math.cos(longitudeRadians),
    radius * Math.sin(longitudeRadians),
  );
}

function FollowSelection({ site }) {
  const map = useMap();

  useEffect(() => {
    if (!site) return;
    map.flyTo(projectSouthPole(site.latitude, site.longitude), Math.max(map.getZoom(), 3), {
      animate: true,
      duration: 0.65,
    });
  }, [map, site]);

  return null;
}

export default function LunarSouthPoleMap({ sites = [], selectedSiteId, onSelect, showMarkers = true, activeLayer = "sites" }) {
  const projectedSites = useMemo(() => sites.map((site) => ({
    site,
    position: projectSouthPole(site.latitude, site.longitude),
  })), [sites]);
  const selectedSite = sites.find((site) => site.site_id === selectedSiteId);

  return (
    <div className="moon-view-card lunar-polar-card">
      <div className="moon-view-heading">
        <div><span className="section-kicker">LUNAR IMAGE MAP</span><h3>Moon south pole</h3></div>
        <span>LRO WAC mosaic · 100 m/pixel</span>
      </div>
      <div className="lunar-polar-map-shell">
        <MapContainer
          className="lunar-polar-map"
          center={[0, 0]}
          zoom={2}
          minZoom={1}
          maxZoom={5}
          crs={southPolarCrs}
          maxBounds={L.latLngBounds([-MAP_LIMIT, -MAP_LIMIT], [MAP_LIMIT, MAP_LIMIT])}
          maxBoundsViscosity={0.9}
          scrollWheelZoom
          attributionControl
          zoomControl
        >
          {(activeLayer === "sites" || activeLayer === "elevation" || activeLayer === "slope") && <TileLayer
            key={activeLayer}
            url={activeLayer === "sites" ? TILE_URL : DATA_LAYER_URLS[activeLayer]}
            minNativeZoom={0}
            maxNativeZoom={5}
            tileSize={256}
            noWrap
            bounds={L.latLngBounds([-MAP_LIMIT, -MAP_LIMIT], [MAP_LIMIT, MAP_LIMIT])}
            attribution="NASA/GSFC/ASU · NASA Moon Trek"
          />}
          {(activeLayer === "illumination" || activeLayer === "psr") && <>
            <TileLayer
              key={`${activeLayer}-base`}
              url={TILE_URL}
              minNativeZoom={0}
              maxNativeZoom={5}
              tileSize={256}
              noWrap
              bounds={L.latLngBounds([-MAP_LIMIT, -MAP_LIMIT], [MAP_LIMIT, MAP_LIMIT])}
              attribution="NASA/GSFC/ASU · NASA Moon Trek"
            />
            <TileLayer
              key={activeLayer}
              url={DATA_LAYER_URLS[activeLayer]}
              minNativeZoom={0}
              maxNativeZoom={5}
              tileSize={256}
              opacity={0.82}
              noWrap
              bounds={L.latLngBounds([-MAP_LIMIT, -MAP_LIMIT], [MAP_LIMIT, MAP_LIMIT])}
              attribution="NASA LRO / LROC · NASA Moon Trek"
            />
          </>}
          {showMarkers && projectedSites.map(({ site, position }) => {
            const isSelected = site.site_id === selectedSiteId;
            return (
              <CircleMarker
                key={site.site_id}
                center={position}
                radius={isSelected ? 8 : 6}
                pathOptions={{
                  color: isSelected ? "#ffe29a" : "#9cebd2",
                  weight: isSelected ? 3 : 2,
                  fillColor: isSelected ? "#b7882f" : "#17846f",
                  fillOpacity: 0.95,
                }}
                eventHandlers={{ click: () => onSelect?.(site) }}
              >
                <Tooltip permanent direction="top" offset={[0, -7]} className={isSelected ? "polar-site-label selected" : "polar-site-label"}>
                  {site.name}
                </Tooltip>
              </CircleMarker>
            );
          })}
          <FollowSelection site={selectedSite} />
        </MapContainer>
        <div className="polar-map-compass" aria-hidden="true"><span>0°</span><span>90°E</span><span>180°</span><span>90°W</span></div>
      </div>
      <div className="lunar-polar-footer">
        <span>Drag to pan · scroll to zoom · map center is 90°S</span>
        <a href={QUICKMAP_URL} target="_blank" rel="noreferrer">Open original QuickMap ↗</a>
      </div>
    </div>
  );
}
