import { afterEach, describe, expect, it, vi } from "vitest";

// R5 — fetchRelated goes through the shared axios instance (default export of
// ./client), which carries the JWT + 401-refresh interceptors. We mock that
// instance's `get` and assert the URL/params and that the payload is parsed.
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("./client", () => ({
  default: { get },
  API_BASE_URL: "http://t/api",
  tokenStore: { getAccess: () => "tok", getRefresh: () => null },
  refreshAccessToken: vi.fn(),
}));

import { fetchRelated } from "./endpoints";

afterEach(() => {
  vi.clearAllMocks();
});

describe("fetchRelated", () => {
  it("GETs /chat/related/ with message+lang params and parses related_questions", async () => {
    get.mockResolvedValue({
      data: {
        related_questions: [
          { slug: "passport", title: "How do I renew my passport?" },
          { slug: "biz", title: "How do I register a business?" },
        ],
      },
    });

    const result = await fetchRelated("visa help", "en");

    expect(get).toHaveBeenCalledWith("/chat/related/", {
      params: { message: "visa help", lang: "en" },
    });
    expect(result).toEqual([
      { slug: "passport", title: "How do I renew my passport?" },
      { slug: "biz", title: "How do I register a business?" },
    ]);
  });

  it("returns an empty array when the payload has no related_questions", async () => {
    get.mockResolvedValue({ data: {} });
    expect(await fetchRelated("nothing", "uz")).toEqual([]);
  });
});
