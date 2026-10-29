import { useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/AuthContext";
import Icon from "./Icon";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar({ onOpenSearch }) {
  const { t } = useTranslation();
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const onHome = useLocation().pathname === "/";
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
    <header className={onHome ? "navbar navbar-hero" : "navbar"}>
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-text">
            <span className="brand-name">{t("brand")}</span>
            <span className="brand-sub">{t("gov.brandSub")}</span>
          </span>
        </Link>

        <nav className={menuOpen ? "nav-links open" : "nav-links"} aria-label={t("nav.primary")}>
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
          {/* Mobile-only drawer extras: language switch (≤640px) + logout (hidden on desktop). */}
          <div className="nav-drawer-extra">
            <LanguageSwitcher />
            {user && (
              <button type="button" className="btn btn-outline btn-block" onClick={handleLogout}>
                {t("nav.logout")}
              </button>
            )}
          </div>
        </nav>

        <div className="nav-actions">
          {onOpenSearch && (
            <button
              type="button"
              className="nav-search"
              onClick={onOpenSearch}
              aria-label={t("nav.searchHint")}
              title={t("nav.searchHint")}
            >
              <Icon name="search" size={18} />
              <span className="nav-search-label">{t("nav.search")}</span>
              <kbd aria-hidden="true">Ctrl K</kbd>
            </button>
          )}
          {user ? (
            <div className="user-chip">
              <Link to="/profile" className="avatar-link" title={t("nav.profile")} aria-label={t("nav.profile")}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="avatar" />
                ) : (
                  <span className="avatar avatar-fallback">
                    {user.display_name?.[0]?.toUpperCase() ?? "U"}
                  </span>
                )}
              </Link>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                {t("nav.logout")}
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm nav-cta">
              {t("nav.login")}
            </Link>
          )}
          <button
            type="button"
            className="nav-burger"
            aria-label={t("nav.menu")}
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
