
import { useState } from "react";
import { MapPin, Search, Globe, RotateCcw } from "lucide-react";
import "./PlanetExplorer.css";

export default function PlanetExplorer({
  onSearch,
  initialPlanet = "Moon",
}) {
  const [planet, setPlanet] = useState(initialPlanet);
  const [latitude, setLatitude] = useState("0");
  const [longitude, setLongitude] = useState("0");
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [apiError, setApiError] = useState("");

  // Chọn tọa độ bằng cách nhấn vào bản đồ
  const handleMapClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    const lat = Number((90 - y * 180).toFixed(4));
    const lon = Number((x * 360 - 180).toFixed(4));

    setLatitude(String(lat));
    setLongitude(String(lon));
    setSelectedPoint({ lat, lon });
    setApiError("");
  };

  // Xác nhận tọa độ nhập thủ công
  const handleCoordinateChange = () => {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (
      latitude.trim() === "" ||
      longitude.trim() === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setApiError(
        "Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180."
      );
      setSelectedPoint(null);
      return;
    }

    setSelectedPoint({ lat, lon });
    setApiError("");
  };

  // Gửi tọa độ đến FastAPI backend
  const handleSearch = async () => {
    if (!selectedPoint) {
      setApiError("Please select or confirm coordinates first.");
      return;
    }

    setIsSearching(true);
    setApiError("");

    const requestData = {
      planet,
      latitude: selectedPoint.lat,
      longitude: selectedPoint.lon,
    };

    // Dữ liệu minh họa để kiểm thử thuật toán.
    // Chưa phải dữ liệu đo từ NASA.
    const demoFeatures = {
      elevation_m: 2200,
      slope_deg: 6,
      surface_temp_k: 292,
    };

    try {
      // API 1: Xác thực tọa độ
      const locationResponse = await fetch(
        "http://127.0.0.1:8000/api/location/inspect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
        }
      );

      if (!locationResponse.ok) {
        throw new Error("Location API failed");
      }

      const locationResult = await locationResponse.json();

      // API 2: Tìm kiếm Earth Analog
      const analogResponse = await fetch(
        "http://127.0.0.1:8000/api/analogs/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...requestData,
            target_features: demoFeatures,
          }),
        }
      );

      if (!analogResponse.ok) {
        throw new Error("Earth Analog search API failed");
      }

      const analogResult = await analogResponse.json();

      // Chuyển kết quả sang App.jsx
      onSearch?.({
        ...requestData,
        apiResult: locationResult,
        analogResult,
        demoFeatures,
      });
    } catch (error) {
      console.error("TerraMatch API error:", error);

      setApiError(
        `${error.message}. Please check whether the backend is running.`
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Đặt lại tọa độ
  const resetLocation = () => {
    setLatitude("0");
    setLongitude("0");
    setSelectedPoint(null);
    setApiError("");
  };

  return (
    <div className="planet-explorer">
      <div className="explorer-header">
        <div>
          <h1>Planet Explorer</h1>
          <p>
            Select a location on the Moon or Mars to explore its
            characteristics.
          </p>
        </div>
      </div>

      {/* Chọn hành tinh */}
      <div className="planet-selector">
        <button
          className={planet === "Moon" ? "planet-option active" : "planet-option"}
          onClick={() => {
            setPlanet("Moon");
            resetLocation();
          }}
        >
          <span>🌕</span>
          Moon
        </button>

        <button
          className={planet === "Mars" ? "planet-option active" : "planet-option"}
          onClick={() => {
            setPlanet("Mars");
            resetLocation();
          }}
        >
          <span>🔴</span>
          Mars
        </button>
      </div>

      {/* Bản đồ chọn tọa độ */}
      <div className="explorer-content">
        <div className="map-section">
          <div className="section-heading">
            <div>
              <h2>
                <Globe size={18} />
                {planet} Surface
              </h2>
              <p>Click anywhere on the map to select coordinates.</p>
            </div>
          </div>

          <div
            className={`coordinate-map ${planet.toLowerCase()}-map`}
            onClick={handleMapClick}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                handleMapClick(event);
              }
            }}
          >
            <div className="map-grid">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  className="map-grid-line horizontal"
                  style={{ top: `${index * 25}%` }}
                  key={`h-${index}`}
                />
              ))}

              {Array.from({ length: 7 }).map((_, index) => (
                <div
                  className="map-grid-line vertical"
                  style={{ left: `${index * (100 / 6)}%` }}
                  key={`v-${index}`}
                />
              ))}
            </div>

            {selectedPoint && (
              <div
                className="map-marker"
                style={{
                  left: `${((selectedPoint.lon + 180) / 360) * 100}%`,
                  top: `${((90 - selectedPoint.lat) / 180) * 100}%`,
                }}
              >
                <MapPin size={28} />
              </div>
            )}

            <div className="map-instruction">
              <MapPin size={16} />
              Click to select a location
            </div>
          </div>

          <div className="map-legend">
            <span>Latitude: -90° to 90°</span>
            <span>Longitude: -180° to 180°</span>
          </div>
        </div>

        {/* Nhập tọa độ */}
        <div className="location-panel">
          <div className="section-heading">
            <div>
              <h2>
                <MapPin size={18} />
                Location Coordinates
              </h2>
              <p>Enter coordinates manually or select on the map.</p>
            </div>
          </div>

          <div className="coordinate-fields">
            <div className="coordinate-input">
              <label htmlFor="latitude">Latitude (°)</label>
              <input
                id="latitude"
                type="number"
                min="-90"
                max="90"
                step="any"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
              />
            </div>

            <div className="coordinate-input">
              <label htmlFor="longitude">Longitude (°)</label>
              <input
                id="longitude"
                type="number"
                min="-180"
                max="180"
                step="any"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
              />
            </div>
          </div>

          {/* NÚT XÁC NHẬN TỌA ĐỘ */}
          <button
            className="secondary-action"
            onClick={handleCoordinateChange}
          >
            <MapPin size={16} />
            Confirm coordinates
          </button>

          {selectedPoint && (
            <div className="selected-location">
              <div className="status-indicator" />
              <div>
                <strong>Location selected</strong>
                <p>
                  {selectedPoint.lat}°, {selectedPoint.lon}°
                </p>
              </div>
            </div>
          )}

          {apiError && (
            <p className="api-error">
              {apiError}
            </p>
          )}

          <button
            className="reset-action"
            onClick={resetLocation}
          >
            <RotateCcw size={15} />
            Reset coordinates
          </button>

          {/* NÚT TÌM KIẾM */}
          <button
            className="search-action"
            onClick={handleSearch}
            disabled={!selectedPoint || isSearching}
          >
            <Search size={17} />
            {isSearching
              ? "Connecting to server..."
              : "Find Earth Analogs"}
          </button>
        </div>
      </div>
    </div>
  );
}
