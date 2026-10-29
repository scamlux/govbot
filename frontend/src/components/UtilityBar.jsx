import { useState } from "react";
import { useTranslation } from "react-i18next";

import { applyA11y, readA11y, saveA11y } from "../theme/a11y";
import Icon from "./Icon";
import LanguageSwitcher from "./LanguageSwitcher";

/** Flag-colour hairline (blue / white with thin red dividers / green). Decorative. */
export function Tricolor({ className = "" }) {
  return <div className={`tricolor ${className}`.trim()} aria-hidden="true" />;
}

/**
 * Round 4 — thin official-style utility bar above the navbar: service name + "official
 * sources" note, hotline 1242, low-vision toggle, language switcher. Not rendered on /embed.
 */
export default function UtilityBar() {
  const { t } = useTranslation();
  const [high, setHigh] = useState(readA11y);

  const toggle = () => {
    const next = !high;
    setHigh(next);
    applyA11y(next);
    saveA11y(next);
  };

  return (
    <div className="utilbar-wrap">
      <div className="utilbar">
        <div className="utilbar-inner">
          <p className="utilbar-note">
            <span className="utilbar-service">{t("gov.service")}</span>
            <span className="utilbar-sep" aria-hidden="true">·</span>
            <span className="utilbar-short">{t("gov.note")}</span>
          </p>
          <div className="utilbar-actions">
            <a href="tel:1242" className="utilbar-btn" aria-label={t("gov.hotline")} title={t("gov.hotline")}>
              <Icon name="phone" size={16} />
              <span className="utilbar-hotline">1242</span>
            </a>
            <button
              type="button"
              className="utilbar-btn utilbar-a11y"
              aria-pressed={high}
              aria-label={t("gov.a11yLabel")}
              title={t("gov.a11yLabel")}
              onClick={toggle}
            >
              <Icon name="eye" size={16} />
              <span className="utilbar-a11y-text">{t("gov.a11y")}</span>
            </button>
            <div className="utilbar-lang">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </div>
      <Tricolor />
    </div>
  );
}
