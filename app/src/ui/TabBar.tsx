import { Glass } from "./Glass";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptics } from "../native/haptics";
import { useA11y } from "../theme/a11y";
import { motion } from "../theme/tokens";
import { Icon, type IconName } from "./icons";
import { T } from "./primitives";

export const TAB_BAR_HEIGHT = 70;
const SIDE_MARGIN = 14;
const PILL_WIDTH = 64;
const ICON_POP = 1.14;

const TAB_ICONS: Record<string, IconName> = {
  index: "home",
  chat: "chat",
  catalog: "grid",
  cases: "cases",
  profile: "user",
};

/** Space screens must reserve so content clears the floating bar. */
export function useTabBarSpace(): number {
  const { bottom } = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(bottom, 12) + 28;
}

function TabItem({ icon, label, focused, onPress, onLongPress }: { icon: IconName; label: string; focused: boolean; onPress: () => void; onLongPress: () => void }) {
  const { palette, reduceMotion } = useA11y();
  const pop = useSharedValue(1);
  useEffect(() => {
    if (focused && !reduceMotion) pop.value = withSequence(withSpring(ICON_POP, { damping: 8, stiffness: 300 }), withSpring(1, motion.spring));
  }, [focused, reduceMotion, pop]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const color = focused ? palette.accentPressed : palette.muted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 3 }}
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={24} color={color} strokeWidth={focused ? 2.1 : 2} />
      </Animated.View>
      <T size={11} weight={focused ? "700" : "600"} color={color} numberOfLines={1}>{label}</T>
    </Pressable>
  );
}

/** Floating glass tab bar with a spring-slid pill and icon pop (Motion spec: tabs). */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { palette, reduceMotion } = useA11y();
  const [width, setWidth] = useState(0);
  const slot = width / state.routes.length;
  const pillX = useSharedValue(0);

  useEffect(() => {
    if (!slot) return;
    const target = state.index * slot + (slot - PILL_WIDTH) / 2;
    pillX.value = reduceMotion ? withTiming(target, { duration: 150 }) : withSpring(target, motion.springSoft);
  }, [state.index, slot, reduceMotion, pillX]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  const bottom = Math.max(insets.bottom, 12) + 10;
  const focusedOptions = descriptors[state.routes[state.index].key].options;
  if ((focusedOptions as { tabBarStyle?: { display?: string } }).tabBarStyle?.display === "none") return null;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: SIDE_MARGIN, right: SIDE_MARGIN, bottom }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{
          height: TAB_BAR_HEIGHT,
          borderRadius: 28,
          overflow: "hidden",
          shadowColor: "#1D1D1F",
          shadowOpacity: 0.14,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 16 },
          elevation: 12,
          backgroundColor: Platform.OS === "android" ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.82)",
        }}
      >
        <Glass intensity={50} fallback="rgba(255,255,255,0.97)" />
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: 6, left: 0, width: PILL_WIDTH, height: TAB_BAR_HEIGHT - 12, borderRadius: 18, backgroundColor: palette.accentTint },
            pillStyle,
          ]}
        />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label = typeof options.title === "string" ? options.title : route.name;
            return (
              <TabItem
                key={route.key}
                icon={TAB_ICONS[route.name] ?? "home"}
                label={label}
                focused={focused}
                onPress={() => {
                  void haptics.selection();
                  const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigateToTab(route.key);
                }}
                onLongPress={() => undefined}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}
