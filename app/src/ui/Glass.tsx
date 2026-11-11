import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";

/**
 * Frosted backdrop for bars and headers. iOS gets a real blur; Android's BlurView draws content
 * through it (text bleeds under the bar), so there it is a near-opaque fill of the same tone.
 */
export function Glass({ intensity = 40, fallback = "rgba(245,246,248,0.97)" }: { intensity?: number; fallback?: string }) {
  if (Platform.OS === "ios") {
    return <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />;
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: fallback }]} />;
}
