// Imports the QS World University Rankings 2027 table into data/raw/qs-wur-2027.json.
// Run with: npm run data:qs
//
// Source: qs-topuniversities.cn, QS's own site (footer "© QS Quacquarelli Symonds Limited");
// robots.txt allows the ranking pages. topuniversities.com serves a Cloudflare challenge to scripts.
// The ranking page loads its table from a JSON file named in the page's Drupal settings
// (`rank_url`); this reads the page, follows that URL and keeps the columns the site uses.
// Adapted from the v1 demo's import script; v1's data file is not reused.

import { mkdirSync, writeFileSync } from "node:fs";

const PAGE = "https://qs-topuniversities.cn/en/university-rankings/world-university-rankings/2027";
const ORIGIN = new URL(PAGE).origin;
const OUT = new URL("../../data/raw/qs-wur-2027.json", import.meta.url);

function decode(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function rankValue(display) {
  const m = /^=?(\d+)/.exec(display);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

const html = await (await fetch(PAGE)).text();
const settings = /data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/.exec(html);
if (!settings) throw new Error("Drupal settings not found on the ranking page");
const rankUrl = /"rank_url":"([^"]+)"/.exec(settings[1])?.[1].replace(/\\\//g, "/");
if (!rankUrl) throw new Error("rank_url not found in the ranking page settings");

const { data } = JSON.parse((await (await fetch(rankUrl)).text()).replace(/^﻿/, ""));
const universities = data
  .map((r) => ({
    qsId: r.core_id,
    rank: r.rank_display,
    rankValue: rankValue(r.rank_display),
    name: decode(r.title),
    country: r.country || null,
    url: ORIGIN + (/href="([^"]+)"/.exec(r.title)?.[1] ?? ""),
  }))
  .sort((a, b) => a.rankValue - b.rankValue || a.name.localeCompare(b.name));

const out = {
  dataset: "QS World University Rankings 2027",
  source: PAGE,
  dataFile: rankUrl,
  publisher: "QS Quacquarelli Symonds Limited",
  licence:
    "QS rankings data: shown unchanged with attribution, non-commercial. Not included in the public xlsx export.",
  retrievedAt: new Date().toLocaleDateString("sv-SE"), // local YYYY-MM-DD
  count: universities.length,
  universities,
};
mkdirSync(new URL(".", OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`Wrote ${universities.length} universities to data/raw/qs-wur-2027.json`);
