// 指南者 (compassedu.hk) public offer case library: the listing pages of each country's offers, one list per
// undergraduate category the site files them under (985 / 211 / 普通本科 / 海外本科), so each case arrives with its
// category. robots.txt allows the site; no login, one request at a time (run with PIPELINE_INTERVAL_MS=4000); a page
// that comes back without cases ends its list, and a challenge page stops the run (it is never answered).
// Kept per case: id, offer university and programme (the title, in Chinese), undergraduate school, major, and the
// background line (status, GPA, English score) as shown. Students' initials are not kept.
// Raw pages are cached gzipped so parsing can change without fetching again.
// Writes data/pipeline/compass/cases.json. Usage: PIPELINE_INTERVAL_MS=4000 npx tsx scripts/pipeline/compass-cases.ts [--only=c11b1] [--refresh]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { closeBrowser } from "./browser";
import { CACHE_DIR, DATA_DIR } from "./config";
import { politeFetch } from "./http";
import { args, keepRunning, today, writeJson } from "./util";

export const COMPASS_DIR = path.join(DATA_DIR, "compass");
export const COMPASS_CASES_FILE = path.join(COMPASS_DIR, "cases.json");
const PAGE_CACHE = path.join(CACHE_DIR, "compass");
const BASE = "https://www.compassedu.hk";
const PER_PAGE = 30;

/** The agency's country filters (its own codes): Hong Kong and Singapore first, then the rest (2026-10-22). */
export const COUNTRIES: Record<string, string> = { 11: "hk", 10: "sg", 7: "uk", 12: "us", 9: "au", 13: "mo", 1332: "eu", 1253: "my", 1205: "cn" };
export const CATEGORIES = { 1: "985", 2: "211", 3: "普通本科", 4: "海外本科" } as const;

export type CompassCase = {
  id: number;
  country: string;
  category: (typeof CATEGORIES)[keyof typeof CATEGORIES];
  title: string;
  school: string;
  major: string;
  background: string;
};

export type CompassList = { country: string; category: string | null; total: number | null; pages: number; fetched: number; stopped?: string };

type Parsed = { total: number | null; cases: { id: number; title: string; rows: Record<string, string> }[]; challenge: boolean };

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Cases on one listing page: only the result list, not related-case boxes elsewhere on the page. */
export function parseListing(html: string): Parsed {
  const total = /class="count">(?:&nbsp;|\s)*(\d+)/.exec(html);
  const start = html.indexOf('class="section__part__result"');
  const region = start >= 0 ? html.slice(start) : "";
  const cases: Parsed["cases"] = [];
  for (const chunk of region.split('<a class="action__hover__cursor case-item').slice(1)) {
    const body = chunk.slice(0, chunk.indexOf("</a>"));
    const id = /href="\/newst_(\d+)"/.exec(body);
    const title = /class="title line-2">([^<]*)</.exec(body);
    if (!id || !title) continue;
    const rows: Record<string, string> = {};
    for (const m of body.matchAll(/<div class="label">([^<]*)<\/div>\s*<div class="text line-1">([^<]*)<\/div>/g)) rows[decode(m[1])] = decode(m[2]);
    cases.push({ id: Number(id[1]), title: decode(title[1]), rows });
  }
  const challenge = cases.length === 0 && /captcha|验证码|滑动验证|访问过于频繁/i.test(html) && !/case-item/.test(html);
  return { total: total ? Number(total[1]) : null, cases, challenge };
}

async function page(slug: string, refresh: boolean): Promise<{ html: string } | { error: string }> {
  const file = path.join(PAGE_CACHE, `${slug}.html.gz`);
  if (!refresh && existsSync(file)) return { html: gunzipSync(readFileSync(file)).toString("utf8") };
  const r = await politeFetch(`${BASE}/${slug}`);
  if (!r.ok) return { error: `${r.reason}: ${r.detail}` };
  const html = r.body.toString("utf8");
  mkdirSync(PAGE_CACHE, { recursive: true });
  writeFileSync(file, gzipSync(html));
  return { html };
}

async function main() {
  const a = args();
  mkdirSync(COMPASS_DIR, { recursive: true });
  const lists: Record<string, CompassList> = {};
  const cases = new Map<number, CompassCase>();
  let stopAll: string | null = null;

  // The unfiltered totals, to see how many cases the four categories leave out.
  for (const [code, country] of Object.entries(COUNTRIES)) {
    const key = `c${code}`;
    const r = await page(`offer_${key}p1`, a.refresh);
    lists[key] = { country, category: null, total: "html" in r ? parseListing(r.html).total : null, pages: 1, fetched: "html" in r ? 1 : 0 };
  }

  for (const [code, country] of Object.entries(COUNTRIES))
    for (const [b, category] of Object.entries(CATEGORIES)) {
      const key = `c${code}b${b}`;
      if (a.only && !a.only.includes(key)) continue;
      if (stopAll) break;
      const list: CompassList = { country, category, total: null, pages: 0, fetched: 0 };
      lists[key] = list;
      for (let p = 1; ; p++) {
        const r = await page(`offer_${key}p${p}`, a.refresh);
        if ("error" in r) {
          list.stopped = `page ${p}: ${r.error}`;
          if (/^(robots|blocked)/.test(r.error)) stopAll = `${key} ${list.stopped}`;
          break;
        }
        const parsed = parseListing(r.html);
        if (p === 1) {
          list.total = parsed.total;
          list.pages = Math.ceil((parsed.total ?? 0) / PER_PAGE);
        }
        if (parsed.challenge) {
          list.stopped = `page ${p}: challenge page (not answered)`;
          stopAll = `${key} ${list.stopped}`;
          break;
        }
        if (!parsed.cases.length) break;
        list.fetched = p;
        for (const c of parsed.cases)
          cases.set(c.id, {
            id: c.id,
            country,
            category,
            title: c.title,
            school: c.rows["毕业学校"] ?? "",
            major: c.rows["本科专业"] ?? "",
            background: c.rows["基本背景"] ?? "",
          });
        if (p % 10 === 0 || p === list.pages) {
          console.log(`${key} ${category}: page ${p}/${list.pages} · cases so far ${cases.size}`);
          save(lists, cases);
        }
        if (p >= list.pages) break;
      }
    }

  save(lists, cases);
  for (const [key, l] of Object.entries(lists)) console.log(`${key.padEnd(7)} ${String(l.category ?? "all").padEnd(5)} total ${l.total ?? "-"} · pages ${l.fetched}/${l.pages}${l.stopped ? ` · stopped ${l.stopped}` : ""}`);
  console.log(`Cases: ${cases.size}${stopAll ? ` · run stopped: ${stopAll}` : ""}`);
  await closeBrowser();
}

function save(lists: Record<string, CompassList>, cases: Map<number, CompassCase>) {
  writeJson(COMPASS_CASES_FILE, {
    source: "指南者留学 case library (www.compassedu.hk/offer): the agency's published admission cases of its own clients",
    checked: today(),
    lists,
    cases: [...cases.values()].sort((x, y) => y.id - x.id),
  });
}

// Run only as a script: other pipeline steps import parseListing and the types.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/pipeline/compass-cases.ts")) {
  keepRunning();
  main();
}
