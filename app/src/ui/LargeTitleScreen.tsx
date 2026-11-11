import { Glass } from "./Glass";
import { useCallback, useState, type ReactNode } from "react";
import { Platform, RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { haptics } from "../native/haptics";
import { useA11y } from "../theme/a11y";
import { GirihPull } from "./Girih";
import { T } from "./primitives";
import { useTabBarSpace } from "./TabBar";

const HEADER_BAR = 52;
const COLLAPSE_AT = 44;
const PULL_THRESHOLD = 84;

export interface LargeTitleScreenProps {
  /** Large title text (34pt) that collapses into the glass header. */
  title: string;
  /** Replaces the default large title block (e.g. Home greeting). */
  largeTitle?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  onRefresh?: () => Promise<unknown> | void;
  /** Reserve space for the floating tab bar (default true for tab screens). */
  tabBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Pinned element above the scroll content (e.g. offline banner). */
  top?: ReactNode;
}

/**
 * Scroll screen with iOS-style large title: the title fades/scales into a glass (blur) header
 * as you scroll; pull-to-refresh shows a girih that rotates with the drag.
 */
export function LargeTitleScreen({ title, largeTitle, headerRight, children, onRefresh, tabBar = true, contentStyle, top }: LargeTitleScreenProps) {
  const { palette } = useA11y();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const scrollY = useSharedValue(0);
  const pull = useSharedValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const armed = useSharedValue(false);

  const fireThreshold = useCallback(() => void haptics.medium(), []);

  const handler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    const drag = Math.max(0, -e.contentOffset.y);
    pull.value = Math.min(1, drag / PULL_THRESHOLD);
    if (drag >= PULL_THRESHOLD && !armed.value) {
      armed.value = true;
      scheduleOnRN(fireThreshold);
    } else if (drag < PULL_THRESHOLD * 0.5) armed.value = false;
  });

  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    void haptics.medium();
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const headerBlur = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [10, COLLAPSE_AT + 20], [0, 1], "clamp") }));
  const compactTitle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_AT, COLLAPSE_AT + 24], [0, 1], "clamp"),
    transform: [{ translateY: interpolate(scrollY.value, [COLLAPSE_AT, COLLAPSE_AT + 24], [6, 0], "clamp") }],
  }));
  const bigTitle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_AT], [1, 0], "clamp"),
    transform: [{ scale: interpolate(scrollY.value, [0, COLLAPSE_AT], [1, 0.5], "clamp") }, { translateX: interpolate(scrollY.value, [0, COLLAPSE_AT], [0, -60], "clamp") }],
  }));
  const pullStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(pull.value, [0, 1], [-20, 0]) }] }));

  const headerH = insets.top + HEADER_BAR;
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Animated.ScrollView
        onScroll={handler}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ paddingTop: insets.top + 12, paddingBottom: tabBar ? tabSpace : insets.bottom + 24, paddingHorizontal: 16, gap: 14 }, contentStyle]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              colors={[Platform.OS === "android" ? "transparent" : palette.accent]}
              tintColor="transparent"
              progressBackgroundColor="transparent"
              progressViewOffset={headerH}
            />
          ) : undefined
        }
      >
        {top}
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <Animated.View style={[{ flex: 1, transformOrigin: "left center" }, bigTitle]}>
            {largeTitle ?? (
              <T variant="largeTitle" weight="800" ls={-0.03} accessibilityRole="header">{title}</T>
            )}
          </Animated.View>
          {headerRight}
        </View>
        {children}
      </Animated.ScrollView>

      {onRefresh ? (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: headerH + 4, alignSelf: "center" }, pullStyle]}>
          <GirihPull progress={pull} spinning={refreshing} />
        </Animated.View>
      ) : null}

      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: headerH }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, headerBlur]}>
          <Glass intensity={30} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(245,246,248,0.78)", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.08)" }]} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, bottom: 0, height: HEADER_BAR, alignItems: "center", justifyContent: "center" }, compactTitle]}>
          <T variant="headline" weight="700" numberOfLines={1}>{title}</T>
        </Animated.View>
      </View>
    </View>
  );
}
