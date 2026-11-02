// Debug helper: saves one official page or PDF (politely, through the browser with --browser) for reading.
// Usage: npx tsx scripts/plan/save-page.ts <url> <file> [--browser]
import { writeFileSync } from "node:fs";
import { closeBrowser } from "../pipeline/browser";
import { politeFetch, routeThroughBrowser } from "../pipeline/http";

async function main() {
  const [url, file] = process.argv.slice(2);
  if (process.argv.includes("--browser")) routeThroughBrowser([new URL(url).origin]);
  const r = await politeFetch(url, 40_000_000);
  if (!r.ok) console.log(r.reason, r.detail);
  else {
    writeFileSync(file, r.body);
    console.log(r.status, r.contentType, r.body.length);
  }
  await closeBrowser();
}
main();
