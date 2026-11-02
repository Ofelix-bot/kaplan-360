// Debug helper for adding a source: lists a site's sitemap URLs that match a pattern.
// Usage: npx tsx scripts/pipeline/peek.ts <origin> [pattern]
import { politeFetch, robotsFor } from "./http";

async function main() {
  const origin = process.argv[2];
  const pat = new RegExp(process.argv[3] ?? "analytics|finance|marketing|management", "i");
  const robots = await robotsFor(origin);
  if (robots === "unreachable") throw new Error("robots.txt unreachable");
  console.log("sitemaps:", robots.sitemaps.join(" ") || "(none)", "· crawl-delay:", robots.rules.crawlDelay);
  const queue = robots.sitemaps.length ? [...robots.sitemaps] : [origin + "/sitemap.xml"];
  const hits: string[] = [];
  for (let n = 0; queue.length && n < 25; n++) {
    const sm = queue.shift()!;
    const r = await politeFetch(sm, 40_000_000);
    if (!r.ok) {
      console.log("fail", sm, r.detail);
      continue;
    }
    const xml = r.body.toString("utf8");
    const locs = Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g), (m) => m[1]);
    if (/<sitemapindex/.test(xml)) {
      console.log("index", sm, locs.length);
      queue.push(...locs.filter((l) => /course|program|study|postgrad|pg|taught|master|page/i.test(l)).slice(0, 20));
      continue;
    }
    hits.push(...locs.filter((l) => pat.test(l)));
  }
  console.log(hits.length, "matches");
  console.log(hits.slice(0, 60).join("\n"));
}

main();
