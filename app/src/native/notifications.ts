import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { REMINDER_HOUR } from "../config";
import { useReminders, type Reminder } from "../state/reminders";

const CHANNEL_ID = "reminders";

/** Call once at startup: show banners for notifications that arrive in the foreground. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#0A6E78",
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/** 09:00 local time on the given calendar day. */
export function reminderMoment(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), REMINDER_HOUR, 0, 0, 0);
}

export type ScheduleResult =
  | { ok: true; reminder: Reminder }
  | { ok: false; reason: "denied" | "past" };

/** Schedule a local reminder at 09:00 on `day` for a scenario and remember it. */
export async function scheduleReminder(input: {
  slug: string;
  title: string;
  body: string;
  day: Date;
  now?: Date;
}): Promise<ScheduleResult> {
  const fireAt = reminderMoment(input.day);
  if (fireAt <= (input.now ?? new Date())) return { ok: false, reason: "past" };
  if (!(await ensureNotificationPermission())) return { ok: false, reason: "denied" };

  await ensureChannel();
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: input.title, body: input.body, data: { slug: input.slug } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: CHANNEL_ID,
    },
  });
  const reminder: Reminder = { id, slug: input.slug, title: input.title, fireAt: fireAt.toISOString() };
  useReminders.getState().add(reminder);
  return { ok: true, reminder };
}

export async function cancelReminder(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
  useReminders.getState().remove(id);
}

/** Pending OS-level notifications, reconciled into the local store (drops fired ones). */
export async function listReminders(): Promise<readonly Reminder[]> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const pendingIds = new Set(pending.map((entry) => entry.identifier));
  const store = useReminders.getState();
  store.reminders.filter((r) => !pendingIds.has(r.id)).forEach((r) => store.remove(r.id));
  return useReminders.getState().reminders;
}
