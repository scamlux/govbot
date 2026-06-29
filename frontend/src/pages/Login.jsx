import { useState } from "react";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from?.pathname || "/chat";
  const prefill = location.state?.prefill;

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true, state: prefill ? { prefill } : undefined });
    } catch (err) {
      const status = err?.response?.status;
      setError(status === 401 ? t("auth.invalidCredentials") : t("auth.loginFailed"));
      setBusy(false);
    }
  };

  if (user) return <Navigate to={from} replace />;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-mark" aria-hidden="true">🏛️</div>
        <h1>{t("auth.loginTitle")}</h1>
        <p className="login-sub">{t("auth.loginSubtitle")}</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span>{t("auth.email")}</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="field">
            <span>{t("auth.password")}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? t("auth.signingIn") : t("auth.loginButton")}
          </button>
        </form>

        <p className="auth-switch">
          {t("auth.noAccount")}{" "}
          <Link to="/register" state={location.state}>{t("auth.registerLink")}</Link>
        </p>
      </div>
    </div>
  );
}
