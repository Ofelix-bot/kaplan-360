// Fact check for the planner: what each university's own English-requirements pages say about how
// recent a test must be (e.g. "taken within two years of the start of your programme"). The pages are
// found in each site's sitemap, postgraduate ones first, and read politely.
// Usage: npx tsx scripts/plan/english-validity.ts [--only=ucl,...]  → data/pipeline/english-validity.json
import { BENEFIT_SOURCES } from "../benefits/sources";
import { closeBrowser } from "../pipeline/browser";
import { pageText } from "../pipeline/extract-lib";
import { politeFetch, robotsFor, routeThroughBrowser } from "../pipeline/http";
import { args, pool, writeJson } from "../pipeline/util";

const PRIORITY = BENEFIT_SOURCES.map((s) => s.institutionId);
const VALIDITY = /(valid|within|no more than|not more than|older than|taken in the last|taken within)[^.]{0,120}\b(two|2)\s*years|\b(two|2)\s*years?[^.]{0,80}(valid|old|prior|before|start|commence|application)/i;
const PAGE = /english-language(-requirements)?|language-requirements|english-requirements|english-proficiency/i;
const NOT = /undergrad|\/ug\/|\/courses?\/|news|blog|staff/i;
const PG = /postgrad|graduate|\bpg\b|masters/i;

async function main() {
  const a = args();
  const ids = a.only ?? PRIORITY;
  const first = (id: string) => {
    const s = BENEFIT_SOURCES.find((x) => x.institutionId === id);
    return s?.hubs[0] ?? s?.pages?.[0] ?? null;
  };
  routeThroughBrowser(BENEFIT_SOURCES.filter((s) => s.browser).map((s) => new URL(s.hubs[0] ?? s.pages![0]).origin));
  const out: Record<string, { url: string; sentences: string[] }[]> = {};
  await pool(ids, 6, async (id) => {
    const u = first(id);
    if (!u) return;
    const origin = new URL(u).origin;
    const robots = await robotsFor(origin);
    const queue = robots !== "unreachable" && robots.sitemaps.length ? [...robots.sitemaps] : [origin + "/sitemap.xml"];
    const hits = new Set<string>();
    for (let n = 0; queue.length && n < 30; n++) {
      const r = await politeFetch(queue.shift()!, 60_000_000);
      if (!r.ok) continue;
      const xml = r.body.toString("utf8");
      const locs = Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g), (m) => m[1].trim());
      if (/<sitemapindex/.test(xml)) queue.push(...locs.filter((l) => !/image|video|news|blog|staff|research/i.test(l)));
      else for (const l of locs) if (PAGE.test(l) && !NOT.test(l)) hits.add(l);
    }
    const pages = [...hits].sort((x, y) => Number(PG.test(y)) - Number(PG.test(x)) || x.length - y.length).slice(0, 3);
    out[id] = [];
    for (const url of pages) {
      const r = await politeFetch(url);
      if (!r.ok) continue;
      const text = pageText({ url: r.finalUrl, html: r.body.toString("utf8") }).lines.join("\n");
      const sentences = [...new Set(text.split(/(?<=[.!?])\s+|\n/).filter((s) => VALIDITY.test(s)).map((s) => s.trim().slice(0, 300)))].slice(0, 4);
      out[id].push({ url: r.finalUrl, sentences });
    }
  });
  await closeBrowser();
  writeJson("data/pipeline/english-validity.json", out);
  for (const id of ids) {
    const pages = out[id] ?? [];
    console.log(`## ${id}`);
    if (!pages.length) console.log("  (no English page found)");
    for (const p of pages) console.log(`${p.url}\n${p.sentences.map((s) => "  - " + s).join("\n") || "  (no validity sentence)"}`);
  }
}

main();
