// Step 1: find candidate programme pages on each university's official site, through the sitemaps
// its robots.txt lists (or configured sitemaps / course-listing pages). Resumable: universities
// already discovered are skipped unless --refresh.
// Usage: npx tsx scripts/pipeline/discover.ts [--only=aston-university,murdoch-university] [--refresh]

import { CANDIDATES_FILE, HOST_CONCURRENCY } from "./config";
import { closeBrowser } from "./browser";
import { paginatedListing, politeFetch, robotsFor, routeThroughBrowser } from "./http";
import { SOURCES, type Source } from "./sources";
import { args, keepRunning, pool, readJson, today, writeJson } from "./util";

export type Discovery = {
  status: "done" | "failed";
  discoveredAt: string;
  sitemapsRead: number;
  urlsSeen: number;
  urls: string[];
  notes: string[];
  /** When nothing matched: course-like URLs seen, to help adjust the source's `include`. */
  samples?: string[];
};

/** Words in a URL path that point to one of Kaplan's 13 disciplines (used when URLs carry names). */
export const DISCIPLINE_WORDS = new RegExp(
  [
    "business", "management", "admin", "mba", "entrepreneur", "innovation", "leadership", "strategy", "human-resource", "hrm",
    "supply-chain", "logistics", "project", "operations", "international", "comput", "software", "cyber", "secur", "information",
    "digital", "it-", "-it$", "network", "web", "games?", "artificial", "-ai", "ai-", "machine-learning", "data", "analytic",
    "intelligence", "robot", "financ", "bank", "account", "fintech", "invest", "econom", "actuar", "psycholog", "counsel",
    "mental-health", "wellbeing", "marketing", "brand", "advertis", "public-relations", "communicat", "media", "journalis",
    "film", "broadcast", "law", "llm", "legal", "crimin", "justice", "forensic", "hospitality", "tourism", "events?", "hotel",
    "education", "teach", "tesol", "early-childhood", "learning", "nursing", "health", "public-health", "clinical", "care",
    "construction", "quantity-surveying", "built-environment", "real-estate", "property", "sport", "exercise", "coaching",
    // Added 2026-10-22: the other words classifyDiscipline (extract-lib.ts) reads as Kaplan subjects.
    "statistic", "quantitative", "translat", "interpret", "linguist", "social-work", "social-policy", "social-welfare", "social-service",
    "public-policy", "public-affairs", "governance", "policy-studies", "consult", "policing", "crime", "midwif", "psychotherap",
    "therap", "psychoanaly", "behaviou?ral", "(^|[-/])(med|mph|msw|mpa|mpp|macc|msf|mfin|mim|msba|mcom|mmgt|mpm)([-/]|$)", "pedagog",
    "building-information", "(^|[-/])bim([-/]|$)", "cloud", "(^|[-/])iot([-/]|$)", "internet-of-things", "audit", "(^|[-/])tax", "insurance",
    "wealth", "procurement", "purchasing", "retail", "luxury", "commerce", "publishing", "interaction", "user-experience", "(^|[-/])ux([-/]|$)",
    "blockchain", "instructional", "risk", "fashion-(marketing|management|business|branding)", "agribusiness", "maritime-business", "shipping",
  ].join("|"),
  "i",
);
export const EXCLUDE_URL =
  /(undergrad|\/ug\/|bachelor|\bphd\b|doctor|research-degree|\/news|\/events?\/|\/blog|\/staff|\/people\/|\/profiles?\/|alumni|scholarship|executive|short-course|summer-school|\/modules?\/|\/units?\/|\.pdf$|\/apply\b|online|part-time|\/research\/|double-degree|dual-degree|\/structure|\/careers?\/?$|\/fees-and-funding\/?$|mphil|\bmres\b|-mres|mres-)/i;

const MAX_SITEMAPS = 60;

function locs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi), (m) =>
    m[1].replace(/&amp;/g, "&").trim(),
  );
}

