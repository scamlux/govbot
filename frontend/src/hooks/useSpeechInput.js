import { useCallback, useEffect, useRef, useState } from "react";

// D2 — thin wrapper over the Web Speech API for dictation into the chat box.
// Degrades gracefully: `supported` is false where the API is missing (e.g. Firefox),
// letting the caller hide the mic button entirely.

const SpeechRecognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

const LANG_MAP = { uz: "uz-UZ", ru: "ru-RU", en: "en-US" };

export function useSpeechInput({ lang = "uz", onResult } = {}) {
  const supported = Boolean(SpeechRecognition);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!supported) return undefined;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) onResultRef.current?.(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [supported]);

  // Keep the recognizer's language in sync with the selected UI language.
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = LANG_MAP[lang] || "en-US";
    }
  }, [lang]);

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      try {
        recognition.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  }, [listening]);

  return { supported, listening, toggle };
}
