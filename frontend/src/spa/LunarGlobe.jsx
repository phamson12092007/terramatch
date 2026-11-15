import { useEffect, useRef, useState } from "react";
import { MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import "./LunarGlobe.css";

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec2 aUv;
uniform vec2 uRotation;
uniform float uZoom;
uniform float uAspect;
varying vec2 vUv;
varying vec3 vNormal;
vec3 rotateX(vec3 p, float a) {
  float c = cos(a); float s = sin(a);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}
vec3 rotateY(vec3 p, float a) {
  float c = cos(a); float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
void main() {
  vec3 p = rotateX(rotateY(aPosition, uRotation.y), uRotation.x);
  vNormal = p;
  vUv = aUv;
  float viewZ = 3.2 - p.z;
  float nearPlane = 0.1;
  float farPlane = 10.0;
  float depthA = (farPlane + nearPlane) / (nearPlane - farPlane);
  float depthB = (2.0 * farPlane * nearPlane) / (nearPlane - farPlane);
  gl_Position = vec4(p.x * uZoom / uAspect, p.y * uZoom, depthA * -viewZ + depthB, viewZ);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D uTexture;
uniform vec3 uLightDirection;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vec3 albedo = texture2D(uTexture, vUv).rgb;
  vec3 normal = normalize(vNormal);
  float diffuse = max(dot(normal, normalize(uLightDirection)), 0.0);
  float illumination = 0.16 + 0.84 * diffuse;
  vec3 color = albedo * illumination;
  gl_FragColor = vec4(color, 1.0);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "Unable to compile the WebGL shader.");
  }
  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Unable to link the WebGL program.");
  }
  return program;
}

function createSphere(latitudes = 64, longitudes = 96) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let row = 0; row <= latitudes; row += 1) {
    const polar = (row / latitudes) * Math.PI;
    for (let column = 0; column <= longitudes; column += 1) {
      const azimuth = (column / longitudes) * Math.PI * 2;
      positions.push(
        Math.sin(polar) * Math.sin(azimuth),
        Math.cos(polar),
        Math.sin(polar) * Math.cos(azimuth),
      );
      uvs.push(0.5 + column / longitudes, 1 - row / latitudes);
    }
  }
  for (let row = 0; row < latitudes; row += 1) {
    for (let column = 0; column < longitudes; column += 1) {
      const first = row * (longitudes + 1) + column;
      const second = first + longitudes + 1;
      indices.push(first, second, first + 1, second, second + 1, first + 1);
    }
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), indices: new Uint16Array(indices) };
}

