import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import type { Lang } from "../src/config";
import { pickVoiceLocale, volumeToLevel } from "../src/domain/voice";
import { useLang } from "../src/i18n/useLang";
import { haptics } from "../src/native/haptics";
import { useA11y } from "../src/theme/a11y";
import { voiceColors } from "../src/theme/tokens";
import { Icon } from "../src/ui/icons";
import { PressableScale } from "../src/ui/PressableScale";
import { T } from "../src/ui/primitives";
import { VoiceOrb } from "../src/ui/skia";

const BARS = [0.55, 0.85, 1, 0.8, 0.5];
const NO_VOLUME_MS = 900;
const LANG_NAME: Record<Lang, string> = { uz: "O'zbekcha", ru: "Русский", en: "English" };

function Bar({ factor, level, phase, index, still }: { factor: number; level: SharedValue<number>; phase: SharedValue<number>; index: number; still: boolean }) {
  const style = useAnimatedStyle(() => {
    const wobble = 0.5 + 0.5 * Math.sin(phase.value * Math.PI * 2 + index * 1.3);
    const h = still ? 0.45 : 0.18 + level.value * factor * (0.55 + 0.45 * wobble) * 0.9;
    return { transform: [{ scaleY: Math.max(0.12, Math.min(1, h)) }] };
  });
  return <Animated.View style={[{ width: 6, height: 34, borderRadius: 3, backgroundColor: index % 2 === 0 ? voiceColors.ring : "#FFFFFF" }, style]} />;
}

