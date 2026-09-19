import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme } from "./hooks/useTheme";
import { usePreferencesStore } from "./store/preferencesStore";

applyTheme(usePreferencesStore.getState().theme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
