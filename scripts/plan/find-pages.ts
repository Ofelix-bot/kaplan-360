// Survey helper for the planner's events and application dates: for each benefits institution, the
// sitemap URLs that look like Singapore pages, open days, webinars or postgraduate application dates.
// Usage: npx tsx scripts/plan/find-pages.ts [--only=ucl,aston-university]
import { closeBrowser } from "../pipeline/browser";
import { politeFetch, robotsFor, routeThroughBrowser } from "../pipeline/http";
import { args, pool } from "../pipeline/util";
import { BENEFIT_SOURCES } from "../benefits/sources";

const RE = /singapore|open-?days?|virtual-?(open|event|fair)|webinar|info(rmation)?-session|meet-us|visits?-(to-)?(your|asia)|application-(dates|deadlines?)|key-dates|closing-dates|when-to-apply|deadlines/i;
const SKIP = /news|blog|press|story|stories|research|staff|alumni|undergrad|ug-|\/ug\/|phd|doctoral|\.pdf$/i;

async function main() {
  const a = args();
  const sources = BENEFIT_SOURCES.filter((s) => !a.only || a.only.includes(s.institutionId));
  const first = (s: (typeof sources)[number]) => s.hubs[0] ?? s.pages![0];
  routeThroughBrowser(sources.filter((s) => s.browser).map((s) => new URL(first(s)).origin));
  const out: Record<string, string[]> = {};
  await pool(sources, 6, async (s) => {
    const origin = new URL(first(s)).origin;
    const robots = await robotsFor(origin);
    const queue = robots !== "unreachable" && robots.sitemaps.length ? [...robots.sitemaps] : [origin + "/sitemap.xml"];
    const hits = new Set<string>();
    for (let n = 0; queue.length && n < 30; n++) {
      const r = await politeFetch(queue.shift()!, 60_000_000);
      if (!r.ok) continue;
      const xml = r.body.toString("utf8");
      const locs = Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g), (m) => m[1].trim());
      if (/<sitemapindex/.test(xml)) queue.push(...locs.filter((l) => !/image|video|news|blog|staff|research/i.test(l)));
      else for (const l of locs) if (RE.test(l) && !SKIP.test(l)) hits.add(l);
    }
    out[s.institutionId] = [...hits].sort((x, y) => x.length - y.length).slice(0, 12);
    console.error(`${s.institutionId}: ${hits.size}`);
  });
  await closeBrowser();
  console.log(JSON.stringify(out, null, 1));
}

main();
