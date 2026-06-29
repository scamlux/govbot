import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { adminApi } from "../api/endpoints";
import Spinner from "../components/Spinner";
import Modal from "../components/Modal";
import MultiLangField from "../components/admin/MultiLangField";

const EMPTY_TR = { uz: "", ru: "", en: "" };

export default function Admin() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("users");

  return (
    <div className="page admin">
      <div className="admin-head">
        <h1>{t("admin.title")}</h1>
        <p className="muted">{t("admin.subtitle")}</p>
      </div>

      <div className="admin-tabs" role="tablist">
        {["users", "categories", "scenarios"].map((key) => (
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
      {tab === "categories" && <CategoriesPanel />}
      {tab === "scenarios" && <ScenariosPanel />}
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
function ScenariosPanel() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState(null);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    adminApi.scenarios().then(({ data }) => setItems(data)).catch(() => setItems([]));
    adminApi.categories().then(({ data }) => setCategories(data)).catch(() => {});
  }, []);
  useEffect(load, [load]);

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
          categories={categories}
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

function ScenarioForm({ initial, categories, onClose, onSaved }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState(initial?.category || categories[0]?.id || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? true);
  const [tags, setTags] = useState((initial?.tags || []).join(", "));
  const [title, setTitle] = useState({ ...EMPTY_TR, ...initial?.title });
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
