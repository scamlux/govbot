import { useTranslation } from "react-i18next";

export default function Spinner({ full = false, label }) {
  const { t } = useTranslation();
  return (
    <div className={full ? "spinner-wrap spinner-full" : "spinner-wrap"} role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="spinner-label">{label ?? t("common.loading")}</span>
    </div>
  );
}
