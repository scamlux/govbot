import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import i18n from "../i18n";
import { hapticTap, isNativeApp, notificationId, scheduleReminder, shareText } from "./bridge";

vi.mock("../config/ConfigContext", () => ({ useConfig: () => ({ guest_chat: false, loaded: true }) }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../api/endpoints", () => ({
  scenariosApi: {
    detail: () =>
      Promise.resolve({
        data: { slug: "passport", title: "Passport", body: "Body text", checklist: [], category: {} },
      }),
    get: () =>
      Promise.resolve({
        data: { slug: "passport", title: "Passport", body: "Body text", checklist: [], category: {} },
      }),
  },
}));
vi.mock("../utils/ics", async (orig) => ({ ...(await orig()), downloadIcs: vi.fn() }));

import ScenarioDetail from "../pages/ScenarioDetail";
import MessageBubble from "../components/MessageBubble";
import { downloadIcs } from "../utils/ics";

function mockNative(plugins) {
  window.Capacitor = { isNativePlatform: () => true, Plugins: plugins };
}

const FUTURE = new Date(Date.now() + 5 * 86400000);
const FUTURE_ISO = `${FUTURE.getFullYear()}-${String(FUTURE.getMonth() + 1).padStart(2, "0")}-${String(FUTURE.getDate()).padStart(2, "0")}`;

beforeEach(async () => {
  await act(() => i18n.changeLanguage("en"));
});

afterEach(() => {
  cleanup();
  delete window.Capacitor;
  delete navigator.share;
  vi.clearAllMocks();
});

describe("bridge", () => {
  it("reports not-native on the plain web", async () => {
    expect(isNativeApp()).toBe(false);
    const r = await scheduleReminder({ id: 1, title: "t", body: "b", at: FUTURE });
    expect(r).toEqual({ ok: false, reason: "not-native" });
  });

  it("requests permission and schedules natively", async () => {
    const plugin = {
      checkPermissions: vi.fn().mockResolvedValue({ display: "prompt" }),
      requestPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
      schedule: vi.fn().mockResolvedValue({}),
    };
    mockNative({ LocalNotifications: plugin });
    const r = await scheduleReminder({ id: 7, title: "t", body: "b", at: FUTURE });
    expect(r.ok).toBe(true);
    expect(plugin.requestPermissions).toHaveBeenCalled();
    expect(plugin.schedule.mock.calls[0][0].notifications[0]).toMatchObject({
      id: 7,
      schedule: { at: FUTURE, allowWhileIdle: true },
    });
  });

  it("returns ok:false when permission is denied", async () => {
    const plugin = {
      checkPermissions: vi.fn().mockResolvedValue({ display: "denied" }),
      requestPermissions: vi.fn().mockResolvedValue({ display: "denied" }),
      schedule: vi.fn(),
    };
    mockNative({ LocalNotifications: plugin });
    const r = await scheduleReminder({ id: 7, title: "t", body: "b", at: FUTURE });
    expect(r).toEqual({ ok: false, reason: "denied" });
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it("derives stable positive 32-bit ids", () => {
    const id = notificationId("passport|2026-12-01");
    expect(id).toBe(notificationId("passport|2026-12-01"));
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThanOrEqual(0x7fffffff);
  });

  it("shares natively, via navigator.share, or copies", async () => {
    const native = { share: vi.fn().mockResolvedValue({}) };
    mockNative({ Share: native });
    expect(await shareText({ title: "a", text: "b", url: "c" })).toBe("native");
    delete window.Capacitor;
    navigator.share = vi.fn().mockResolvedValue();
    expect(await shareText({ title: "a", text: "b", url: "c" })).toBe("web");
    delete navigator.share;
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue() }, configurable: true });
    expect(await shareText({ title: "a", text: "b", url: "c" })).toBe("copied");
  });

  it("taps haptics only natively and never throws", () => {
    expect(() => hapticTap()).not.toThrow();
    const impact = vi.fn().mockResolvedValue();
    mockNative({ Haptics: { impact } });
    hapticTap();
    expect(impact).toHaveBeenCalledWith({ style: "LIGHT" });
  });
});

function renderScenario() {
  return render(
    <MemoryRouter initialEntries={["/scenarios/passport"]}>
      <Routes>
        <Route path="/scenarios/:slug" element={<ScenarioDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("scenario reminder and share", () => {
  it("downloads .ics on the web and hides share", async () => {
    renderScenario();
    const input = await screen.findByLabelText("Reminder date");
    fireEvent.change(input, { target: { value: FUTURE_ISO } });
    fireEvent.click(screen.getByRole("button", { name: /Download \.ics/ }));
    expect(downloadIcs).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });

  it("schedules a local notification in the native app", async () => {
    const plugin = {
      checkPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
      requestPermissions: vi.fn(),
      schedule: vi.fn().mockResolvedValue({}),
    };
    mockNative({ LocalNotifications: plugin });
    renderScenario();
    const input = await screen.findByLabelText("Reminder date");
    fireEvent.change(input, { target: { value: FUTURE_ISO } });
    fireEvent.click(screen.getByRole("button", { name: /Remind me/ }));
    await waitFor(() => expect(plugin.schedule).toHaveBeenCalled());
    expect(downloadIcs).not.toHaveBeenCalled();
    expect(await screen.findByText(/Reminder set/)).toBeTruthy();
  });

  it("shows share when navigator.share exists", async () => {
    navigator.share = vi.fn();
    renderScenario();
    expect(await screen.findByRole("button", { name: "Share" })).toBeTruthy();
  });
});

describe("chat message share", () => {
  const bubble = () =>
    render(
      <MemoryRouter>
        <MessageBubble role="assistant" content="Answer" model="gpt" messageId={1} onFeedback={() => {}} />
      </MemoryRouter>
    );

  it("hides share without native or navigator.share", () => {
    bubble();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });

  it("shares answer with GovBot signature and taps haptics on feedback", async () => {
    const share = vi.fn().mockResolvedValue({});
    const impact = vi.fn().mockResolvedValue();
    mockNative({ Share: { share }, Haptics: { impact } });
    bubble();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0].text).toContain("— GovBot");
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    expect(impact).toHaveBeenCalled();
  });
});
