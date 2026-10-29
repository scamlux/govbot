import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { scenariosApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useConfig } from "../config/ConfigContext";
import Icon, { CategoryIcon } from "../components/Icon";
import Section from "../components/Section";

const ROLE_KEY = "govbot.role";
const ROLES = ["citizen", "resident", "tourist"];
const SITUATIONS_SHOWN = 6;
const STEPS = [
  { icon: "chat", n: "01", key: "feature1" },
  { icon: "book", n: "02", key: "feature2" },
  { icon: "globe", n: "03", key: "feature3" },
];

const TRUST = ["shield", "check", "globe"];
const SOURCES = [
  { host: "my.gov.uz", icon: "portal", desc: "gov.sourceMy" },
  { host: "gov.uz", icon: "building", desc: "gov.sourceGov" },
  { host: "lex.uz", icon: "law", desc: "gov.sourceLex" },
];

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
  // null = still loading (cold API): render placeholders instead of blocking the page.
  const [categories, setCategories] = useState(null);
  // B3 / R3 — role chosen by the visitor; drives the "popular situations" list.
  const [role, setRole] = useState(readRole);
  const [situations, setSituations] = useState(null);
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

  // "N verified scenarios" comes from the data; without it the item renders with no number.
  const scenarioTotal = (categories || []).reduce((sum, c) => sum + (c.scenario_count || 0), 0);

  // B1 — when guest chat is on, signed-out visitors can ask straight away.
  const chatLabel = !user && guestChat ? t("landing.askGuest") : t("landing.ctaChat");

  return (
    <div className="st-landing">
      <section className="st-hero st-tone-night" aria-labelledby="hero-title">
        <div className="st-container st-hero-inner">
          <p className="st-eyebrow">{t("tagline")}</p>
          <h1 id="hero-title" className="st-hero-title">
            {t("landing.heroBefore")}{" "}
            <span className="st-hl">{t("landing.heroHighlight")}</span>
            {t("landing.heroAfter") ? ` ${t("landing.heroAfter")}` : ""}
          </h1>
          <p className="st-hero-sub">{t("landing.heroSubtitle")}</p>
          <form className="st-search" role="search" onSubmit={onSearch}>
            <label htmlFor="hero-search-input" className="visually-hidden">
              {t("common.search")}
            </label>
            <Icon name="search" size={22} className="st-search-icon" />
            <input
              id="hero-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("landing.searchPlaceholder")}
            />
            <button type="submit" className="st-search-btn">
              {t("common.search")}
            </button>
          </form>
          <div className="st-hero-cta">
            <Link to="/chat" className="btn btn-primary btn-lg">
              {chatLabel} <Icon name="arrow" size={20} className="btn-arrow" />
            </Link>
            <Link to="/scenarios" className="btn btn-outline btn-lg">
              {t("landing.ctaScenarios")}
            </Link>
          </div>
          <ul className="st-trust">
            {TRUST.map((icon, i) => (
              <li key={icon} className="st-trust-item">
                <Icon name={icon} size={22} className="st-trust-icon" />
                <span className="st-trust-text">
                  <strong className="st-trust-title">
                    {i === 0 && t("gov.trustSourcesTitle")}
                    {i === 1 && t("gov.trustScenariosTitle")}
                    {i === 2 && t("gov.trustLangsTitle")}
                  </strong>
                  <span className="st-trust-sub">
                    {i === 0 && t("gov.trustSourcesSub")}
                    {i === 1 &&
                      (scenarioTotal > 0
                        ? t("gov.trustScenariosSub", { count: scenarioTotal })
                        : t("gov.trustScenariosSubNoCount"))}
                    {i === 2 && t("gov.trustLangsSub")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Section
        tone="paper"
        eyebrow={t("studio.eyebrowRoles")}
        title={t("roles.title")}
        subtitle={t("roles.subtitle")}
      >
        <div className="st-grid st-grid-3 st-roles">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              className="st-card st-role-card"
              aria-pressed={role === r}
              onClick={() => chooseRole(r)}
            >
              <span className="st-icon-tile"><Icon name={r} /></span>
              <strong>{t(`roles.${r}`)}</strong>
              <span className="st-card-text">{t(`roles.${r}Hint`)}</span>
            </button>
          ))}
        </div>
      </Section>

      {(situations === null || situations.length > 0) && (
        <Section
          tone="dark"
          eyebrow={t("studio.eyebrowSituations")}
          title={t("landing.situationsTitle")}
        >
          <ul className="st-grid st-grid-3 st-situations" aria-busy={situations === null}>
            {situations === null
              ? Array.from({ length: SITUATIONS_SHOWN }, (_, i) => (
                  <li key={i}><span className="st-card st-skeleton" aria-hidden="true" /></li>
                ))
              : situations.map((s, i) => (
                  <li key={s.slug}>
                    <Link className="st-card st-situation" to={`/scenarios/${s.slug}`}>
                      <span className="st-num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="st-situation-title">{s.title}</span>
                    </Link>
                  </li>
                ))}
          </ul>
        </Section>
      )}

      <Section
        tone="paper2"
        eyebrow={t("studio.eyebrowTopics")}
        title={t("landing.categoriesTitle")}
        subtitle={t("landing.categoriesSubtitle")}
      >
        <div className="st-cats" aria-busy={categories === null}>
          {categories === null
            ? Array.from({ length: 4 }, (_, i) => (
                <span key={i} className="st-card st-cat st-skeleton" aria-hidden="true" />
              ))
            : categories.map((c) => (
                <Link to={`/scenarios?category=${c.slug}`} className="st-card st-cat" key={c.slug}>
                  <span className="st-icon-tile"><CategoryIcon slug={c.slug} fallback={c.icon} /></span>
                  <span className="st-cat-name">{c.name}</span>
                  <span className="st-card-text">{t("scenarios.itemsCount", { count: c.scenario_count })}</span>
                </Link>
              ))}
        </div>
      </Section>

      <Section
        tone="paper"
        eyebrow={t("studio.eyebrowHow")}
        title={t("studio.howTitle")}
      >
        <ol className="st-grid st-grid-3 st-steps">
          {STEPS.map((s) => (
            <li key={s.key} className="st-card st-step">
              <span className="st-step-head">
                <span className="st-icon-tile"><Icon name={s.icon} /></span>
                <span className="st-num" aria-hidden="true">{s.n}</span>
              </span>
              <h3>{t(`landing.${s.key}Title`)}</h3>
              <p className="st-card-text">{t(`landing.${s.key}Body`)}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        tone="paper2"
        className="st-section-last st-sources"
        eyebrow={t("gov.sourcesEyebrow")}
        title={t("gov.sourcesTitle")}
        subtitle={t("gov.sourcesSubtitle")}
      >
        <ul className="st-grid st-grid-3 st-source-list">
          {SOURCES.map((src) => (
            <li key={src.host}>
              <a
                className="st-card st-source"
                href={`https://${src.host}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="st-icon-tile"><Icon name={src.icon} /></span>
                <strong className="st-source-host">{src.host}</strong>
                <span className="st-card-text">{t(src.desc)}</span>
                <span className="st-source-visit">
                  {t("gov.sourceVisit")}
                  <Icon name="external" size={16} />
                  <span className="visually-hidden"> {t("gov.newTab")}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
