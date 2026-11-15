import { useMemo, useState } from "react";
import { ArrowUpRight, Database, Globe2, Map, MapPin, Search } from "lucide-react";
import LunarGlobe from "./LunarGlobe";
import LunarSouthPoleMap from "./LunarSouthPoleMap";
import { lunarSiteTerrainMetrics } from "./data";
import "./MoonExplorer.css";

const layerCatalog = {
  sites: {
    label: "Locations",
    description: "The list below includes reference sites, coordinates, and cited sources.",
    source: "Site coordinates",
    sourceUrl: "https://ntrs.nasa.gov/api/citations/20230007818/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book%20Rev%20A.pdf",
  },
  elevation: {
    label: "LOLA elevation",
    description: "Color-shaded LOLA terrain showing elevation and surface features from 75°S to the south pole.",
    source: "NASA Moon Trek · LRO LOLA Color Hillshade",
    sourceUrl: "https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_ClrShade_SPole75_30mp_v04/1.0.0/WMTSCapabilities.xml",
  },
  slope: {
    label: "Slope",
    description: "Color-coded LOLA slope layer at 120 m/pixel, covering 75°S to the south pole.",
    source: "NASA Moon Trek · LRO LOLA Color Slope",
    sourceUrl: "https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_ClrSlope_SPole75S_120m/1.0.0/WMTSCapabilities.xml",
  },
  illumination: {
    label: "Illumination",
    description: "Sun visibility fraction from WAC images over one lunar year. Coverage extends from 88°S to the south pole.",
    source: "NASA LROC · WAC Percentage Illumination",
    sourceUrl: "https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_PCT_SOUTH",
  },
  psr: {
    label: "Permanently shadowed regions (PSR)",
    description: "A LOLA illumination layer with a shadow mask to identify south-polar areas that receive little or no sunlight.",
    source: "NASA Moon Trek · LOLA Polar Illumination",
    sourceUrl: "https://trek.nasa.gov/tiles/Moon/SP/LRO_LOLA_Illumination_SPole65S_240m/1.0.0/WMTSCapabilities.xml",
  },
};

