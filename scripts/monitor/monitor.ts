// The monthly check for change (agreed 2026-11-01, Q10). For the watch list (universities with programmes that
// are in the QS 2027 top 200 or are Kaplan partners) it rediscovers the programme pages, fetches every page
// again, and compares each page's text with what was cached before: only pages that changed, and new ones,
// are read again by Claude Haiku (their old readings are dropped, so extract-ai fills just those). Then it
// rebuilds data/raw/programmes.json and writes a report of what changed: new and removed programmes, and
// changed fees, English scores, intakes, lengths and entry requirements, with the run's Claude cost.
// Universities whose pages come from a saved sitemap list (lists/phase1) only show changed pages here, not new
// ones: their list is rebuilt by scripts/pipeline/auto-sources.ts. Loading into Supabase stays manual
// (npm run data:load). Run monthly by C:\Users\12514\kaplan360-refresh\run-refresh.cmd after `npm run refresh`.
// Usage: npx tsx scripts/monitor/monitor.ts [--only=id1,id2] [--dry]
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AI_FILE, CACHE_DIR, INSTITUTIONS_FILE, OUTPUT_FILE, ROOT } from "../pipeline/config";

type Programme = Record<string, unknown> & { id: string; institutionId: string; name: string; sourceUrl: string };
type Institution = { id: string; name: string; kaplanPartner?: boolean; qs?: { rankValue?: number } };
type AiRecord = { base: string; source: string; extractedAt: string; usage?: { input?: number; output?: number } };

/** Where fetch.ts caches a page (its cacheFile; not imported, since importing fetch.ts starts a fetch). */
const cacheFile = (url: string) => path.join(CACHE_DIR, new URL(url).host, createHash("sha1").update(url).digest("hex") + ".html");

/** Haiku 5.5, US$ per million tokens (input, output). */
const PRICE = { input: 0.1, output: 0.5 };
/** The fields whose change the report lists. */
const FIELDS = ["tuition", "ieltsOverall", "toeflTotal", "intakes", "durationMonths", "academicRequirement"] as const;

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const onlyArg = args.find((a) => a.startsWith("--only="))?.slice(7).split(",").filter(Boolean);

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;
const today = new Date().toISOString().slice(0, 10);
const outDir = path.join(ROOT, "data", "monitor", today);

/** A page's text without markup, scripts or spacing: the part a reader sees. */
function fingerprint(file: string): string | null {
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha1").update(text).digest("hex");
}

const programmesBefore = readJson<{ programmes: Programme[] }>(OUTPUT_FILE).programmes;
const institutions = readJson<{ institutions: Institution[] }>(INSTITUTIONS_FILE).institutions;
const withProgrammes = new Set(programmesBefore.map((p) => p.institutionId));
const watch = (onlyArg ?? institutions.filter((i) => withProgrammes.has(i.id) && (i.kaplanPartner || (i.qs?.rankValue ?? 9999) <= 200)).map((i) => i.id)).sort();
const pagesOf = (ids: Set<string>, list: Programme[]) => [...new Set(list.filter((p) => ids.has(p.institutionId)).map((p) => p.sourceUrl))];
const watchSet = new Set(watch);

console.log(`watch list: ${watch.length} universities, ${pagesOf(watchSet, programmesBefore).length} programme pages`);
if (dry) {
  console.log(watch.join(", "));
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(OUTPUT_FILE, path.join(outDir, "programmes.before.json"));
copyFileSync(AI_FILE, path.join(outDir, "ai-extracted.before.json"));
const before = new Map(pagesOf(watchSet, programmesBefore).map((u) => [u, fingerprint(cacheFile(u))]));

const run = (cmd: string) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
};
const only = `--only=${watch.join(",")}`;
run(`npx tsx scripts/pipeline/discover.ts ${only} --refresh`);
run(`npx tsx scripts/pipeline/fetch.ts ${only} --refresh`);
run(`npx tsx scripts/pipeline/extract.ts ${only}`);
try {
  run(`npx tsx scripts/pipeline/name-ai.ts ${only}`);
  run(`npx tsx scripts/pipeline/extract.ts ${only}`);
} catch {
  console.log("name-ai failed; continuing with the names the rules found");
}

