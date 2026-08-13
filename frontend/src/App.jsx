import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import Navbar from "./components/Navbar";
import OfflineBanner from "./components/OfflineBanner";
import Spinner from "./components/Spinner";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";

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
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  const location = useLocation();
  // The chat page manages its own full-height layout without the page container.
  const isChat = location.pathname.startsWith("/chat");

  return (
    <div className="app-shell">
      <OfflineBanner />
      <Navbar />
      <main className={isChat ? "app-main app-main-flush" : "app-main"}>
        <Suspense fallback={<Spinner full />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />
          <Route path="/scenarios" element={<ScenarioCatalog />} />
          <Route path="/scenarios/:slug" element={<ScenarioDetail />} />
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
    </div>
  );
}