const layerExplanations = {
  sites: {
    resolution: "Named locations · not a raster",
    coverage: "Reference sites cataloged in TerraMatch",
    meaning: "Map markers show the coordinates of each selected site. Select a marker or a list entry to view its details and source.",
    limitation: "A coordinate point does not represent the crater rim or survey-area boundary.",
  },
  elevation: {
    resolution: "30 m/pixel · LOLA",
    coverage: "75°S to 90°S",
    meaning: "The shaded terrain shows landforms and relative elevation. Simulated shadows help reveal crater rims and slopes.",
    limitation: "This is a color-shaded terrain layer, not a point query in meters. Colors follow the NASA product's scale.",
  },
  slope: {
    resolution: "120 m/pixel · LOLA",
    coverage: "75°S to 90°S",
    meaning: "Each pixel represents terrain steepness, typically expressed in degrees (°). Steeper areas are harder to traverse.",
    limitation: "The color scale is encoded in the NASA raster; this preview does not show exact values on hover.",
  },
  illumination: {
    resolution: "100 m/pixel · LROC WAC imagery",
    coverage: "88°S to 90°S",
    meaning: "Fraction of observations where the Sun was visible across roughly one lunar year. Higher values suggest more frequent illumination.",
    limitation: "This is a fraction derived from an image series, not a real-time forecast or guarantee of future lighting. Coverage is narrower than the LOLA layers.",
  },
  psr: {
    resolution: "240 m/pixel · LOLA",
    coverage: "65°S to 90°S",
    meaning: "A polar illumination layer based on the LOLA terrain model. Dark areas indicate where terrain blocks sunlight in this product.",
    limitation: "This is a modeled illumination product, not a surface photograph. PSR boundaries depend on the criteria and analysis period.",
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
    const normalizedQuery = query.trim().toLocaleLowerCase("en");
    return sites.filter((site) => {
      const matchesSouthPole = Number(site.latitude) < -70;
      const matchesQuery = !normalizedQuery
        || `${site.name} ${site.reference ?? ""} ${site.kind ?? ""}`.toLocaleLowerCase("en").includes(normalizedQuery);
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
    <section className="moon-explorer" aria-label="Explore the Moon on a 3D globe">
      <div className="polar-toolbar">
        <label className="polar-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search lunar locations</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search locations…" />
        </label>
        <div className="explorer-view-toggle" role="group" aria-label="Map view">
          <button type="button" className={viewMode === "globe" ? "active" : ""} aria-pressed={viewMode === "globe"} onClick={() => setViewMode("globe")}><Globe2 size={13} /> 3D globe</button>
          <button type="button" className={viewMode === "south-pole" ? "active" : ""} aria-pressed={viewMode === "south-pole"} onClick={() => setViewMode("south-pole")}><Map size={13} /> South pole map</button>
        </div>
        <label className="explorer-marker-toggle"><input type="checkbox" checked={showMarkers} onChange={(event) => setShowMarkers(event.target.checked)} /> Show markers</label>
        <span className="explorer-count">{filteredSites.length} locations</span>
      </div>

      <div className="moon-explorer-layout">
        <div className="moon-globe-column">
          {viewMode === "globe"
            ? <LunarGlobe sites={filteredSites} selectedSiteId={selectedSite?.site_id} onSelect={selectSite} showMarkers={showMarkers} />
            : <LunarSouthPoleMap sites={visibleSouthPoleSites} selectedSiteId={selectedSite?.site_id} onSelect={selectSite} showMarkers={showMarkers} activeLayer={activeLayer} />}
          <div className="south-pole-context">
            <span className="south-pole-context-icon"><MapPin size={15} /></span>
            {viewMode === "globe"
              ? <div><strong>South pole on the lunar globe</strong><p>{southPoleCount} south-polar reference sites are shown. Choose a site from the list or select a marker to rotate the globe to it.</p></div>
              : <div><strong>LRO WAC south-pole mosaic</strong><p>{southPoleCount} matching sites are shown on NASA Moon Trek imagery, covering 60°S to 90°S. An internet connection is required to load map tiles.</p></div>}
          </div>
        </div>

        <aside className="moon-explorer-inspector" aria-label="Location details">
          <div className="polar-layer-picker">
            <div className="polar-card-heading"><span className="section-kicker">Data layers</span><span className="layer-status-pill">Open data</span></div>
            <div className="layer-options" role="group" aria-label="Select a data layer">
              {Object.entries(layerCatalog).map(([key, layer]) => (
                <button key={key} type="button" className={activeLayer === key ? "active" : ""} aria-pressed={activeLayer === key} onClick={() => setActiveLayer(key)}>{layer.label}</button>
              ))}
            </div>
            <p>{activeLayerInfo.description}</p>
            <a href={activeLayerInfo.sourceUrl} target="_blank" rel="noreferrer">{activeLayerInfo.source} <ArrowUpRight size={13} /></a>
            <div className="layer-explanation" aria-live="polite">
              <div className="layer-explanation-title">How to read this layer</div>
              <div className="layer-facts"><span><strong>Resolution</strong>{activeLayerExplanation.resolution}</span><span><strong>Coverage</strong>{activeLayerExplanation.coverage}</span></div>
              <p>{activeLayerExplanation.meaning}</p>
              <small>{activeLayerExplanation.limitation}</small>
            </div>
            {activeLayer !== "sites" && <div className="layer-status layer-status-live" role="status"><Database size={15} /><span><strong>Showing {activeLayerInfo.label.toLocaleLowerCase("en")}.</strong> Map tiles are loaded directly from NASA Moon Trek.</span></div>}
          </div>

          <div className="polar-selected" aria-live="polite" aria-atomic="true">
            <div className="polar-card-heading"><span className="section-kicker">Selected location</span><span className="verified-pill">Source cited</span></div>
            {selectedSite ? <>
              <h3><MapPin size={16} /> {selectedSite.name}</h3>
              <p className="polar-reference">{selectedSite.reference} · {selectedSite.kind}</p>
              <p className="polar-coordinates"><span>Latitude {formatCoordinate(selectedSite.latitude, "N", "S")}</span><span>Longitude {formatCoordinate(selectedSite.longitude, "E", "W")}</span></p>
              <p className="polar-site-summary">{selectedSite.summary}</p>
              <div className="selected-terrain-profile">
                <div className="selected-terrain-heading">Terrain metrics at this coordinate</div>
                {selectedTerrainMetrics ? <>
                  <div className="terrain-profile-grid">
                    <div><strong>Elevation above reference radius</strong><span>{selectedTerrainMetrics.elevationM.toLocaleString("en-US")} m</span></div>
                    <div><strong>Relative elevation to local ground</strong><span>{selectedTerrainMetrics.relativeElevationM.toLocaleString("en-US", { maximumFractionDigits: 1 })} m</span></div>
                    <div><strong>Mean slope</strong><span>{selectedTerrainMetrics.slopeDeg.toLocaleString("en-US", { maximumFractionDigits: 2 })}°</span></div>
                    <div><strong>Terrain roughness</strong><span>{selectedTerrainMetrics.roughnessM.toLocaleString("en-US", { maximumFractionDigits: 1 })} m</span></div>
                    <div><strong>Local relief</strong><span>{selectedTerrainMetrics.localReliefM.toLocaleString("en-US", { maximumFractionDigits: 1 })} m</span></div>
                    <div><strong>Valid raster samples</strong><span>{lunarSiteTerrainMetrics.validPixels}/{lunarSiteTerrainMetrics.expectedPixels} pixels</span></div>
                  </div>
                  <small>Reference sphere radius: 1,737.4 km. Local metrics use a 5×5-pixel window (~{lunarSiteTerrainMetrics.supportM.toLocaleString("en-US", { maximumFractionDigits: 0 })} m); source resolution: {lunarSiteTerrainMetrics.resolutionM.toLocaleString("en-US", { maximumFractionDigits: 2 })} m/pixel. {selectedSite.kind}.</small>
                  <a className="polar-source-link" href={lunarSiteTerrainMetrics.sourceUrl} target="_blank" rel="noreferrer">Metrics: {lunarSiteTerrainMetrics.source} <ArrowUpRight size={13} /></a>
                </> : <small>No valid LOLA pixels are available for this location.</small>}
              </div>
              <small className="polar-source-note">{selectedSite.sourceNote}</small>
              <a className="polar-source-link" href={selectedSite.sourceUrl} target="_blank" rel="noreferrer">Source: {selectedSite.source} <ArrowUpRight size={13} /></a>
            </> : <p>No matching locations. Try another search term.</p>}
          </div>

          <div className="explorer-site-list">
            <div className="polar-card-heading"><span className="section-kicker">Location list</span><span>{filteredSites.length}</span></div>
            <div className="explorer-site-grid">
              {filteredSites.map((site) => (
                <button key={site.site_id} type="button" className={selectedSite?.site_id === site.site_id ? "active" : ""} onClick={() => selectSite(site)} aria-pressed={selectedSite?.site_id === site.site_id}>
                  <span><strong>{site.name}</strong><small>{Number(site.latitude) < -70 ? "South polar region" : "Historic landing site"} · {site.reference}</small></span><MapPin size={14} aria-hidden="true" />
                </button>
              ))}
              {!filteredSites.length && <p>No matching locations.</p>}
            </div>
          </div>
          <p className="polar-data-note">South-polar terrain, slope, illumination, and shadow layers use public LRO LOLA/WAC data through NASA Moon Trek. Site coordinates are reference points cited to their sources.</p>
        </aside>
      </div>
    </section>
  );
}
