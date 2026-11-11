import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

import type { Lang } from "../config";

/**
 * Voice input via expo-speech-recognition (58.x targets SDK 58). Uzbek has weak on-device
 * support, so callers should treat `isVoiceInputAvailable()` as the source of truth and hide
 * the mic when it is false. Result events are consumed with `useSpeechRecognitionEvent`
 * ("result", "end", "error") inside the chat composer.
 */
const LOCALE: Record<Lang, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

export function isVoiceInputAvailable(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function startVoiceInput(lang: Lang): Promise<boolean> {
  const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!permission.granted) return false;
  ExpoSpeechRecognitionModule.start({ lang: LOCALE[lang], interimResults: true, continuous: false });
  return true;
}

export const stopVoiceInput = (): void => ExpoSpeechRecognitionModule.stop();
