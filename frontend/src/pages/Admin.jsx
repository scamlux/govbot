import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { adminApi } from "../api/endpoints";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import MessageBubble from "../components/MessageBubble";
import MultiLangField from "../components/admin/MultiLangField";

const EMPTY_TR = { uz: "", ru: "", en: "" };

export default function Admin() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("users");
  // C2 — jumping from a catalog gap to a prefilled "create scenario" form.
  const [scenarioPrefill, setScenarioPrefill] = useState(null);

  const createScenarioFrom = (question) => {
    setScenarioPrefill(question);
    setTab("scenarios");
  };

  return (
    <div className="page admin">
      <div className="admin-head">
        <h1>{t("admin.title")}</h1>
        <p className="muted">{t("admin.subtitle")}</p>
      </div>

      <div className="admin-tabs" role="tablist">
        {["users", "conversations", "categories", "scenarios", "analytics", "usage", "system"].map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "admin-tab active" : "admin-tab"}
            onClick={() => setTab(key)}
          >
            {t(`admin.${key}`)}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersPanel />}
      {tab === "conversations" && <ConversationsPanel />}
      {tab === "categories" && <CategoriesPanel />}
      {tab === "scenarios" && (
        <ScenariosPanel
          prefill={scenarioPrefill}
          onPrefillConsumed={() => setScenarioPrefill(null)}
        />
      )}
      {tab === "analytics" && <AnalyticsPanel onCreateScenario={createScenarioFrom} />}
      {tab === "usage" && <UsagePanel />}
      {tab === "system" && <SystemPanel />}
    </div>
  );
}

