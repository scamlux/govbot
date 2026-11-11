import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedProps, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";

import { useA11y } from "../theme/a11y";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const RADIUS = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Ring spring from the Motion spec: d20 k180. */
const RING_SPRING = { damping: 20, stiffness: 180, mass: 1 } as const;

/** Circular progress; animates (spring) whenever `done` changes. `label` is the centre text, e.g. "2/4". */
export function ProgressRing({
  done,
  total,
  size = 46,
  label,
  color,
  stroke = 5,
}: {
  done: number;
  total: number;
  size?: number;
  label?: string;
  color?: string;
  stroke?: number;
}) {
  const { palette, reduceMotion } = useA11y();
  const fraction = total > 0 ? Math.min(1, done / total) : 0;
  const progress = useSharedValue(fraction);
  useEffect(() => {
    progress.value = reduceMotion ? withTiming(fraction, { duration: 150 }) : withSpring(fraction, RING_SPRING);
  }, [fraction, reduceMotion, progress]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress.value))) }));
  const tone = color ?? palette.accent;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${done}/${total}`} accessibilityValue={{ min: 0, max: total, now: done }}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Circle cx={20} cy={20} r={RADIUS} fill="none" stroke={palette.accentTint} strokeWidth={stroke} />
        <AnimatedCircle
          cx={20}
          cy={20}
          r={RADIUS}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          animatedProps={animatedProps}
          transform="rotate(-90 20 20)"
        />
        {label ? (
          <SvgText x={20} y={label.length > 4 ? 23.5 : 24} textAnchor="middle" fontSize={label.length > 4 ? 8 : 10} fontWeight="800" fill={palette.ink}>
            {label}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

const CHECK_LENGTH = 24;

/** Rounded square tick box; the check draws in 220ms when `checked` turns on. */
export function CheckBox({ checked, size = 28 }: { checked: boolean; size?: number }) {
  const { palette, reduceMotion } = useA11y();
  const draw = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    draw.value = withTiming(checked ? 1 : 0, { duration: reduceMotion ? 150 : 220, easing: Easing.out(Easing.cubic) });
  }, [checked, reduceMotion, draw]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - draw.value) }));
  const bg = useAnimatedProps(() => ({ opacity: draw.value }));
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx={14} cy={14} r={12.5} fill="none" stroke="#C7C7CC" strokeWidth={2} />
      <AnimatedCircle cx={14} cy={14} r={13} fill={palette.accent} animatedProps={bg} />
      <AnimatedPath
        d="M8 14.5l4 4 8-9"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={`${CHECK_LENGTH} ${CHECK_LENGTH}`}
        animatedProps={props}
      />
    </Svg>
  );
}
