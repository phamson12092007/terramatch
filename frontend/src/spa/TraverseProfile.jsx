import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowUpRight, LoaderCircle } from "lucide-react";

const CACHE_PREFIX = "spa-traverse-v1:";

function profileUrl(site) {
  const latitudes = [];
  const longitudes = [];
  const longitudeStep = 1 / (111.32 * Math.cos(site.lat * Math.PI / 180));
  for (let kilometer = 0; kilometer <= 10; kilometer += 1) {
    latitudes.push(site.lat.toFixed(5));
    longitudes.push((site.lon + (kilometer - 5) * longitudeStep).toFixed(5));
  }
  return `https://api.open-meteo.com/v1/elevation?latitude=${latitudes.join(",")}&longitude=${longitudes.join(",")}`;
}

export default function TraverseProfile({ site }) {
  const [state, setState] = useState({ status: "idle", profile: null, message: "" });

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_PREFIX + site.id);
    if (cached) {
      try {
        setState({ status: "ready", profile: JSON.parse(cached), message: "Cached in this browser" });
        return;
      } catch {
        localStorage.removeItem(CACHE_PREFIX + site.id);
      }
    }
    setState({ status: "idle", profile: null, message: "" });
  }, [site.id]);

  async function loadProfile() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    setState({ status: "loading", profile: null, message: "" });
    try {
      const response = await fetch(profileUrl(site), { signal: controller.signal });
      if (!response.ok) throw new Error("The API returned an error.");
      const payload = await response.json();
      if (!Array.isArray(payload.elevation) || payload.elevation.length !== 11
        || payload.elevation.some((value) => !Number.isFinite(value))) {
        throw new Error("The elevation data is invalid.");
      }
      const profile = payload.elevation.map((elevation, kilometer) => ({
        kilometer,
        elevation,
      }));
      localStorage.setItem(CACHE_PREFIX + site.id, JSON.stringify(profile));
      setState({ status: "ready", profile, message: "Open-Meteo · Copernicus DEM GLO-90" });
    } catch {
      setState({ status: "error", profile: null, message: "Could not load the profile. Try again when the connection is stable." });
    } finally {
      clearTimeout(timeout);
    }
  }

  const steepest = state.profile
    ? Math.max(...state.profile.slice(1).map((point, index) => Math.atan(Math.abs(point.elevation - state.profile[index].elevation) / 1000) * 180 / Math.PI))
    : null;

  return (
    <section className="panel traverse-panel" aria-labelledby="traverse-title">
      <div className="panel-heading">
        <div><span className="section-kicker">Live terrain</span><h2 id="traverse-title">10 km traverse profile</h2></div>
        <Activity size={20} aria-hidden="true" />
      </div>
      <p>Sample 11 elevation points along an east–west route to inspect terrain variation in the selected cell.</p>
      {state.status === "ready" ? (
        <>
          <div className="profile-chart" aria-label="Elevation profile by distance">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={state.profile} margin={{ top: 12, right: 6, bottom: 0, left: -24 }}>
                <defs><linearGradient id="elevationFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e8b56d" stopOpacity=".35" /><stop offset="100%" stopColor="#e8b56d" stopOpacity="0" /></linearGradient></defs>
                <CartesianGrid stroke="#263745" strokeDasharray="3 4" />
                <XAxis dataKey="kilometer" tick={{ fill: "#91a6b1", fontSize: 10 }} unit=" km" />
                <YAxis tick={{ fill: "#91a6b1", fontSize: 10 }} unit=" m" />
                <Tooltip contentStyle={{ background: "#10232d", border: "1px solid #36505a", color: "#fff" }} />
                <Area dataKey="elevation" name="Elevation" stroke="#e8b56d" fill="url(#elevationFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="profile-note"><strong>Steepest average slope / 1 km segment</strong><span className={steepest > 20 ? "risk" : ""}>{steepest.toFixed(1)}° {steepest > 20 ? "· warning >20°" : ""}</span></div>
        </>
      ) : (
        <div className="profile-placeholder"><Activity size={27} /><span>{state.status === "loading" ? "Loading elevation data…" : "Load data to view the profile."}</span></div>
      )}
      {state.status === "error" && <p className="inline-error" role="alert">{state.message}</p>}
      <div className="profile-footer">
        <button type="button" className="secondary-action" onClick={loadProfile} disabled={state.status === "loading"}>
          {state.status === "loading" ? <LoaderCircle size={15} className="spin" /> : <ArrowUpRight size={15} />}
          {state.status === "ready" ? "Refresh profile" : "Load profile"}
        </button>
        <a href="https://open-meteo.com/en/docs/elevation-api" target="_blank" rel="noreferrer">Data source</a>
      </div>
      {state.status === "ready" && <small className="data-source">{state.message}</small>}
      {state.status === "ready" && <small className="data-source">A 1 km sample shows broad terrain trends; finer surveying is needed to assess short steep sections.</small>}
    </section>
  );
}
