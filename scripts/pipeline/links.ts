// Debug helper for adding a source: fetches one page politely and lists its links matching a pattern.
// --grep=<regex> prints raw matches from the page source instead (for links built by scripts).
// Usage: npx tsx scripts/pipeline/links.ts <url> [pattern] [--browser] [--grep=<regex>] [--max=<bytes>]
import { closeBrowser } from "./browser";
import { politeFetch, routeThroughBrowser } from "./http";

async function main() {
  const [url, filter] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const grep = process.argv.find((a) => a.startsWith("--grep="))?.slice(7);
  if (process.argv.includes("--browser")) routeThroughBrowser([new URL(url).origin]);
  const max = process.argv.find((a) => a.startsWith("--max="))?.slice(6);
  const r = await politeFetch(url, max ? Number(max) : undefined);
  if (!r.ok) console.log(r.reason, r.detail);
  else {
    const body = r.body.toString("utf8");
    console.log(r.status, r.contentType, r.finalUrl, body.length);
    if (grep) {
      const hits = new Set(Array.from(body.matchAll(new RegExp(grep, "gi")), (m) => m[0]));
      for (const h of Array.from(hits).slice(0, 60)) console.log(h);
    } else {
      const links = new Set(Array.from(body.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi), (m) => new URL(m[1].replace(/&amp;/g, "&"), r.finalUrl).toString()));
      const re = filter ? new RegExp(filter, "i") : null;
      for (const l of links) if (!re || re.test(l)) console.log(l);
      if (!links.size) console.log(body.slice(0, 1500));
    }
  }
  await closeBrowser();
}
main();