/** Voice mode: live transcript, orb driven by mic amplitude (or a simulated pulse), pause / send / cancel. */
export default function Voice() {
  const { t } = useTranslation();
  const uiLang = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useA11y();
  const [lang, setLang] = useState<Lang>(uiLang);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "listening" | "paused" | "error">("idle");
  const [committed, setCommitted] = useState("");
  const [interim, setInterim] = useState("");
  const localeRef = useRef<string>("");
  const committedRef = useRef("");
  const startedRef = useRef(false);

  const level = useSharedValue(0);
  const phase = useSharedValue(0);
  const lastVolumeAt = useRef(0);

  useEffect(() => {
    if (reduceMotion) return;
    phase.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [phase, reduceMotion]);

  // Simulated pulse if the recogniser does not emit volume events.
  useEffect(() => {
    if (status !== "listening" || reduceMotion) {
      level.value = withTiming(0, { duration: 200 });
      return undefined;
    }
    const id = setInterval(() => {
      if (Date.now() - lastVolumeAt.current > NO_VOLUME_MS) level.value = withTiming(0.35 + Math.random() * 0.4, { duration: 420 });
    }, 450);
    return () => clearInterval(id);
  }, [status, reduceMotion, level]);

  const beginRecognition = useCallback(async (target: Lang) => {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setStatus("error");
      setNotice(t("m.voice.denied"));
      return false;
    }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setStatus("error");
      setNotice(t("m.voice.unavailable"));
      return false;
    }
    let supported: string[] = [];
    try {
      const res = await ExpoSpeechRecognitionModule.getSupportedLocales({});
      supported = [...res.locales, ...(res.installedLocales ?? [])];
    } catch {
      supported = [];
    }
    const pick = pickVoiceLocale(target, supported);
    localeRef.current = pick.locale;
    if (pick.lang !== uiLang) setNotice(t("m.voice.fallback", { from: LANG_NAME[uiLang], to: LANG_NAME[pick.lang] }));
    else setNotice(null);
    setLang(pick.lang);
    ExpoSpeechRecognitionModule.start({
      lang: pick.locale,
      interimResults: true,
      continuous: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
    });
    return true;
  }, [t, uiLang]);

  useSpeechRecognitionEvent("start", () => setStatus("listening"));
  useSpeechRecognitionEvent("volumechange", (e) => {
    lastVolumeAt.current = Date.now();
    level.value = withTiming(volumeToLevel(e.value), { duration: 90 });
  });
  useSpeechRecognitionEvent("result", (e) => {
    const text = e.results[0]?.transcript ?? "";
    if (e.isFinal) {
      const next = `${committedRef.current} ${text}`.trim();
      committedRef.current = next;
      setCommitted(next);
      setInterim("");
    } else setInterim(text);
  });
  useSpeechRecognitionEvent("end", () => setStatus((s) => (s === "listening" ? "paused" : s)));
  useSpeechRecognitionEvent("error", (e) => {
    if (e.error === "language-not-supported" && lang === "uz") {
      // Retry once with ru when Uzbek is not installed.
      setNotice(t("m.voice.fallback", { from: LANG_NAME.uz, to: LANG_NAME.ru }));
      setLang("ru");
      ExpoSpeechRecognitionModule.start({ lang: "ru-RU", interimResults: true, continuous: true, volumeChangeEventOptions: { enabled: true, intervalMillis: 80 } });
      return;
    }
    if (e.error === "aborted") return;
    if (e.error === "no-speech") {
      setStatus("paused");
      return;
    }
    setStatus("error");
    setNotice(e.error === "not-allowed" ? t("m.voice.denied") : t("m.voice.failed"));
  });

  useEffect(() => {
    if (startedRef.current) return undefined;
    startedRef.current = true;
    void beginRecognition(uiLang);
    return () => ExpoSpeechRecognitionModule.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = useCallback(() => {
    ExpoSpeechRecognitionModule.abort();
    void haptics.light();
    router.back();
  }, [router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      cancel();
      return true;
    });
    return () => sub.remove();
  }, [cancel]);

  const transcript = `${committed} ${interim}`.trim();
  const send = () => {
    if (!transcript) return;
    ExpoSpeechRecognitionModule.stop();
    void haptics.success();
    router.replace({ pathname: "/chat/[id]", params: { id: "new", prefill: transcript, autoSend: "1" } });
  };

  const togglePause = () => {
    void haptics.light();
    if (status === "listening") {
      ExpoSpeechRecognitionModule.stop();
      setStatus("paused");
    } else {
      void beginRecognition(lang);
    }
  };

  const listening = status === "listening";
  const dotStyle = useAnimatedStyle(() => ({ opacity: listening ? 0.5 + 0.5 * Math.sin(phase.value * Math.PI * 2) : 1 }));
  const orbLevel = useDerivedValue(() => level.value);
  const statusLabel = listening ? t("m.voice.listening") : status === "paused" ? t("m.voice.paused") : status === "error" ? t("m.common.error") : t("m.voice.idle");

  return (
    <LinearGradient colors={[voiceColors.bg0, voiceColors.bg1, voiceColors.bg2]} locations={[0, 0.55, 1]} style={{ flex: 1, alignItems: "center" }}>
      <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)" }}>
          <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: listening ? "#F07167" : "#9AA" }, dotStyle]} />
          <T size={13} weight="700" color="#FFFFFF">{statusLabel}</T>
        </View>
        <View style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)" }}>
          <T size={13} weight="700" color="#FFFFFF">{LANG_NAME[lang]}</T>
        </View>
      </View>

      <View style={{ marginTop: 40 }}>
        <VoiceOrb level={orbLevel} active={listening} size={300} />
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Icon name="mic" size={46} color="#FFFFFF" strokeWidth={1.8} />
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 40, marginTop: 8 }} accessibilityElementsHidden>
        {BARS.map((f, i) => (
          <Bar key={i} index={i} factor={f} level={level} phase={phase} still={!listening || reduceMotion} />
        ))}
      </View>

      <View accessibilityLiveRegion="polite" style={{ marginTop: 22, paddingHorizontal: 28, minHeight: 100 }}>
        <T size={24} weight="600" ls={-0.01} color="#FFFFFF" style={{ textAlign: "center" }}>
          {transcript ? (
            <>
              {committed}
              {committed && interim ? " " : ""}
              <T size={24} weight="600" color="rgba(255,255,255,0.5)">{interim}</T>
            </>
          ) : (
            <T size={24} weight="600" color="rgba(255,255,255,0.5)">{t("m.voice.placeholder")}</T>
          )}
        </T>
        {notice ? (
          <Pressable disabled={status !== "error"} onPress={() => void Linking.openSettings()}>
            <T variant="footnote" color="#E7C98A" style={{ textAlign: "center", marginTop: 12 }}>{notice}</T>
          </Pressable>
        ) : null}
      </View>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 32, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 28 }}>
        <PressableScale onPress={cancel} accessibilityRole="button" accessibilityLabel={t("m.voice.cancel")} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={26} color="#FFFFFF" />
        </PressableScale>
        <PressableScale
          onPress={togglePause}
          accessibilityRole="button"
          accessibilityLabel={listening ? t("m.voice.pause") : t("m.voice.resume")}
          style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 14 }, elevation: 10 }}
        >
          {listening ? <Icon name="pause" size={30} color="#0A6E78" strokeWidth={3.2} /> : <Icon name="mic" size={32} color="#0A6E78" />}
        </PressableScale>
        <PressableScale
          onPress={send}
          disabled={!transcript}
          accessibilityRole="button"
          accessibilityLabel={t("m.voice.send")}
          style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: voiceColors.ring, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="arrowUp" size={26} color="#1D1D1F" strokeWidth={2.6} />
        </PressableScale>
      </View>
    </LinearGradient>
  );
}
