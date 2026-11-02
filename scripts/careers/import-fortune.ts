// The Fortune Global 500 2026 ranking (published 28 July 2026): company names and positions only,
// read from the ranking page's structured data (JSON-LD item list), to tag employers as members.
// Writes data/raw/fortune-global-500-2026.json. Usage: npx tsx scripts/careers/import-fortune.ts
import { writeFileSync } from "node:fs";
import { politeFetch } from "../pipeline/http";
import { today } from "../pipeline/util";

const URL_ = "https://fortune.com/ranking/global500/";

async function main() {
  const res = await politeFetch(URL_);
  if (!res.ok) throw new Error(`${res.reason} ${res.detail}`);
  const html = res.body.toString("utf8");
  const items: { name: string; rank: number; url: string }[] = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      for (const node of [data, ...(data["@graph"] ?? [])].flat()) {
        for (const li of node?.itemListElement ?? []) {
          if (li?.item?.name && li.position) items.push({ name: li.item.name, rank: li.position, url: li.item["@id"] });
        }
      }
    } catch {}
  }
  const unique = [...new Map(items.map((i) => [i.rank, i])).values()].sort((a, b) => a.rank - b.rank);
  writeFileSync(
    "data/raw/fortune-global-500-2026.json",
    JSON.stringify({ source: "Fortune Global 500, 2026", sourceUrl: URL_, publishedAt: "2026-07-28", retrievedAt: today(), note: "Names and positions only, used to tag employers.", companies: unique }, null, 2) + "\n",
  );
  console.log(`${unique.length} companies; last: ${unique.at(-1)?.rank} ${unique.at(-1)?.name}`);
}

main();
