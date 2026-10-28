import { useCallback, useEffect, useState } from "react";

const BCP47 = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

function pickVoice(lang) {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices() || [];
  const prefix = (BCP47[lang] || lang).split("-")[0].toLowerCase();
  return voices.find((v) => v.lang?.toLowerCase().startsWith(prefix)) || null;
}

/** Strip markdown so the voice doesn't read "asterisk asterisk". */
export function toSpeakable(markdown) {
  return (markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * B4 — text-to-speech via the Web Speech API.
 *
 * `supported` is true only when the browser has a voice for the requested language, so
 * we never read Uzbek text with an English voice (many browsers ship no uz voice).
 */
export function useSpeechOutput(lang) {
  const [hasVoice, setHasVoice] = useState(() => !!pickVoice(lang));
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return undefined;
    const update = () => setHasVoice(!!pickVoice(lang));
    update();
    synth.addEventListener?.("voiceschanged", update);
    return () => synth.removeEventListener?.("voiceschanged", update);
  }, [lang]);

  // Stop talking when the component unmounts (e.g. user leaves the chat).
  useEffect(() => () => speaking && window.speechSynthesis?.cancel(), [speaking]);

  const speak = useCallback(
    (text) => {
      const synth = window.speechSynthesis;
      const voice = pickVoice(lang);
      if (!synth || !voice) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(toSpeakable(text));
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synth.speak(utterance);
    },
    [lang]
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { supported: typeof window !== "undefined" && !!window.speechSynthesis && hasVoice, speaking, speak, stop };
}
