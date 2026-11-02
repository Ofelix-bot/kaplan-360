// Checks the /careers art (plan §C) against the data: every role in data/raw/careers-roles.json has a scene,
// every scene has its component and a panel tint, and every industry has a head drawing (a missing head is a
// warning: the industry page then shows its headline alone). Rebuild the art with
// node scripts/careers/build-art.mjs.
// Run: npx tsx scripts/check-art.ts

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { INDUSTRIES } from "../lib/careers/industries";
import { INDUSTRY_HEADS, ROLE_SCENE, SCENE_IDS, SCENE_TINT } from "../lib/careers/art";

const ROOT = path.join(import.meta.dirname, "..");
const ART = path.join(ROOT, "components", "careers", "art");
const roles = (JSON.parse(readFileSync(path.join(ROOT, "data/raw/careers-roles.json"), "utf8")) as { roles: { id: string }[] }).roles;

const problems: string[] = [];
const warnings: string[] = [];

const sceneIndex = readFileSync(path.join(ART, "scenes", "index.ts"), "utf8");
const headIndex = readFileSync(path.join(ART, "heads", "index.ts"), "utf8");

for (const r of roles) if (!ROLE_SCENE[r.id]) problems.push(`role ${r.id} has no scene (scenes.json)`);
const roleIds = new Set(roles.map((r) => r.id));
for (const id of Object.keys(ROLE_SCENE)) if (!roleIds.has(id)) warnings.push(`lib/careers/art.ts maps ${id}, which is not a role any more`);

for (const s of SCENE_IDS) {
  if (!existsSync(path.join(ART, "scenes", `${s}.tsx`))) problems.push(`scene ${s} has no component`);
  if (!sceneIndex.includes(`import("./${s}")`)) problems.push(`scene ${s} is not in scenes/index.ts`);
  if (!SCENE_TINT[s]) problems.push(`scene ${s} has no panel tint`);
}
const used = new Set(Object.values(ROLE_SCENE));
for (const s of SCENE_IDS) if (!used.has(s)) warnings.push(`scene ${s} is drawn but no role uses it`);

for (const i of INDUSTRIES) {
  const drawn = INDUSTRY_HEADS.includes(i.id) && existsSync(path.join(ART, "heads", `${i.id}.tsx`)) && headIndex.includes(`import("./${i.id}")`);
  if (!drawn) warnings.push(`industry ${i.id} has no head drawing: its page shows the headline alone`);
}

for (const w of warnings) console.warn(`warn: ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log(`✓ ${roles.length} roles → ${SCENE_IDS.length} scenes; ${INDUSTRY_HEADS.length} of ${INDUSTRIES.length} industries have a head`);
