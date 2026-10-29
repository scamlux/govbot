import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { useConfig } from "../config/ConfigContext";
import { AiDisclaimer } from "../components/AiNotice";
import Spinner from "../components/Spinner";

const Chat = lazy(() => import("./Chat"));

/**
 * D2 — embeddable widget page (`/embed`), loaded in an iframe by `public/widget.js`.
 *
 * It is the guest chat without the site chrome. Because the iframe content comes from the
 * GovBot origin, the host site needs no CORS access to the API. When guest chat is off on
 * the backend, the widget shows a link to the full site instead of a dead input.
 */
export default function Embed() {
  const { t } = useTranslation();
  const config = useConfig();
  const site = window.location.origin;

  if (!config.loaded) return <Spinner full />;

  if (!config.guest_chat) {
    return (
      <div className="embed-fallback">
        <p className="embed-brand">GovBot</p>
        <p>{t("landing.heroSubtitle")}</p>
        <a className="btn btn-primary" href={`${site}/`} target="_blank" rel="noopener noreferrer">
          {t("landing.ctaChat")}&nbsp;↗
        </a>
        <AiDisclaimer />
      </div>
    );
  }

  return (
    <div className="embed-shell">
      <Suspense fallback={<Spinner full />}>
        <Chat guest embedded />
      </Suspense>
    </div>
  );
}
