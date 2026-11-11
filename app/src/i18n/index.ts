import i18n from "i18next";
import { getLocales } from "expo-localization";
import { initReactI18next } from "react-i18next";

import { authApi } from "../api/endpoints";
import { setApiLanguage } from "../api/http";
import { tokenStore } from "../api/tokens";
import { DEFAULT_LANG, SUPPORTED_LANGS, type Lang } from "../config";
import { useSettings } from "../state/settings";
import en from "./en.json";
import mobileEn from "./mobile.en.json";
import mobileRu from "./mobile.ru.json";
import mobileUz from "./mobile.uz.json";
import ru from "./ru.json";
import uz from "./uz.json";

export const isLang = (value: unknown): value is Lang =>
  typeof value === "string" && (SUPPORTED_LANGS as readonly string[]).includes(value);

/** Web strings are shared verbatim; app-only strings live under the `m.` prefix. */
export const resources = {
  uz: { translation: { ...uz, m: mobileUz } },
  ru: { translation: { ...ru, m: mobileRu } },
  en: { translation: { ...en, m: mobileEn } },
} as const;

/** Saved setting -> device locale (uz/ru/en) -> uz. */
export function resolveInitialLanguage(saved: Lang | null = useSettings.getState().language): Lang {
  if (saved) return saved;
  try {
    for (const locale of getLocales()) {
      const code = locale.languageCode?.toLowerCase();
      if (isLang(code)) return code;
    }
  } catch {
    /* no locale info: fall through to default */
  }
  return DEFAULT_LANG;
}

export function initI18n(lang: Lang = resolveInitialLanguage()): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: lang,
      fallbackLng: [DEFAULT_LANG, "en", "ru"],
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  setApiLanguage(lang);
  return i18n;
}

/**
 * Switch UI language: persists the choice, retargets Accept-Language and, when signed in,
 * PATCHes `/auth/me/` like the web does (a failed sync never blocks the switch).
 */
export async function applyLanguage(lang: Lang): Promise<void> {
  useSettings.getState().setLanguage(lang);
  setApiLanguage(lang);
  await i18n.changeLanguage(lang);
}

export async function changeLanguage(lang: Lang): Promise<void> {
  await applyLanguage(lang);
  if (!tokenStore.getAccess()) return;
  try {
    await authApi.updateMe({ preferred_language: lang });
  } catch {
    /* offline or expired: the local choice still wins */
  }
}

export default i18n;
