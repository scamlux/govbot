import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { asyncJsonStorage } from "./storage";

/**
 * Checklist progress, mirroring the web (`govbot.checklist.<slug>` in localStorage):
 * the value is the list of ticked item TEXTS (not indexes), so edits to the item order
 * server-side do not shift ticks. Stored under the key `checklist:<slug>`.
 */
export const checklistKey = (slug: string): string => `checklist:${slug}`;

export type ChecklistState = {
  progress: Record<string, readonly string[]>;
  /** Flip one item and return the new ticked list. */
  toggle: (slug: string, item: string) => readonly string[];
  clear: (slug: string) => void;
  doneCount: (slug: string, items: readonly string[]) => number;
};

export const useChecklist = create<ChecklistState>()(
  persist(
    (set, get) => ({
      progress: {},
      toggle: (slug, item) => {
        const key = checklistKey(slug);
        const current = get().progress[key] ?? [];
        const next = current.includes(item)
          ? current.filter((entry) => entry !== item)
          : [...current, item];
        set({ progress: { ...get().progress, [key]: next } });
        return next;
      },
      clear: (slug) => {
        const { [checklistKey(slug)]: _removed, ...rest } = get().progress;
        set({ progress: rest });
      },
      // Counts only ticks that still exist in the current items (same as the web's Set filter).
      doneCount: (slug, items) => {
        const ticked = get().progress[checklistKey(slug)] ?? [];
        return items.filter((item) => ticked.includes(item)).length;
      },
    }),
    { name: "govbot.checklist", storage: createJSONStorage(() => asyncJsonStorage) },
  ),
);
