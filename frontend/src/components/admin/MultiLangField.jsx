import { useState } from "react";

import { SUPPORTED_LANGUAGES } from "../../i18n";

/**
 * Edits a {uz, ru, en} translations object with a small language tab bar.
 * `value` is the object; `onChange(next)` returns the updated object.
 */
export default function MultiLangField({ label, value, onChange, textarea = false, rows = 8 }) {
  const [active, setActive] = useState("uz");
  const current = value?.[active] ?? "";

  const update = (text) => onChange({ ...value, [active]: text });

  return (
    <div className="ml-field">
      <div className="ml-head">
        <span className="ml-label">{label}</span>
        <div className="ml-tabs">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              type="button"
              key={l.code}
              className={active === l.code ? "ml-tab active" : "ml-tab"}
              onClick={() => setActive(l.code)}
            >
              {l.short}
              {value?.[l.code]?.trim() ? <span className="ml-dot" /> : null}
            </button>
          ))}
        </div>
      </div>
      {textarea ? (
        <textarea
          className="ml-input"
          rows={rows}
          value={current}
          onChange={(e) => update(e.target.value)}
          placeholder={`${label} (${active.toUpperCase()}) — markdown supported`}
        />
      ) : (
        <input
          className="ml-input"
          value={current}
          onChange={(e) => update(e.target.value)}
          placeholder={`${label} (${active.toUpperCase()})`}
        />
      )}
    </div>
  );
}
