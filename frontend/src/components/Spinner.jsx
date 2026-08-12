import { useTranslation } from "react-i18next";

import GridSpinner from "./GridSpinner";

export default function Spinner({ full = false, label }) {
  const { t } = useTranslation();
  return (
    <div className={full ? "spinner-wrap spinner-full" : "spinner-wrap"} role="status">
      <GridSpinner size={full ? 48 : 34} />
      <span className="spinner-label">{label ?? t("common.loading")}</span>
    </div>
  );
}
