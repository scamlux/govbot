import { useState } from "react";
import { useTranslation } from "react-i18next";

import { applyA11y, readA11y, saveA11y } from "../theme/a11y";
import Icon from "./Icon";

/** Compact header utilities: hotline 1242 and the low-vision toggle. */
export default function HeaderTools() {
  const { t } = useTranslation();
  const [high, setHigh] = useState(readA11y);

  const toggle = () => {
    const next = !high;
    setHigh(next);
    applyA11y(next);
    saveA11y(next);
  };

  return (
    <div className="header-tools">
      <a href="tel:1242" className="tool-btn tool-hotline" aria-label={t("gov.hotline")} title={t("gov.hotline")}>
        <Icon name="phone" size={20} />
        <span className="tool-hotline-num">1242</span>
      </a>
      <button
        type="button"
        className="tool-btn tool-a11y"
        aria-pressed={high}
        aria-label={t("gov.a11yLabel")}
        title={t("gov.a11yLabel")}
        onClick={toggle}
      >
        <Icon name="eye" size={20} />
      </button>
    </div>
  );
}
