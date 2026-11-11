import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { haptics } from "../native/haptics";
import { useA11y } from "../theme/a11y";
import { motion, radii, spacing, type TypeName } from "../theme/tokens";
import { Icon, type IconName } from "./icons";
import { PressableScale } from "./PressableScale";

/** Themed text. `size`/`weight` override the type scale (the app XL multiplier still applies). */
export function T({
  variant = "body",
  muted = false,
  size,
  weight,
  color,
  ls,
  style,
  children,
  ...rest
}: {
  variant?: TypeName;
  muted?: boolean;
  size?: number;
  weight?: TextStyle["fontWeight"];
  color?: string;
  /** Letter spacing in em. */
  ls?: number;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  selectable?: boolean;
  accessibilityRole?: "header" | "text" | "link";
  accessibilityLiveRegion?: "polite" | "none";
}) {
  const { palette, textStyle, appTextScale } = useA11y();
  const base = textStyle(variant);
  const fontSize = size ? Math.round(size * appTextScale) : undefined;
  const overrides: TextStyle = {
    ...(fontSize ? { fontSize, lineHeight: Math.round(size! * 1.3 * appTextScale) } : null),
    ...(weight ? { fontWeight: weight } : null),
    ...(ls !== undefined ? { letterSpacing: (fontSize ?? base.fontSize ?? 16) * ls } : null),
  };
  return (
    <Text {...rest} style={[base, { color: color ?? (muted ? palette.muted : palette.ink) }, overrides, style]}>
      {children}
    </Text>
  );
}

export type ButtonTone = "primary" | "dark" | "tint" | "plain" | "danger" | "glass";

export function Button({
  label,
  onPress,
  disabled,
  tone = "primary",
  icon,
  loading,
  style,
  size = "lg",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: ButtonTone;
  icon?: IconName;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: "md" | "lg";
}) {
  const { palette } = useA11y();
  const scheme: Record<ButtonTone, { bg: string; fg: string; shadow?: string }> = {
    primary: { bg: palette.accent, fg: "#FFFFFF", shadow: palette.accent },
    dark: { bg: palette.ink, fg: "#FFFFFF", shadow: "#1D1D1F" },
    tint: { bg: palette.accentTint, fg: palette.accentPressed },
    plain: { bg: "#F2F2F5", fg: palette.ink },
    danger: { bg: palette.danger, fg: "#FFFFFF" },
    glass: { bg: "rgba(255,255,255,0.18)", fg: "#FFFFFF" },
  };
  const c = scheme[tone];
  const height = size === "lg" ? 56 : 48;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        {
          minHeight: height,
          paddingHorizontal: spacing.xl,
          borderRadius: size === "lg" ? 18 : 16,
          backgroundColor: c.bg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        },
        c.shadow ? { shadowColor: c.shadow, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 } : null,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={c.fg} strokeWidth={2.4} /> : null}
      <T variant="headline" color={c.fg} weight="700">
        {loading ? "…" : label}
      </T>
    </PressableScale>
  );
}

