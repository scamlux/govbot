import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/AuthContext";
import HeaderTools from "./HeaderTools";
import Icon from "./Icon";
import LanguageSwitcher from "./LanguageSwitcher";

/** Single white header: logo left, nav centre, utilities + actions right. */
export default function Navbar({ onOpenSearch }) {
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
    { to: "/scenarios", label: t("nav.scenarios") },
    { to: "/chat", label: t("nav.chat") },
    { to: "/about", label: t("nav.about") },
    { to: "/guide", label: t("nav.guide") },
  ];
  if (isAdmin) links.push({ to: "/admin", label: t("nav.admin") });

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" strokeWidth="2.4">
              <polygon className="brand-sq-a" points="10,10 30,10 30,30 10,30" />
              <polygon className="brand-sq-b" points="20,5.9 34.1,20 20,34.1 5.9,20" />
            </svg>
          </span>
          <span className="brand-name">{t("brand")}</span>
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

          {/* Mobile drawer extras (hidden on desktop): language, account. */}
          <div className="nav-drawer-extra">
            <LanguageSwitcher />
            {user ? (
              <button type="button" className="btn btn-outline btn-block" onClick={handleLogout}>
                {t("nav.logout")}
              </button>
            ) : (
              <Link to="/login" className="btn btn-primary btn-block" onClick={() => setMenuOpen(false)}>
                {t("nav.login")}
              </Link>
            )}
          </div>
        </nav>

        <div className="nav-actions">
          <HeaderTools />
          {onOpenSearch && (
            <button
              type="button"
              className="tool-btn nav-search"
              onClick={onOpenSearch}
              aria-label={t("nav.searchHint")}
            >
              <Icon name="search" size={20} />
            </button>
          )}
          <div className="nav-lang">
            <LanguageSwitcher />
          </div>
          {user ? (
            <div className="user-chip">
              <Link to="/profile" className="avatar-link" aria-label={t("nav.profile")}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="avatar" />
                ) : (
                  <span className="avatar avatar-fallback">
                    {user.display_name?.[0]?.toUpperCase() ?? "U"}
                  </span>
                )}
              </Link>
              <button type="button" className="btn btn-ghost btn-sm nav-logout" onClick={handleLogout}>
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
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
