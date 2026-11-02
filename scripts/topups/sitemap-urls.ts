// Debug helper: every sitemap URL on an origin that matches a pattern, one per line.
// Usage: npx tsx scripts/topups/sitemap-urls.ts <origin> <pattern>
import { politeFetch, robotsFor } from "../pipeline/http";

async function main() {
  const [origin, pattern] = process.argv.slice(2);
  const re = new RegExp(pattern, "i");
  const robots = await robotsFor(origin);
  if (robots === "unreachable") throw new Error("robots.txt unreachable");
  const queue = robots.sitemaps.length ? [...robots.sitemaps] : [origin + "/sitemap.xml"];
  const hits = new Set<string>();
  for (let n = 0; queue.length && n < 40; n++) {
    const r = await politeFetch(queue.shift()!, 40_000_000);
    if (!r.ok) {
      console.error("fail", r.url, r.detail);
      continue;
    }
    const xml = r.body.toString("utf8");
    const locs = Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g), (m) => m[1]);
    console.error(r.finalUrl, /<sitemapindex/.test(xml) ? "index" : "urlset", locs.length);
    if (/<sitemapindex/.test(xml)) queue.push(...locs);
    else for (const l of locs) if (re.test(l)) hits.add(l);
  }
  console.log([...hits].sort().join("\n"));
}

main();
