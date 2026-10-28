import { useState } from "react";
import { useTranslation } from "react-i18next";

import Modal from "./Modal";

const ONBOARD_KEY = "govbot.onboarded.v1";

function readOnboarded() {
  try {
    return localStorage.getItem(ONBOARD_KEY) === "1";
  } catch {
    return false;
  }
}

/** A1 — short disclaimer that lives right above the chat input. */
export function AiDisclaimer() {
  const { t } = useTranslation();
  return (
    <p className="ai-disclaimer" role="note">
      <span aria-hidden="true">ⓘ</span> {t("trust.disclaimer")}
    </p>
  );
}

/**
 * A1 — three-step onboarding shown once before the first chat (pattern from GOV.UK Chat:
 * purpose & limits, double-check, how data is used). Dismissal is remembered per browser.
 */
export function AiOnboarding() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => !readOnboarded());
  if (!open) return null;

  const accept = () => {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* private mode — the dialog will simply show again next time */
    }
    setOpen(false);
  };

  return (
    <Modal
      title={t("trust.onboardTitle")}
      onClose={accept}
      footer={
        <button type="button" className="btn btn-primary" onClick={accept}>
          {t("trust.onboardAccept")}
        </button>
      }
    >
      <ol className="onboard-steps">
        {[1, 2, 3].map((n) => (
          <li key={n}>
            <h3>{t(`trust.onboard${n}Title`)}</h3>
            <p>{t(`trust.onboard${n}Body`)}</p>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
