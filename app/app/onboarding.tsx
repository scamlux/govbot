import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGS, type Lang } from "../src/config";
import { changeLanguage } from "../src/i18n";
import { useLang } from "../src/i18n/useLang";
import { haptics } from "../src/native/haptics";
import { ensureNotificationPermission } from "../src/native/notifications";
import { useSettings } from "../src/state/settings";
import { useA11y } from "../src/theme/a11y";
import { Icon, type IconName } from "../src/ui/icons";
import { useRise } from "../src/ui/motion";
import { Button, T } from "../src/ui/primitives";
import { LaunchGirih } from "../src/ui/skia";

const LANG_NAMES: Record<Lang, string> = { uz: "O'zbekcha", ru: "Русский", en: "English" };
const PAGES = 3;

function Dot({ index, x, width }: { index: number; x: SharedValue<number>; width: number }) {
  const { palette } = useA11y();
  const style = useAnimatedStyle(() => ({
    width: interpolate(x.value / width, [index - 1, index, index + 1], [6, 22, 6], "clamp"),
    backgroundColor: Math.abs(x.value / width - index) < 0.5 ? palette.accent : "#C7C7CC",
  }));
  return <Animated.View style={[{ height: 6, borderRadius: 3 }, style]} />;
}

function InfoPage({ icon, title, body, width }: { icon: IconName; title: string; body: string; width: number }) {
  const { palette } = useA11y();
  return (
    <View style={{ width, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 18 }}>
      <View style={{ width: 120, height: 120, borderRadius: 40, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center", shadowColor: "#1D1D1F", shadowOpacity: 0.08, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 6 }}>
        <Icon name={icon} size={56} color={palette.accent} strokeWidth={1.7} />
      </View>
      <T size={28} weight="800" ls={-0.03} style={{ textAlign: "center" }} accessibilityRole="header">{title}</T>
      <T size={17} color="#3A3A3C" style={{ textAlign: "center" }}>{body}</T>
    </View>
  );
}

export default function Onboarding() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { palette } = useA11y();
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const x = useSharedValue(0);
  const scroller = useRef<Animated.ScrollView>(null);
  const [page, setPage] = useState(0);
  const rise2 = useRise(900, 16, 700);
  const rise3 = useRise(1050, 16, 700);
  const rise4 = useRise(1200, 16, 700);

  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  const goTo = (next: number) => scroller.current?.scrollTo({ x: next * width, animated: true });

  const finish = (then?: "auth") => {
    setOnboarded(true);
    router.replace("/");
    if (then === "auth") setTimeout(() => router.push("/auth"), 50);
  };

  const primary = async () => {
    void haptics.light();
    if (page < PAGES - 1) goTo(page + 1);
    else finish();
  };

  const allowNotifications = async () => {
    void haptics.light();
    await ensureNotificationPermission().catch(() => false);
    finish();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Animated.View entering={FadeIn.duration(1200)} pointerEvents="none" style={{ position: "absolute", left: "50%", top: 150, width: 420, height: 420, marginLeft: -210, borderRadius: 210, backgroundColor: "rgba(10,110,120,0.1)" }} />
      <Animated.ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        <View style={{ width, alignItems: "center" }}>
          <Animated.View entering={FadeIn.duration(400)} style={{ position: "absolute", top: insets.top + 20 }} pointerEvents="none">
            <Svg width={390} height={430} viewBox="0 0 390 430">
              <Path d="M40 430 L40 214 C40 120 120 52 195 22 C270 52 350 120 350 214 L350 430" fill="#FFFFFF" stroke="#C9A55A" strokeWidth={1.5} />
              <Path d="M62 430 L62 220 C62 136 132 76 195 48 C258 76 328 136 328 220 L328 430" fill="none" stroke={palette.accent} strokeOpacity={0.25} strokeWidth={1} />
            </Svg>
          </Animated.View>
          <View style={{ marginTop: insets.top + 130 }}>
            <LaunchGirih size={210} />
          </View>
          <View style={{ marginTop: 40, alignItems: "center", gap: 10, paddingHorizontal: 28 }}>
            <Animated.View entering={rise2}>
              <T size={40} weight="800" ls={-0.04} accessibilityRole="header">GovBot</T>
            </Animated.View>
            <Animated.View entering={rise3}>
              <T size={19} color="#3A3A3C" style={{ textAlign: "center" }}>{t("m.onboarding.tagline")}</T>
            </Animated.View>
          </View>
          <Animated.View entering={rise3} accessibilityRole="radiogroup" style={{ marginTop: 26, flexDirection: "row", gap: 6, padding: 5, borderRadius: 18, backgroundColor: "#FFFFFF", shadowColor: "#1D1D1F", shadowOpacity: 0.08, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 5 }}>
            {SUPPORTED_LANGS.map((code) => {
              const on = code === lang;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={LANG_NAMES[code]}
                  onPress={() => {
                    void haptics.selection();
                    void changeLanguage(code);
                  }}
                  style={{ minWidth: 96, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, backgroundColor: on ? palette.accent : "transparent" }}
                >
                  <T variant="callout" weight="600" color={on ? "#FFFFFF" : palette.ink}>{LANG_NAMES[code]}</T>
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
        <InfoPage icon="sparkle" title={t("m.onboarding.p2Title")} body={t("m.onboarding.p2Body")} width={width} />
        <InfoPage icon="shield" title={t("m.onboarding.p3Title")} body={t("m.onboarding.p3Body")} width={width} />
      </Animated.ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 12) + 16, alignItems: "center", gap: 14, paddingHorizontal: 24 }}>
        <Animated.View entering={rise4} accessible accessibilityRole="progressbar" accessibilityLabel={t("m.onboarding.pageOf", { page: page + 1, total: PAGES })} style={{ flexDirection: "row", gap: 6 }}>
          {Array.from({ length: PAGES }, (_, i) => (
            <Dot key={i} index={i} x={x} width={width} />
          ))}
        </Animated.View>
        <Animated.View entering={rise4} style={{ width: "100%", gap: 6 }}>
          {page === PAGES - 1 ? (
            <Button tone="dark" icon="bell" label={t("m.onboarding.allowNotifications")} onPress={() => void allowNotifications()} />
          ) : (
            <Button tone="dark" icon="arrowRight" label={page === 0 ? t("m.onboarding.start") : t("m.onboarding.next")} onPress={() => void primary()} />
          )}
          {page === PAGES - 1 ? (
            <Pressable accessibilityRole="button" onPress={() => finish()} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
              <T variant="callout" weight="600" color={palette.accent}>{t("m.onboarding.later")}</T>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => finish("auth")} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
              <T variant="callout" weight="600" color={palette.accent}>{t("m.onboarding.haveAccount")}</T>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
