// Class profiles, step 2: fetch the pages profile-discover.ts found into the shared page cache
// (data/pipeline/cache and fetch-log.json), as HTML or PDF, with the same politeness as fetch.ts
// (robots.txt, pacing per host, a real browser for the sites that need one).
// Usage: npx tsx scripts/pipeline/profile-fetch.ts [--refresh] [--browser=https://mbs.edu,…]
// (--browser: origins that turn away scripted clients, fetched through a real browser window instead)

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { closeBrowser } from "./browser";
import { CACHE_DIR, CACHE_MAX_AGE_DAYS, FETCH_LOG_FILE, HOST_CONCURRENCY } from "./config";
import type { FetchEntry } from "./fetch";
import { politeFetch, routeThroughBrowser } from "./http";
import { PROFILE_SOURCES_FILE, type ProfilePage } from "./profile-lib";
import { SOURCES } from "./sources";
import { args, keepRunning, pool, readJson, writeJson } from "./util";

/** As fetch.ts names cached pages, with a .pdf extension for PDFs. */
function cacheFile(url: string, pdf: boolean): string {
  const u = new URL(url);
  return path.join(CACHE_DIR, u.host, createHash("sha1").update(url).digest("hex") + (pdf ? ".pdf" : ".html"));
}

async function main() {
  const a = args();
  const extra = process.argv.find((x) => x.startsWith("--browser="))?.slice(10).split(",").filter(Boolean) ?? [];
  routeThroughBrowser([...SOURCES.filter((s) => s.browser).flatMap((s) => s.origins), ...extra]);
  const pages = readJson<{ pages: ProfilePage[] }>(PROFILE_SOURCES_FILE, { pages: [] }).pages;
  const log = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
  const maxAge = CACHE_MAX_AGE_DAYS * 86_400_000;
  const urls = [...new Set(pages.map((p) => p.url))].filter((u) => {
    const e = log[u];
    return a.refresh || !(e?.ok && e.file && existsSync(e.file) && Date.now() - Date.parse(e.fetchedAt) < maxAge);
  });
  // One worker per host, so a site never sees two requests at once.
  const byHost = new Map<string, string[]>();
  for (const u of urls) byHost.set(new URL(u).host, [...(byHost.get(new URL(u).host) ?? []), u]);
  console.log(`Fetching ${urls.length} profile pages on ${byHost.size} hosts…`);
  let ok = 0;
  let failed = 0;
  const mine = new Set<string>();
  const save = () => {
    const disk = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
    for (const u of mine) disk[u] = log[u];
    writeJson(FETCH_LOG_FILE, disk);
  };
  await pool([...byHost.values()], HOST_CONCURRENCY, async (list) => {
    for (const url of list) {
      const source = pages.find((p) => p.url === url)!.institutionId;
      const res = await politeFetch(url, 40_000_000).catch((e: Error) => ({ ok: false as const, url, status: null, reason: "network" as const, detail: e.message }));
      const at = new Date().toISOString();
      mine.add(url);
      if (!res.ok) {
        log[url] = { source, fetchedAt: at, ok: false, status: res.status, reason: res.reason, detail: res.detail };
        failed++;
        console.log(`  ${url}: ${res.reason} ${res.detail.slice(0, 80)}`);
        continue;
      }
      const pdf = /pdf/i.test(res.contentType) || /\.pdf($|\?)/i.test(res.finalUrl);
      if (!pdf && !/html/i.test(res.contentType)) {
        log[url] = { source, fetchedAt: at, ok: false, status: res.status, reason: "not-html", detail: res.contentType };
        failed++;
        continue;
      }
      const file = cacheFile(url, pdf);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, res.body);
      log[url] = { source, fetchedAt: at, ok: true, status: res.status, finalUrl: res.finalUrl, file };
      ok++;
    }
    save();
  });
  save();
  console.log(`Fetched ${ok}, failed ${failed}`);
  await closeBrowser();
}

keepRunning();
main();
