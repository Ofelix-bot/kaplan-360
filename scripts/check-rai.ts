// Scans the site's own text (app/, components/, lib/ except the banned list itself) and the
// Claude-drafted data shown on the site for admission wording it must never use (lib/rai.ts).
// Exits non-zero on a hit, so it can run before a deploy.
// Usage: npm run check:rai

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { bannedWording } from "../lib/rai";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKIP = new Set(["lib/rai.ts"]);
const hits: string[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(f) ? [p] : [];
  });
}

// String literals and JSX text in the site's source: comments are not shown to students.
for (const file of ["app", "components", "lib"].flatMap((d) => walk(path.join(ROOT, d)))) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (SKIP.has(rel)) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      const b = bannedWording(line);
      if (b) hits.push(`${rel}:${i + 1}  "${b.match}" (${b.why})`);
    });
}

// Claude-drafted text that reaches the page.
for (const [file, texts] of [
  ["data/raw/benefits.json", (j: { items: { checklist?: Record<string, string[]> | null }[] }) => j.items.flatMap((b) => Object.values(b.checklist ?? {}).flat())],
  ["data/raw/programme-prepare.json", (j: { items: Record<string, { steps: string[] }> }) => Object.values(j.items).flatMap((p) => p.steps)],
] as const) {
  const p = path.join(ROOT, file);
  if (!existsSync(p)) continue;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (texts as (j: any) => string[])(JSON.parse(readFileSync(p, "utf8")))) {
    const b = bannedWording(t);
    if (b) hits.push(`${file}  "${b.match}" (${b.why}) in: ${t.slice(0, 100)}`);
  }
}

if (hits.length) {
  console.log(`Admission wording found (${hits.length}):\n${hits.join("\n")}`);
  process.exit(1);
}
console.log("No admission wording found in the site's text or in Claude-drafted content.");
