import { readFileSync } from "fs";
import { join } from "path";

type Json = { [key: string]: Json | string | number | boolean | null | Json[] };

const load = (file: string): Json =>
  JSON.parse(readFileSync(join(__dirname, "..", "src", "i18n", file), "utf8"));

/** i18next plural forms legitimately differ per language (ru has _few/_many, en does not). */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function flatten(node: Json | string | number | boolean | null | Json[], prefix = ""): string[] {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return [prefix.replace(PLURAL_SUFFIX, "")];
  }
  return Object.entries(node).flatMap(([key, value]) => flatten(value, prefix ? `${prefix}.${key}` : key));
}

const unique = (keys: string[]) => [...new Set(keys)].sort();
const diff = (a: string[], b: string[]) => a.filter((key) => !b.includes(key));

describe.each([
  ["web copies", ["uz.json", "ru.json", "en.json"]],
  ["mobile strings", ["mobile.uz.json", "mobile.ru.json", "mobile.en.json"]],
] as const)("i18n key parity: %s", (_label, files) => {
  const keys = files.map((file) => unique(flatten(load(file))));

  it.each([1, 2])("has identical keys to the first file (%i)", (index) => {
    expect(diff(keys[0], keys[index])).toEqual([]);
    expect(diff(keys[index], keys[0])).toEqual([]);
  });

  it("has no empty strings", () => {
    files.forEach((file) => {
      const text = readFileSync(join(__dirname, "..", "src", "i18n", file), "utf8");
      expect(text).not.toMatch(/:\s*""/);
    });
  });
});

describe("web copies stay in sync with the web frontend", () => {
  it.each(["uz.json", "ru.json", "en.json"])("%s equals frontend/src/i18n/%s", (file) => {
    const web = join(__dirname, "..", "..", "frontend", "src", "i18n", file);
    let source: string;
    try {
      source = readFileSync(web, "utf8");
    } catch {
      return; // app/ checked out without the monorepo: nothing to compare
    }
    expect(unique(flatten(JSON.parse(source)))).toEqual(unique(flatten(load(file))));
  });
});
