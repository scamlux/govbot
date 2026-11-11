import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";

import { useA11y } from "../theme/a11y";
import { radii, spacing, type TypeName } from "../theme/tokens";

/** Minimal themed text; real visuals arrive with the design spec. */
export function T({
  variant = "body",
  muted = false,
  style,
  children,
  ...rest
}: {
  variant?: TypeName;
  muted?: boolean;
  style?: TextStyle;
  children: ReactNode;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const { palette, textStyle } = useA11y();
  return (
    <Text {...rest} style={[textStyle(variant), { color: muted ? palette.muted : palette.ink }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  tone = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "plain";
}) {
  const { palette } = useA11y();
  const primary = tone === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }): ViewStyle => ({
        minHeight: 48,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        borderRadius: radii.md,
        opacity: disabled ? 0.5 : 1,
        backgroundColor: primary ? (pressed ? palette.accentPressed : palette.accent) : palette.surface,
        borderWidth: primary ? 0 : StyleSheet.hairlineWidth,
        borderColor: palette.line,
      })}
    >
      <T variant="headline" style={{ color: primary ? "#FFFFFF" : palette.accent }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const { palette } = useA11y();
  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: radii.md,
        padding: spacing.lg,
        gap: spacing.xs,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: palette.line,
      }}
    >
      {children}
    </View>
  );
}
