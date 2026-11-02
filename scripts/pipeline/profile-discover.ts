// Class profiles, step 1: pages that may hold a programme's official class profile (who was
// admitted: class size, nationalities, undergraduate schools and majors, GPA, GMAT/GRE, work
// experience, age). Three sources, no network here:
//   - the cached programme pages: a profile on the page itself ("Class profile … 62 students,
//     28 nationalities, average age 24"), or a link from it to one ("Class profile", "Class of 2026");
//   - the universities' saved sitemap lists (data/pipeline/probe/*.urls.txt): class-profile pages;
//   - data/pipeline/profiles/search.json: official class-profile pages found by web search, per university.
// Writes data/pipeline/profiles/sources.json for profile-fetch.ts and profile-ai.ts.
// Usage: npx tsx scripts/pipeline/profile-discover.ts

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR, EXTRACTED_FILE, FETCH_LOG_FILE, OUTPUT_FILE } from "./config";
import type { ExtractedRecord } from "./extract";
import { decodeEntities, pageText } from "./extract-lib";
import type { FetchEntry } from "./fetch";
import { PROFILE_ANCHOR, PROFILE_FIGURE, PROFILE_SEARCH_FILE, PROFILE_SOURCES_FILE, type ProfilePage } from "./profile-lib";
import { readJson, today, writeJson } from "./util";

/** Addresses and link texts that look like a profile but are single students' stories, news or other levels. */
const NOT_PROFILE = /alumni|stor(y|ies)|blog|testimonial|ambassador|\/people\/|staff|undergrad|bachelor|\bphd\b|doctoral|executive|webinar|\/events?\//i;

function linksOf(html: string, base: string): { url: string; text: string }[] {
  const out: { url: string; text: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    try {
      out.push({ url: new URL(m[1].replace(/&amp;/g, "&"), base).toString().replace(/\/$/, ""), text });
    } catch {}
  }
  return out;
}

/** The last three labels of a host, so "www.sbs.ox.ac.uk" and "www.ox.ac.uk" are one site and "wbs.ac.uk" another. */
const site = (host: string) => host.replace(/^www\./, "").split(".").slice(-3).join(".");
const CLASS_PROFILE_URL = /class-?profile|cohort-?profile|class_profile|class-snapshot|class-statistics|incoming-class|meet-the-class/i;
const CLASS_PROFILE_TEXT = /\b(class|cohort) profile\b|\bclass (composition|snapshot|statistics|at a glance)\b|\bmeet the class of\b|\bincoming class\b|\bour class of 20\d\d\b/i;

function main() {
  const programmes = readJson<{ programmes: { id: string; institutionId: string; sourceUrl: string }[] }>(OUTPUT_FILE, { programmes: [] }).programmes;
  const extracted = readJson<ExtractedRecord[]>(EXTRACTED_FILE, []);
  const log = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
  const pagesOf = new Map(extracted.map((r) => [r.base, r.pages]));
  const found = new Map<string, ProfilePage>();
  const add = (p: ProfilePage) => {
    const key = p.kind === "inline" ? `${p.url}#${p.anchor}` : p.url;
    const prev = found.get(key);
    if (prev) prev.programmeIds = [...new Set([...prev.programmeIds, ...p.programmeIds])];
    else found.set(key, p);
  };

  // 1. Programme pages: a profile on the page, or a link to one.
  for (const p of programmes) {
    for (const url of pagesOf.get(p.sourceUrl) ?? [p.sourceUrl]) {
      const file = log[url]?.file;
      if (!file || !existsSync(file)) continue;
      const html = readFileSync(file, "utf8");
      const lines = pageText({ url, html }).lines;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 160 || !PROFILE_ANCHOR.test(lines[i])) continue;
        // Two figures within the 25 lines after the heading: a profile, not a passing mention.
        const figures = lines.slice(i + 1, i + 26).filter((l) => l.length < 400 && PROFILE_FIGURE.test(l)).length;
        if (figures >= 2) {
          add({ url, institutionId: p.institutionId, programmeIds: [p.id], kind: "inline", anchor: lines[i] });
          break;
        }
      }
      const home = site(new URL(url).host);
      for (const l of linksOf(html, url)) {
        if (l.url === url || !/^https?:/.test(l.url) || site(new URL(l.url).host) !== home) continue;
        if (!(CLASS_PROFILE_TEXT.test(l.text) || CLASS_PROFILE_URL.test(new URL(l.url).pathname)) || NOT_PROFILE.test(l.url)) continue;
        add({ url: l.url, institutionId: p.institutionId, programmeIds: [p.id], kind: "link" });
      }
    }
  }

  // 2. Sitemap lists saved by auto-sources.ts (data/pipeline/probe/<id>@n.urls.txt).
  const probe = path.join(DATA_DIR, "probe");
  const ids = new Set(programmes.map((p) => p.institutionId));
  if (existsSync(probe))
    for (const f of readdirSync(probe).filter((f) => f.endsWith(".urls.txt"))) {
      const id = f.replace(/(@\d+)?\.urls\.txt$/, "");
      if (!ids.has(id)) continue;
      for (const url of readFileSync(path.join(probe, f), "utf8").split("\n")) {
        if (url && CLASS_PROFILE_URL.test(url) && !NOT_PROFILE.test(url)) add({ url: url.trim().replace(/\/$/, ""), institutionId: id, programmeIds: [], kind: "sitemap" });
      }
    }

  // 3. Web search finds (official domains only; added by hand to search.json).
  const search = readJson<Record<string, string[]>>(PROFILE_SEARCH_FILE, {});
  for (const [id, urls] of Object.entries(search)) for (const url of urls) add({ url: url.replace(/\/$/, ""), institutionId: id, programmeIds: [], kind: "search" });

  const pages = [...found.values()];
  writeJson(PROFILE_SOURCES_FILE, { builtAt: today(), pages });
  const by = (k: ProfilePage["kind"]) => pages.filter((p) => p.kind === k).length;
  console.log(`Profile pages: ${pages.length} · on programme pages ${by("inline")} · linked ${by("link")} · sitemaps ${by("sitemap")} · search ${by("search")} · universities ${new Set(pages.map((p) => p.institutionId)).size}`);
}

main();
