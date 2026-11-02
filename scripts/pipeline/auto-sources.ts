// Phase 1 sources from sitemaps: reads each origin's sitemaps politely (robots.txt first, through
// http.ts), keeps every URL in data/pipeline/probe/<id@n>.urls.txt, and picks the master's programme
// pages by their address: the last path segment names a master's degree ("accounting-mba",
// "master-of-applied-finance", "data-science-ms") under a course / programme / degree path, and
// news, events, undergraduate, research, admissions and fees pages are left out. The pages found
// for each university go to scripts/pipeline/lists/phase1/<id>.json for sources.ts to read.
// Usage: npx tsx scripts/pipeline/auto-sources.ts --file=data/pipeline/phase1-probe-plain.args [--browser]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { closeBrowser } from "./browser";
import { DATA_DIR, HOST_CONCURRENCY, ROOT } from "./config";
import { politeFetch, robotsFor, routeThroughBrowser } from "./http";
import { keepRunning, pool } from "./util";

const MAX_SITEMAPS = 150;
const MAX_URLS = 400_000;
const PROBE_DIR = path.join(DATA_DIR, "probe");
const LIST_DIR = path.join(ROOT, "scripts", "pipeline", "lists", "phase1");

/** A master's degree named in the last path segment. */
const DEGREE_SEGMENT = new RegExp(
  "(^|[-_.])(" +
    "ms|msc|mse|msn|msw|mst|msf|msm|msph|mspa|mshs|msit|msis|msba|msed|ma|mat|mae|maed|mba|meng|mem|mfa|mph|mpa|mpp|mps|med|mfin|macc|mres|llm|" +
    "march|mdes|mlis|mhs|mcs|mcit|mhci|mbe|mbs|mbus|mcom|mcomm|mit|mm|mmgt|mhsc|mnsc|mpas|mpharm|mphil|mlitt|mtech|mpl|mup|mla|mcp|mcrp|" +
    "mhrm|mir|mlhr|mot|mpt|mpm|mprof|mnurs|mn|mhm|mib|mim|mfe|mqf|mmath|mstat|mca|mhealth|mpubpol" +
    ")([-_.]|$)|master",
  "i",
);
/** The path looks like a programme catalogue or course page. */
const PROGRAMME_PATH = /program|programme|course|degree|study|graduate|postgrad|academics|catalog|major|masters?\b|taught|pg/i;
/** Pages that mention a degree without being its programme page (whole words only: "history" is not "story"). */
const NOT_PROGRAMME = new RegExp(
  "(^|[/_.-])(news|events?|stor(y|ies)|blogs?|magazine|people|profiles?|staff|alumni|undergraduate|ug|bachelors?|phd|doctoral|doctorate|" +
    "research|apply|admissions?|fees|tuition|scholarships?|funding|webinars?|info-?sessions?|open-?days?|masterclass(es)?|careers?|" +
    "testimonials?|student-life|accommodation|tag|category)([/_.-]|$)|\\.pdf$",
  "i",
);

function locs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi), (m) => m[1].replace(/&amp;/g, "&").trim());
}

