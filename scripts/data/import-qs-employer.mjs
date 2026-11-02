// Imports each university's Employer Reputation score and rank from the QS World University Rankings 2027 into
// data/raw/qs-employer-2027.json, keyed by our institution id (data/raw/institutions.json, matched on the QS id).
// Run with: npm run data:qs-employer
//
// The finder's industry recognition falls back to this university-wide figure where QS by Subject 2026 has no
// employer score for the discipline (lib/finder/criteria.ts). The ranking page names two JSON files in its Drupal
// settings: `rank_url` (the table, with the QS id) and `rank_indicators_url` (every indicator, keyed by an indicator id,
// no labels). Indicator 77 is Employer Reputation: across the 519 universities in both, it correlates 0.85 with
// the Business & Management subject table's Employer score, every other indicator 0.70 or less (checked 2026-11-02).
// A separate file so the QS ranks in qs-wur-2027.json (import-qs.mjs) are not refreshed with it.
// Where Node cannot reach the site (connect timeouts seen 2026-11-02 while curl worked), pass a folder holding
// page.html, rank.json and indicators.json saved with curl: npm run data:qs-employer -- <folder>

import { readFileSync, writeFileSync } from "node:fs";

const PAGE = "https://qs-topuniversities.cn/en/university-rankings/world-university-rankings/2027";
const EMPLOYER = "77";
const OUT = new URL("../../data/raw/qs-employer-2027.json", import.meta.url);
const INSTITUTIONS = JSON.parse(readFileSync(new URL("../../data/raw/institutions.json", import.meta.url), "utf8")).institutions;

const strip = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
const LOCAL = process.argv[2];
const text = async (url, file) => (LOCAL ? readFileSync(`${LOCAL}/${file}`, "utf8") : (await fetch(url)).text());
const json = async (url, file) => JSON.parse((await text(url, file)).replace(/^﻿/, ""));

const html = await text(PAGE, "page.html");
const settings = /data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/.exec(html)?.[1];
if (!settings) throw new Error("Drupal settings not found on the ranking page");
const url = (key) => {
  const u = new RegExp(`"${key}":"([^"]+)"`).exec(settings)?.[1].replace(/\\\//g, "/");
  if (!u) throw new Error(`${key} not found in the ranking page settings`);
  return u;
};
const rankUrl = url("rank_url");
const indicatorsUrl = url("rank_indicators_url");
const ranks = (await json(rankUrl, "rank.json")).data;
const indicators = (await json(indicatorsUrl, "indicators.json")).data;

const qsIdByName = new Map(ranks.map((r) => [strip(r.title), r.core_id]));
const ourIdByQs = new Map(INSTITUTIONS.filter((i) => i.qs?.id).map((i) => [i.qs.id, i.id]));
const universities = {};
let unnamed = 0;
for (const r of indicators) {
  const score = Number(strip(r[`ind_${EMPLOYER}`]));
  const qsId = qsIdByName.get(strip(r.uni));
  if (!qsId) unnamed++;
  const id = qsId && ourIdByQs.get(qsId);
  if (!id || !Number.isFinite(score) || strip(r[`ind_${EMPLOYER}`]) === "") continue;
  universities[id] = { score, rank: strip(r[`rank_d_${EMPLOYER}`]).replace(/^=/, "") || null };
}

const out = {
  dataset: "QS World University Rankings 2027 — Employer Reputation",
  source: PAGE,
  dataFile: indicatorsUrl,
  publisher: "QS Quacquarelli Symonds Limited",
  licence: "QS rankings data: shown unchanged with attribution, non-commercial.",
  retrievedAt: new Date().toLocaleDateString("sv-SE"),
  count: Object.keys(universities).length,
  universities,
};
writeFileSync(OUT, JSON.stringify(out) + "\n");
console.log(`Wrote ${out.count} universities to data/raw/qs-employer-2027.json (${indicators.length} rows, ${unnamed} not matched to the table by name)`);
