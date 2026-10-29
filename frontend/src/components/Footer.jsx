import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import HelpContacts from "./HelpContacts";
import Section from "./Section";

/** R2 — site footer: official hotlines + what GovBot is (and isn't) (WCAG 3.2.6). */
export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="site-footer st-footer" id="help">
      <Section tone="dark" eyebrow={t("studio.eyebrowHelp")} title={t("help.title")}>
        <HelpContacts compact />

        <div className="st-footer-cols">
          <div className="st-footer-col">
            <h3 className="st-footer-heading">{t("footer.aboutTitle")}</h3>
            <p className="st-footer-brand">GovBot</p>
            <p>{t("footer.about")}</p>
          </div>
          <nav className="st-footer-col" aria-label={t("footer.navTitle")}>
            <h3 className="st-footer-heading">{t("footer.navTitle")}</h3>
            <ul>
              <li><Link to="/">{t("nav.home")}</Link></li>
              <li><Link to="/scenarios">{t("footer.catalog")}</Link></li>
              <li><Link to="/chat">{t("nav.chat")}</Link></li>
              <li><Link to="/privacy">{t("footer.privacy")}</Link></li>
            </ul>
          </nav>
          <div className="st-footer-col">
            <h3 className="st-footer-heading">{t("footer.help")}</h3>
            <ul>
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
            <p className="help-source">{t("help.source")}</p>
          </div>
        </div>
      </Section>
    </footer>
  );
}
