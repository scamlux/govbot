import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { scenariosApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useConfig } from "../config/ConfigContext";

const ROLE_KEY = "govbot.role";
const ROLES = ["citizen", "resident", "tourist"];
const SITUATIONS_SHOWN = 6;

function readRole() {
  try {
    const saved = localStorage.getItem(ROLE_KEY);
    return ROLES.includes(saved) ? saved : "";
  } catch {
    return "";
  }
}

export default function Landing() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { guest_chat: guestChat } = useConfig();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  // B3 / R3 — role chosen by the visitor; drives the "popular situations" list.
  const [role, setRole] = useState(readRole);
  const [situations, setSituations] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    scenariosApi
      .categories(i18n.language)
      .then(({ data }) => active && setCategories(data))
      .catch(() => active && setCategories([]));
    return () => {
      active = false;
    };
  }, [i18n.language]);

  useEffect(() => {
    let active = true;
    scenariosApi
      .list(i18n.language, { audience: role || undefined })
      .then(({ data }) => {
        if (!active) return;
        const rows = Array.isArray(data) ? data : data?.results || [];
        // Role-specific topics first, then the universal ones.
        const ranked = role
          ? [...rows].sort(
              (a, b) =>
                Number((b.audience || []).includes(role)) - Number((a.audience || []).includes(role))
            )
          : rows;
        setSituations(ranked.slice(0, SITUATIONS_SHOWN));
      })
      .catch(() => active && setSituations([]));
    return () => {
      active = false;
    };
  }, [i18n.language, role]);

  const chooseRole = (next) => {
    const value = next === role ? "" : next;
    setRole(value);
    try {
      if (value) localStorage.setItem(ROLE_KEY, value);
      else localStorage.removeItem(ROLE_KEY);
    } catch {
      /* ignore */
    }
  };

  const onSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/scenarios?search=${encodeURIComponent(q)}` : "/scenarios");
  };

  const features = [
    { icon: "💬", title: t("landing.feature1Title"), body: t("landing.feature1Body") },
    { icon: "📚", title: t("landing.feature2Title"), body: t("landing.feature2Body") },
    { icon: "🌐", title: t("landing.feature3Title"), body: t("landing.feature3Body") },
  ];
  // B1 — when guest chat is on, signed-out visitors can ask straight away.
  const chatLabel = !user && guestChat ? t("landing.askGuest") : t("landing.ctaChat");

  return (
    <div className="landing">
      <section className="hero">
        <p className="hero-tag">{t("tagline")}</p>
        <h1 className="hero-title">{t("landing.heroTitle")}</h1>
        <p className="hero-sub">{t("landing.heroSubtitle")}</p>
        <form className="hero-search" role="search" onSubmit={onSearch}>
          <label htmlFor="hero-search-input" className="visually-hidden">
            {t("common.search")}
          </label>
          <input
            id="hero-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("landing.searchPlaceholder")}
          />
          <button type="submit" className="btn btn-outline btn-lg">
            {t("common.search")}
          </button>
        </form>
        <div className="hero-cta">
          <Link to="/chat" className="btn btn-primary btn-lg">
            {chatLabel}
          </Link>
          <Link to="/scenarios" className="btn btn-outline btn-lg">
            {t("landing.ctaScenarios")}
          </Link>
        </div>
      </section>

      <section className="roles" aria-labelledby="roles-title">
        <h2 id="roles-title">{t("roles.title")}</h2>
        <p>{t("roles.subtitle")}</p>
        <div className="role-grid">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              className="role-card"
              aria-pressed={role === r}
              onClick={() => chooseRole(r)}
            >
              <strong>{t(`roles.${r}`)}</strong>
              <span>{t(`roles.${r}Hint`)}</span>
            </button>
          ))}
        </div>
        {situations.length > 0 && (
          <div className="situations">
            <h3>{t("landing.situationsTitle")}</h3>
            <ul className="situation-list">
              {situations.map((s) => (
                <li key={s.slug}>
                  <Link className="situation-link" to={`/scenarios/${s.slug}`}>
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="features">
        {features.map((f) => (
          <div className="feature-card" key={f.title}>
            <div className="feature-icon" aria-hidden="true">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </section>

      <section className="cat-preview">
        <div className="section-head">
          <h2>{t("landing.categoriesTitle")}</h2>
          <p>{t("landing.categoriesSubtitle")}</p>
        </div>
        <div className="cat-grid">
          {categories.map((c) => (
            <Link
              to={`/scenarios?category=${c.slug}`}
              className="cat-card"
              key={c.slug}
            >
              <span className="cat-icon" aria-hidden="true">{c.icon}</span>
              <span className="cat-name">{c.name}</span>
              <span className="cat-count">{t("scenarios.itemsCount", { count: c.scenario_count })}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
