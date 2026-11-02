// Checks data/raw/master-skills.json (scripts/careers/build-master-skills.mjs) and the master's options a role page
// gets from it (lib/careers/master-options.ts, called by lib/data/careers-db.ts getRoleMasterOptions). Plan §F.
// Run: npx tsx scripts/check-masters.ts
//
// File: every skill is a Skills Framework role skill (data/raw/careers-roles.json), every programme id is in
// data/raw/programmes.json and appears once, every skill index is in range, every programme has a skill.
// Options, for 3 sample roles: at most MAX_MASTER_OPTIONS; every skill is one of the role's key skills; core and
// elective never repeat a skill; every option adds a skill; and leaving out the beaten programmes never changes the
// top 3 for 200 random students (scored by key skills added in the core, then in core plus electives, then QS).
// Every role: the options kept stay under the cap, so the cap never cuts a list.

import { readFileSync } from "node:fs";
import path from "node:path";
import { MAX_MASTER_OPTIONS, masterOptionsFor, type MasterSkillsFile } from "../lib/careers/master-options";
import type { MasterOption } from "../lib/careers/types";

const ROOT = path.join(import.meta.dirname, "..");
const read = <T>(f: string): T => JSON.parse(readFileSync(path.join(ROOT, f), "utf8")) as T;

const problems: string[] = [];
const check = (ok: unknown, message: string) => {
  if (!ok) problems.push(message);
};

type RolesFile = { roles: { id: string; industry_id: string; hot: boolean }[]; roleSkills: { role_id: string; skill: string; key: boolean; sort_order: number }[] };
const file = read<MasterSkillsFile>("data/raw/master-skills.json");
const roles = read<RolesFile>("data/raw/careers-roles.json");
const programmesFile = read<{ programmes: { id: string }[] } | { id: string }[]>("data/raw/programmes.json");
const programmeIds = new Set((Array.isArray(programmesFile) ? programmesFile : programmesFile.programmes).map((p) => p.id));

// INDUSTRY_MATCH's disciplines, read from lib/data/careers-db.ts (the module itself needs Next and Supabase).
const INDUSTRY_MATCH: Record<string, string[]> = Object.fromEntries(
  [...readFileSync(path.join(ROOT, "lib/data/careers-db.ts"), "utf8").matchAll(/^\s*"?([a-z-]+)"?: \{ disciplines: \[([^\]]*)\]/gm)].map((m) => [m[1], [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1])]),
);
check(Object.keys(INDUSTRY_MATCH).length === 16, `INDUSTRY_MATCH: read ${Object.keys(INDUSTRY_MATCH).length} industries from careers-db.ts, expected 16`);

// ── the file ───────────────────────────────────────────────────────────────────────────────────────────

const roleSkills = new Set(roles.roleSkills.map((s) => s.skill));
for (const s of file.skills) check(roleSkills.has(s), `skill "${s}" is not a role skill in careers-roles.json`);
check(new Set(file.skills).size === file.skills.length, "skills: the index table repeats a title");
const seen = new Set<string>();
for (const p of file.programmes) {
  check(programmeIds.has(p.id), `${p.id}: not in programmes.json`);
  check(!seen.has(p.id), `${p.id}: appears twice`);
  seen.add(p.id);
  const idx = [...p.core, ...p.outcome, ...p.elective.map((e) => e.skill)];
  check(idx.length > 0, `${p.id}: no skill`);
  check(idx.every((i) => Number.isInteger(i) && i >= 0 && i < file.skills.length), `${p.id}: a skill index out of range`);
  check(p.url?.startsWith("http"), `${p.id}: no official url`);
  check(p.elective.every((e) => e.modules.length > 0), `${p.id}: an elective skill without a module`);
}
check(file.counts.programmes === file.programmes.length, "counts.programmes does not match the list");

// ── options for 3 sample roles ─────────────────────────────────────────────────────────────────────────

const keysOf = (roleId: string) => roles.roleSkills.filter((s) => s.role_id === roleId && s.key).sort((a, b) => a.sort_order - b.sort_order).map((s) => s.skill);
const samples = ["infocomm-technology", "financial-services", "accountancy"].map((ind) => roles.roles.find((r) => r.industry_id === ind && r.hot) ?? roles.roles.find((r) => r.industry_id === ind));

