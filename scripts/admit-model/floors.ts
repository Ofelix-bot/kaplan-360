// Each programme's stated minimum on the UK class scale (40 Third, 50 2:2, 60 2:1, 65 high 2:1, 70 First), read
// with the site's own rules (lib/grades.ts requirementLevel, the same as /results uses), for the admission model.
// Usage: npx tsx scripts/admit-model/floors.ts → data/pipeline/admit-model/floors.json
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { goodReadings, requirementLevel } from "../../lib/grades";
import { academicStructured } from "../../lib/pipeline/requirements";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (f: string) => JSON.parse(readFileSync(path.join(ROOT, f), "utf8"));
const programmes: { id: string; institutionId: string; academicRequirement: string | null }[] = read("data/raw/programmes.json").programmes;
const country = new Map<string, string | null>(read("data/raw/institutions.json").institutions.map((i: { id: string; country: string | null }) => [i.id, i.country]));
const rows = programmes.filter((p) => p.academicRequirement).map((p) => ({ institution: p.institutionId, text: p.academicRequirement!, country: country.get(p.institutionId) ?? null }));
const good = goodReadings(rows);
const out: Record<string, { floor: number; main: number; basis: string }> = {};
for (const p of programmes) {
  if (!p.academicRequirement) continue;
  const r = requirementLevel(academicStructured(p.academicRequirement), p.academicRequirement, country.get(p.institutionId) ?? null, good.get(p.institutionId) ?? null);
  if (r) out[p.id] = { floor: r.floor, main: r.main, basis: r.basis };
}
writeFileSync(path.join(ROOT, "data/pipeline/admit-model/floors.json"), JSON.stringify(out));
const n: Record<string, number> = {};
for (const v of Object.values(out)) n[v.floor] = (n[v.floor] ?? 0) + 1;
console.log(`floors: ${Object.keys(out).length} of ${programmes.length} programmes`, n);
