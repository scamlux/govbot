import { Canvas, Circle, Group, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { useEffect } from "react";
import { View } from "react-native";
import { Easing, cancelAnimation, interpolate, useDerivedValue, useSharedValue, withDelay, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";

import { useA11y } from "../theme/a11y";
import { colors, voiceColors } from "../theme/tokens";

const square = Skia.Path.MakeFromSVGString("M10 10L30 10L30 30L10 30Z");
const diamond = Skia.Path.MakeFromSVGString("M20 5.9L34.1 20L20 34.1L5.9 20Z");
const DRAW_MS = 900;

/** Launch mark: Skia path trim 0→1 over 900ms (easeInOutCubic), slow 40s spin afterwards. */
export function LaunchGirih({ size = 210 }: { size?: number }) {
  const { reduceMotion } = useA11y();
  const trim = useSharedValue(reduceMotion ? 1 : 0);
  const trim2 = useSharedValue(reduceMotion ? 1 : 0);
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return undefined;
    const ease = Easing.inOut(Easing.cubic);
    trim.value = withDelay(200, withTiming(1, { duration: DRAW_MS, easing: ease }));
    trim2.value = withDelay(500, withTiming(1, { duration: DRAW_MS, easing: ease }));
    spin.value = withRepeat(withTiming(360, { duration: 40_000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [reduceMotion, trim, trim2, spin]);
  const scale = size / 40;
  const spinTransform = useDerivedValue(() => [{ rotate: (spin.value * Math.PI) / 180 }]);
  const dotOpacity = useDerivedValue(() => 0.9 * trim2.value);
  const center = vec(20, 20);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        <Group transform={[{ scale }]}>
          <Group origin={center} transform={spinTransform}>
            {square ? <Path path={square} style="stroke" strokeWidth={1.1} strokeJoin="round" color={colors.accent} start={0} end={trim} /> : null}
            {diamond ? <Path path={diamond} style="stroke" strokeWidth={1.1} strokeJoin="round" color={colors.goldDeep} start={0} end={trim2} /> : null}
            <Circle cx={20} cy={20} r={3.2} color={colors.accent} opacity={dotOpacity} />
          </Group>
        </Group>
      </Canvas>
    </View>
  );
}

/**
 * Voice orb: radial-gradient disc whose scale follows `level` (0..1, mic amplitude) with
 * two emitted rings every 800ms. Runs entirely on the UI thread.
 */
export function VoiceOrb({ level, active, size = 300 }: { level: SharedValue<number>; active: boolean; size?: number }) {
  const { reduceMotion } = useA11y();
  const ring = useSharedValue(0);
  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(ring);
      ring.value = 0;
      return undefined;
    }
    ring.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.bezier(0.2, 0.7, 0.3, 1) }), -1, false);
    return () => cancelAnimation(ring);
  }, [active, reduceMotion, ring]);

  const c = size / 2;
  const base = size * 0.267;
  const orbR = useDerivedValue(() => base * interpolate(level.value, [0, 1], [0.94, 1.08], "clamp"));
  const ring1 = useDerivedValue(() => base * interpolate(ring.value, [0, 1], [1.05, 1.9]));
  const ring2 = useDerivedValue(() => base * interpolate((ring.value + 0.33) % 1, [0, 1], [1.05, 1.9]));
  const ring3 = useDerivedValue(() => base * interpolate((ring.value + 0.66) % 1, [0, 1], [1.05, 1.9]));
  const o1 = useDerivedValue(() => (active ? 0.7 * (1 - ring.value) : 0));
  const o2 = useDerivedValue(() => (active ? 0.7 * (1 - ((ring.value + 0.33) % 1)) : 0));
  const o3 = useDerivedValue(() => (active ? 0.7 * (1 - ((ring.value + 0.66) % 1)) : 0));
  const glowR = useDerivedValue(() => orbR.value + 14);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={c} cy={c} r={ring1} style="stroke" strokeWidth={1.5} color={voiceColors.ring} opacity={o1} />
        <Circle cx={c} cy={c} r={ring2} style="stroke" strokeWidth={1.5} color={voiceColors.ring} opacity={o2} />
        <Circle cx={c} cy={c} r={ring3} style="stroke" strokeWidth={1.5} color={voiceColors.ring} opacity={o3} />
        <Circle cx={c} cy={c} r={orbR}>
          <RadialGradient c={vec(c - base * 0.3, c - base * 0.4)} r={base * 1.6} colors={[voiceColors.orb, colors.accent, "#074E55"]} positions={[0, 0.55, 1]} />
        </Circle>
        <Circle cx={c} cy={c} r={glowR} color="rgba(43,163,168,0.18)" />
      </Canvas>
    </View>
  );
}
