import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES } from "../i18n";
import { useAuth } from "../auth/AuthContext";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { user, updatePreferredLanguage } = useAuth();

  const change = (code) => {
    i18n.changeLanguage(code);
    if (user) updatePreferredLanguage(code);
  };

  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          className={i18n.language === lang.code ? "lang-btn active" : "lang-btn"}
          aria-pressed={i18n.language === lang.code}
          onClick={() => change(lang.code)}
          title={lang.label}
        >
          {lang.short}
        </button>
      ))}
    </div>
  );
}
