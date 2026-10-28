import { useState } from "react";
import { useTranslation } from "react-i18next";

import { authApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import Modal from "../components/Modal";
import { useTheme, ACCENTS, FONT_SCALES, CHAT_BACKGROUNDS } from "../theme/ThemeContext";
import { SUPPORTED_LANGUAGES } from "../i18n";

// R1 — kept in sync with the (contrast-fixed) accents in styles/upgrades.css.
const ACCENT_HEX = {
  teal: "#0c6c8a",
  blue: "#2559c9",
  violet: "#6544d6",
  green: "#15803d",
  rose: "#c0306c",
  amber: "#955a0b",
};
// R1 — screen readers announce a colour name, not the internal key.
const ACCENT_NAMES = {
  uz: { teal: "Moviy-yashil", blue: "Ko'k", violet: "Binafsha", green: "Yashil", rose: "Pushti", amber: "Qahrabo" },
  ru: { teal: "Бирюзовый", blue: "Синий", violet: "Фиолетовый", green: "Зелёный", rose: "Розовый", amber: "Янтарный" },
  en: { teal: "Teal", blue: "Blue", violet: "Violet", green: "Green", rose: "Rose", amber: "Amber" },
};

/** F3 — download my data / delete my account. */
function PrivacySection() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    const { data } = await authApi.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "govbot-my-data.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const deleteAccount = async () => {
    setBusy(true);
    setError("");
    try {
      await authApi.deleteAccount(password);
      logout({ revoke: false }); // tokens were revoked server-side
    } catch {
      setError(t("profile.deleteFailed"));
      setBusy(false);
    }
  };

  return (
    <section className="admin-card danger-zone" aria-labelledby="privacy-title">
      <div className="admin-card-head">
        <h2 id="privacy-title">{t("profile.privacy")}</h2>
      </div>
      <p className="muted">{t("profile.privacyHint")}</p>
      <div className="profile-actions">
        <button type="button" className="btn btn-outline" onClick={exportData}>
          ⬇ {t("profile.export")}
        </button>
        <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirming(true)}>
          {t("profile.deleteAccount")}
        </button>
      </div>
      {confirming && (
        <Modal
          title={t("profile.deleteConfirmTitle")}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!password || busy}
                onClick={deleteAccount}
              >
                {t("profile.deleteAccount")}
              </button>
            </>
          }
        >
          <p>{t("profile.deleteConfirmBody")}</p>
          <label className="field">
            <span>{t("auth.password")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
        </Modal>
      )}
    </section>
  );
}

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, updateProfile } = useAuth();
  const theme = useTheme();
  const accentNames = ACCENT_NAMES[i18n.language] || ACCENT_NAMES.en;

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const saveAccount = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await updateProfile({ full_name: fullName.trim() });
      setSaved(true);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  const changeLanguage = async (code) => {
    i18n.changeLanguage(code);
    try {
      await updateProfile({ preferred_language: code });
    } catch {
      /* non-fatal — UI language already switched */
    }
  };

  return (
    <div className="page profile">
      <div className="section-head">
        <h1>{t("profile.title")}</h1>
        <p className="muted">{t("profile.subtitle")}</p>
      </div>

      {/* ---- Account ---- */}
      <section className="admin-card">
        <div className="admin-card-head">
          <h2>{t("profile.account")}</h2>
        </div>
        <form className="profile-form" onSubmit={saveAccount}>
          <label className="field">
            <span>{t("profile.email")}</span>
            <input type="email" value={user?.email || ""} disabled />
          </label>
          <label className="field">
            <span>{t("profile.name")}</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("profile.namePlaceholder")}
              maxLength={120}
            />
          </label>
          <div className="field">
            <span>{t("profile.language")}</span>
            <div className="seg">
              {SUPPORTED_LANGUAGES.map((l) => (
                <button
                  type="button"
                  key={l.code}
                  className={i18n.language === l.code ? "seg-btn active" : "seg-btn"}
                  aria-pressed={i18n.language === l.code}
                  onClick={() => changeLanguage(l.code)}
                >
                  {l.short}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="profile-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t("common.loading") : t("profile.save")}
            </button>
            {saved && <span className="save-ok">✓ {t("profile.saved")}</span>}
          </div>
        </form>
      </section>

      {/* ---- Appearance (Telegram-style) ---- */}
      <section className="admin-card">
        <div className="admin-card-head">
          <h2>{t("profile.appearance")}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={theme.reset}>
            {t("profile.reset")}
          </button>
        </div>

        <div className="field">
          <span>{t("profile.theme")}</span>
          <div className="seg">
            {["light", "dark", "system"].map((m) => (
              <button
                type="button"
                key={m}
                className={theme.mode === m ? "seg-btn active" : "seg-btn"}
                aria-pressed={theme.mode === m}
                onClick={() => theme.set({ mode: m })}
              >
                {t(`profile.theme_${m}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>{t("profile.accent")}</span>
          <div className="swatch-row">
            {ACCENTS.map((a) => (
              <button
                type="button"
                key={a}
                className={theme.accent === a ? "swatch active" : "swatch"}
                style={{ "--sw": ACCENT_HEX[a] }}
                aria-label={accentNames[a]}
                title={accentNames[a]}
                aria-pressed={theme.accent === a}
                onClick={() => theme.set({ accent: a })}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <span>{t("profile.fontSize")}</span>
          <div className="seg">
            {FONT_SCALES.map((f) => (
              <button
                type="button"
                key={f}
                className={theme.font === f ? "seg-btn active" : "seg-btn"}
                aria-pressed={theme.font === f}
                onClick={() => theme.set({ font: f })}
              >
                {t(`profile.font_${f}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>{t("profile.chatBg")}</span>
          <div className="seg seg-wrap">
            {CHAT_BACKGROUNDS.map((b) => (
              <button
                type="button"
                key={b}
                className={theme.chatBg === b ? "seg-btn active" : "seg-btn"}
                aria-pressed={theme.chatBg === b}
                onClick={() => theme.set({ chatBg: b })}
              >
                {t(`profile.bg_${b}`)}
              </button>
            ))}
          </div>
        </div>

        <p className="muted profile-hint">{t("profile.appearanceHint")}</p>
      </section>

      <PrivacySection />
    </div>
  );
}
