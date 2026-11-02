// "Last checked": a quick re-check of the official pages the last full read covered
// (data/pipeline/benefits/pages-latest.json, data/pipeline/plan/pages-latest.json), without Claude. Each
// page is fetched again (politely, robots.txt honoured, the crawlers' browser routing) and every quote the
// site shows from it (data/raw/benefits.json, data/raw/plan-dates.json) must still be on it word for word
// (the crawlers' own squash). A page is confirmed when it was read and all its quotes are there (a page
// with no items: when it was read). The items are left as they are: pages whose quotes are gone, and
// pages that couldn't be read, are listed for the next full refresh (npm run refresh).
// Writes the `quick` field of data/raw/changes.json (lib/changes.ts) and the details to
// data/pipeline/quick-check-latest.json.
// Usage: npx tsx scripts/changes/quick-check.ts

import { BENEFIT_SOURCES } from "../benefits/sources";
import { squash as squashBenefit } from "../benefits/verify";
import { closeBrowser } from "../pipeline/browser";
import { pageText } from "../pipeline/extract-lib";
import { politeFetch, routeThroughBrowser } from "../pipeline/http";
import { pool, readJson, today, writeJson } from "../pipeline/util";
import { PLAN_SOURCES } from "../plan/date-sources";
import { squash as squashDate } from "../plan/verify";

type Item = { id: string; url: string; quotes?: Record<string, string | null> };
type Group = { name: "benefits" | "dates"; pages: string; items: string; squash: (s: string) => string };
type Result = { url: string; group: Group["name"]; status: "confirmed" | "changed" | "unread"; detail?: string; missing?: { id: string; field: string }[] };

const GROUPS: Group[] = [
  { name: "benefits", pages: "data/pipeline/benefits/pages-latest.json", items: "data/raw/benefits.json", squash: squashBenefit },
  { name: "dates", pages: "data/pipeline/plan/pages-latest.json", items: "data/raw/plan-dates.json", squash: squashDate },
];
const OUT = "data/raw/changes.json";
const DETAILS = "data/pipeline/quick-check-latest.json";

async function main() {
  routeThroughBrowser([
    ...BENEFIT_SOURCES.filter((s) => s.browser).flatMap((s) => [...s.hubs, ...(s.pages ?? [])].map((h) => new URL(h).origin)),
    ...PLAN_SOURCES.filter((s) => s.browser).flatMap((s) => s.pages.map((p) => new URL(p).origin)),
  ]);
  const results: Result[] = [];
  for (const g of GROUPS) {
    const urls = Object.keys(readJson<{ pages: Record<string, string> }>(g.pages, { pages: {} }).pages);
    const items = readJson<{ items: Item[] }>(g.items, { items: [] }).items;
    const byUrl = new Map<string, Item[]>();
    for (const it of items) byUrl.set(it.url, [...(byUrl.get(it.url) ?? []), it]);
    await pool(urls, 4, async (url) => {
      const r = await politeFetch(url);
      if (!r.ok) {
        results.push({ url, group: g.name, status: "unread", detail: `${r.reason} ${r.detail ?? ""}`.trim() });
        return;
      }
      const page = g.squash(pageText({ url: r.finalUrl, html: r.body.toString("utf8") }).lines.join("\n"));
      const missing = (byUrl.get(url) ?? []).flatMap((it) =>
        Object.entries(it.quotes ?? {})
          .filter(([, q]) => q && !page.includes(g.squash(q)))
          .map(([field]) => ({ id: it.id, field })),
      );
      results.push(missing.length ? { url, group: g.name, status: "changed", missing } : { url, group: g.name, status: "confirmed" });
    });
    console.log(`${g.name}: ${urls.length} pages`);
  }
  await closeBrowser();

  const count = (s: Result["status"]) => results.filter((r) => r.status === s).length;
  const checked = today();
  const quick = { checked, pages: results.length, confirmed: count("confirmed") };
  const file = readJson<Record<string, unknown>>(OUT, {});
  writeJson(OUT, { ...file, quick });
  writeJson(DETAILS, { checked, results: results.sort((a, b) => a.status.localeCompare(b.status) || a.url.localeCompare(b.url)) });
  console.log(`checked ${checked}: ${quick.confirmed} confirmed, ${count("changed")} changed, ${count("unread")} unread, of ${quick.pages}`);
  for (const r of results.filter((x) => x.status !== "confirmed")) console.log(`  ${r.status} ${r.url} ${r.detail ?? (r.missing ?? []).map((m) => `${m.id}:${m.field}`).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
