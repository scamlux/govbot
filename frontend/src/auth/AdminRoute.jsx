import { Navigate } from "react-router-dom";

import { useAuth } from "./AuthContext";
import Spinner from "../components/Spinner";

export default function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
