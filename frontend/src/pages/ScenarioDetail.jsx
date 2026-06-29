import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";

import { scenariosApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import Spinner from "../components/Spinner";

export default function ScenarioDetail() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    scenariosApi
      .detail(slug, i18n.language)
      .then(({ data }) => active && setScenario(data))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug, i18n.language]);

  const askAI = () => {
    const prefill = t("scenarios.askPrefill", { title: scenario.title });
    const target = user ? "/chat" : "/login";
    navigate(target, {
      state: user ? { prefill } : { from: { pathname: "/chat" }, prefill },
    });
  };

  if (loading) return <div className="page"><Spinner /></div>;
  if (error || !scenario) {
    return (
      <div className="page">
        <p className="muted">{t("scenarios.noResults")}</p>
        <Link to="/scenarios" className="btn btn-outline">{t("scenarios.backToCatalog")}</Link>
      </div>
    );
  }

  const updated = new Date(scenario.updated_at).toLocaleDateString(i18n.language);

  return (
    <article className="page scenario-detail">
      <Link to="/scenarios" className="back-link">← {t("scenarios.backToCatalog")}</Link>

      <header className="detail-head">
        <span className="detail-cat">
          {scenario.category?.icon} {scenario.category?.name}
        </span>
        <h1>{scenario.title}</h1>
        <p className="detail-meta">{t("scenarios.updated")}: {updated}</p>
      </header>

      <div className="markdown detail-body">
        <ReactMarkdown>{scenario.body}</ReactMarkdown>
      </div>

      <div className="detail-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={askAI}>
          💬 {t("scenarios.askAI")}
        </button>
      </div>
    </article>
  );
}
