import { ArrowRight, ArrowUpRight, Database, Globe2, Layers3, MapPin, SlidersHorizontal } from "lucide-react";

const steps = [
  { icon: MapPin, title: "Chọn địa điểm trên Mặt Trăng", description: "Chọn điểm hạ cánh trong danh mục hoặc khu vực cực Nam." },
  { icon: SlidersHorizontal, title: "Thiết lập tiêu chí", description: "Chọn xe địa hình hoặc máy khoan và điều chỉnh trọng số địa hình." },
  { icon: Globe2, title: "So sánh địa điểm trên Trái Đất", description: "Xem thứ hạng địa điểm, số liệu đo đạc và nguồn dữ liệu." },
];

export default function Dashboard({ navigate }) {
  return (
    <div className="dashboard">
      <section className="mission-hero" aria-labelledby="mission-title">
        <div className="hero-orbit" aria-hidden="true" />
        <img className="hero-moon" src="/media/lunar-disk.jpg" alt="" fetchPriority="high" />
        <div className="mission-copy">
          <p className="mission-kicker"><span /> Nghiên cứu địa hình tương tự Mặt Trăng</p>
          <h1 id="mission-title">Mặt Trăng,<br /><em>gần với Trái Đất hơn.</em></h1>
          <p className="mission-description">Tìm địa hình trên Trái Đất tương đồng với các địa điểm nghiên cứu trên Mặt Trăng dựa trên số liệu độ cao, độ dốc, độ gồ ghề và độ lồi lõm.</p>
          <button className="primary-button" onClick={() => navigate("explorer")}>
            Khám phá Mặt Trăng <ArrowRight size={18} />
          </button>
        </div>
        <a className="hero-credit" href="https://science.nasa.gov/moon/daily-moon-guide/" target="_blank" rel="noreferrer">Ảnh Mặt Trăng · NASA SVS <ArrowUpRight size={12} /></a>
      </section>

      <div className="dashboard-details">
        <section className="dashboard-panel" aria-labelledby="workflow-title">
          <h2 id="workflow-title">Quy trình khám phá</h2>
          <ol className="mission-steps">
            {steps.map(({ icon: Icon, title, description }) => (
              <li key={title}><span className="step-icon"><Icon size={17} /></span><div><h3>{title}</h3><p>{description}</p></div></li>
            ))}
          </ol>
        </section>
        <section className="dashboard-panel" aria-labelledby="data-title">
          <h2 id="data-title">Dữ liệu nghiên cứu</h2>
          <div className="dataset-row"><Layers3 size={18} /><div><h3>Tàu Quỹ đạo Trinh sát Mặt Trăng</h3><p>Dữ liệu địa hình LOLA và nhiệt độ Diviner</p></div></div>
          <div className="dataset-row"><Database size={18} /><div><h3>Địa hình Trái Đất</h3><p>Dữ liệu quan trắc NASA SRTM đã xử lý</p></div></div>
          <button className="text-button" onClick={() => navigate("sources")}>Xem nguồn dữ liệu <ArrowUpRight size={15} /></button>
        </section>
      </div>
    </div>
  );
}
