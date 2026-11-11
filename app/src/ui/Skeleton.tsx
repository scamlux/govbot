import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { useA11y } from "../theme/a11y";

const SHIMMER_MS = 1600;

/** Shimmering placeholder block (Motion spec: skeleton shimmer). */
export function Skeleton({ width = "100%", height = 14, radius = 7, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { reduceMotion } = useA11y();
  const [w, setW] = useState(0);
  const x = useSharedValue(-1);
  useEffect(() => {
    if (reduceMotion) return undefined;
    x.value = -1;
    x.value = withRepeat(withTiming(1, { duration: SHIMMER_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [reduceMotion, x]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * w }] }));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: radius, backgroundColor: "#ECEDF0", overflow: "hidden" }, style]}
    >
      {reduceMotion ? null : (
        <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, width: "100%" }, sweep]}>
          <LinearGradient
            colors={["rgba(236,237,240,0)", "rgba(247,247,249,0.95)", "rgba(230,243,244,0.9)", "rgba(236,237,240,0)"]}
            locations={[0, 0.35, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** Card-shaped loading placeholder with three text lines. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={{ padding: 16, borderRadius: 24, backgroundColor: "#FFFFFF", gap: 10 }}>
      <Skeleton width="72%" height={18} radius={9} />
      {Array.from({ length: lines - 1 }, (_, i) => (
        <Skeleton key={i} width={i === 0 ? "94%" : "60%"} height={14} />
      ))}
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
