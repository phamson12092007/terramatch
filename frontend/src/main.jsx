
<<<<<<< HEAD
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import SpaApp from "./spa/SpaApp.jsx";
import "./index.css";

const LegacyApp = lazy(() => import("./App.jsx"));
const Interface = window.location.pathname === "/legacy" ? LegacyApp : SpaApp;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div style={{ padding: 24, color: "#e8f1f0" }}>Loading interface…</div>}>
      <Interface />
    </Suspense>
=======
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
>>>>>>> 57867d0c2fff0fbaf799359e8f5ffbe1c509c587
  </React.StrictMode>
);
