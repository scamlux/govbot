import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { scenariosApi } from "../api/endpoints";

export default function Landing() {
  const { t, i18n } = useTranslation();
  const [categories, setCategories] = useState([]);

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

  const features = [
    { icon: "💬", title: t("landing.feature1Title"), body: t("landing.feature1Body") },
    { icon: "📚", title: t("landing.feature2Title"), body: t("landing.feature2Body") },
    { icon: "🌐", title: t("landing.feature3Title"), body: t("landing.feature3Body") },
  ];

  return (
    <div className="landing">
      <section className="hero">
        <p className="hero-tag">{t("tagline")}</p>
        <h1 className="hero-title">{t("landing.heroTitle")}</h1>
        <p className="hero-sub">{t("landing.heroSubtitle")}</p>
        <div className="hero-cta">
          <Link to="/chat" className="btn btn-primary btn-lg">
            {t("landing.ctaChat")}
          </Link>
          <Link to="/scenarios" className="btn btn-outline btn-lg">
            {t("landing.ctaScenarios")}
          </Link>
        </div>
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
