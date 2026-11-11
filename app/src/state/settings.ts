import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Lang } from "../config";
import { asyncJsonStorage } from "./storage";

export type SettingsState = {
  /** null until the user picks a language; then device locale -> uz decides. */
  language: Lang | null;
  xlText: boolean;
  highContrast: boolean;
  haptics: boolean;
  /** null follows the OS "reduce motion" setting. */
  reduceMotionOverride: boolean | null;
  onboarded: boolean;
  setLanguage: (language: Lang) => void;
  setXlText: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
  setHaptics: (value: boolean) => void;
  setReduceMotionOverride: (value: boolean | null) => void;
  setOnboarded: (value: boolean) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: null,
      xlText: false,
      highContrast: false,
      haptics: true,
      reduceMotionOverride: null,
      onboarded: false,
      setLanguage: (language) => set({ language }),
      setXlText: (xlText) => set({ xlText }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setHaptics: (haptics) => set({ haptics }),
      setReduceMotionOverride: (reduceMotionOverride) => set({ reduceMotionOverride }),
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    { name: "govbot.settings", storage: createJSONStorage(() => asyncJsonStorage) },
  ),
);
