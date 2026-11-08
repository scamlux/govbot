import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/AuthContext";
import { useConfig } from "../config/ConfigContext";
import { useSpeechInput } from "../hooks/useSpeechInput";
import { askAiTarget } from "../utils/pendingQuestion";
import Icon from "../components/Icon";
import Section from "../components/Section";
import { ClosingArch, GirihFrieze, HeroArch } from "../components/Ornaments";

// Cards link to a role filter where the catalog has one, otherwise to the closest category.
const AUDIENCES = [
  { key: "citizen", icon: "aud-citizen", to: "/scenarios?audience=citizen" },
  { key: "youth", icon: "aud-student", to: "/scenarios?category=identity-documents" },
  { key: "elder", icon: "aud-elder", to: "/scenarios?category=healthcare" },
  { key: "business", icon: "aud-business", to: "/scenarios?category=business" },
  { key: "resident", icon: "aud-resident", to: "/scenarios?audience=resident" },
  { key: "tourist", icon: "aud-tourist", to: "/scenarios?audience=tourist" },
];
const ACCESS = [
  { key: "accessVoice", icon: "mic" },
  { key: "accessFont", glyph: "Aa" },
  { key: "accessPlain", icon: "lines" },
  { key: "accessLang", glyph: "UZ · RU · EN", small: true },
];
const REGIONS = ["qq", "xr", "nv", "bx", "sm", "qa", "su", "jz", "sr", "tv", "ts", "nm", "an", "fg"];
const HIGHLIGHT_REGION = "ts";
const STEPS = ["step1", "step2", "step3"];
const SAMPLE_CHIPS = ["my.gov.uz", "sampleChipDocs", "sampleChipVoice"];

function AskBox({ canChat }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const voice = useSpeechInput({ lang: i18n.language, onResult: setQuestion });

  const submit = (event) => {
    event.preventDefault();
    const target = askAiTarget({ canChat, question: question.trim() });
    navigate(target.to, { state: target.state });
  };

  return (
    <form className="lp-ask" onSubmit={submit}>
      <label htmlFor="lp-ask-input" className="visually-hidden">{t("civic.landing.askLabel")}</label>
      <input
        id="lp-ask-input"
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={t("civic.landing.askPlaceholder")}
        autoComplete="off"
      />
      {voice.supported ? (
        <button
          type="button"
          className={voice.listening ? "lp-ask-mic listening" : "lp-ask-mic"}
          aria-label={t("civic.landing.mic")}
          aria-pressed={voice.listening}
          onClick={voice.toggle}
        >
          <Icon name="mic" size={20} />
        </button>
      ) : (
        <Link to="/chat" className="lp-ask-mic" aria-label={t("civic.landing.mic")}>
          <Icon name="mic" size={20} />
        </Link>
      )}
      <button type="submit" className="lp-ask-go">
        {t("civic.landing.ask")} <Icon name="arrow" size={18} />
      </button>
    </form>
  );
}

function SampleAnswer() {
  const { t } = useTranslation();
  return (
    <section className="lp-sample-wrap" aria-label={t("civic.landing.sampleLabel")}>
      <div className="lp-sample">
        <span className="lp-sample-tag">{t("civic.landing.sampleTag")}</span>
        <div className="lp-bubble lp-bubble-user">{t("civic.landing.sampleQ")}</div>
        <div className="lp-bubble lp-bubble-bot">
          <span>{t("civic.landing.sampleA")}</span>
          <ul className="lp-chips">
            {SAMPLE_CHIPS.map((key) => (
              <li key={key} className="lp-chip">
                {key === "my.gov.uz" ? key : t(`civic.landing.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { guest_chat: guestChat } = useConfig();
  const canChat = Boolean(user) || Boolean(guestChat);
  const showFree = !user && Boolean(guestChat);

  return (
    <div className="landing lp">
      <GirihFrieze />

      <section className="lp-hero" aria-labelledby="hero-title">
        <HeroArch />
        <div className="lp-hero-inner">
          <span className="lp-eyebrow">
            <span className="lp-dot" aria-hidden="true" />
            {t("civic.landing.eyebrow")}
          </span>
          <h1 id="hero-title" className="lp-h1">
            {t("civic.landing.h1a")}{" "}
            <br />
            <span className="lp-accent">{t("civic.landing.h1b")}</span>
          </h1>
          <p className="lp-lead">{t("civic.landing.lead")}</p>
          <AskBox canChat={canChat} />
          {showFree && <p className="lp-note">{t("civic.landing.free")}</p>}
        </div>
      </section>

      <SampleAnswer />

      <Section id="everyone" title={t("civic.landing.everyoneTitle")} lead={t("civic.landing.everyoneLead")}>
        <ul className="lp-flex lp-flex-3">
          {AUDIENCES.map(({ key, icon, to }) => (
            <li key={key}>
              <Link to={to} className="lp-card lp-card-link">
                <span className="lp-card-icon"><Icon name={icon} size={34} /></span>
                <h3>{t(`civic.landing.${key}Title`)}</h3>
                <p>{t(`civic.landing.${key}Text`)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="access" title={t("civic.landing.accessTitle")}>
        <ul className="lp-flex lp-flex-4">
          {ACCESS.map(({ key, icon, glyph, small }) => (
            <li key={key}>
              <div className="lp-card lp-card-tall lp-card-access">
                {icon ? (
                  <span className="lp-card-icon lp-card-icon-lg"><Icon name={icon} size={40} /></span>
                ) : (
                  <span className={small ? "lp-glyph lp-glyph-sm" : "lp-glyph"} aria-hidden="true">{glyph}</span>
                )}
                <h3>{t(`civic.landing.${key}`)}</h3>
              </div>
            </li>
          ))}
        </ul>
        <p className="lp-foot-note">{t("civic.landing.accessNote")}</p>
      </Section>

      <Section id="regions" band title={t("civic.landing.regionsTitle")} lead={t("civic.landing.regionsLead")}>
        <ul className="lp-pills">
          {REGIONS.map((key) => (
            <li key={key} className={key === HIGHLIGHT_REGION ? "lp-pill is-on" : "lp-pill"}>
              {t(`civic.regions.${key}`)}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="how" title={t("civic.landing.stepsTitle")}>
        <ol className="lp-flex lp-flex-3 lp-steps">
          {STEPS.map((key, i) => (
            <li key={key}>
              <div className="lp-card">
                <span className="lp-num" aria-hidden="true">{i + 1}</span>
                <h3>{t(`civic.landing.${key}Title`)}</h3>
                <p>{t(`civic.landing.${key}Text`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <section className="lp-closing" aria-labelledby="closing-title">
        <ClosingArch />
        <h2 id="closing-title" className="lp-h1 lp-h1-sm">
          {t("civic.landing.closing1")}{" "}
          <br />
          {t("civic.landing.closing2")}
        </h2>
        <p className="lp-lead">
          {showFree ? t("civic.landing.closingLeadFree") : t("civic.landing.closingLead")}
        </p>
        <div className="lp-actions">
          <Link to="/chat" className="lp-btn lp-btn-primary">{t("civic.landing.closingCta")}</Link>
          <Link to="/scenarios" className="lp-btn lp-btn-ghost">{t("civic.landing.closingTopics")}</Link>
        </div>
      </section>
    </div>
  );
}
