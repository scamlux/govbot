import type { ReactNode } from "react";
import { Pressable, type AccessibilityRole, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

import { haptics } from "../native/haptics";
import { useA11y } from "../theme/a11y";
import { motion } from "../theme/tokens";

export interface PressableScaleProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** 0.96 for buttons, 0.98 for cards (Motion spec). */
  scaleTo?: number;
  /** Light haptic on press; disable for rows that fire their own feedback. */
  haptic?: "light" | "selection" | "none";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean; busy?: boolean };
  accessibilityHint?: string;
  testID?: string;
}

/** Spring scale-down on press-in with overshoot on release, plus a light haptic. */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  scaleTo = 0.96,
  haptic = "light",
  disabled,
  style,
  hitSlop,
  ...a11y
}: PressableScaleProps) {
  const { reduceMotion } = useA11y();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...a11y}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => {
        if (!reduceMotion) scale.value = withSpring(scaleTo, motion.spring);
      }}
      onPressOut={() => {
        if (!reduceMotion) scale.value = withSpring(1, { ...motion.spring, damping: 11 });
      }}
      onPress={() => {
        if (haptic === "light") void haptics.light();
        else if (haptic === "selection") void haptics.selection();
        onPress?.();
      }}
      onLongPress={onLongPress}
      style={[style, animated, disabled ? { opacity: 0.5 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
}
