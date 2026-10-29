import { useTranslation } from "react-i18next";

/**
 * C6 / R2 — official contact lines. Numbers verified against
 * https://my.gov.uz/ru/for-foreigners (SOS 112, tourist helpline 1173,
 * my.gov.uz support 1242) — re-check that page if they ever change.
 */
export const OFFICIAL_LINES = [
  { key: "emergency", number: "112" },
  { key: "tourist", number: "1173" },
  { key: "portal", number: "1242" },
];

export default function HelpContacts({ compact = false, intro }) {
  const { t } = useTranslation();
  return (
    <div className={compact ? "help-contacts compact" : "help-contacts"}>
      {intro && <p className="help-intro">{intro}</p>}
      <ul className="help-lines">
        {OFFICIAL_LINES.map((line) => (
          <li key={line.key}>
            <a href={`tel:${line.number}`} className="help-line">
              <span className="help-number">{line.number}</span>
              <span className="help-label">{t(`help.${line.key}`)}</span>
            </a>
          </li>
        ))}
      </ul>
      {!compact && (
        <ul className="help-links">
          <li>
            <a href="https://my.gov.uz" target="_blank" rel="noopener noreferrer">
              {t("help.portalLink")}&nbsp;↗
            </a>
          </li>
          <li>
            <a href="https://my.gov.uz/ru/for-foreigners" target="_blank" rel="noopener noreferrer">
              {t("help.foreignersLink")}&nbsp;↗
            </a>
          </li>
        </ul>
      )}
    </div>
  );
}
