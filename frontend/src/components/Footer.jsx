import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import HelpContacts from "./HelpContacts";

/** R2 — site footer: what GovBot is (and isn't) + consistent help (WCAG 3.2.6). */
export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="site-footer" id="help">
      <div className="site-footer-inner">
        <div className="site-footer-about">
          <p className="site-footer-brand">GovBot</p>
          <p>{t("footer.about")}</p>
          <nav aria-label={t("footer.help")} className="site-footer-links">
            <Link to="/scenarios">{t("footer.catalog")}</Link>
            <Link to="/privacy">{t("footer.privacy")}</Link>
          </nav>
        </div>
        <div className="site-footer-help">
          <h2 className="site-footer-title">{t("help.title")}</h2>
          <HelpContacts />
          <p className="help-source">{t("help.source")}</p>
        </div>
      </div>
    </footer>
  );
}
