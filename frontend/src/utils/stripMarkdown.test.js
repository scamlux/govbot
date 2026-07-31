import { describe, it, expect } from "vitest";

import { stripMarkdown } from "./stripMarkdown";

describe("stripMarkdown", () => {
  it("removes heading and bold markers from a scenario excerpt", () => {
    const raw = "## Водительское удостоверение Чтобы получить, **подайте** заявление.";
    const out = stripMarkdown(raw);
    expect(out).not.toContain("##");
    expect(out).not.toContain("**");
    expect(out).toContain("Водительское удостоверение");
    expect(out).toContain("подайте");
  });

  it("keeps link text and drops the URL", () => {
    expect(stripMarkdown("See [soliq.uz](https://soliq.uz) for details")).toBe(
      "See soliq.uz for details"
    );
  });

  it("strips list bullets and collapses whitespace", () => {
    expect(stripMarkdown("- one\n- two\n\n1. three")).toBe("one two three");
  });

  it("handles empty / nullish input", () => {
    expect(stripMarkdown("")).toBe("");
    expect(stripMarkdown(undefined)).toBe("");
    expect(stripMarkdown(null)).toBe("");
  });
});
