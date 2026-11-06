import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/** Route pattern -> i18n key of the localized document title (#21). */
export const TITLE_KEYS = [
  ["/scenarios/", null],
  ["/scenarios", "r6.docCatalog"],
  ["/login", "r6.docLogin"],
  ["/register", "r6.docRegister"],
  ["/chat", "r6.docChat"],
  ["/profile", "r6.docProfile"],
  ["/privacy", "r6.docPrivacy"],
  ["/admin", "r6.docAdmin"],
  ["/embed", "r6.docEmbed"],
];

export function titleKeyFor(pathname) {
  if (pathname === "/") return "r6.docHome";
  for (const [prefix, key] of TITLE_KEYS) {
    if (pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)) return key;
  }
  return "r6.docNotFound";
}

/** Sets `document.title` per route in the active language. Detail pages override it. */
export function useDocumentTitle(pathname) {
  const { t, i18n } = useTranslation();
  useEffect(() => {
    const key = titleKeyFor(pathname);
    if (key) document.title = t(key);
  }, [pathname, i18n.language, t]);
}
