import * as Speech from "expo-speech";

import type { Lang } from "../config";

/** BCP-47 tags; Uzbek (Latin) falls back through uz-UZ -> uz. */
const LOCALE: Record<Lang, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

const hasVoiceFor = (voices: Speech.Voice[], lang: Lang): boolean =>
  voices.some((voice) => voice.language.toLowerCase().startsWith(lang));

/** True when the device ships a TTS voice for the language (Uzbek often has none). */
export async function canSpeak(lang: Lang): Promise<boolean> {
  try {
    return hasVoiceFor(await Speech.getAvailableVoicesAsync(), lang);
  } catch {
    return false;
  }
}

/** Read text aloud. Resolves `false` (and speaks nothing) when no voice exists for `lang`. */
export async function speak(text: string, lang: Lang, onDone?: () => void): Promise<boolean> {
  if (!(await canSpeak(lang))) return false;
  await Speech.stop();
  Speech.speak(text, {
    language: LOCALE[lang],
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
  return true;
}

export const stopSpeaking = (): Promise<void> => Speech.stop();
export const isSpeaking = (): Promise<boolean> => Speech.isSpeakingAsync();
