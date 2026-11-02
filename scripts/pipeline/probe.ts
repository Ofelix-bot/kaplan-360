// Debug helper for adding sources in bulk: reads each site's sitemaps (politely, through http.ts)
// and summarises the paths of master's-looking URLs by prefix, with examples, so an `include`
// pattern can be chosen. Writes data/pipeline/probe/<id>.txt.
// Usage: npx tsx scripts/pipeline/probe.ts id=https://www.example.ac.uk [id2=https://…] [--browser]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { closeBrowser } from "./browser";
import { DATA_DIR, HOST_CONCURRENCY } from "./config";
import { politeFetch, robotsFor, routeThroughBrowser } from "./http";
import { keepRunning, pool } from "./util";

const MAX_SITEMAPS = 80;
const MASTERS = /(\bmsc\b|-msc\b|msc-|\bma-|-ma\b|\bmba\b|\bllm\b|master|postgrad|\bpgt\b|taught|\/pg\/|graduate)/i;
const OUT_DIR = path.join(DATA_DIR, "probe");

function locs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi), (m) => m[1].replace(/&amp;/g, "&").trim());
}

async function probe(id: string, origin: string): Promise<string> {
  const lines: string[] = [`# ${id} ${origin}`];
  const robots = await robotsFor(origin);
  if (robots === "unreachable") return lines.concat("robots.txt unreachable").join("\n");
  lines.push(`robots sitemaps: ${robots.sitemaps.join(" ") || "(none)"} · crawl-delay: ${robots.rules.crawlDelay} · AI-agent groups: ${robots.aiAgents.length}`);
  const queue = (robots.sitemaps.length ? [...robots.sitemaps] : [origin + "/sitemap.xml"]).filter((u) => URL.canParse(u));
  const seen = new Set<string>();
  const urls = new Set<string>();
  let read = 0;
  while (queue.length && read < MAX_SITEMAPS) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    const r = await politeFetch(sm, 40_000_000);
    read++;
    if (!r.ok) {
      lines.push(`sitemap ${sm}: ${r.reason} ${r.detail}`);
      continue;
    }
    const xml = r.body.toString("utf8");
    const list = locs(xml);
    if (/<sitemapindex/i.test(xml)) {
      const pref = list.filter((l) => /(course|program|study|postgrad|degree|pg|taught|master|page)/i.test(l));
      queue.unshift(...pref);
      queue.push(...list.filter((l) => !pref.includes(l)));
      lines.push(`index ${sm}: ${list.length} children (${pref.length} course-like)`);
      continue;
    }
    for (const l of list) if (URL.canParse(l)) urls.add(l);
  }
  const hits = Array.from(urls).filter((u) => MASTERS.test(new URL(u).pathname));
  lines.push(`sitemaps read ${read} · urls ${urls.size} · master's-looking ${hits.length}`);
  const byPrefix = new Map<string, string[]>();
  for (const u of hits) {
    const segs = new URL(u).pathname.split("/").filter(Boolean);
    const key = new URL(u).host + "/" + segs.slice(0, Math.min(3, Math.max(1, segs.length - 1))).join("/");
    byPrefix.set(key, [...(byPrefix.get(key) ?? []), u]);
  }
  for (const [k, v] of Array.from(byPrefix).sort((a, b) => b[1].length - a[1].length).slice(0, 25)) {
    lines.push(`${String(v.length).padStart(5)}  ${k}`);
    for (const e of v.slice(0, 4)) lines.push(`         ${e}`);
  }
  return lines.join("\n");
}

async function main() {
  // `--file=list.args`: one id=origin per line (long lists exceed the Windows command-line limit).
  const file = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
  const listed = file ? readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean) : [];
  const pairs = [...process.argv.slice(2), ...listed].filter((a) => a.includes("=") && !a.startsWith("--")).map((a) => a.split(/=(.+)/) as [string, string]);
  if (process.argv.includes("--browser")) routeThroughBrowser(pairs.map(([, o]) => o));
  mkdirSync(OUT_DIR, { recursive: true });
  await pool(pairs, HOST_CONCURRENCY, async ([id, origin]) => {
    let text: string;
    try {
      text = await probe(id, origin);
    } catch (e) {
      text = `# ${id} ${origin}\nfailed: ${(e as Error).message}`;
    }
    writeFileSync(path.join(OUT_DIR, id + ".txt"), text + "\n");
    console.log(text.split("\n").slice(0, 3).join(" | ").slice(0, 220));
  });
  await closeBrowser();
}

keepRunning();
main();