async function sitemapUrls(origin: string, cacheFile: string): Promise<{ urls: string[]; note: string }> {
  if (existsSync(cacheFile)) return { urls: readFileSync(cacheFile, "utf8").split("\n").filter(Boolean), note: "from saved list" };
  const robots = await robotsFor(origin);
  if (robots === "unreachable") return { urls: [], note: "robots.txt unreachable" };
  const queue = (robots.sitemaps.length ? [...robots.sitemaps] : [`${origin}/sitemap.xml`]).filter((u) => URL.canParse(u));
  const seen = new Set<string>();
  const urls = new Set<string>();
  let read = 0;
  const notes: string[] = [];
  while (queue.length && read < MAX_SITEMAPS && urls.size < MAX_URLS) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    const r = await politeFetch(sm, 60_000_000);
    read++;
    if (!r.ok) {
      notes.push(`${sm}: ${r.reason}`);
      continue;
    }
    const xml = r.body.toString("utf8");
    const list = locs(xml);
    if (/<sitemapindex/i.test(xml)) {
      // Course-like child sitemaps first; news and media last (and only if there's room).
      const course = list.filter((l) => /(course|program|study|postgrad|degree|graduate|taught|master|academ|catalog)/i.test(l));
      const noise = list.filter((l) => /(news|event|blog|story|media|image|video|people|staff|profile)/i.test(l));
      queue.unshift(...course);
      queue.push(...list.filter((l) => !course.includes(l) && !noise.includes(l)));
      continue;
    }
    for (const l of list) if (URL.canParse(l)) urls.add(l);
  }
  const all = [...urls];
  writeFileSync(cacheFile, all.join("\n"));
  return { urls: all, note: `${read} sitemaps${notes.length ? ` · ${notes.slice(0, 2).join("; ")}` : ""}` };
}

export function isProgrammeUrl(u: string): boolean {
  const { pathname } = new URL(u);
  const segs = pathname.split("/").filter(Boolean);
  // A year, "overview" or an index page at the end belongs to the segment before it.
  while (segs.length > 1 && /^(20\d\d|overview|index(\.html?)?|home|course-overview|program-overview)$/i.test(segs.at(-1)!)) segs.pop();
  const last = segs.at(-1) ?? "";
  return DEGREE_SEGMENT.test(last) && PROGRAMME_PATH.test(pathname) && !NOT_PROGRAMME.test(pathname) && segs.length >= 2;
}

async function main() {
  const file = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
  const pairs = (file ? readFileSync(file, "utf8").split(/\r?\n/) : []).filter((a) => a.includes("=")).map((a) => a.split(/=(.+)/) as [string, string]);
  if (process.argv.includes("--browser")) routeThroughBrowser(pairs.map(([, o]) => o));
  mkdirSync(PROBE_DIR, { recursive: true });
  mkdirSync(LIST_DIR, { recursive: true });
  const found = new Map<string, Set<string>>();
  const report: string[] = [];
  await pool(pairs, HOST_CONCURRENCY, async ([key, origin]) => {
    const id = key.split("@")[0];
    let res: { urls: string[]; note: string };
    try {
      res = await sitemapUrls(origin, path.join(PROBE_DIR, `${key}.urls.txt`));
    } catch (e) {
      res = { urls: [], note: `failed: ${(e as Error).message}` };
    }
    const hits = res.urls.filter((u) => {
      try {
        return isProgrammeUrl(u);
      } catch {
        return false;
      }
    });
    const set = found.get(id) ?? new Set<string>();
    for (const h of hits) set.add(h.replace(/[?#].*$/, "").replace(/\/$/, ""));
    found.set(id, set);
    report.push(`${String(hits.length).padStart(5)} / ${String(res.urls.length).padStart(6)}  ${key}  ${origin}  (${res.note})`);
    console.log(report.at(-1));
  });
  for (const [id, set] of found) {
    if (!set.size) continue;
    const out = path.join(LIST_DIR, `${id}.json`);
    const prev: string[] = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")).pages : [];
    const pages = [...new Set([...prev, ...set])].sort();
    writeFileSync(out, JSON.stringify({ source: "sitemaps (scripts/pipeline/auto-sources.ts)", retrievedAt: new Date().toISOString().slice(0, 10), pages }, null, 1) + "\n");
  }
  writeFileSync(path.join(DATA_DIR, `phase1-auto${process.argv.includes("--browser") ? "-browser" : ""}.txt`), report.sort().join("\n") + "\n");
  await closeBrowser();
}

// Run only when executed directly (tests import isProgrammeUrl).
if (process.argv[1]?.endsWith("auto-sources.ts")) {
  keepRunning();
  main();
}
