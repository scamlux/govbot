import { useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, Pattern, Polygon, Rect } from "react-native-svg";

import { useA11y } from "../theme/a11y";
import { colors } from "../theme/tokens";

export const GIRIH_SQUARE = "10,10 30,10 30,30 10,30";
export const GIRIH_DIAMOND = "20,5.9 34.1,20 20,34.1 5.9,20";

/** Static two-polygon girih mark (square + rotated square). */
export function GirihMark({ size = 24, stroke = 2, a = colors.accent, b = colors.goldDeep }: { size?: number; stroke?: number; a?: string; b?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Polygon points={GIRIH_SQUARE} fill="none" stroke={a} strokeWidth={stroke} strokeLinejoin="round" />
      <Polygon points={GIRIH_DIAMOND} fill="none" stroke={b} strokeWidth={stroke} strokeLinejoin="round" />
    </Svg>
  );
}

/** Tiling girih pattern for hero cards (absolute fill). */
export function GirihPattern({ id = "hg", style }: { id?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={46} height={46} patternUnits="userSpaceOnUse">
            <Polygon points="13,13 33,13 33,33 13,33" fill="none" stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={1} />
            <Polygon points="23,8.9 37.1,23 23,37.1 8.9,23" fill="none" stroke="#E7C98A" strokeOpacity={0.22} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const AnimatedSvgView = Animated.createAnimatedComponent(View);

/** Gold girih burst played once when `play` flips true (checklist hits 100%). */
export function GirihBurst({ play, size = 120 }: { play: boolean; size?: number }) {
  const { reduceMotion } = useA11y();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!play) return;
    t.value = 0;
    t.value = withTiming(1, { duration: reduceMotion ? 150 : 1100, easing: Easing.bezier(0.2, 0.9, 0.25, 1) });
  }, [play, reduceMotion, t]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.15, 1], [0, 1, 0]),
    transform: [{ scale: interpolate(t.value, [0, 1], [0.35, 1.7]) }, { rotate: `${interpolate(t.value, [0, 1], [0, 90])}deg` }],
  }));
  return (
    <AnimatedSvgView pointerEvents="none" style={[{ position: "absolute", width: size, height: size, alignSelf: "center" }, style]}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Polygon points={GIRIH_SQUARE} fill="none" stroke="#E7C98A" strokeWidth={0.9} />
        <Polygon points={GIRIH_DIAMOND} fill="none" stroke={colors.gold} strokeWidth={0.9} />
        <Polygon points="20,0 24,16 40,20 24,24 20,40 16,24 0,20 16,16" fill="none" stroke="#E7C98A" strokeWidth={0.5} />
      </Svg>
    </AnimatedSvgView>
  );
}

/** Girih spinner for pull-to-refresh: rotation follows `progress` (0..1 = 0..360deg), then spins while `spinning`. */
export function GirihPull({ progress, spinning, size = 34 }: { progress: SharedValue<number>; spinning: boolean; size?: number }) {
  const spin = useSharedValue(0);
  useEffect(() => {
    if (spinning) spin.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    else {
      cancelAnimation(spin);
      spin.value = 0;
    }
  }, [spinning, spin]);
  const style = useAnimatedStyle(() => ({
    opacity: spinning ? 1 : interpolate(progress.value, [0, 0.2, 1], [0, 0.6, 1], "clamp"),
    transform: [
      { scale: spinning ? 1 : interpolate(progress.value, [0, 1], [0.6, 1], "clamp") },
      { rotate: `${spinning ? spin.value : progress.value * 360}deg` },
    ],
  }));
  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <GirihMark size={size} stroke={2} />
    </Animated.View>
  );
}
