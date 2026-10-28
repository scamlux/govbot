import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import ru from "./ru.json";
import uz from "./uz.json";

export const SUPPORTED_LANGUAGES = [
  { code: "uz", label: "O'zbekcha", short: "UZ" },
  { code: "ru", label: "Русский", short: "RU" },
  { code: "en", label: "English", short: "EN" },
];

const STORAGE_KEY = "govbot.lang";

const isSupported = (code) => SUPPORTED_LANGUAGES.some((l) => l.code === code);

function initialLanguage() {
  // D2 — the embed widget passes ?lang=… so the iframe matches the host page.
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("lang");
    if (isSupported(fromQuery)) return fromQuery;
  } catch {
    /* no window.location in some test environments */
  }
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage blocked (e.g. third-party iframe in Safari) */
  }
  if (isSupported(saved)) return saved;
  return "uz";
}

i18n.use(initReactI18next).init({
  resources: {
    uz: { translation: uz },
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: initialLanguage(),
  fallbackLng: "uz",
  interpolation: { escapeValue: false },
});

// D2 — inside the widget iframe the language comes from the host page; don't overwrite
// the visitor's saved choice for the main site.
const isEmbed = () => {
  try {
    return window.location.pathname.startsWith("/embed");
  } catch {
    return false;
  }
};

i18n.on("languageChanged", (lng) => {
  try {
    if (!isEmbed()) localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* storage blocked — language just isn't remembered */
  }
  document.documentElement.setAttribute("lang", lng);
});

document.documentElement.setAttribute("lang", i18n.language);

export default i18n;
