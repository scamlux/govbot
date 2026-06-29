import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/AuthContext";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const { t } = useTranslation();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/");
  };

  const links = [
    { to: "/", label: t("nav.home"), end: true },
    { to: "/scenarios", label: t("nav.scenarios") },
    { to: "/chat", label: t("nav.chat") },
  ];
  if (isAdmin) links.push({ to: "/admin", label: t("nav.admin") });

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true">🏛️</span>
          <span className="brand-name">{t("brand")}</span>
        </Link>

        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label="Primary">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className="nav-link"
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <LanguageSwitcher />
          {user ? (
            <div className="user-chip">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="avatar" />
              ) : (
                <span className="avatar avatar-fallback">
                  {user.display_name?.[0]?.toUpperCase() ?? "U"}
                </span>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                {t("nav.logout")}
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              {t("nav.login")}
            </Link>
          )}
          <button
            type="button"
            className="nav-burger"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}