function normalise(u: string, src: Source): string | null {
  try {
    const url = new URL(u);
    url.hash = "";
    if (!src.keepQuery) url.search = "";
    url.protocol = "https:";
    const host = src.rewriteHost?.[url.host];
    if (host) url.host = host;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function hosts(src: Source): Set<string> {
  return new Set(src.origins.map((o) => new URL(o).host));
}

/** Certificates and diplomas are dropped unless the same URL also names a master's award ("…-msc-pgcert-pgdip"). */
const CERTIFICATE = /(graduate-certificate|graduate-diploma|grad-cert|grad-dip|postgraduate-certificate|postgraduate-diploma|specialist-certificate|professional-certificate|pgcert|pgdip|pg-cert|pg-dip)/i;
const MASTERS_AWARD = /(^|[-/])(msc|ma|mba|llm|med|mph|mpa|march|mfa|mfin|master|masters)([-/.]|$)/i;

/** URLs that carry only a course code (e.g. Murdoch's /m1213) can't be filtered by discipline words. */
const CODE_ONLY = /\/[a-z]?\d{3,6}$/i;

export function isCandidate(u: string, src: Source): boolean {
  const url = new URL(u);
  if (!hosts(src).has(url.host)) return false;
  const p = decodeURIComponent(url.pathname).toLowerCase().replace(/\/$/, "");
  if (src.include && !new RegExp(src.include, "i").test(p)) return false;
  if (src.exclude && new RegExp(src.exclude, "i").test(p)) return false;
  if (EXCLUDE_URL.test(p)) return false;
  if (CERTIFICATE.test(p) && !MASTERS_AWARD.test(p.replace(CERTIFICATE, ""))) return false;
  // Whole path: some sites end course URLs with an intake segment ("…/finance-msc/september-2027").
  return !!src.codes || CODE_ONLY.test(p) || DISCIPLINE_WORDS.test(p);
}

async function discover(src: Source): Promise<Discovery> {
  // A curated list from the official catalogue (scripts/pipeline/lists/): taken as it is.
  if (src.pages) return { status: "done", discoveredAt: today(), sitemapsRead: 0, urlsSeen: src.pages.length, urls: [...src.pages].sort(), notes: ["explicit list"] };
  const notes: string[] = [];
  const queue: string[] = [...(src.sitemaps ?? [])];
  if (!src.listings) {
    for (const origin of src.origins) {
      const robots = await robotsFor(origin);
      if (robots === "unreachable") {
        notes.push(`${origin}: robots.txt unreachable; not crawled`);
        continue;
      }
      if (!src.sitemaps) queue.push(...(robots.sitemaps.length ? robots.sitemaps : [origin + "/sitemap.xml"]));
    }
  }
  const seen = new Set<string>();
  const found = new Set<string>();
  const samples: string[] = [];
  let urlsSeen = 0;
  let read = 0;
  while (queue.length && read < MAX_SITEMAPS) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    const res = await politeFetch(sm, 40_000_000);
    read++;
    if (!res.ok) {
      notes.push(`sitemap ${sm}: ${res.reason} ${res.detail}`);
      continue;
    }
    const xml = res.body.toString("utf8");
    const list = locs(xml);
    if (/<sitemapindex/i.test(xml)) {
      // Large indexes: read the child sitemaps that look like course or page listings first.
      const pref = list.filter((l) => /(course|program|study|postgrad|degree|pg|taught|master|page)/i.test(l));
      queue.push(...pref, ...(list.length > MAX_SITEMAPS ? [] : list.filter((l) => !pref.includes(l))));
      continue;
    }
    urlsSeen += list.length;
    for (const l of list) {
      const n = normalise(l, src);
      if (n && isCandidate(n, src)) found.add(n);
      else if (n && samples.length < 40 && /(msc|master|postgrad|taught|course|program)/i.test(n)) samples.push(n);
    }
  }
  for (const listing of src.listings ?? []) {
    let htmls: { html: string; base: string }[];
    if (src.listingNext) {
      const res = await paginatedListing(listing, src.listingNext);
      read++;
      if (!res.ok) {
        notes.push(`listing ${listing}: ${res.reason} ${res.detail}`);
        continue;
      }
      notes.push(`listing ${listing}: ${res.pages.length} pages (${res.detail})`);
      htmls = res.pages.map((html) => ({ html, base: listing }));
    } else {
      const res = await politeFetch(listing);
      read++;
      if (!res.ok) {
        notes.push(`listing ${listing}: ${res.reason} ${res.detail}`);
        continue;
      }
      htmls = [{ html: res.body.toString("utf8"), base: res.finalUrl }];
    }
    // href attributes, plus quoted paths in inline data (listings rendered by scripts).
    for (const { html, base } of htmls) for (const m of html.matchAll(/(?:href\s*=\s*["']([^"'#]+)["']|["'](\/[a-z0-9][^"'#\s<>]*)["'])/gi)) {
      urlsSeen++;
      const n = normalise(new URL((m[1] ?? m[2]).replace(/&amp;/g, "&"), base).toString(), src);
      if (n && isCandidate(n, src)) found.add(n);
    }
  }
  if (!found.size) notes.push("no candidate URLs found");
  return {
    status: found.size ? "done" : "failed",
    discoveredAt: today(),
    sitemapsRead: read,
    urlsSeen,
    urls: Array.from(found).sort(),
    notes,
    ...(found.size ? {} : { samples }),
  };
}

async function main() {
  const a = args();
  routeThroughBrowser(SOURCES.filter((s) => s.browser).flatMap((s) => s.origins));
  const state = readJson<Record<string, Discovery>>(CANDIDATES_FILE, {});
  const todo = SOURCES.filter(
    (s) => !s.skip && (a.only ? a.only.includes(s.id) : a.refresh || state[s.id]?.status !== "done"),
  );
  console.log(`Discovering ${todo.length} of ${SOURCES.length} universities…`);
  await pool(todo, HOST_CONCURRENCY, async (src) => {
    const prev = state[src.id];
    try {
      state[src.id] = await discover(src);
    } catch (e) {
      state[src.id] = { status: "failed", discoveredAt: today(), sitemapsRead: 0, urlsSeen: 0, urls: [], notes: [(e as Error).message] };
    }
    // A failed run (the site down, robots.txt unreachable, a sitemap blocked) keeps the last list that worked.
    if (state[src.id].status === "failed" && prev?.status === "done" && prev.urls.length)
      state[src.id] = { ...prev, notes: [`kept from ${prev.discoveredAt}: ${state[src.id].notes.slice(0, 1).join("")}`, ...prev.notes.filter((n) => !n.startsWith("kept from"))] };
    // Pages checked by hand that the listing or `include` misses (sources.ts alsoPages).
    if (src.alsoPages && state[src.id].status === "done") state[src.id] = { ...state[src.id], urls: [...new Set([...state[src.id].urls, ...src.alsoPages])].sort() };
    const d = state[src.id];
    console.log(`${src.id.padEnd(38)} ${String(d.urls.length).padStart(4)} candidates · ${d.sitemapsRead} sitemaps/listings · ${d.urlsSeen} urls${d.notes.length ? " · " + d.notes.slice(0, 2).join("; ") : ""}`);
    // Saved after each university, so an interrupted run resumes.
    writeJson(CANDIDATES_FILE, { ...readJson<Record<string, Discovery>>(CANDIDATES_FILE, {}), [src.id]: d });
  });
  const total = Object.values(state).reduce((n, d) => n + d.urls.length, 0);
  console.log(`Candidates: ${total}`);
  await closeBrowser();
}

keepRunning();
main();
