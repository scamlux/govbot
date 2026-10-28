import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

// The real axios.create() is kept (we inspect the instance defaults); only the
// bare axios.post used by the refresh call is mocked.
vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal();
  return { default: Object.assign(actual.default, { post }) };
});

async function loadClient() {
  vi.resetModules();
  return import("./client");
}

beforeEach(() => {
  localStorage.clear();
  post.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("client auth (httpOnly refresh cookie)", () => {
  it("keeps the access token in memory only, never in localStorage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { tokenStore } = await loadClient();
    tokenStore.set({ access: "A1", refresh: "R-should-be-ignored" });
    expect(tokenStore.getAccess()).toBe("A1");
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    tokenStore.clear();
    expect(tokenStore.getAccess()).toBeNull();
  });

  it("sends the X-Auth-Cookie opt-in header on API requests", async () => {
    const { default: api } = await loadClient();
    expect(api.defaults.headers["X-Auth-Cookie"]).toBe("1");
  });

  it("refresh sends the opt-in header and an empty body when there is no legacy token", async () => {
    post.mockResolvedValue({ data: { access: "A2" } });
    const { refreshAccessToken, tokenStore } = await loadClient();
    await expect(refreshAccessToken()).resolves.toBe("A2");
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toMatch(/\/auth\/refresh\/$/);
    expect(body).toEqual({});
    expect(config.headers["X-Auth-Cookie"]).toBe("1");
    expect(tokenStore.getAccess()).toBe("A2");
  });

  it("sends a legacy localStorage refresh token once, then removes both legacy keys", async () => {
    localStorage.setItem("govbot.refresh", "LEGACY");
    localStorage.setItem("govbot.access", "OLD");
    post.mockResolvedValue({ data: { access: "A3" } });
    const { refreshAccessToken } = await loadClient();
    // The old access token is dropped from storage immediately on init.
    expect(localStorage.getItem("govbot.access")).toBeNull();

    await refreshAccessToken();
    expect(post.mock.calls[0][1]).toEqual({ refresh: "LEGACY" });
    expect(post.mock.calls[0][2].headers["X-Auth-Cookie"]).toBe("1");
    expect(localStorage.getItem("govbot.refresh")).toBeNull();
    expect(localStorage.getItem("govbot.access")).toBeNull();

    await refreshAccessToken();
    expect(post.mock.calls[1][1]).toEqual({}); // legacy token is never resent
  });

  it("removes legacy keys even when the migration refresh fails", async () => {
    localStorage.setItem("govbot.refresh", "LEGACY");
    post.mockRejectedValue({ response: { status: 500 } });
    const { refreshAccessToken } = await loadClient();
    await expect(refreshAccessToken()).rejects.toBeDefined();
    expect(localStorage.getItem("govbot.refresh")).toBeNull();
  });

  it("retries a 401 refresh once, then dispatches govbot:logout", async () => {
    post.mockRejectedValue({ response: { status: 401 } });
    const onLogout = vi.fn();
    window.addEventListener("govbot:logout", onLogout);
    const { refreshAccessToken } = await loadClient();
    await expect(refreshAccessToken()).rejects.toBeDefined();
    window.removeEventListener("govbot:logout", onLogout);
    expect(post).toHaveBeenCalledTimes(2);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("succeeds when the retry after a 401 works (another tab rotated the cookie)", async () => {
    post
      .mockRejectedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: { access: "A4" } });
    const onLogout = vi.fn();
    window.addEventListener("govbot:logout", onLogout);
    const { refreshAccessToken } = await loadClient();
    await expect(refreshAccessToken()).resolves.toBe("A4");
    window.removeEventListener("govbot:logout", onLogout);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("silent refresh (boot probe) does not dispatch govbot:logout on 401", async () => {
    post.mockRejectedValue({ response: { status: 401 } });
    const onLogout = vi.fn();
    window.addEventListener("govbot:logout", onLogout);
    const { refreshAccessToken } = await loadClient();
    await expect(refreshAccessToken({ silent: true })).rejects.toBeDefined();
    window.removeEventListener("govbot:logout", onLogout);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("serialises refreshes through navigator.locks when available", async () => {
    post.mockResolvedValue({ data: { access: "A5" } });
    const request = vi.fn((_name, fn) => fn());
    vi.stubGlobal("navigator", { locks: { request } });
    const { refreshAccessToken } = await loadClient();
    await refreshAccessToken();
    expect(request).toHaveBeenCalledWith("govbot-refresh", expect.any(Function));
  });
});