/* ---------------------------- Analytics --------------------------- */
function AnalyticsPanel({ onCreateScenario }) {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [questions, setQuestions] = useState(null);
  const [gaps, setGaps] = useState(null);
  const [downvotes, setDownvotes] = useState(null);

  useEffect(() => {
    let active = true;
    setQuestions(null);
    setGaps(null);
    setDownvotes(null);
    adminApi.analyticsQuestions(days).then(({ data }) => active && setQuestions(data)).catch(() => active && setQuestions({}));
    adminApi.analyticsGaps(days).then(({ data }) => active && setGaps(data.gaps || [])).catch(() => active && setGaps([]));
    adminApi.feedback("down").then(({ data }) => active && setDownvotes(data.results || [])).catch(() => active && setDownvotes([]));
    return () => {
      active = false;
    };
  }, [days]);

  if (!questions) return <Spinner />;

  const langMax = Math.max(1, ...(questions.language_split || []).map((r) => r.count));
  const isEmpty = (questions.message_count || 0) === 0;

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <h2>{t("admin.analytics")}</h2>
        <label className="field field-sm analytics-period">
          <span>{t("admin.period")}</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>{t("admin.last7Days")}</option>
            <option value={30}>{t("admin.last30Days")}</option>
            <option value={90}>{t("admin.last90Days")}</option>
          </select>
        </label>
      </div>

      {isEmpty ? (
        <p className="muted">{t("admin.noAnalytics")}</p>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat-tile">
              <div className="stat-num">{questions.message_count}</div>
              <div className="stat-label">{t("admin.totalMessages")}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-num">{questions.conversation_count}</div>
              <div className="stat-label">{t("admin.totalConversations")}</div>
            </div>
          </div>

          <div className="analytics-grid">
            <section className="analytics-block">
              <h3>{t("admin.topQuestions")}</h3>
              <ul className="term-list">
                {(questions.top_terms || []).map((row) => (
                  <li key={row.term}>
                    <span className="term-word">{row.term}</span>
                    <span className="term-count">{row.count}</span>
                  </li>
                ))}
                {(questions.top_terms || []).length === 0 && <li className="muted">—</li>}
              </ul>
            </section>

            <section className="analytics-block">
              <h3>{t("admin.languageSplit")}</h3>
              <ul className="lang-bars">
                {(questions.language_split || []).map((row) => (
                  <li key={row.language}>
                    <span className="lang-code">{row.language?.toUpperCase()}</span>
                    <span className="lang-bar-track">
                      <span
                        className="lang-bar-fill"
                        style={{ width: `${(row.count / langMax) * 100}%` }}
                      />
                    </span>
                    <span className="lang-count">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="analytics-block">
              <h3>{t("admin.catalogGaps")}</h3>
              <p className="muted analytics-hint">{t("admin.catalogGapsHint")}</p>
              <ul className="gaps-list">
                {gaps === null ? (
                  <li className="muted">…</li>
                ) : gaps.length === 0 ? (
                  <li className="muted">—</li>
                ) : (
                  gaps.map((g) => (
                    <li key={g.question}>
                      <button
                        type="button"
                        className="gap-q gap-create"
                        title={t("admin.createScenario")}
                        onClick={() => onCreateScenario?.(g.question)}
                      >
                        {g.question}
                      </button>
                      <span className="gap-count">{g.count}</span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="analytics-block">
              <h3>{t("admin.recentDownvotes")}</h3>
              <ul className="downvote-list">
                {downvotes === null ? (
                  <li className="muted">…</li>
                ) : downvotes.length === 0 ? (
                  <li className="muted">—</li>
                ) : (
                  downvotes.slice(0, 8).map((d) => (
                    <li key={d.id}>
                      <span className="dv-lang">{d.conversation_language?.toUpperCase()}</span>
                      <span className="dv-text">{d.message_content}</span>
                      {d.reason && <span className="dv-reason">“{d.reason}”</span>}
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/* ----------------------------- Users ----------------------------- */
function UsersPanel() {
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState(null);

  useEffect(() => {
    adminApi.users().then(({ data }) => setUsers(data)).catch(() => setUsers([]));
  }, []);

  if (!users) return <Spinner />;

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <h2>{t("admin.users")}</h2>
        <span className="count-badge">{users.length}</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("admin.user")}</th>
              <th>{t("admin.email")}</th>
              <th>{t("admin.role")}</th>
              <th>{t("admin.lang")}</th>
              <th>{t("admin.conversations")}</th>
              <th>{t("admin.joined")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="cell-user">
                    <span className="avatar avatar-fallback sm">
                      {u.display_name?.[0]?.toUpperCase() || "U"}
                    </span>
                    {u.full_name || u.display_name}
                  </div>
                </td>
                <td className="muted">{u.email}</td>
                <td>
                  <span className={u.is_staff ? "pill pill-staff" : "pill"}>
                    {u.is_staff ? t("admin.staff") : t("admin.member")}
                  </span>
                </td>
                <td>{u.preferred_language?.toUpperCase()}</td>
                <td>{u.conversation_count}</td>
                <td className="muted">
                  {new Date(u.created_at).toLocaleDateString(i18n.language)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------- Categories --------------------------- */
function CategoriesPanel() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null); // object or "new" or null

  const load = useCallback(() => {
    adminApi.categories().then(({ data }) => setItems(data)).catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);

  const remove = async (cat) => {
    if (!window.confirm(t("admin.confirmDeleteCategory"))) return;
    await adminApi.deleteCategory(cat.id).catch(() => {});
    load();
  };

  if (!items) return <Spinner />;

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <h2>{t("admin.categories")}</h2>
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          + {t("admin.newCategory")}
        </button>
      </div>

      <div className="admin-grid">
        {items.map((c) => (
          <div className="admin-item" key={c.id}>
            <div className="admin-item-main">
              <span className="admin-item-icon">{c.icon || "📁"}</span>
              <div className="admin-item-text">
                <div className="admin-item-title">{c.name?.[i18n.language] || c.name?.en || c.slug}</div>
                <div className="admin-item-sub">
                  <span className="admin-item-meta">{c.slug} · {c.scenario_count} {t("admin.scenarios").toLowerCase()}</span>
                </div>
              </div>
            </div>
            <div className="admin-item-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>{t("admin.edit")}</button>
              <button className="btn btn-danger-ghost btn-sm" onClick={() => remove(c)}>{t("admin.delete")}</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="muted">{t("admin.empty")}</p>}
      </div>

      {editing && (
        <CategoryForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CategoryForm({ initial, onClose, onSaved }) {
  const { t } = useTranslation();
  const [slug, setSlug] = useState(initial?.slug || "");
  const [icon, setIcon] = useState(initial?.icon || "");
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [name, setName] = useState({ ...EMPTY_TR, ...initial?.name });
  const [description, setDescription] = useState({ ...EMPTY_TR, ...initial?.description });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Order auto-increments on the server when creating; only sent when editing.
    const payload = { slug, icon, name, description };
    if (initial) payload.order = Number(order);
    try {
      if (initial) await adminApi.updateCategory(initial.id, payload);
      else await adminApi.createCategory(payload);
      onSaved();
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.slug?.[0] || data?.detail || t("admin.saveError"));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={initial ? t("admin.editCategory") : t("admin.newCategory")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t("admin.cancel")}</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "…" : t("admin.save")}
          </button>
        </>
      }
    >
      <form className="admin-form" onSubmit={submit}>
        <div className="form-row">
          <label className="field">
            <span>{t("admin.slug")}</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="passport-services" />
          </label>
          <label className="field field-sm">
            <span>{t("admin.icon")}</span>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🛂" />
          </label>
          {initial && (
            <label className="field field-sm">
              <span>{t("admin.order")}</span>
              <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
            </label>
          )}
        </div>
        <MultiLangField label={t("admin.name")} value={name} onChange={setName} />
        <MultiLangField label={t("admin.description")} value={description} onChange={setDescription} textarea rows={3} />
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}

/* --------------------------- Scenarios --------------------------- */
function ScenariosPanel({ prefill, onPrefillConsumed }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    adminApi.scenarios().then(({ data }) => setItems(data)).catch(() => setItems([]));
    adminApi.categories().then(({ data }) => setCategories(data)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  // C2 — a catalog gap was clicked: open the create form prefilled with the question.
  useEffect(() => {
    if (prefill) setEditing("new");
  }, [prefill]);

  const remove = async (s) => {
    if (!window.confirm(t("admin.confirmDeleteScenario"))) return;
    await adminApi.deleteScenario(s.id).catch(() => {});
    load();
  };

  if (!items) return <Spinner />;

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <h2>{t("admin.scenarios")}</h2>
        <button
          className="btn btn-primary"
          onClick={() => setEditing("new")}
          disabled={categories.length === 0}
          title={categories.length === 0 ? t("admin.needCategory") : ""}
        >
          + {t("admin.newScenario")}
        </button>
      </div>

      <div className="admin-grid">
        {items.map((s) => (
          <div className="admin-item" key={s.id}>
            <div className="admin-item-main">
              <span className="admin-item-icon">📄</span>
              <div className="admin-item-text">
                <div className="admin-item-title">{s.title?.[i18n.language] || s.title?.en || s.slug}</div>
                <div className="admin-item-sub">
                  <span className="admin-item-meta">{s.category_slug} · {s.slug}</span>
                  {!s.is_published && <span className="pill pill-draft">{t("admin.draft")}</span>}
                </div>
              </div>
            </div>
            <div className="admin-item-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>{t("admin.edit")}</button>
              <button className="btn btn-danger-ghost btn-sm" onClick={() => remove(s)}>{t("admin.delete")}</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="muted">{t("admin.empty")}</p>}
      </div>

      {editing && (
        <ScenarioForm
          initial={editing === "new" ? null : editing}
          prefillTitle={editing === "new" ? prefill : null}
          categories={categories}
          onClose={() => {
            setEditing(null);
            onPrefillConsumed?.();
          }}
          onSaved={() => {
            setEditing(null);
            onPrefillConsumed?.();
            load();
          }}
        />
      )}
    </div>
  );
}

function ScenarioForm({ initial, categories, onClose, onSaved, prefillTitle }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState(initial?.category || categories[0]?.id || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? true);
  const [tags, setTags] = useState((initial?.tags || []).join(", "));
  const [title, setTitle] = useState(
    // C2 — when opened from a catalog gap, seed every language with the question text.
    initial?.title
      ? { ...EMPTY_TR, ...initial.title }
      : prefillTitle
        ? { uz: prefillTitle, ru: prefillTitle, en: prefillTitle }
        : { ...EMPTY_TR }
  );
  const [body, setBody] = useState({ ...EMPTY_TR, ...initial?.body });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      category: Number(category),
      slug,
      is_published: isPublished,
      tags: tags.split(",").map((x) => x.trim()).filter(Boolean),
      title,
      body,
    };
    // Order auto-increments within the category on create; only sent when editing.
    if (initial) payload.order = Number(order);
    try {
      if (initial) await adminApi.updateScenario(initial.id, payload);
      else await adminApi.createScenario(payload);
      onSaved();
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.slug?.[0] || data?.category?.[0] || data?.detail || t("admin.saveError"));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={initial ? t("admin.editScenario") : t("admin.newScenario")}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t("admin.cancel")}</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "…" : t("admin.save")}
          </button>
        </>
      }
    >
      <form className="admin-form" onSubmit={submit}>
        <div className="form-row">
          <label className="field">
            <span>{t("admin.category")}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name?.en || c.slug}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("admin.slug")}</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="passport-renewal" />
          </label>
          {initial && (
            <label className="field field-sm">
              <span>{t("admin.order")}</span>
              <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
            </label>
          )}
        </div>

        <div className="form-row">
          <label className="field">
            <span>{t("admin.tags")}</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="passport, biometric" />
          </label>
          <label className="field checkbox-field">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            <span>{t("admin.published")}</span>
          </label>
        </div>

        <MultiLangField label={t("admin.scenarioTitle")} value={title} onChange={setTitle} />
        <MultiLangField label={t("admin.body")} value={body} onChange={setBody} textarea rows={10} />
        {error && <p className="form-error">{error}</p>}
      </form>
    </Modal>
  );
}


// ---- C3: Conversations viewer ----
function ConversationsPanel() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    adminApi
      .conversations(page)
      .then(({ data }) => active && setData(data))
      .catch(() => active && setData({ results: [], count: 0 }));
    return () => {
      active = false;
    };
  }, [page]);

  const fmt = (iso) => new Date(iso).toLocaleString(i18n.language);

  if (!data) return <Spinner />;
  const rows = data.results ?? [];

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <h2>{t("admin.conversations")}</h2>
        <span className="count-badge">{data.count ?? rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{t("admin.noConversations")}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("admin.user")}</th>
                <th>{t("admin.convTitle")}</th>
                <th>{t("admin.language")}</th>
                <th>{t("admin.messages")}</th>
                <th>{t("admin.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="row-click"
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(c.id);
                    }
                  }}
                >
                  <td>{c.user_email}</td>
                  <td>{c.title || t("admin.untitled")}</td>
                  <td>{c.language?.toUpperCase()}</td>
                  <td>{c.message_count}</td>
                  <td>{fmt(c.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(data.next || data.previous) && (
        <div className="pager">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={!data.previous}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("common.back")}
          </button>
          <span className="muted">{page}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={!data.next}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.next")}
          </button>
        </div>
      )}
      {openId != null && <ConversationModal id={openId} onClose={() => setOpenId(null)} />}
    </section>
  );
}

function ConversationModal({ id, onClose }) {
  const { t } = useTranslation();
  const [conv, setConv] = useState(null);

  useEffect(() => {
    let active = true;
    adminApi
      .conversation(id)
      .then(({ data }) => active && setConv(data))
      .catch(() => active && setConv({ messages: [] }));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <Modal title={conv?.title || t("admin.conversation")} onClose={onClose} wide>
      {!conv ? (
        <Spinner />
      ) : (
        <div className="admin-thread">
          {conv.messages.map((m) => (
            <div key={m.id} className="admin-thread-item">
              <MessageBubble role={m.role} content={m.content} sources={m.sources || []} />
              {m.feedback && (
                <span className={`fb-badge fb-${m.feedback.rating}`}>
                  {m.feedback.rating === "up" ? "👍" : "👎"}
                  {m.feedback.reason ? ` — ${m.feedback.reason}` : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---- C3: Usage statistics ----
function UsagePanel() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    setData(null);
    adminApi
      .analyticsUsage(days)
      .then(({ data }) => active && setData(data))
      .catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, [days]);

  const maxMsg = data ? Math.max(1, ...data.series.map((d) => d.messages)) : 1;

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <h2>{t("admin.usage")}</h2>
        <label className="field field-sm analytics-period">
          <span>{t("admin.period")}</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7</option>
            <option value={30}>30</option>
            <option value={90}>90</option>
          </select>
        </label>
      </div>
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="kpi-row">
            <div className="kpi-tile">
              <span className="kpi-value">{data.totals.messages}</span>
              <span className="kpi-label">{t("admin.messages")}</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-value">{data.totals.conversations}</span>
              <span className="kpi-label">{t("admin.conversationsShort")}</span>
            </div>
            <div className="kpi-tile">
              <span className="kpi-value">{data.totals.active_users}</span>
              <span className="kpi-label">{t("admin.activeUsers")}</span>
            </div>
          </div>

          <div className="analytics-grid">
            <section className="analytics-block">
              <h3>{t("admin.messagesPerDay")}</h3>
              <div className="bar-chart" role="img" aria-label={t("admin.messagesPerDay")}>
                {data.series.map((d) => (
                  <div
                    key={d.date}
                    className="bar"
                    style={{ height: `${Math.round((d.messages / maxMsg) * 100)}%` }}
                    title={`${d.date}: ${d.messages}`}
                  />
                ))}
              </div>
            </section>

            <section className="analytics-block">
              <h3>{t("admin.byLanguage")}</h3>
              {data.by_language.length === 0 ? (
                <p className="muted">—</p>
              ) : (
                <ul className="term-list">
                  {data.by_language.map((l) => (
                    <li key={l.language}>
                      <span>{l.language?.toUpperCase()}</span>
                      <span className="count-badge">{l.messages}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}

// ---- C3: System health ----
function SystemPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    adminApi
      .health()
      .then(({ data }) => active && setData(data))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (error) return <p className="form-error">{t("errors.generic")}</p>;
  if (!data) return <Spinner />;

  const embedOk = data.embeddings.present >= data.embeddings.expected && data.embeddings.expected > 0;

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <h2>{t("admin.system")}</h2>
      </div>
      <div className="status-grid">
        <div className={`status-card ${data.database.ok ? "ok" : "bad"}`}>
          <span className="status-label">{t("admin.database")}</span>
          <span className="status-value">{data.database.ok ? "OK" : "DOWN"}</span>
        </div>
        <div className={`status-card ${data.openai.mode === "live" ? "ok" : "warn"}`}>
          <span className="status-label">OpenAI</span>
          <span className="status-value">{data.openai.mode.toUpperCase()}</span>
        </div>
        <div className={`status-card ${embedOk ? "ok" : "warn"}`}>
          <span className="status-label">{t("admin.embeddings")}</span>
          <span className="status-value">
            {data.embeddings.present}/{data.embeddings.expected}
          </span>
        </div>
        <div className="status-card">
          <span className="status-label">{t("admin.rateLimit")}</span>
          <span className="status-value">{data.throttles.burst || "—"}</span>
        </div>
      </div>

      <div className="analytics-grid">
        <section className="analytics-block">
          <h3>{t("admin.totals")}</h3>
          <ul className="term-list">
            <li><span>{t("admin.users")}</span><span className="count-badge">{data.counts.users}</span></li>
            <li><span>{t("admin.conversationsShort")}</span><span className="count-badge">{data.counts.conversations}</span></li>
            <li><span>{t("admin.messages")}</span><span className="count-badge">{data.counts.messages}</span></li>
            <li><span>{t("admin.scenarios")}</span><span className="count-badge">{data.counts.scenarios_published}</span></li>
          </ul>
        </section>
      </div>
    </section>
  );
}
