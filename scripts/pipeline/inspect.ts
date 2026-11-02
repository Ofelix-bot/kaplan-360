// Debug helper for tuning extraction: prints the text lines of cached pages whose URL contains a
// string, optionally only lines matching a pattern. Usage: npx tsx scripts/pipeline/inspect.ts <url-part> [pattern] [maxLines]
import { readFileSync } from "node:fs";
import { FETCH_LOG_FILE } from "./config";
import { pageText } from "./extract-lib";
import type { FetchEntry } from "./fetch";
import { readJson } from "./util";

const [part, pattern, max] = process.argv.slice(2);
const re = pattern ? new RegExp(pattern, "i") : null;
const log = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
for (const [url, e] of Object.entries(log)) {
  if (!url.includes(part) || !e.ok || !e.file) continue;
  const p = pageText({ url, html: readFileSync(e.file, "utf8") });
  console.log(`\n== ${url} · h1: ${p.h1.join(" / ")} · title: ${p.title} · ${p.lines.length} lines`);
  p.lines
    .map((l, i) => [i, l] as const)
    .filter(([, l]) => !re || re.test(l))
    .slice(0, Number(max ?? 80))
    .forEach(([i, l]) => console.log(String(i).padStart(4), l.slice(0, 180)));
}
