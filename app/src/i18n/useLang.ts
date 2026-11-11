import { useTranslation } from "react-i18next";

import { DEFAULT_LANG, type Lang } from "../config";
import { isLang } from "./index";

/** Current UI language, always one of uz/ru/en. */
export function useLang(): Lang {
  const { i18n } = useTranslation();
  return isLang(i18n.language) ? i18n.language : DEFAULT_LANG;
}