// a simple seeded random, so a failure repeats
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

for (const role of samples) {
  if (!role) {
    problems.push("sample role missing");
    continue;
  }
  const keys = keysOf(role.id);
  const disciplines = INDUSTRY_MATCH[role.industry_id] ?? [];
  const options = masterOptionsFor(file, disciplines, keys);
  const all = masterOptionsFor(file, disciplines, keys, Infinity);
  const key = new Set(keys);
  check(options.length <= MAX_MASTER_OPTIONS, `${role.id}: ${options.length} options, more than ${MAX_MASTER_OPTIONS}`);
  for (const o of options) {
    const el = o.elective.map((e) => e.skill);
    check([...o.core, ...el].every((s) => key.has(s)), `${o.id} for ${role.id}: a skill that is not a key skill`);
    check(o.core.length + el.length > 0, `${o.id} for ${role.id}: adds no key skill`);
    check(!el.some((s) => o.core.includes(s)), `${o.id} for ${role.id}: an elective skill the core already has`);
  }

  // every programme in the field that adds a key skill, with nothing left out, to compare against
  const field = new Set(disciplines);
  const full = file.programmes.flatMap((p) => {
    if (!field.has(p.discipline)) return [];
    const core = new Set([...p.core, ...p.outcome].map((i) => file.skills[i]).filter((s) => key.has(s)));
    const every = new Set([...core, ...p.elective.map((e) => file.skills[e.skill]).filter((s) => key.has(s))]);
    return every.size ? [{ core, every, qs: p.qsRank ?? Infinity }] : [];
  });
  const asCand = (o: MasterOption) => ({ core: new Set(o.core), every: new Set([...o.core, ...o.elective.map((e) => e.skill)]), qs: o.qsRank ?? Infinity });
  const kept = all.map(asCand);
  const sent = options.map(asCand);
  for (let n = 0; n < 200; n++) {
    const held = new Set(keys.filter(() => rand() < 0.4));
    const score = (c: { core: Set<string>; every: Set<string>; qs: number }) => [...c.core].filter((s) => !held.has(s)).length * 1e6 + [...c.every].filter((s) => !held.has(s)).length * 1e4 - Math.min(c.qs, 9999);
    const top = (list: typeof full) => list.map(score).sort((a, b) => b - a).slice(0, 3).join(",");
    if (top(full) !== top(kept)) {
      problems.push(`${role.id}: leaving out beaten programmes changed the top 3 for a student holding ${[...held].join(", ") || "nothing"}`);
      break;
    }
    if (top(full) !== top(sent)) {
      problems.push(`${role.id}: the cap of ${MAX_MASTER_OPTIONS} changed the top 3 for a student holding ${[...held].join(", ") || "nothing"}`);
      break;
    }
  }
  console.log(`${role.id} (${role.industry_id}): ${full.length} programmes add a key skill, ${all.length} kept, ${options.length} sent, ${JSON.stringify(options).length} bytes`);
}

// every role: the cap never cuts a list, so it can never drop a top 3
let most = { id: "", n: 0, bytes: 0 };
for (const role of roles.roles) {
  const options = masterOptionsFor(file, INDUSTRY_MATCH[role.industry_id] ?? [], keysOf(role.id), Infinity);
  check(options.length < MAX_MASTER_OPTIONS, `${role.id}: ${options.length} options kept, the cap of ${MAX_MASTER_OPTIONS} would cut some`);
  if (options.length > most.n) most = { id: role.id, n: options.length, bytes: JSON.stringify(options).length };
}
console.log(`every role: at most ${most.n} options (${most.id}, ${most.bytes} bytes)`);

console.log(`master-skills.json: ${file.programmes.length} programmes (${file.counts.withModules} with modules, ${file.counts.outcomesOnly} outcomes only), ${file.skills.length} skills`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 50)) console.log(`  - ${p}`);
  process.exit(1);
}
console.log("check-masters: all checks pass");
