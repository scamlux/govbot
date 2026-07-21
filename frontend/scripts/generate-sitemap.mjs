// Generates public/sitemap.xml before `vite build`.
// Static pages + all published scenarios fetched from the backend API.
// On fetch failure the sitemap falls back to static pages only (build never fails).
import { writeFileSync } from "node:fs";

const SITE = "https://govbot-web.vercel.app";
const API_BASE =
  process.env.VITE_API_BASE_URL || "https://govbot-backend-3utu.onrender.com/api";

const staticUrls = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/scenarios", changefreq: "weekly", priority: "0.8" },
  { loc: "/login", changefreq: "monthly", priority: "0.4" },
  { loc: "/register", changefreq: "monthly", priority: "0.4" },
];

let scenarioUrls = [];
try {
  // Render free tier can cold-start; give it time.
  const res = await fetch(`${API_BASE}/scenarios/`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const scenarios = await res.json();
  scenarioUrls = scenarios
    .filter((s) => typeof s.slug === "string" && s.slug.length > 0)
    .map((s) => ({
      loc: `/scenarios/${s.slug}`,
      lastmod: s.updated_at ? s.updated_at.slice(0, 10) : undefined,
      changefreq: "monthly",
      priority: "0.7",
    }));
  console.log(`sitemap: fetched ${scenarioUrls.length} scenarios from ${API_BASE}`);
} catch (err) {
  console.warn(`sitemap: scenarios fetch failed (${err.message}); static entries only`);
}

const entry = ({ loc, lastmod, changefreq, priority }) =>
  [
    "  <url>",
    `    <loc>${SITE}${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...staticUrls.map(entry),
  ...scenarioUrls.map(entry),
  "</urlset>",
  "",
].join("\n");

writeFileSync(new URL("../public/sitemap.xml", import.meta.url), xml);
console.log(`sitemap: wrote ${staticUrls.length + scenarioUrls.length} URLs to public/sitemap.xml`);
