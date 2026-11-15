
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import SpaApp from "./spa/SpaApp.jsx";
import "./index.css";

const LegacyApp = lazy(() => import("./App.jsx"));
// Keep the 3D mission interface as the main experience. The data-workbench
// interface remains available at /legacy for reference and troubleshooting.
const Interface = window.location.pathname === "/legacy" ? LegacyApp : SpaApp;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div style={{ padding: 24, color: "#e8f1f0" }}>Loading interface…</div>}>
      <Interface />
    </Suspense>
  </React.StrictMode>
);
