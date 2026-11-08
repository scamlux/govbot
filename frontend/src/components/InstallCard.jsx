import { useTranslation } from "react-i18next";

import { usePwaInstall } from "../hooks/usePwaInstall";
import Icon from "./Icon";

/** "Install app" card for /guide. Hidden once the app is installed / opened standalone. */
export default function InstallCard() {
  const { t } = useTranslation();
  const { installed, canPrompt, ios, install } = usePwaInstall();
  if (installed) return null;

  let action;
  if (canPrompt) {
    action = (
      <button type="button" className="btn btn-primary lp-install-btn" onClick={install}>
        <Icon name="download" size={18} /> {t("civic.guide.installButton")}
      </button>
    );
  } else if (ios) {
    action = <p className="lp-install-hint">{t("civic.guide.installIos")}</p>;
  } else {
    action = <p className="lp-install-hint">{t("civic.guide.installOther")}</p>;
  }

  return (
    <section className="lp-install" aria-labelledby="install-title">
      <span className="lp-install-mark" aria-hidden="true">
        <Icon name="download" size={28} />
      </span>
      <div className="lp-install-body">
        <h2 id="install-title">{t("civic.guide.installTitle")}</h2>
        <p>{t("civic.guide.installText")}</p>
        {action}
      </div>
    </section>
  );
}
