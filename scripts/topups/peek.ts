// Debug helper: prints the readable text of one page as the top-up collector sees it.
// Usage: npx tsx scripts/topups/peek.ts <url> [maxChars] [--browser]
import { closeBrowser } from "../pipeline/browser";
import { pageText } from "../pipeline/extract-lib";
import { politeFetch, routeThroughBrowser } from "../pipeline/http";

async function main() {
  if (process.argv.includes("--browser")) routeThroughBrowser([new URL(process.argv[2]).origin]);
  const r = await politeFetch(process.argv[2]);
  if (!r.ok) throw new Error(`${r.reason} ${r.detail}`);
  const text = pageText({ url: r.finalUrl, html: r.body.toString("utf8") }).lines.join("\n");
  console.log(r.finalUrl, text.length, "chars\n");
  console.log(text.slice(0, Number(process.argv[3] ?? 8000)));
  await closeBrowser();
}

main();
