import * as Notifications from "expo-notifications";

import { cancelReminder, listReminders, reminderMoment, scheduleReminder } from "../src/native/notifications";
import { useReminders } from "../src/state/reminders";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date" },
  AndroidImportance: { DEFAULT: 3 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => "notif-1"),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
}));

const mocked = Notifications as unknown as {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  scheduleNotificationAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
  getAllScheduledNotificationsAsync: jest.Mock;
};

const NOW = new Date(2026, 10, 11, 12, 0, 0);

beforeEach(() => {
  jest.clearAllMocks();
  useReminders.setState({ reminders: [] });
  mocked.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
});

describe("reminder scheduling", () => {
  it("fires at 09:00 local on the chosen day", () => {
    const moment = reminderMoment(new Date(2026, 11, 12, 17, 45));
    expect([moment.getFullYear(), moment.getMonth(), moment.getDate(), moment.getHours(), moment.getMinutes()]).toEqual([2026, 11, 12, 9, 0]);
  });

  it("schedules a DATE trigger and records the reminder", async () => {
    const result = await scheduleReminder({ slug: "passport", title: "Passport", body: "b", day: new Date(2026, 11, 12), now: NOW });
    expect(result.ok).toBe(true);
    const call = mocked.scheduleNotificationAsync.mock.calls[0][0];
    expect(call.trigger.type).toBe("date");
    expect(call.trigger.date.getHours()).toBe(9);
    expect(call.content.data).toEqual({ slug: "passport" });
    expect(useReminders.getState().reminders).toEqual([expect.objectContaining({ id: "notif-1", slug: "passport" })]);
  });

  it("refuses a moment in the past without scheduling", async () => {
    const result = await scheduleReminder({ slug: "x", title: "t", body: "b", day: new Date(2026, 10, 11), now: NOW });
    expect(result).toEqual({ ok: false, reason: "past" });
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("asks for permission and stops when denied", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mocked.requestPermissionsAsync.mockResolvedValue({ granted: false });
    const result = await scheduleReminder({ slug: "x", title: "t", body: "b", day: new Date(2026, 11, 20), now: NOW });
    expect(result).toEqual({ ok: false, reason: "denied" });
    expect(mocked.requestPermissionsAsync).toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("cancel removes it from the OS and the store", async () => {
    await scheduleReminder({ slug: "x", title: "t", body: "b", day: new Date(2026, 11, 20), now: NOW });
    await cancelReminder("notif-1");
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notif-1");
    expect(useReminders.getState().reminders).toEqual([]);
  });

  it("listReminders drops reminders that already fired", async () => {
    await scheduleReminder({ slug: "x", title: "t", body: "b", day: new Date(2026, 11, 20), now: NOW });
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    expect(await listReminders()).toEqual([]);
  });
});
