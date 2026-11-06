import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/** #16 — a real "page not found" screen (3 languages), no illustration. */
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="page notfound">
      <p className="notfound-code" aria-hidden="true">404</p>
      <h1>{t("r6.notFoundTitle")}</h1>
      <p className="muted notfound-body">{t("r6.notFoundBody")}</p>
      <div className="notfound-actions">
        <Link to="/" className="btn btn-primary">{t("nav.home")}</Link>
        <Link to="/scenarios" className="btn btn-outline">{t("r6.notFoundCatalog")}</Link>
      </div>
    </div>
  );
}
