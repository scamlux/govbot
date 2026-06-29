import { Routes, Route, useLocation } from "react-router-dom";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./auth/ProtectedRoute";
import AdminRoute from "./auth/AdminRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import ScenarioCatalog from "./pages/ScenarioCatalog";
import ScenarioDetail from "./pages/ScenarioDetail";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

export default function App() {
  const location = useLocation();
  // The chat page manages its own full-height layout without the page container.
  const isChat = location.pathname.startsWith("/chat");

  return (
    <div className="app-shell">
      <Navbar />
      <main className={isChat ? "app-main app-main-flush" : "app-main"}>
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
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
