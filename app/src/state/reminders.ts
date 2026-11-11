import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { asyncJsonStorage } from "./storage";

export interface Reminder {
  /** expo-notifications identifier, also the list id. */
  id: string;
  slug: string;
  title: string;
  /** ISO timestamp the notification fires. */
  fireAt: string;
}

export type RemindersState = {
  reminders: readonly Reminder[];
  add: (reminder: Reminder) => void;
  remove: (id: string) => void;
  /** Drops reminders whose time has passed. */
  pruneExpired: (now?: Date) => void;
};

export const useReminders = create<RemindersState>()(
  persist(
    (set, get) => ({
      reminders: [],
      add: (reminder) =>
        set({
          reminders: [...get().reminders.filter((r) => r.id !== reminder.id), reminder].sort(
            (a, b) => a.fireAt.localeCompare(b.fireAt),
          ),
        }),
      remove: (id) => set({ reminders: get().reminders.filter((r) => r.id !== id) }),
      pruneExpired: (now = new Date()) =>
        set({ reminders: get().reminders.filter((r) => new Date(r.fireAt) > now) }),
    }),
    { name: "govbot.reminders", storage: createJSONStorage(() => asyncJsonStorage) },
  ),
);
