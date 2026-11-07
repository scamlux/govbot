import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import i18n from "../i18n";
import { useDocumentTitle } from "./useDocumentTitle";

const SELECTORS = ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]'];

beforeEach(() => {
  document.head.innerHTML = SELECTORS.map((sel) => {
    const [, attr, value] = sel.match(/\[(\w+)="([^"]+)"\]/);
    return `<meta ${attr}="${value}" content="static fallback" />`;
  }).join("");
});
afterEach(cleanup);

describe("useDocumentTitle meta localisation", () => {
  it.each([
    ["uz", /uch tilda sodda javoblar/],
    ["ru", /на трёх языках/],
    ["en", /in three languages/],
  ])("sets description tags and <html lang> for %s", async (lang, pattern) => {
    await i18n.changeLanguage(lang);
    renderHook(() => useDocumentTitle("/"));
    for (const selector of SELECTORS) {
      expect(document.head.querySelector(selector).getAttribute("content")).toMatch(pattern);
    }
    expect(document.documentElement.getAttribute("lang")).toBe(lang);
  });

  it("updates the tags when the language changes", async () => {
    await i18n.changeLanguage("en");
    renderHook(() => useDocumentTitle("/"));
    await act(() => i18n.changeLanguage("ru"));
    expect(document.head.querySelector(SELECTORS[0]).getAttribute("content")).toMatch(/на трёх языках/);
  });
});
