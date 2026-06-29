import { useState } from "react";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/AuthContext";

export default function Register() {
  const { t, i18n } = useTranslation();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [fullName, setFullName] = useState("");
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
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        language: i18n.language,
      });
      navigate(from, { replace: true, state: prefill ? { prefill } : undefined });
    } catch (err) {
      // DRF returns field errors: { email: [...] } / { password: [...] }.
      const data = err?.response?.data;
      const firstError =
        data?.email?.[0] || data?.password?.[0] || data?.detail || t("auth.registerFailed");
      setError(firstError);
      setBusy(false);
    }
  };

  if (user) return <Navigate to={from} replace />;

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-mark" aria-hidden="true">🏛️</div>
        <h1>{t("auth.registerTitle")}</h1>
        <p className="login-sub">{t("auth.registerSubtitle")}</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span>{t("auth.fullName")}</span>
            <input
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("auth.fullNamePlaceholder")}
            />
          </label>

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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <small className="field-hint">{t("auth.passwordHint")}</small>
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? t("auth.signingUp") : t("auth.registerButton")}
          </button>
        </form>

        <p className="auth-switch">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" state={location.state}>{t("auth.loginLink")}</Link>
        </p>
      </div>
    </div>
  );
}
