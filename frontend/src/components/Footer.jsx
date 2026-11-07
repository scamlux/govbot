import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import HelpContacts from "./HelpContacts";

/** Light compact footer: hotlines in one row, three short link columns, legal line. */
export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="site-footer" id="help">
      <div className="st-container footer-body">
        <HelpContacts compact />

        <div className="footer-cols">
          <nav className="footer-col" aria-label={t("footer.navTitle")}>
            <h2 className="footer-heading">{t("footer.navTitle")}</h2>
            <ul>
              <li><Link to="/">{t("nav.home")}</Link></li>
              <li><Link to="/scenarios">{t("footer.catalog")}</Link></li>
              <li><Link to="/chat">{t("nav.chat")}</Link></li>
            </ul>
          </nav>
          <div className="footer-col">
            <h2 className="footer-heading">{t("footer.help")}</h2>
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
          </div>
          <nav className="footer-col" aria-label={t("gov.legalNav")}>
            <h2 className="footer-heading">{t("gov.legalNav")}</h2>
            <ul>
              <li><Link to="/privacy">{t("footer.privacy")}</Link></li>
              {/* Terms of use: dedicated page is pending — until then it points at /privacy. */}
              <li><Link to="/privacy">{t("gov.terms")}</Link></li>
            </ul>
          </nav>
        </div>

        <div className="footer-legal">
          <p>{t("footer.about")}</p>
          <p>{t("gov.legal")}</p>
        </div>
      </div>
    </footer>
  );
}