export function Card({ children, style, pad = spacing.lg }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: number }) {
  const { palette } = useA11y();
  return (
    <View
      style={[
        {
          backgroundColor: palette.surface,
          borderRadius: radii.lg,
          padding: pad,
          gap: spacing.xs,
          shadowColor: "#1D1D1F",
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 1,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Grouped (inset) list container with hairline dividers between rows. */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette } = useA11y();
  return (
    <View style={[{ borderRadius: 22, backgroundColor: palette.surface, overflow: "hidden" }, style]}>{children}</View>
  );
}

export function Row({
  label,
  value,
  onPress,
  right,
  last,
  danger,
  icon,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  last?: boolean;
  danger?: boolean;
  icon?: IconName;
}) {
  const { palette } = useA11y();
  const body = (
    <View
      style={{
        minHeight: 54,
        paddingHorizontal: spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: "#E6E6EA",
      }}
    >
      {icon ? <Icon name={icon} size={20} color={danger ? palette.danger : palette.muted} /> : null}
      <View style={{ flex: 1 }}>
        <T color={danger ? palette.danger : palette.ink}>{label}</T>
      </View>
      {value ? <T muted variant="callout">{value}</T> : null}
      {right}
      {onPress && !right ? <Icon name="chevronRight" size={18} color={palette.muted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} android_ripple={{ color: "#00000010" }}>
      {body}
    </Pressable>
  );
}

/** 51x31 iOS-style switch with spring thumb. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (next: boolean) => void; label: string }) {
  const { palette, reduceMotion } = useA11y();
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = reduceMotion ? withTiming(value ? 1 : 0, { duration: 150 }) : withSpring(value ? 1 : 0, motion.spring);
  }, [value, reduceMotion, progress]);
  const track = useDerivedValue(() => progress.value);
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(track.value, [0, 1], ["#E3E3E8", palette.accent]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * 20 }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        void haptics.selection();
        onChange(!value);
      }}
    >
      <Animated.View style={[{ width: 51, height: 31, borderRadius: 999, padding: 2 }, trackStyle]}>
        <Animated.View
          style={[
            { width: 27, height: 27, borderRadius: 14, backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export function SwitchRow({ label, value, onChange, icon, last }: { label: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName; last?: boolean }) {
  return <Row label={label} icon={icon} last={last} right={<Toggle value={value} onChange={onChange} label={label} />} />;
}

/** Pill chip used for categories, tags, suggestions. */
export function Chip({ label, selected, onPress, icon, tone = "default" }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; tone?: "default" | "tint" }) {
  const { palette } = useA11y();
  const bg = selected ? palette.ink : tone === "tint" ? palette.accentTint : palette.surface;
  const fg = selected ? "#FFFFFF" : tone === "tint" ? palette.accentPressed : palette.ink;
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      scaleTo={0.96}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: radii.pill, backgroundColor: bg, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" }}
    >
      {icon ? <Icon name={icon} size={14} color={fg} strokeWidth={2.2} /> : null}
      <T variant="subhead" color={fg} weight="600">{label}</T>
    </PressableScale>
  );
}

/** Small badge. */
export function Pill({ label, bg, fg, style }: { label: string; bg: string; fg: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: bg, alignSelf: "flex-start" }, style]}>
      <T variant="caption" color={fg} weight="700">{label}</T>
    </View>
  );
}

export function SectionTitle({ children, action, onAction }: { children: string; action?: string; onAction?: () => void }) {
  const { palette } = useA11y();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
      <T variant="title2" weight="800" ls={-0.02} accessibilityRole="header">{children}</T>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={{ minHeight: 44, justifyContent: "center" }}>
          <T variant="subhead" weight="600" color={palette.accent}>{action}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return (
    <T variant="footnote" muted weight="700" ls={0.06} style={{ textTransform: "uppercase", marginTop: 6, marginHorizontal: 4 }}>
      {children}
    </T>
  );
}

export function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  const { palette } = useA11y();
  return (
    <View
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.accentTint,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: palette.gold,
      }}
    >
      <T size={Math.round(size * 0.4)} weight="800" color={palette.accentPressed}>{(name.trim()[0] ?? "G").toUpperCase()}</T>
    </View>
  );
}

/** Search field (design: 14px radius, grey fill). */
export function SearchField({ value, onChangeText, placeholder, ...rest }: TextInputProps & { value: string; placeholder: string }) {
  const { palette, appTextScale } = useA11y();
  return (
    <View style={{ minHeight: 46, borderRadius: 14, backgroundColor: "#E9EAEE", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 }}>
      <Icon name="search" size={18} color={palette.muted} />
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        style={{ flex: 1, minWidth: 0, fontSize: 17 * appTextScale, color: palette.ink, paddingVertical: 10 }}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="clear" hitSlop={10} onPress={() => onChangeText?.("")}>
          <Icon name="close" size={16} color={palette.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Labeled text field used in auth sheets. */
export function Field({ label, trailing, focused, ...rest }: TextInputProps & { label: string; trailing?: ReactNode; focused?: boolean }) {
  const { palette, appTextScale } = useA11y();
  return (
    <View style={{ gap: 6 }}>
      <T variant="footnote" weight="700" muted>{label}</T>
      <View
        style={{
          minHeight: 54,
          borderRadius: 16,
          backgroundColor: "#F2F2F5",
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 16,
          paddingRight: 6,
          borderWidth: 2,
          borderColor: focused ? palette.accent : "transparent",
        }}
      >
        <TextInput
          {...rest}
          accessibilityLabel={label}
          placeholderTextColor={palette.muted}
          style={{ flex: 1, minWidth: 0, fontSize: 17 * appTextScale, color: palette.ink, paddingVertical: 12 }}
        />
        {trailing}
      </View>
    </View>
  );
}

export function IconButton({ icon, label, onPress, size = 44, color, bg }: { icon: IconName; label: string; onPress: () => void; size?: number; color?: string; bg?: string }) {
  const { palette } = useA11y();
  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: bg }}
    >
      <Icon name={icon} size={22} color={color ?? palette.ink} />
    </PressableScale>
  );
}
