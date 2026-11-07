import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { scenariosApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useConfig } from "../config/ConfigContext";
import Icon from "../components/Icon";
import Section from "../components/Section";

const ROLES = ["citizen", "resident", "tourist"];
const STEPS = ["feature1", "feature2", "feature3"];
// Skyline-style wordmark: solid and outline letters alternate in pairs.
const WORDMARK = [
  { ch: "G", outline: false },
  { ch: "O", outline: false },
  { ch: "V", outline: true },
  { ch: "B", outline: false },
  { ch: "O", outline: false },
  { ch: "T", outline: true },
];
const SOURCES = ["my.gov.uz", "gov.uz", "lex.uz"];

/** "01 / 07" — the Skyline card counter. */
function counter(index, total) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(index + 1)} / ${pad(total)}`;
}

export default function Landing() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { guest_chat: guestChat } = useConfig();
  // null = still loading (cold API): render placeholders instead of blocking the page.
  const [categories, setCategories] = useState(null);

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

  // B1 — when guest chat is on, signed-out visitors can ask straight away.
  const chatLabel = !user && guestChat ? t("landing.askGuest") : t("landing.ctaChat");
  const cats = categories || [];

  return (
    <div className="landing sky">
      <section className="sky-hero" aria-labelledby="hero-title">
        <div className="st-container sky-hero-inner">
          <p className="sky-eyebrow">{t("sky.eyebrow")}</p>
          <h1 id="hero-title" className="sky-wordmark">
            <span className="visually-hidden">GovBot — {t("landing.heroTitle")}</span>
            <span aria-hidden="true">
              {WORDMARK.map((l, i) => (
                <span key={i} className={l.outline ? "sky-letter is-outline" : "sky-letter"}>
                  {l.ch}
                </span>
              ))}
            </span>
          </h1>
          <p className="sky-lead">{t("landing.heroSubtitle")}</p>
          <div className="sky-actions">
            <Link to="/chat" className="sky-pill sky-pill-primary">
              {chatLabel} <Icon name="arrow" size={18} />
            </Link>
            <Link to="/scenarios" className="sky-pill sky-pill-ghost">
              {t("landing.ctaScenarios")}
            </Link>
          </div>
          <span className="sky-scroll" aria-hidden="true">{t("sky.scroll")}</span>
        </div>
      </section>

      {cats.length > 0 && (
        <div className="sky-marquee" aria-hidden="true">
          <div className="sky-marquee-track">
            {[0, 1].map((copy) => (
              <span key={copy} className="sky-marquee-group">
                {cats.map((c, i) => (
                  <span key={c.slug} className={i % 2 ? "sky-marquee-item is-outline" : "sky-marquee-item"}>
                    {c.name} /
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      )}

      <Section eyebrow={t("sky.rolesEyebrow")} title={t("roles.title")}>
        <div className="sky-grid sky-grid-3">
          {ROLES.map((r, i) => (
            <Link key={r} to={`/scenarios?audience=${r}`} className="sky-card">
              <span className="sky-counter">{counter(i, ROLES.length)}</span>
              <h3 className="sky-card-title">{t(`roles.${r}`)}</h3>
              <p className="sky-card-text">{t(`roles.${r}Hint`)}</p>
              <span className="sky-card-foot">
                {t("sky.open")} <Icon name="arrow" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section
        eyebrow={t("sky.catalogEyebrow")}
        title={t("landing.categoriesTitle")}
        action={<Link to="/scenarios" className="sky-head-link">{t("sky.allTopics")} →</Link>}
      >
        <div className="sky-grid sky-grid-cats" aria-busy={categories === null}>
          {categories === null
            ? Array.from({ length: 4 }, (_, i) => (
                <span key={i} className="sky-card st-skeleton" aria-hidden="true" />
              ))
            : cats.map((c, i) => (
                <Link to={`/scenarios?category=${c.slug}`} className="sky-card sky-card-cat" key={c.slug}>
                  <span className="sky-counter">{counter(i, cats.length)}</span>
                  <h3 className="sky-card-title">{c.name}</h3>
                  <span className="sky-card-value">
                    {t("scenarios.itemsCount", { count: c.scenario_count })}
                  </span>
                </Link>
              ))}
        </div>
      </Section>

      <Section eyebrow={t("sky.howEyebrow")} title={t("studio.howTitle")}>
        <ol className="sky-grid sky-grid-3 sky-steps">
          {STEPS.map((key, i) => (
            <li key={key} className="sky-card sky-step">
              <span className="sky-counter">{counter(i, STEPS.length)}</span>
              <h3 className="sky-card-title">{t(`landing.${key}Title`)}</h3>
              <p className="sky-card-text">{t(`landing.${key}Body`)}</p>
            </li>
          ))}
        </ol>
      </Section>

      <section className="sky-closing" aria-labelledby="closing-title">
        <div className="st-container">
          <h2 id="closing-title" className="sky-closing-title">
            {t("sky.closingTitle")} <span className="is-outline">{t("sky.closingAction")}</span>
          </h2>
          <div className="sky-actions">
            <Link to="/chat" className="sky-pill sky-pill-primary">
              {chatLabel} <Icon name="arrow" size={18} />
            </Link>
          </div>
          <ul className="sky-sources" aria-label={t("gov.sourcesTitle")}>
            {SOURCES.map((host) => (
              <li key={host}>
                <a href={`https://${host}`} target="_blank" rel="noopener noreferrer">
                  {host} <Icon name="external" size={14} />
                  <span className="visually-hidden"> {t("gov.newTab")}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
