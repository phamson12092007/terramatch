import { ArrowRight, ArrowUpRight, Database, Globe2, Layers3, MapPin, SlidersHorizontal } from "lucide-react";

const steps = [
  { icon: MapPin, title: "Choose a lunar site", description: "Select a catalogued landing site or south-pole region." },
  { icon: SlidersHorizontal, title: "Set your criteria", description: "Pick a vehicle or drill and tune the terrain weights." },
  { icon: Globe2, title: "Compare Earth matches", description: "Inspect ranked locations, measurements and their sources." },
];

export default function Dashboard({ navigate }) {
  return (
    <div className="dashboard">
      <section className="mission-hero" aria-labelledby="mission-title">
        <div className="hero-orbit" aria-hidden="true" />
        <img className="hero-moon" src="/media/lunar-disk.jpg" alt="" fetchPriority="high" />
        <div className="mission-copy">
          <p className="mission-kicker"><span /> Lunar analog research</p>
          <h1 id="mission-title">The Moon,<br /><em>closer to Earth.</em></h1>
          <p className="mission-description">Find Earth terrain that resembles lunar research sites using measured elevation, slope, roughness and relief.</p>
          <button className="primary-button" onClick={() => navigate("explorer")}>
            Explore the Moon <ArrowRight size={18} />
          </button>
        </div>
        <a className="hero-credit" href="https://science.nasa.gov/moon/daily-moon-guide/" target="_blank" rel="noreferrer">Lunar imagery · NASA SVS <ArrowUpRight size={12} /></a>
      </section>

      <div className="dashboard-details">
        <section className="dashboard-panel" aria-labelledby="workflow-title">
          <h2 id="workflow-title">Discovery workflow</h2>
          <ol className="mission-steps">
            {steps.map(({ icon: Icon, title, description }) => (
              <li key={title}><span className="step-icon"><Icon size={17} /></span><div><h3>{title}</h3><p>{description}</p></div></li>
            ))}
          </ol>
        </section>
        <section className="dashboard-panel" aria-labelledby="data-title">
          <h2 id="data-title">Research data</h2>
          <div className="dataset-row"><Layers3 size={18} /><div><h3>Lunar Reconnaissance Orbiter</h3><p>LOLA terrain and Diviner temperature</p></div></div>
          <div className="dataset-row"><Database size={18} /><div><h3>Earth terrain</h3><p>Processed NASA SRTM observations</p></div></div>
          <button className="text-button" onClick={() => navigate("sources")}>View data sources <ArrowUpRight size={15} /></button>
        </section>
      </div>
    </div>
  );
}
