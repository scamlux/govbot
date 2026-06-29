import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { scenariosApi } from "../api/endpoints";
import Spinner from "../components/Spinner";

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
      <div className="section-head">
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

      <div className="filter-row" role="tablist">
        <button
          className={!activeCategory ? "filter-pill active" : "filter-pill"}
          onClick={() => selectCategory("")}
        >
          {t("scenarios.allCategories")}
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            className={activeCategory === c.slug ? "filter-pill active" : "filter-pill"}
            onClick={() => selectCategory(c.slug)}
          >
            <span aria-hidden="true">{c.icon}</span> {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : scenarios.length === 0 ? (
        <p className="muted">{t("scenarios.noResults")}</p>
      ) : (
        <div className="scenario-grid">
          {scenarios.map((s) => (
            <Link to={`/scenarios/${s.slug}`} className="scenario-card" key={s.slug}>
              <h3>{s.title}</h3>
              <p className="scenario-excerpt">{s.excerpt}</p>
              <div className="scenario-tags">
                {s.tags?.slice(0, 3).map((tag) => (
                  <span className="tag" key={tag}>#{tag}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
