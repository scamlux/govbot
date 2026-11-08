import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { scenariosApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useConfig } from "../config/ConfigContext";
import { askAiTarget } from "../utils/pendingQuestion";
import { stripMarkdown } from "../utils/stripMarkdown";
import Icon, { CategoryIcon } from "../components/Icon";

const AUDIENCES = ["citizen", "resident", "tourist"];

export default function ScenarioCatalog() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { guest_chat: guestChat } = useConfig();
  const navigate = useNavigate();

  const activeCategory = searchParams.get("category") || "";
  const audienceParam = searchParams.get("audience");
  const audience = AUDIENCES.includes(audienceParam) ? audienceParam : "";
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
      .list(i18n.language, {
        category: activeCategory || undefined,
        search: search || undefined,
        audience: audience || undefined,
      })
      .then(({ data }) => setScenarios(data))
      .catch(() => setError(t("errors.loadScenarios")))
      .finally(() => setLoading(false));
  }, [i18n.language, activeCategory, audience, search, t]);

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

  const clearAudience = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("audience");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="page catalog">
      <div className="section-head st-page-head">
        <h1>{t("scenarios.title")}</h1>
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
        {audience && (
          <button type="button" className="filter-pill active" onClick={clearAudience}>
            {t(`roles.${audience}`)} <span aria-hidden="true">×</span>
            <span className="visually-hidden"> — {t("roles.all")}</span>
          </button>
        )}
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
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const target = askAiTarget({ canChat: user || guestChat, question: search });
                  navigate(target.to, { state: target.state });
                }}
              >
                <Icon name="chat" size={20} /> {t("scenarios.askAI")}
              </button>
            )}
          </div>
        ) : (
          <div className="scenario-grid">
            {scenarios.map((s) => (
              <Link to={`/scenarios/${s.slug}`} className="scenario-card" key={s.slug}>
                <h3>{s.title}</h3>
                <p className="scenario-excerpt">{stripMarkdown(s.excerpt)}</p>
                {/* Tags are search keywords (English-only), so the card keeps just the trust badge. */}
                {s.verified_at && (
                  <div className="scenario-tags">
                    <span className="verified-badge">
                      ✓ {t("trust.verified", { date: new Date(s.verified_at).toLocaleDateString(i18n.language) })}
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
