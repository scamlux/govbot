import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";

import { scenariosApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useConfig } from "../config/ConfigContext";
import Spinner from "../components/Spinner";
import { buildIcs, downloadIcs } from "../utils/ics";

const PROGRESS_KEY = (slug) => `govbot.checklist.${slug}`;

function readProgress(slug) {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY(slug)) || "[]");
  } catch {
    return [];
  }
}

/** C1 + C2 — documents checklist whose ticks are remembered on this device. */
function Checklist({ slug, items }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(() => new Set(readProgress(slug)));

  useEffect(() => {
    setDone(new Set(readProgress(slug)));
  }, [slug]);

  const toggle = (item) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      try {
        localStorage.setItem(PROGRESS_KEY(slug), JSON.stringify([...next]));
      } catch {
        /* private mode — progress just isn't remembered */
      }
      return next;
    });
  };

  return (
    <section className="checklist-box" aria-labelledby="checklist-title">
      <h2 id="checklist-title">{t("scenarios.documents")}</h2>
      {items.length === 0 ? (
        <p className="checklist-empty">{t("scenarios.documentsEmpty")}</p>
      ) : (
        <>
          <ul>
            {items.map((item) => (
              <li key={item}>
                <label>
                  <input type="checkbox" checked={done.has(item)} onChange={() => toggle(item)} />
                  <span className={done.has(item) ? "done" : undefined}>{item}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="checklist-progress" aria-live="polite">
            {t("scenarios.progress", {
              done: items.filter((i) => done.has(i)).length,
              total: items.length,
            })}
          </p>
        </>
      )}
    </section>
  );
}

/** C4 — a user-chosen reminder exported as an .ics calendar file (no dates invented). */
function Reminder({ scenario }) {
  const { t } = useTranslation();
  const [date, setDate] = useState("");
  const save = () => {
    if (!date) return;
    const url = `${window.location.origin}/scenarios/${scenario.slug}`;
    downloadIcs(
      buildIcs({
        title: `GovBot: ${scenario.title}`,
        date,
        description: `${scenario.title}\n${url}${scenario.source_url ? `\n${scenario.source_url}` : ""}`,
        url,
      }),
      `govbot-${scenario.slug}.ics`
    );
  };
  return (
    <div className="reminder">
      <label>
        {t("scenarios.remindDate")}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button type="button" className="btn btn-outline" onClick={save} disabled={!date}>
        📅 {t("scenarios.remindSave")}
      </button>
    </div>
  );
}

export default function ScenarioDetail() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { guest_chat: guestChat } = useConfig();
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
    // B1 — guests go straight to the chat when guest mode is on.
    const canChat = user || guestChat;
    navigate(canChat ? "/chat" : "/login", {
      state: canChat ? { prefill } : { from: { pathname: "/chat" }, prefill },
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

  const fmt = (d) => new Date(d).toLocaleDateString(i18n.language);
  const updated = fmt(scenario.updated_at);

  return (
    <article className="page scenario-detail">
      {/* R4 — breadcrumbs */}
      <nav aria-label="breadcrumb" className="breadcrumbs">
        <ol>
          <li><Link to="/">{t("scenarios.breadcrumbHome")}</Link></li>
          <li><Link to="/scenarios">{t("scenarios.title")}</Link></li>
          {scenario.category && (
            <li>
              <Link to={`/scenarios?category=${scenario.category.slug}`}>{scenario.category.name}</Link>
            </li>
          )}
          <li aria-current="page">{scenario.title}</li>
        </ol>
      </nav>

      <header className="detail-head">
        <span className="detail-cat">
          {scenario.category?.icon} {scenario.category?.name}
        </span>
        <h1>{scenario.title}</h1>
        {/* A2 / A3 — official source + verification status, right under the title */}
        <div className="scenario-meta">
          {scenario.verified_at ? (
            <span className="verified-badge">✓ {t("trust.verified", { date: fmt(scenario.verified_at) })}</span>
          ) : (
            <span className="verified-badge unverified">{t("trust.notVerified")}</span>
          )}
          {scenario.source_url && (
            <a
              className="source-link"
              href={scenario.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("scenarios.source")}: {new URL(scenario.source_url).hostname} ↗
            </a>
          )}
          <span className="detail-meta">{t("scenarios.updated")}: {updated}</span>
        </div>
      </header>

      <Checklist slug={scenario.slug} items={scenario.checklist || []} />

      <div className="markdown detail-body">
        <ReactMarkdown>{scenario.body}</ReactMarkdown>
      </div>

      {scenario.source_url && (
        <p>
          <a href={scenario.source_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
            {t("trust.checkOfficial")} ↗
          </a>
        </p>
      )}

      <h2 className="visually-hidden">{t("scenarios.remind")}</h2>
      <Reminder scenario={scenario} />

      <div className="sticky-ask">
        <button type="button" className="btn btn-primary btn-lg" onClick={askAI}>
          💬 {t("scenarios.askAI")}
        </button>
      </div>
    </article>
  );
}
