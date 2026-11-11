import * as Haptics from "expo-haptics";

import { useSettings } from "../state/settings";

const enabled = (): boolean => useSettings.getState().haptics;

async function run(action: () => Promise<void>): Promise<void> {
  if (!enabled()) return;
  try {
    await action();
  } catch {
    /* device without a haptic engine */
  }
}

/** Haptic wrappers that honour the in-app switch. */
export const haptics = {
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  selection: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
