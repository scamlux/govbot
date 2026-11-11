import { ApiError, PlanLimitError } from "../src/api/errors";
import type { Plan, ScenarioDetail } from "../src/api/types";
import { authErrorKey } from "../src/domain/authErrors";
import { categoryStyle } from "../src/domain/categories";
import { bucketFor, daysUntil, greetingKey } from "../src/domain/dates";
import { canOpenPaywall, checkoutUrl, formatPrice, paywallMode, purchasablePlans } from "../src/domain/paywall";
import { pickVoiceLocale, volumeToLevel } from "../src/domain/voice";
import { activeSlugs, buildCase } from "../src/query/cases";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const plan = (over: Partial<Plan>): Plan => ({ code: "plus", name: "Plus", price_uzs: 29000, for_sale: true, period_days: 30, daily_question_limit: null, features: [], ...over });

describe("paywall gating", () => {
  it("offers purchases only when billing is enabled", () => {
    expect(paywallMode(true)).toBe("plans");
    expect(paywallMode(false)).toBe("limit-only");
    expect(paywallMode(undefined)).toBe("limit-only");
  });

  it("is reachable from Profile only with billing, always after a 402", () => {
    expect(canOpenPaywall(false, false)).toBe(false);
    expect(canOpenPaywall(true, false)).toBe(true);
    expect(canOpenPaywall(false, true)).toBe(true);
  });

  it("lists only purchasable plans and formats prices", () => {
    const plans = [plan({ code: "free", price_uzs: null, for_sale: false }), plan({}), plan({ code: "biz", for_sale: false })];
    expect(purchasablePlans(plans).map((p) => p.code)).toEqual(["plus"]);
    expect(formatPrice(129000)).toBe("129 000");
    expect(checkoutUrl({ checkout_url: "https://pay" })).toBe("https://pay");
    expect(checkoutUrl({})).toBeNull();
  });

  it("recognises 402 plan_limit errors", () => {
    const e = new PlanLimitError("limit", { plan: "free", limit: 5 });
    expect(e.limit).toBe(5);
    expect(e.status).toBe(402);
  });
});

describe("auth errors", () => {
  it("maps credentials, network and generic failures to localized keys", () => {
    expect(authErrorKey(new ApiError(401, null, "x"), "login")).toBe("auth.invalidCredentials");
    expect(authErrorKey(new ApiError(0, "network", "x"), "login")).toBe("m.auth.network");
    expect(authErrorKey(new ApiError(500, null, "x"), "register")).toBe("auth.registerFailed");
    expect(authErrorKey(new Error("?"), "login")).toBe("auth.loginFailed");
  });
});

describe("dates", () => {
  const now = new Date(2026, 10, 11, 15, 0, 0);
  it("counts calendar days and buckets history", () => {
    expect(daysUntil(new Date(2026, 10, 14, 1), now)).toBe(3);
    expect(bucketFor(new Date(2026, 10, 11, 8).toISOString(), now)).toBe("today");
    expect(bucketFor(new Date(2026, 10, 7).toISOString(), now)).toBe("week");
    expect(bucketFor(new Date(2026, 9, 1).toISOString(), now)).toBe("earlier");
    expect(greetingKey(new Date(2026, 0, 1, 9))).toBe("goodMorning");
    expect(greetingKey(new Date(2026, 0, 1, 20))).toBe("goodEvening");
  });
});

describe("cases", () => {
  const detail = { slug: "bio", title: "Bio passport", category: { slug: "identity-documents" }, checklist: ["Photo", "Fee", "Visit"] } as unknown as ScenarioDetail;
  const now = new Date(2026, 10, 11, 10);

  it("derives progress, next item and days left", () => {
    const item = buildCase(detail, { "checklist:bio": ["Photo"] }, [{ id: "n1", slug: "bio", title: "Bio", fireAt: new Date(2026, 10, 14, 9).toISOString() }], now);
    expect(item).toMatchObject({ slug: "bio", done: 1, total: 3, nextItem: "Fee", daysLeft: 3 });
  });

  it("activeSlugs merges ticked checklists and reminders, skipping empty ones", () => {
    const slugs = activeSlugs({ "checklist:a": ["x"], "checklist:b": [] }, [{ id: "1", slug: "c", title: "", fireAt: "" }, { id: "2", slug: "a", title: "", fireAt: "" }]);
    expect(slugs.sort()).toEqual(["a", "c"]);
  });

  it("falls back to documents/teal for unknown categories", () => {
    expect(categoryStyle("nope")).toEqual({ icon: "docs", family: "teal" });
    expect(categoryStyle("taxes").family).toBe("gold");
  });
});

describe("voice locale", () => {
  it("uses the UI language when supported and falls back to ru/en for Uzbek", () => {
    expect(pickVoiceLocale("uz", ["uz-UZ", "ru-RU"])).toEqual({ locale: "uz-UZ", lang: "uz", fellBack: false });
    expect(pickVoiceLocale("uz", ["ru-RU", "en-US"])).toEqual({ locale: "ru-RU", lang: "ru", fellBack: true });
    expect(pickVoiceLocale("uz", ["en-US"])).toMatchObject({ lang: "en", fellBack: true });
    expect(pickVoiceLocale("ru", [])).toMatchObject({ locale: "ru-RU", fellBack: false });
  });

  it("maps volume to 0..1", () => {
    expect(volumeToLevel(-5)).toBe(0);
    expect(volumeToLevel(10)).toBe(1);
    expect(volumeToLevel(4)).toBeCloseTo(0.5);
  });
});
