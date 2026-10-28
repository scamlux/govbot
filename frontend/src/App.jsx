import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CommandPalette from "./components/CommandPalette";
import OfflineBanner from "./components/OfflineBanner";
import Spinner from "./components/Spinner";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";
import { useAuth } from "./auth/AuthContext";
import { useConfig } from "./config/ConfigContext";

// Route-level code-splitting: each page ships in its own chunk and is fetched on demand,
// so the initial load no longer pulls in the chat editor, admin analytics, and markdown
// rendering up front. Keeps the entry bundle small and the landing page fast.
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Chat = lazy(() => import("./pages/Chat"));
const Profile = lazy(() => import("./pages/Profile"));
const ScenarioCatalog = lazy(() => import("./pages/ScenarioCatalog"));
const ScenarioDetail = lazy(() => import("./pages/ScenarioDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Embed = lazy(() => import("./pages/Embed"));
const NotFound = lazy(() => import("./pages/NotFound"));

/**
 * B1 — /chat for guests when the backend enables guest mode; otherwise the usual
 * sign-in gate. Waits for the flags so a signed-out visitor isn't bounced to /login
 * before we know guest mode is on.
 */
function ChatRoute() {
  const { user, loading } = useAuth();
  const config = useConfig();
  if (loading || (!user && !config.loaded)) return <Spinner full />;
  if (!user && config.guest_chat) return <Chat guest />;
  return (
    <ProtectedRoute>
      <Chat />
    </ProtectedRoute>
  );
}

export default function App() {
  const { t } = useTranslation();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // The chat page manages its own full-height layout without the page container.
  const isChat = location.pathname.startsWith("/chat");

  // R4 — Ctrl/⌘+K opens the search palette from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close the palette on navigation.
  useEffect(() => setPaletteOpen(false), [location.pathname]);

  // D2 — the embeddable widget renders without the site chrome.
  if (location.pathname.startsWith("/embed")) {
    return (
      <main id="main" className="app-main app-main-flush">
        <Suspense fallback={<Spinner full />}>
          <Embed />
        </Suspense>
      </main>
    );
  }

  return (
    <div className="app-shell">
      {/* R1 — first focusable element: jump past the navigation. */}
      <a href="#main" className="skip-link">{t("common.skipToContent")}</a>
      <OfflineBanner />
      <Navbar onOpenSearch={() => setPaletteOpen(true)} />
      <main id="main" tabIndex={-1} className={isChat ? "app-main app-main-flush" : "app-main"}>
        <Suspense fallback={<Spinner full />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/chat" element={<ChatRoute />} />
          <Route path="/scenarios" element={<ScenarioCatalog />} />
          <Route path="/scenarios/:slug" element={<ScenarioDetail />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      {!isChat && <Footer />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
