import { ApiError, PlanLimitError, errorFromResponse } from "../src/api/errors";
import { request } from "../src/api/http";
import { refreshAccessToken } from "../src/api/refresh";
import { onSessionExpired, tokenStore } from "../src/api/tokens";

const mockSecure = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecure.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockSecure.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockSecure.delete(key)),
}));

const json = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  }) as unknown as Response;

const fetchMock = jest.fn();
const calls = (needle: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes(needle));

beforeEach(async () => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  await tokenStore.clear();
  await tokenStore.setRefresh("refresh-1");
  tokenStore.setAccess("expired");
});

describe("single-flight refresh", () => {
  it("shares ONE refresh request between concurrent 401s and retries each call once", async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (String(url).includes("/auth/refresh/")) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return json(200, { access: "fresh", refresh: "refresh-2" });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === "Bearer fresh" ? json(200, { ok: true }) : json(401, { detail: "expired" });
    });

    const results = await Promise.all([
      request("/auth/me/"),
      request("/conversations/"),
      request("/billing/me/"),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(calls("/auth/refresh/")).toHaveLength(1);
    expect(tokenStore.getAccess()).toBe("fresh");
    expect(await tokenStore.getRefresh()).toBe("refresh-2"); // rotated token persisted
    // 3 first tries + 3 retries, never a second retry
    expect(fetchMock.mock.calls.length - calls("/auth/refresh/").length).toBe(6);
  });

  it("sends the refresh token in the body and no cookie opt-in header", async () => {
    fetchMock.mockResolvedValue(json(200, { access: "a" }));
    await refreshAccessToken();
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ refresh: "refresh-1" });
    expect(init.headers).not.toHaveProperty("X-Auth-Cookie");
  });

  it("wipes tokens and signals expiry when the refresh is rejected", async () => {
    const expired = jest.fn();
    const off = onSessionExpired(expired);
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("/auth/refresh/") ? json(401, { detail: "bad" }) : json(401, {}),
    );

    await expect(request("/auth/me/")).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
    expect(tokenStore.getAccess()).toBeNull();
    expect(await tokenStore.getRefresh()).toBeNull();
    off();
  });

  it("keeps the session on a network failure during refresh", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/auth/refresh/")) throw new TypeError("offline");
      return json(401, {});
    });
    await expect(request("/auth/me/")).rejects.toMatchObject({ status: 0 });
    expect(await tokenStore.getRefresh()).toBe("refresh-1");
  });

  it("does not try to refresh anonymous requests", async () => {
    fetchMock.mockResolvedValue(json(401, { detail: "nope" }));
    await expect(request("/auth/login/", { method: "POST", body: {}, anonymous: true })).rejects.toBeInstanceOf(ApiError);
    expect(calls("/auth/refresh/")).toHaveLength(0);
  });
});

describe("error mapping", () => {
  it("turns a 402 plan_limit body into a typed PlanLimitError", () => {
    const error = errorFromResponse(402, { code: "plan_limit", detail: "Limit", plan: "free", limit: 5 });
    expect(error).toBeInstanceOf(PlanLimitError);
    expect(error).toMatchObject({ status: 402, code: "plan_limit", plan: "free", limit: 5, detail: "Limit" });
  });

  it("extracts DRF field errors as the detail", () => {
    const error = errorFromResponse(400, { email: ["Already registered."] });
    expect(error).toMatchObject({ status: 400, detail: "Already registered." });
    expect(error).not.toBeInstanceOf(PlanLimitError);
  });
});