// Pages whose text changed: drop their readings, so extract-ai reads only them (and new pages) again.
const changed = [...before].filter(([u, h]) => h !== null && fingerprint(cacheFile(u)) !== h).map(([u]) => u);
const ai = readJson<Record<string, AiRecord>>(AI_FILE);
for (const u of changed) delete ai[u];
writeFileSync(AI_FILE, JSON.stringify(ai, null, 2) + "\n");
run(`npx tsx scripts/pipeline/extract-ai.ts ${only}`);
run(`npx tsx scripts/pipeline/build.ts`);

// What changed.
const programmesAfter = readJson<{ programmes: Programme[] }>(OUTPUT_FILE).programmes;
const inWatch = (p: Programme) => watchSet.has(p.institutionId);
const beforeById = new Map(programmesBefore.filter(inWatch).map((p) => [p.id, p]));
const afterById = new Map(programmesAfter.filter(inWatch).map((p) => [p.id, p]));
const added = [...afterById.values()].filter((p) => !beforeById.has(p.id));
const removed = [...beforeById.values()].filter((p) => !afterById.has(p.id));
const fieldChanges: { id: string; name: string; institutionId: string; field: string; from: unknown; to: unknown; url: string }[] = [];
for (const [id, a] of afterById) {
  const b = beforeById.get(id);
  if (!b) continue;
  for (const f of FIELDS) if (JSON.stringify(a[f] ?? null) !== JSON.stringify(b[f] ?? null)) fieldChanges.push({ id, name: a.name, institutionId: a.institutionId, field: f, from: b[f] ?? null, to: a[f] ?? null, url: a.sourceUrl });
}
const fresh = Object.values(readJson<Record<string, AiRecord>>(AI_FILE)).filter((r) => r.extractedAt === today && watchSet.has(r.source));
const tokens = fresh.reduce((s, r) => ({ input: s.input + (r.usage?.input ?? 0), output: s.output + (r.usage?.output ?? 0) }), { input: 0, output: 0 });
const cost = (tokens.input * PRICE.input + tokens.output * PRICE.output) / 1e6;

const show = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
const md = [
  `# What changed · ${today}`,
  "",
  `Watch list: ${watch.length} universities (QS 2027 top 200 and Kaplan partners). Pages whose text changed: ${changed.length}. Pages read again by Claude Haiku: ${fresh.length} (≈ US$${cost.toFixed(2)}).`,
  "",
  `## New programmes (${added.length})`,
  ...added.map((p) => `- ${p.name} · ${p.institutionId} · ${p.sourceUrl}`),
  "",
  `## No longer listed (${removed.length})`,
  ...removed.map((p) => `- ${p.name} · ${p.institutionId} · ${p.sourceUrl}`),
  "",
  `## Changed details (${fieldChanges.length})`,
  ...fieldChanges.map((c) => `- ${c.name} · ${c.institutionId} · ${c.field}: ${show(c.from)} → ${show(c.to)} · ${c.url}`),
  "",
  "Check a sample against the official pages before loading (npm run data:load).",
].join("\n");
writeFileSync(path.join(outDir, "report.md"), md + "\n");
writeFileSync(path.join(outDir, "changes.json"), JSON.stringify({ date: today, watch, changedPages: changed, added: added.map((p) => p.id), removed: removed.map((p) => p.id), fieldChanges, claude: { pages: fresh.length, ...tokens, usd: Number(cost.toFixed(4)) } }, null, 2) + "\n");
console.log(`\n${added.length} new · ${removed.length} removed · ${fieldChanges.length} field changes · ${changed.length} pages changed · US$${cost.toFixed(2)}\nreport: ${path.join(outDir, "report.md")}`);
