import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BackHandler, Keyboard, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useA11y } from "../theme/a11y";
import { motion } from "../theme/tokens";

const BACKDROP_MAX = 0.38;
const BACKDROP_MS = 220;
const RUBBER = 0.25;

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /** Fires after a parent-driven close (visible -> false) finishes animating out. */
  onClosed?: () => void;
  /** Visible fractions of screen height, ascending (Motion spec: 50% / 92%). */
  detents?: readonly number[];
  children: ReactNode;
  /** Accessible title announced for the dialog. */
  label: string;
}

/** Bottom sheet: detents, drag-to-dismiss, rubber band, backdrop 0 -> 0.38. Reanimated + Gesture Handler. */
export function Sheet({ visible, onClose, onClosed, detents = [0.5, 0.92], children, label }: SheetProps) {
  const { height: screenH } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const { reduceMotion } = useA11y();
  const [mounted, setMounted] = useState(visible);
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const topFraction = detents[detents.length - 1];
  const sheetH = Math.round(screenH * topFraction);
  const snaps = detents.map((d) => sheetH - Math.round(screenH * d));
  const startSnap = snaps[0];

  const y = useSharedValue(sheetH);
  const startY = useSharedValue(0);

  const finishClose = useCallback(() => {
    setMounted(false);
    onClose();
  }, [onClose]);

  const animateTo = useCallback(
    (target: number, done?: () => void) => {
      if (reduceMotion) {
        y.value = withTiming(target, { duration: 150 }, (finished) => {
          if (finished && done) scheduleOnRN(done);
        });
      } else {
        y.value = withSpring(target, { ...motion.springSoft, overshootClamping: target === sheetH }, (finished) => {
          if (finished && done) scheduleOnRN(done);
        });
      }
    },
    [reduceMotion, y, sheetH],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.value = sheetH;
      animateTo(startSnap);
    } else if (mounted) {
      animateTo(sheetH, () => {
        setMounted(false);
        onClosed?.();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const requestClose = useCallback(() => animateTo(sheetH, finishClose), [animateTo, sheetH, finishClose]);

  useEffect(() => {
    if (!visible) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      requestClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, requestClose]);

  const pan = usePanGesture({
    activeOffsetY: [-6, 6],
    onActivate: () => {
      "worklet";
      startY.value = y.value;
    },
    onUpdate: (e) => {
      "worklet";
      const next = startY.value + e.translationY;
      y.value = next < 0 ? next * RUBBER : next;
    },
    onDeactivate: (e) => {
      "worklet";
      const projected = y.value + e.velocityY * 0.18;
      const candidates = [...snaps, sheetH];
      let best = candidates[0];
      for (const c of candidates) if (Math.abs(c - projected) < Math.abs(best - projected)) best = c;
      if (best === sheetH) {
        y.value = withTiming(sheetH, { duration: 200 }, (finished) => {
          if (finished) scheduleOnRN(finishClose);
        });
      } else {
        y.value = withSpring(best, motion.springSoft);
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [sheetH, startSnap], [0, BACKDROP_MAX], "clamp"),
  }));

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={requestClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#0F1416" }, backdropStyle]} />
        <Pressable accessibilityRole="button" accessibilityLabel="close" style={StyleSheet.absoluteFill} onPress={requestClose} />
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={label}
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: keyboard,
              height: sheetH,
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 25,
              shadowOffset: { width: 0, height: -20 },
              elevation: 24,
              paddingBottom: Platform.OS === "android" ? bottom + 8 : bottom,
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }} accessibilityElementsHidden>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: "#D1D1D6" }} />
            </View>
          </GestureDetector>
          <View style={{ flex: 1, paddingHorizontal: 20 }}>{children}</View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Fixed ease used for backdrop-only fades elsewhere. */
export const BACKDROP_EASING = Easing.bezier(...motion.easingStandard);
export const BACKDROP_DURATION = BACKDROP_MS;
