import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme } from "./hooks/useTheme";
import { usePreferencesStore } from "./store/preferencesStore";
import { applyLanguage, useLanguageStore } from "./lib/i18n";

applyTheme(usePreferencesStore.getState().theme);
applyLanguage(useLanguageStore.getState().language);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
