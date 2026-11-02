// Dumps every linked admission report (all programmes, any count) for the admission model's fit.
// Usage: npx tsx scripts/admit-model/admit-dump.ts  → data/pipeline/admit-model/records.json
import { writeFileSync } from "node:fs";
import path from "node:path";
import { collect } from "../pipeline/compass-build";
import { ROOT } from "../pipeline/config";
const { records, used, old } = collect();
const out: Record<string, unknown[]> = {};
for (const [id, recs] of records) out[id] = recs;
writeFileSync(path.join(ROOT, "data", "pipeline", "admit-model", "records.json"), JSON.stringify({ used, old, records: out }));
console.log("programmes", records.size, "used", used, "old", old);
