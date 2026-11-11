import { useRouter } from "expo-router";
import { View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { useA11y } from "../../theme/a11y";
import { families, type FamilyName } from "../../theme/tokens";
import { GirihPattern } from "../Girih";
import { IconButton, Pill, T } from "../primitives";

export const HERO_HEIGHT = 270;

/** Category-coloured hero with arch + girih. Enters with a 380ms spring zoom (shared-element fallback). */
export function ScenarioHero({ title, eyebrow, family, badges }: { title: string; eyebrow?: string; family: FamilyName; badges: string[] }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useA11y();
  const solid = families[family].solid;
  const entering = reduceMotion ? FadeIn.duration(150) : ZoomIn.springify().damping(22).stiffness(180).duration(380);
  return (
    <Animated.View entering={entering} style={{ height: HERO_HEIGHT + insets.top, backgroundColor: solid, overflow: "hidden" }}>
      <GirihPattern id="scHero" />
      <Svg width="100%" height="100%" viewBox="0 0 390 300" preserveAspectRatio="xMidYMax slice" style={{ position: "absolute", bottom: 0 }}>
        <Path d="M40 300 L40 150 C40 85 120 40 195 18 C270 40 350 85 350 150 L350 300" fill="none" stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={1.5} />
        <Path d="M62 300 L62 156 C62 98 132 56 195 38 C258 56 328 98 328 156 L328 300" fill="none" stroke="#E7C98A" strokeOpacity={0.3} strokeWidth={1} />
      </Svg>
      <View style={{ position: "absolute", top: insets.top + 8, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" }}>
        <IconButton icon="chevronLeft" label="back" onPress={() => router.back()} color="#FFFFFF" bg="rgba(255,255,255,0.18)" />
      </View>
      <View style={{ position: "absolute", left: 20, right: 20, bottom: 30, gap: 10 }}>
        {eyebrow ? <T size={13} weight="700" ls={0.06} color="rgba(255,255,255,0.85)" style={{ textTransform: "uppercase" }}>{eyebrow}</T> : null}
        <T size={28} weight="800" ls={-0.025} color="#FFFFFF" accessibilityRole="header">{title}</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {badges.map((b) => (
            <Pill key={b} label={b} bg="rgba(255,255,255,0.2)" fg="#FFFFFF" />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}
