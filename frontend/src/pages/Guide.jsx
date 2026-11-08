import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useConfig } from "../config/ConfigContext";
import { useAuth } from "../auth/AuthContext";
import InstallCard from "../components/InstallCard";

/** Mini phone screens, drawn in CSS: purely decorative (the step text carries the meaning). */
function Phone({ children }) {
  return (
    <div className="lp-phone-stage" aria-hidden="true">
      <div className="lp-phone">{children}</div>
    </div>
  );
}

function ScreenAsk({ t }) {
  return (
    <>
      <b className="lp-ph-title">{t("civic.guide.phHello")}</b>
      <div className="lp-ph-input">
        {t("civic.guide.phInput")}
        <span className="lp-ph-dot" />
      </div>
      <div className="lp-ph-row"><span /><span /></div>
    </>
  );
}

function ScreenSources({ t }) {
  return (
    <>
      <span className="lp-ph-line">{t("civic.guide.phStep1")}</span>
      <span className="lp-ph-line">{t("civic.guide.phStep2")}</span>
      <span className="lp-ph-line">{t("civic.guide.phStep3")}</span>
      <div className="lp-ph-chips">
        <span className="lp-ph-chip is-ring">my.gov.uz</span>
        <span className="lp-ph-chip">{t("civic.guide.phCatalog")}</span>
      </div>
    </>
  );
}

function ScreenDocs({ t }) {
  const docs = [
    { key: "phDoc1", done: true },
    { key: "phDoc2", done: true },
    { key: "phDoc3", done: false },
  ];
  return (
    <>
      <b className="lp-ph-title">{t("civic.guide.phDocs")}</b>
      {docs.map(({ key, done }) => (
        <span key={key} className="lp-ph-doc">
          <span className={done ? "lp-ph-check is-done" : "lp-ph-check"} />
          {t(`civic.guide.${key}`)}
        </span>
      ))}
      <div className="lp-ph-bar"><span /></div>
    </>
  );
}

function ScreenRemind({ t }) {
  return (
    <div className="lp-ph-toast">
      <span className="lp-ph-toast-head">{t("civic.guide.phRemind")}</span>
      <b>{t("civic.guide.phRemindText")}</b>
      <span className="lp-ph-btn">{t("civic.guide.phCalendar")}</span>
    </div>
  );
}

function ScreenTune({ t }) {
  return (
    <>
      <div className="lp-ph-seg"><span className="is-on">UZ</span><span>RU</span><span>EN</span></div>
      <span className="lp-ph-line lp-ph-big">Aa <em>{t("civic.guide.phBigFont")}</em></span>
      <span className="lp-ph-line">{t("civic.guide.phPlain")}</span>
    </>
  );
}

function ScreenSave({ t }) {
  return (
    <>
      <b className="lp-ph-title">{t("civic.guide.phSave")}</b>
      <span className="lp-ph-btn is-primary">{t("civic.guide.phEmail")}</span>
    </>
  );
}

const STEPS = [
  { key: "g1", Screen: ScreenAsk },
  { key: "g2", Screen: ScreenSources },
  { key: "g3", Screen: ScreenDocs },
  { key: "g4", Screen: ScreenRemind },
  { key: "g5", Screen: ScreenTune },
  { key: "g6", Screen: ScreenSave },
];

export default function Guide() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { guest_chat: guestChat } = useConfig();
  const showFree = !user && Boolean(guestChat);

  return (
    <div className="lp lp-guide">
      <header className="lp-page-hero">
        <h1 className="lp-h1 lp-h1-md">{t("civic.guide.h1")}</h1>
        <p className="lp-lead">
          {t("civic.guide.lead")}
          {showFree && t("civic.guide.leadFree")}
        </p>
      </header>

      <section className="lp-sec" aria-label={t("civic.guide.h1")}>
        <div className="lp-wrap">
          <ol className="lp-flex lp-flex-3 lp-guide-steps">
            {STEPS.map(({ key, Screen }, i) => (
              <li key={key}>
                <div className="lp-card lp-guide-card">
                  <Phone><Screen t={t} /></Phone>
                  <span className="lp-step-label">{t("civic.guide.stepN", { n: i + 1 })}</span>
                  <h2 className="lp-h3">{t(`civic.guide.${key}`)}</h2>
                  <p>{t(`civic.guide.${key}Text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="lp-sec lp-sec-tight">
        <div className="lp-wrap lp-wrap-narrow">
          <InstallCard />
        </div>
      </section>

      <section className="lp-closing" aria-labelledby="guide-cta">
        <h2 id="guide-cta" className="lp-h1 lp-h1-sm">{t("civic.guide.ready")}</h2>
        <div className="lp-actions">
          <Link to="/chat" className="lp-btn lp-btn-primary">{t("civic.guide.ask")}</Link>
        </div>
      </section>
    </div>
  );
}
