import { useMemo } from "react";
import { Easing, FadeIn, Keyframe } from "react-native-reanimated";

import { useA11y } from "../theme/a11y";

/** Stagger step used for lists and launch text (Motion spec: 150ms launch, 60ms sources). */
export const STAGGER = { launch: 150, list: 60 } as const;

/**
 * `entering` animation: rise 16px + fade over 700ms (launch) or the given duration.
 * With reduce-motion this collapses to a 150ms crossfade.
 */
export function useRise(delay = 0, distance = 16, duration = 450) {
  const { reduceMotion } = useA11y();
  return useMemo(() => {
    if (reduceMotion) return FadeIn.duration(150);
    return new Keyframe({
      0: { opacity: 0, transform: [{ translateY: distance }] },
      100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(0.2, 0.9, 0.25, 1) },
    })
      .duration(duration)
      .delay(delay);
  }, [reduceMotion, delay, distance, duration]);
}
