import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, PixelRatio, type TextStyle } from "react-native";

import { useSettings } from "../state/settings";
import {
  accents,
  colors,
  highContrastColors,
  type Palette,
  type TypeName,
  type,
  XL_TEXT_SCALE,
} from "./tokens";

/** OS "reduce motion", live. */
export function useOsReduceMotion(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => active && setEnabled(value))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setEnabled);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return enabled;
}

export interface A11y {
  palette: Palette;
  /** Extra multiplier from the app "XL text" switch (1 or 1.2). */
  appTextScale: number;
  /** OS font scale; RN Text already applies it, exposed for fixed-size layouts. */
  osFontScale: number;
  highContrast: boolean;
  reduceMotion: boolean;
  /** Type-scale style with the app XL multiplier applied (OS scale stays with RN). */
  textStyle: (name: TypeName) => TextStyle;
}

/** Single source for palette + text scale + motion preference. */
export function useA11y(): A11y {
  const xlText = useSettings((s) => s.xlText);
  const highContrast = useSettings((s) => s.highContrast);
  const override = useSettings((s) => s.reduceMotionOverride);
  const accent = useSettings((s) => s.accent);
  const osReduceMotion = useOsReduceMotion();

  return useMemo(() => {
    const appTextScale = xlText ? XL_TEXT_SCALE : 1;
    return {
      palette: { ...(highContrast ? highContrastColors : colors), ...accents[accent] },
      appTextScale,
      osFontScale: PixelRatio.getFontScale(),
      highContrast,
      reduceMotion: override ?? osReduceMotion,
      textStyle: (name: TypeName): TextStyle => {
        const base = type[name];
        return {
          fontSize: Math.round(base.fontSize * appTextScale),
          lineHeight: Math.round(base.lineHeight * appTextScale),
          fontWeight: base.fontWeight,
        };
      },
    };
  }, [xlText, highContrast, override, osReduceMotion, accent]);
}
