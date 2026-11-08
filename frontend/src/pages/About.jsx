import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { scenariosApi } from "../api/endpoints";
import Icon from "../components/Icon";
import Section from "../components/Section";

const PROBLEMS = ["p1", "p2", "p3"];
const PIPELINE = ["s1", "s2", "s3", "s4", "s5"];
const PRINCIPLES = ["pr1", "pr2", "pr3", "pr4"];
const ROADMAP = [
  { key: "r1", badge: "now", live: true },
  { key: "r2", badge: "next" },
  { key: "r3", badge: "plan" },
  { key: "r4", badge: "future" },
];

function Count({ total }) {
  if (!total) return <span className="lp-glyph lp-glyph-sm" aria-hidden="true">UZ · RU · EN</span>;
  return <span className="lp-glyph" aria-hidden="true">{total}</span>;
}

export default function About() {
  const { t, i18n } = useTranslation();
  // Catalog size for the bento tile; the tile degrades to a neutral glyph while loading / offline.
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;
    scenariosApi
      .categories(i18n.language)
      .then(({ data }) => active && setTotal(data.reduce((sum, c) => sum + (c.scenario_count || 0), 0)))
      .catch(() => active && setTotal(0));
    return () => {
      active = false;
    };
  }, [i18n.language]);

  return (
    <div className="lp lp-about">
      <header className="lp-page-hero">
        <span className="lp-eyebrow">
          <span className="lp-dot" aria-hidden="true" />
          {t("civic.about.eyebrow")}
        </span>
        <h1 className="lp-h1 lp-h1-md">{t("civic.about.h1")}</h1>
        <p className="lp-lead">{t("civic.about.lead")}</p>
      </header>

      <Section title={t("civic.about.problemTitle")} lead={t("civic.about.problemHead")}>
        <ol className="lp-flex lp-flex-3">
          {PROBLEMS.map((key, i) => (
            <li key={key}>
              <div className="lp-card">
                <span className="lp-index" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <h3>{t(`civic.about.${key}Title`)}</h3>
                <p>{t(`civic.about.${key}Text`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t("civic.about.solutionTitle")} lead={t("civic.about.solutionHead")}>
        <div className="lp-bento">
          <div className="lp-card lp-bento-wide">
            <h3>{t("civic.about.chatTitle")}</h3>
            <p>{t("civic.about.chatText")}</p>
            <div className="lp-mini-chat" role="img" aria-label={t("civic.landing.sampleLabel")}>
              <div className="lp-bubble lp-bubble-user">{t("civic.about.sampleQ")}</div>
              <div className="lp-bubble lp-bubble-bot">{t("civic.about.sampleA")}</div>
            </div>
          </div>
          <div className="lp-card lp-bento-cell">
            <Count total={total} />
            <h3>{t("civic.about.catalogTitle")}</h3>
            <p>{t("civic.about.catalogText")}</p>
          </div>
          <div className="lp-card lp-bento-cell">
            <span className="lp-card-icon lp-card-icon-lg"><Icon name="check" size={40} /></span>
            <h3>{t("civic.about.checklistTitle")}</h3>
            <p>{t("civic.about.checklistText")}</p>
          </div>
        </div>
      </Section>

      <Section band title={t("civic.about.pipelineTitle")} lead={t("civic.about.pipelineLead")}>
        <ol className="lp-flex lp-flex-5">
          {PIPELINE.map((key, i) => (
            <li key={key}>
              <div className="lp-card lp-card-soft">
                <span className="lp-step-n" aria-hidden="true">{i + 1}</span>
                <b>{t(`civic.about.${key}`)}</b>
                <span>{t(`civic.about.${key}Text`)}</span>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t("civic.about.principlesTitle")}>
        <ul className="lp-flex lp-flex-4">
          {PRINCIPLES.map((key) => (
            <li key={key}>
              <div className="lp-card lp-card-tall">
                <h3>{t(`civic.about.${key}`)}</h3>
                <p>{t(`civic.about.${key}Text`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("civic.about.roadmapTitle")}>
        <ol className="lp-flex lp-flex-4">
          {ROADMAP.map(({ key, badge, live }) => (
            <li key={key}>
              <div className={live ? "lp-card lp-card-tall is-live" : "lp-card lp-card-tall"}>
                <span className={live ? "lp-badge is-on" : "lp-badge"}>{t(`civic.about.${badge}`)}</span>
                <h3>{t(`civic.about.${key}`)}</h3>
                <p>{t(`civic.about.${key}Text`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <section className="lp-closing" aria-labelledby="about-cta">
        <h2 id="about-cta" className="lp-h1 lp-h1-sm">{t("civic.about.ctaTitle")}</h2>
        <p className="lp-lead">{t("civic.about.ctaLead")}</p>
        <div className="lp-actions">
          <Link to="/guide" className="lp-btn lp-btn-primary">{t("civic.about.ctaGuide")}</Link>
          <Link to="/chat" className="lp-btn lp-btn-ghost">{t("civic.about.ctaAsk")}</Link>
        </div>
      </section>
    </div>
  );
}