export default function LunarGlobe({ sites = [], selectedSiteId, onSelect, showMarkers = true }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const markerRefs = useRef({});
  const sitesRef = useRef(sites);
  const showMarkersRef = useRef(showMarkers);
  sitesRef.current = sites;
  showMarkersRef.current = showMarkers;
  const viewRef = useRef({ pitch: -0.32, yaw: 0.42, zoom: 1.15 });
  const dragRef = useRef(null);
  const [zoom, setZoom] = useState(1.15);
  const [error, setError] = useState("");

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const handleWheel = (event) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.92 : 1.08;
      const nextZoom = Math.max(0.85, Math.min(2.4, viewRef.current.zoom * factor));
      viewRef.current.zoom = nextZoom;
      setZoom(nextZoom);
    };
    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) {
      setError("WebGL is unavailable. Enable hardware acceleration or try another browser.");
      return undefined;
    }

    let animationFrame = 0;
    let disposed = false;
    let textureReady = false;
    let resources;

    try {
      const program = createProgram(gl);
      const sphere = createSphere();
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW);
      const uvBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, sphere.uvs, gl.STATIC_DRAW);
      const indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW);

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([95, 100, 105, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const image = new Image();
      image.onload = () => {
        if (disposed) return;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        textureReady = true;
      };
      image.onerror = () => { if (!disposed) setError("Could not load the lunar surface image from the media folder."); };
      image.src = "/media/lunar-map.jpg";

      resources = {
        program, positionBuffer, uvBuffer, indexBuffer, texture, indexCount: sphere.indices.length,
        position: gl.getAttribLocation(program, "aPosition"), uv: gl.getAttribLocation(program, "aUv"),
        rotation: gl.getUniformLocation(program, "uRotation"), zoom: gl.getUniformLocation(program, "uZoom"),
        aspect: gl.getUniformLocation(program, "uAspect"), light: gl.getUniformLocation(program, "uLightDirection"),
      };
      setError("");

      const render = () => {
        if (disposed) return;
        const bounds = canvas.getBoundingClientRect();
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(bounds.width * pixelRatio));
        const height = Math.max(1, Math.round(bounds.height * pixelRatio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.useProgram(resources.program);

        gl.bindBuffer(gl.ARRAY_BUFFER, resources.positionBuffer);
        gl.enableVertexAttribArray(resources.position);
        gl.vertexAttribPointer(resources.position, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.uvBuffer);
        gl.enableVertexAttribArray(resources.uv);
        gl.vertexAttribPointer(resources.uv, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, resources.indexBuffer);
        const view = viewRef.current;
        gl.uniform2f(resources.rotation, view.pitch, view.yaw);
        gl.uniform1f(resources.zoom, view.zoom);
        gl.uniform1f(resources.aspect, width / height);
        gl.uniform3f(resources.light, -0.52, 0.28, 1.0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, resources.texture);
        gl.drawElements(gl.TRIANGLES, resources.indexCount, gl.UNSIGNED_SHORT, 0);

        sitesRef.current.forEach((site, index) => {
          const marker = markerRefs.current[site.site_id];
          if (!marker) return;
          const latitude = (Number(site.latitude) * Math.PI) / 180;
          const longitude = (Number(site.longitude) * Math.PI) / 180;
          const source = [Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude), Math.cos(latitude) * Math.cos(longitude)];
          const yawCos = Math.cos(view.yaw);
          const yawSin = Math.sin(view.yaw);
          const yawed = [yawCos * source[0] + yawSin * source[2], source[1], -yawSin * source[0] + yawCos * source[2]];
          const pitchCos = Math.cos(view.pitch);
          const pitchSin = Math.sin(view.pitch);
          const point = [yawed[0], pitchCos * yawed[1] - pitchSin * yawed[2], pitchSin * yawed[1] + pitchCos * yawed[2]];
          const visible = showMarkersRef.current && point[2] > 0.035;
          marker.setAttribute("aria-hidden", visible ? "false" : "true");
          marker.tabIndex = visible ? 0 : -1;
          marker.style.visibility = visible ? "visible" : "hidden";
          marker.style.pointerEvents = visible ? "auto" : "none";
          if (!visible) return;
          const perspective = 3.2 - point[2];
          const normalizedX = (point[0] * view.zoom / (width / height)) / perspective;
          const normalizedY = (point[1] * view.zoom) / perspective;
          const canvasBounds = canvas.getBoundingClientRect();
          const layerBounds = marker.parentElement.getBoundingClientRect();
          const screenX = canvasBounds.left + ((normalizedX + 1) * 0.5 * canvasBounds.width) - layerBounds.left;
          const screenY = canvasBounds.top + ((1 - normalizedY) * 0.5 * canvasBounds.height) - layerBounds.top;
          marker.style.left = `${screenX}px`;
          marker.style.top = `${screenY}px`;
          marker.style.opacity = `${Math.min(1, Math.max(0.35, point[2] * 2.8))}`;
          marker.style.zIndex = String(5 + index + Math.round(point[2] * 10));
        });
        animationFrame = window.requestAnimationFrame(render);
      };
      render();
    } catch (initializationError) {
      setError(initializationError.message || "Could not initialize the 3D globe.");
    }

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      if (resources) {
        gl.deleteBuffer(resources.positionBuffer);
        gl.deleteBuffer(resources.uvBuffer);
        gl.deleteBuffer(resources.indexBuffer);
        gl.deleteTexture(resources.texture);
        gl.deleteProgram(resources.program);
      }
    };
  }, []);

  const setZoomLevel = (value) => {
    const nextZoom = Math.max(0.85, Math.min(2.4, value));
    viewRef.current.zoom = nextZoom;
    setZoom(nextZoom);
  };

  const focusOn = (site) => {
    if (!site) return;
    const latitude = (Number(site.latitude) * Math.PI) / 180;
    const longitude = (Number(site.longitude) * Math.PI) / 180;
    viewRef.current.pitch = latitude;
    viewRef.current.yaw = -longitude;
    onSelect?.(site);
  };

  useEffect(() => {
    const site = sites.find((candidate) => candidate.site_id === selectedSiteId);
    if (!site) return;
    viewRef.current.pitch = (Number(site.latitude) * Math.PI) / 180;
    viewRef.current.yaw = -(Number(site.longitude) * Math.PI) / 180;
  }, [selectedSiteId, sites]);

  const onPointerDown = (event) => {
    dragRef.current = { x: event.clientX, y: event.clientY, pitch: viewRef.current.pitch, yaw: viewRef.current.yaw };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    const { x, y, pitch, yaw } = dragRef.current;
    viewRef.current.yaw = yaw + (event.clientX - x) * 0.008;
    viewRef.current.pitch = Math.max(-1.48, Math.min(1.48, pitch + (event.clientY - y) * 0.008));
  };

  const resetView = () => {
    viewRef.current.pitch = -0.32;
    viewRef.current.yaw = 0.42;
    setZoomLevel(1.15);
  };

  return (
    <section className="moon-view-card lunar-globe-view" aria-labelledby="lunar-globe-title">
      <div className="moon-view-heading"><div><span className="section-kicker">3D · GLOBAL</span><h3 id="lunar-globe-title">Lunar surface</h3></div><span className="globe-live"><i /> Interactive rotation</span></div>
      <div className="lunar-globe-content">
        <div ref={stageRef} className="lunar-globe-stage" aria-label="Drag to rotate the Moon; scroll to zoom">
          <div className="globe-stars" aria-hidden="true" />
          <canvas
            ref={canvasRef}
            className="lunar-globe-canvas"
            aria-label="3D Moon globe. Drag to rotate and scroll to zoom in or out."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
          />
          {showMarkers && <div className="globe-marker-layer" role="group" aria-label="Locations on the lunar surface">
            {sites.map((site) => (
              <button
                key={site.site_id}
                ref={(element) => { markerRefs.current[site.site_id] = element; }}
                type="button"
                className={`globe-location-marker site-${site.site_id} ${Number(site.longitude) < 0 ? "label-west" : "label-east"} ${selectedSiteId === site.site_id ? "selected" : ""}`}
                aria-label={`Rotate to ${site.name}, ${Math.abs(Number(site.latitude)).toFixed(3)} degrees ${Number(site.latitude) < 0 ? "South" : "North"}, ${Math.abs(Number(site.longitude)).toFixed(3)} degrees ${Number(site.longitude) < 0 ? "West" : "East"}`}
                aria-pressed={selectedSiteId === site.site_id}
                title={`${site.name} · ${Math.abs(Number(site.latitude)).toFixed(3)}°${Number(site.latitude) < 0 ? "S" : "N"}, ${Math.abs(Number(site.longitude)).toFixed(3)}°${Number(site.longitude) < 0 ? "W" : "E"}`}
                onClick={() => focusOn(site)}
              >
                <span className="globe-location-pin"><MapPin size={15} aria-hidden="true" /></span>
                <span className="globe-location-label">{site.name}</span>
              </button>
            ))}
          </div>}
          <div className="globe-controls" role="group" aria-label="Globe controls">
            <button type="button" aria-label="Zoom in on the Moon" onClick={() => setZoomLevel(zoom + 0.15)} disabled={zoom >= 2.4}><Plus size={16} /></button>
            <button type="button" aria-label="Zoom out from the Moon" onClick={() => setZoomLevel(zoom - 0.15)} disabled={zoom <= 0.85}><Minus size={16} /></button>
            <button type="button" aria-label="Reset view" onClick={resetView}><RotateCcw size={14} /></button>
          </div>
          <span className="globe-zoom-readout">{Math.round(zoom * 100)}%</span>
          {error && <div className="globe-error" role="status">{error}</div>}
        </div>

      </div>
      <div className="lunar-globe-footer">Drag to rotate · scroll to zoom · select a marker to focus on a location</div>
      <p className="globe-data-note">The globe uses the project's equirectangular surface image. It is a visual model, not a measured 3D terrain dataset.</p>
    </section>
  );
}
