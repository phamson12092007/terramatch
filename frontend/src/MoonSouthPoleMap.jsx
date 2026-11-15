import { useMemo } from "react";
import { MapPin } from "lucide-react";
import lrocSouthPoleMosaic from "./assets/lroc-wac-south-pole.png";
import "./MoonSouthPoleMap.css";

const SOUTH_POLE_CUTOFF = -60;
// Shackleton Rim has no QC-passing LOLA terrain support in the current
// lunar repository, so it must not be offered as an analysis target.
const EXCLUDED_SITE_IDS = new Set(["shackleton-rim"]);

/** A lightweight polar stereographic-style picker for catalogued lunar sites. */
export default function MoonSouthPoleMap({ sites = [], selectedSiteId, onSelect }) {
  const availableSites = useMemo(
    () => sites.filter((site) => !EXCLUDED_SITE_IDS.has(site.site_id)),
    [sites],
  );
  const southPoleSites = useMemo(
    () => availableSites.filter((site) => Number(site.latitude) < SOUTH_POLE_CUTOFF),
    [availableSites],
  );
  const otherSites = useMemo(
    () => availableSites.filter((site) => Number(site.latitude) >= SOUTH_POLE_CUTOFF),
    [availableSites],
  );
  const selectedSouthPoleSite = southPoleSites.find((site) => site.site_id === selectedSiteId);

  const project = (latitude, longitude) => {
    const distance = (90 + Number(latitude)) / 30;
    const angle = (Number(longitude) * Math.PI) / 180;
    return {
      left: `${50 + distance * 48 * Math.sin(angle)}%`,
      top: `${50 - distance * 48 * Math.cos(angle)}%`,
    };
  };

  return <div className="moon-south-pole">
    <div className="polar-map-container">
      <div className="polar-circle" style={{ "--lroc-south-pole-mosaic": `url(${lrocSouthPoleMosaic})` }} aria-label="NASA LROC lunar south-pole terrain map">
        <div className="lat-ring lat-80" /><div className="lat-ring lat-70" /><div className="pole-label">90°S</div>
        {[0, 90, 180, 270].map((degree) => <div key={degree} className="lon-line" style={{ transform: `rotate(${degree}deg)` }} />)}
        {southPoleSites.map((site) => {
          const selected = selectedSiteId === site.site_id;
          return <button key={site.site_id} className={`polar-marker ${selected ? "selected" : ""}`} style={project(site.latitude, site.longitude)} onClick={() => onSelect?.(site)} title={`Select ${site.name}: ${site.latitude}°, ${site.longitude}°`}><span className="marker-dot" /><span className="marker-label">{site.name}</span></button>;
        })}
        {selectedSouthPoleSite && <div className="selected-pin" style={project(selectedSouthPoleSite.latitude, selectedSouthPoleSite.longitude)}><MapPin size={22} /></div>}
      </div>
      <div className="polar-legend"><span>NASA LROC terrain · 90°S–60°S</span><a className="legend-note" href="https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_GLOBAL/" target="_blank" rel="noreferrer">LROC WAC mosaic</a></div>
    </div>
    {otherSites.length > 0 && <div className="other-sites"><small>Other catalogue sites</small><div className="other-chips">{otherSites.map((site) => <button key={site.site_id} className={`other-chip ${selectedSiteId === site.site_id ? "active" : ""}`} onClick={() => onSelect?.(site)}>{site.name}</button>)}</div></div>}
  </div>;
}
