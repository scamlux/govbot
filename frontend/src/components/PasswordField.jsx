import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import Icon from "./Icon";

/** #20 — password input with an accessible show/hide toggle. */
export default function PasswordField({ label, hint, value, onChange, autoComplete, minLength, required = true }) {
  const { t } = useTranslation();
  const id = useId();
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? t("r6.hidePassword") : t("r6.showPassword");

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={onChange}
          placeholder="••••••••"
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={20} />
        </button>
      </div>
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  );
}
