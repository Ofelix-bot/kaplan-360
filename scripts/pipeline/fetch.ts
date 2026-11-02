// Step 2: fetch the candidate programme pages into data/pipeline/cache (one file per page).
// Resumable and incremental: pages fetched within CACHE_MAX_AGE_DAYS are reused; failures are
// retried on the next run, except pages blocked by robots.txt or by the site (401/403).
// Usage: npx tsx scripts/pipeline/fetch.ts [--only=aston-university] [--refresh] [--limit=40]

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CACHE_DIR, CACHE_MAX_AGE_DAYS, CANDIDATES_FILE, FETCH_LOG_FILE, HOST_CONCURRENCY } from "./config";
import type { Discovery } from "./discover";
import { groupProgrammes } from "./group";
import { closeBrowser } from "./browser";
import { politeFetch, type FailReason, routeThroughBrowser } from "./http";
import { SOURCES } from "./sources";
import { args, keepRunning, pool, readJson, writeJson } from "./util";

export type FetchEntry = {
  source: string;
  fetchedAt: string;
  ok: boolean;
  status: number | null;
  finalUrl?: string;
  file?: string;
  reason?: FailReason | "not-html";
  detail?: string;
};

export function cacheFile(url: string): string {
  const u = new URL(url);
  return path.join(CACHE_DIR, u.host, createHash("sha1").update(url).digest("hex") + ".html");
}

const PERMANENT: (string | undefined)[] = ["robots", "blocked", "crawl-delay"];

async function main() {
  const a = args();
  routeThroughBrowser(SOURCES.filter((s) => s.browser).flatMap((s) => s.origins));
  const candidates = readJson<Record<string, Discovery>>(CANDIDATES_FILE, {});
  const log = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
  const maxAge = CACHE_MAX_AGE_DAYS * 86_400_000;
  const mine = new Set<string>();
  // Merge into the file on disk, so parallel runs for different universities don't drop entries.
  const save = () => {
    const disk = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
    for (const u of mine) disk[u] = log[u];
    writeJson(FETCH_LOG_FILE, disk);
  };
  const unis = SOURCES.filter((s) => !s.skip && candidates[s.id]?.urls.length && (!a.only || a.only.includes(s.id)));
  let fetched = 0;
  let reused = 0;
  let failed = 0;
  await pool(unis, HOST_CONCURRENCY, async (src) => {
    const groups = groupProgrammes(candidates[src.id].urls, src.keepQuery).slice(0, a.limit ?? Infinity);
    const pages = groups.flatMap((g) => g.pages);
    for (const url of pages) {
      const prev = log[url];
      const fresh = prev?.ok && prev.file && existsSync(prev.file) && Date.now() - Date.parse(prev.fetchedAt) < maxAge;
      // An unreachable robots.txt is a transient failure (network, or the browser not starting): retried.
      const permanent = prev && !prev.ok && PERMANENT.includes(prev.reason) && !/unreachable/.test(prev.detail ?? "");
      if (!a.refresh && (fresh || permanent)) {
        reused++;
        continue;
      }
      // One page's exception (e.g. the browser failing to start) must not stop the other universities.
      // Up to 40 MB: some portals (HKU) render a programme page with tens of MB of inline data.
      const res = await politeFetch(url, 40_000_000).catch((e: Error) => ({ ok: false as const, url, status: null, reason: "network" as const, detail: e.message }));
      const at = new Date().toISOString();
      mine.add(url);
      if (!res.ok) {
        log[url] = { source: src.id, fetchedAt: at, ok: false, status: res.status, reason: res.reason, detail: res.detail };
        failed++;
      } else if (!/html/i.test(res.contentType)) {
        log[url] = { source: src.id, fetchedAt: at, ok: false, status: res.status, reason: "not-html", detail: res.contentType };
        failed++;
      } else {
        const file = cacheFile(url);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, res.body);
        log[url] = { source: src.id, fetchedAt: at, ok: true, status: res.status, finalUrl: res.finalUrl, file };
        fetched++;
      }
      if ((fetched + failed) % 20 === 0) save();
    }
    save();
    const done = pages.map((p) => log[p]).filter(Boolean);
    console.log(`${src.id.padEnd(38)} ${groups.length} programmes · ${pages.length} pages · ok ${done.filter((e) => e.ok).length} · failed ${done.filter((e) => !e.ok).length}`);
  });
  save();
  console.log(`Fetched ${fetched}, reused ${reused}, failed ${failed}`);
  await closeBrowser();
}

keepRunning();
main();
