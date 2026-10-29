import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./i18n";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { AuthProvider } from "./auth/AuthContext";
import { ConfigProvider } from "./config/ConfigContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { registerServiceWorker } from "./registerSW";
import "./styles/global.css";
import "./styles/upgrades.css";
import "./styles/studio.css";

// B6 — light mode for slow / metered connections: drop decorative backgrounds and motion.
try {
  if (navigator.connection?.saveData) document.documentElement.setAttribute("data-lite", "");
} catch {
  /* Network Information API unavailable — nothing to do */
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <ConfigProvider>
            <AuthProvider>
              <ConfirmProvider>
                <App />
              </ConfirmProvider>
            </AuthProvider>
          </ConfigProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

registerServiceWorker();
