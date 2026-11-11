import { Platform, type TextStyle } from "react-native";

export const colors = {
  bg: "#F5F6F8",
  surface: "#FFFFFF",
  ink: "#1D1D1F",
  muted: "#636366",
  line: "rgba(0,0,0,0.06)",
  accent: "#0A6E78",
  accentPressed: "#075A62",
  accentTint: "#E6F3F4",
  gold: "#C9A55A",
  goldDeep: "#B8913F",
  danger: "#B3261E",
  success: "#1E7F4F",
  warnTint: "#FDF6E6",
} as const;

/** High-contrast overrides: darker secondary text and stronger hairlines. */
export const highContrastColors = {
  ...colors,
  muted: "#3A3A3C",
  line: "rgba(0,0,0,0.28)",
} as const;

export type Palette = { [K in keyof typeof colors]: string };

/** User-selectable accents (all pass AA with white text). */
export const accents = {
  teal: { accent: "#0A6E78", accentPressed: "#075A62", accentTint: "#E6F3F4" },
  lapis: { accent: "#1F4E9E", accentPressed: "#173B7A", accentTint: "#E8EEFA" },
  pomegranate: { accent: "#A3283F", accentPressed: "#7F1F31", accentTint: "#FBEDF0" },
} as const;
export type AccentName = keyof typeof accents;
export const ACCENT_NAMES = Object.keys(accents) as AccentName[];

/** Category colour families (tint bg, strong stroke, solid hero). */
export const families = {
  teal: { tint: "#E6F3F4", ink: "#075A62", solid: "#0A6E78" },
  gold: { tint: "#FDF6E6", ink: "#7A5413", solid: "#8A6A1F" },
  lapis: { tint: "#EEF2FB", ink: "#2C4C8C", solid: "#1F4E9E" },
  pomegranate: { tint: "#FBEDF0", ink: "#8E2C43", solid: "#A3283F" },
} as const;
export type FamilyName = keyof typeof families;

/** Dark deep-teal used by the voice screen and orb. */
export const voiceColors = { bg0: "#0E5960", bg1: "#073A40", bg2: "#04262A", orb: "#2BA3A8", ring: "#E7C98A" } as const;

export const radii = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const fontFamily = Platform.select({ ios: "System", default: "Roboto" }) as string;

type TypeStyle = Pick<TextStyle, "fontSize" | "lineHeight" | "fontWeight">;

export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700" },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 17, lineHeight: 24, fontWeight: "400" },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400" },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
} as const satisfies Record<string, TypeStyle>;

export type TypeName = keyof typeof type;

export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 1 },
  springSoft: { damping: 22, stiffness: 140, mass: 1 },
  duration: { fast: 150, base: 220, slow: 320 },
  /** cubic-bezier(0.2, 0, 0, 1) as control points for Easing.bezier. */
  easingStandard: [0.2, 0, 0, 1] as const,
} as const;

/** Extra scale applied by the in-app "XL text" switch. */
export const XL_TEXT_SCALE = 1.2;
