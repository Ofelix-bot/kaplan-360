// How far above a programme's published minimum its admitted students sit, on programmes that have both
// a minimum and 10 or more reported GPAs: grounds the index's admitted level for the programmes that
// publish only a minimum (lib/stand/score.ts: the minimum + one class step, Kaplan 360++'s rule).
// --write saves the medians to data/raw/stand/min-gap.json, which the index's wording quotes.
// Usage: npx tsx scripts/stand/min-gap.ts [--write]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { goodReadings, requirementLevel, requirementWords } from "../../lib/grades";
import { academicStructured } from "../../lib/pipeline/requirements";
import { fourToUkMark } from "../../lib/gpa4";
import { LEVELS, levelOf } from "../../lib/admit-range";

const ROOT = path.resolve(import.meta.dirname, "../..");
const raw = (f: string) => JSON.parse(readFileSync(path.join(ROOT, "data/raw", f), "utf8"));
const institutions: { id: string; country: string | null; tier: number }[] = raw("institutions.json").institutions;
const tier1 = new Map(institutions.filter((i) => i.tier === 1).map((i) => [i.id, i]));
const rows: { id: string; institutionId: string; academicRequirement: string | null; discipline: string | null }[] = raw("programmes.json").programmes.filter((r: { discipline: string | null; institutionId: string }) => r.discipline && tier1.has(r.institutionId));
const cases = raw("admit-cases.json").programmes as Record<string, { gpa?: { n: number; p25: number; median: number } | null; gpaByTier?: { tier: string; n: number; p25: number; median: number }[] }>;
const good = goodReadings(rows.filter((r) => r.academicRequirement).map((r) => ({ institution: r.institutionId, text: r.academicRequirement!, country: tier1.get(r.institutionId)!.country })));
const ASKS_A_DEGREE = /\b(bachelor|undergraduate|degree|honou?rs)\b/i;

const step = (mark: number, floor: number) => LEVELS.indexOf(levelOf(mark)) - LEVELS.indexOf(levelOf(floor));
const all: { marks: number; steps: number }[] = [];
const tierC: { marks: number; steps: number }[] = [];
let onlyMinimum = 0;
for (const r of rows) {
  const text = r.academicRequirement;
  const c = text ? requirementLevel(academicStructured(text), text, tier1.get(r.institutionId)!.country, good.get(r.institutionId)) : null;
  const floor = c ? c.floor : text && ASKS_A_DEGREE.test(requirementWords(text)) ? 40 : null;
  const k = cases[r.id];
  if (floor == null) continue;
  if (!k?.gpa || k.gpa.n < 10) {
    onlyMinimum++;
    continue;
  }
  const p25 = fourToUkMark(k.gpa.p25);
  all.push({ marks: p25 - floor, steps: step(p25, floor) });
  const cb = (k.gpaByTier ?? []).find((x) => x.tier === "C");
  if (cb) {
    const c25 = fourToUkMark(cb.p25);
    tierC.push({ marks: c25 - floor, steps: step(c25, floor) });
  }
}
const quantile = (xs: { marks: number }[], p: number) => {
  const m = xs.map((x) => x.marks).sort((a, b) => a - b);
  return m[Math.floor((m.length - 1) * p)];
};
const summary = (name: string, xs: { marks: number; steps: number }[]) => {
  const q = (p: number) => quantile(xs, p);
  const byStep: Record<string, number> = {};
  for (const x of xs) byStep[x.steps] = (byStep[x.steps] ?? 0) + 1;
  console.log(`${name}: n ${xs.length} · admitted p25 above the minimum, UK marks: p25 ${q(0.25)?.toFixed(1)} · median ${q(0.5)?.toFixed(1)} · p75 ${q(0.75)?.toFixed(1)} · class steps above the minimum ${JSON.stringify(byStep)}`);
};
console.log(`programmes with a minimum but fewer than 10 reported GPAs: ${onlyMinimum}`);
summary("All admits' 25th percentile vs minimum", all);
summary("Tier-C admits' 25th percentile vs minimum", tierC);

if (process.argv.includes("--write")) {
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const out = {
    dataset: "How far admitted students' 25th percentile sits above the published minimum, in UK marks, on programmes with both a minimum and 10 or more reported GPAs (scripts/stand/min-gap.ts)",
    computed: new Date().toLocaleDateString("sv"),
    n: all.length,
    medianMarks: r1(quantile(all, 0.5)),
    tierC: { n: tierC.length, medianMarks: r1(quantile(tierC, 0.5)) },
  };
  writeFileSync(path.join(ROOT, "data/raw/stand/min-gap.json"), `${JSON.stringify(out, null, 2)}\n`);
  console.log("wrote data/raw/stand/min-gap.json");
}
