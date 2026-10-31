import { describe, expect, it } from "vitest";
import en from "./en.json";
import ru from "./ru.json";
import uz from "./uz.json";

// Locale drift guard: every UI string must exist in uz / ru / en. Plural keys are
// compared by base name, and each language must carry exactly the CLDR forms it
// needs (ru adds _few/_many; uz/en only _one/_other) — so those aren't "missing".
const LOCALES = { uz, ru, en };
const PLURAL_RE = /_(zero|one|two|few|many|other)$/;
// Values that are intentionally empty in one language.
const ALLOWED_EMPTY = new Set(["ru:landing.heroAfter"]);

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const flat = Object.fromEntries(Object.entries(LOCALES).map(([l, o]) => [l, flatten(o)]));
const base = (key) => key.replace(PLURAL_RE, "");
const placeholders = (s) => (String(s).match(/\{\{\s*[\w.]+\s*\}\}/g) || []).map((p) => p.replace(/\s/g, "")).sort().join(",");

const allBases = new Set(Object.values(flat).flatMap((d) => Object.keys(d).map(base)));
const pluralBases = new Set(
  Object.values(flat).flatMap((d) => Object.keys(d).filter((k) => PLURAL_RE.test(k)).map(base)),
);

describe.each(Object.keys(LOCALES))("locale %s", (lang) => {
  const keys = flat[lang];

  it("has every key that any other locale has", () => {
    const own = new Set(Object.keys(keys).map(base));
    expect([...allBases].filter((b) => !own.has(b))).toEqual([]);
  });

  it("has exactly the plural forms its language needs", () => {
    const forms = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
    const problems = [];
    for (const b of pluralBases) {
      for (const f of forms) if (!(`${b}_${f}` in keys)) problems.push(`missing ${b}_${f}`);
      for (const k of Object.keys(keys)) {
        if (base(k) === b && PLURAL_RE.test(k) && !forms.includes(k.match(PLURAL_RE)[1])) {
          problems.push(`unused ${k}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("has no empty values", () => {
    const empty = Object.entries(keys).filter(([k, v]) => !v && !ALLOWED_EMPTY.has(`${lang}:${k}`));
    expect(empty.map(([k]) => k)).toEqual([]);
  });

  it("uses the same {{placeholders}} as uz", () => {
    const bad = Object.entries(keys)
      .filter(([k]) => !PLURAL_RE.test(k) && k in flat.uz)
      .filter(([k, v]) => placeholders(v) !== placeholders(flat.uz[k]))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });
});
