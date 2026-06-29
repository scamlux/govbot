import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="page notfound">
      <h1>404</h1>
      <p className="muted">{t("scenarios.noResults")}</p>
      <Link to="/" className="btn btn-primary">{t("nav.home")}</Link>
    </div>
  );
}
