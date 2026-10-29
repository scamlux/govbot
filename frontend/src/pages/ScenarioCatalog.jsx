import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { scenariosApi } from "../api/endpoints";
import { stripMarkdown } from "../utils/stripMarkdown";
import Icon, { CategoryIcon } from "../components/Icon";

export default function ScenarioCatalog() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeCategory = searchParams.get("category") || "";
  const [categories, setCategories] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load categories once per language.
  useEffect(() => {
    scenariosApi
      .categories(i18n.language)
      .then(({ data }) => setCategories(data))
      .catch(() => setCategories([]));
  }, [i18n.language]);

  const loadScenarios = useCallback(() => {
    setLoading(true);
    setError(null);
    scenariosApi
      .list(i18n.language, { category: activeCategory || undefined, search: search || undefined })
      .then(({ data }) => setScenarios(data))
      .catch(() => setError(t("errors.loadScenarios")))
      .finally(() => setLoading(false));
  }, [i18n.language, activeCategory, search, t]);

  // Debounce search; reload on category/language change immediately.
  useEffect(() => {
    const id = setTimeout(loadScenarios, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [loadScenarios, search]);

  const selectCategory = (slug) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set("category", slug);
    else next.delete("category");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="page catalog">
      <div className="section-head st-page-head">
        <p className="st-eyebrow">{t("studio.eyebrowCatalog")}</p>
        <h1>{t("scenarios.title")}</h1>
        <p>{t("scenarios.subtitle")}</p>
      </div>

      <input
        type="search"
        className="search-box"
        placeholder={t("scenarios.searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={t("common.search")}
      />

      {/* R1 — a filter group, not tabs: there are no tab panels to point at. */}
      <div className="filter-row" role="group" aria-label={t("common.search")}>
        <button
          type="button"
          aria-pressed={!activeCategory}
          className={!activeCategory ? "filter-pill active" : "filter-pill"}
          onClick={() => selectCategory("")}
        >
          {t("scenarios.allCategories")}
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            aria-pressed={activeCategory === c.slug}
            className={activeCategory === c.slug ? "filter-pill active" : "filter-pill"}
            onClick={() => selectCategory(c.slug)}
          >
            <CategoryIcon slug={c.slug} fallback={c.icon} size={18} /> {c.name}
          </button>
        ))}
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {loading ? (
          // R4 — skeletons keep the layout stable while the (possibly cold) API answers.
          <div className="skeleton-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton skeleton-card" />
            ))}
          </div>
        ) : error ? (
          <div>
            <p className="form-error">{error}</p>
            <button type="button" className="btn btn-outline" onClick={loadScenarios}>
              {t("common.retry")}
            </button>
          </div>
        ) : scenarios.length === 0 ? (
          <div className="catalog-empty">
            <p className="muted">{t("scenarios.noResults")}</p>
            {search && (
              <Link to="/chat" state={{ prefill: search }} className="btn btn-primary">
                <Icon name="chat" size={20} /> {t("scenarios.askAI")}
              </Link>
            )}
          </div>
        ) : (
          <div className="scenario-grid">
            {scenarios.map((s) => (
              <Link to={`/scenarios/${s.slug}`} className="scenario-card" key={s.slug}>
                <h3>{s.title}</h3>
                <p className="scenario-excerpt">{stripMarkdown(s.excerpt)}</p>
                <div className="scenario-tags">
                  {s.verified_at && (
                    <span className="verified-badge">
                      ✓ {t("trust.verified", { date: new Date(s.verified_at).toLocaleDateString(i18n.language) })}
                    </span>
                  )}
                  {s.tags?.slice(0, 3).map((tag) => (
                    <span className="tag" key={tag}>#{tag}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
