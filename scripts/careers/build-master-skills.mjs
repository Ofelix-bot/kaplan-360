// Builds data/raw/master-skills.json: for each master's, the Skills Framework skills its official page says it
// teaches, split into core and elective (plan §F, grill Q22, Q26–Q30, Q39). lib/data/careers-db.ts reads it on the
// server (getRoleMasterOptions); there is no table for it.
//
// Input: the results.jsonl that scratchpad/masters/run.mts writes, one programme per line:
//   { id, discipline, url, modules: [{ title, kind, skills }], outcomes: [{ quote, skills }], electiveRule, ... }
// plus data/raw/programmes.json (name, institution), data/raw/institutions.json (name, country, QS 2027 rank) and
// data/raw/careers-roles.json (roleSkills: the only skill titles allowed).
//
// Rules (Kaplan 360++'s):
// - A module of kind "unknown" counts as core when the programme lists no elective at all, else as elective;
//   "optional" and "free" are electives.
// - Outcome skills (the page's own sentences on what graduates can do) count like core.
// - An elective skill the core already teaches is left out of the elective list.
// - Only programmes with at least one skill are written. When a programme appears twice, the last line wins, so
//   the script can be rerun while results.jsonl is still being filled.
//
// Usage: node scripts/careers/build-master-skills.mjs [<results.jsonl>]

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAW = join(ROOT, "data", "raw");
const INPUT = process.argv[2]
  ?? "C:/Users/12514/AppData/Local/Temp/claude/c--Users-12514-Desktop-kaplan-360--v201/1a070891-5139-4f9f-a8b9-ff6e17dc5dce/scratchpad/masters/results.jsonl";
const OUT = join(RAW, "master-skills.json");

const read = (f) => JSON.parse(readFileSync(join(RAW, f), "utf8"));
const programmesFile = read("programmes.json");
const institutionsFile = read("institutions.json");
const roles = read("careers-roles.json");

const programmes = new Map((Array.isArray(programmesFile) ? programmesFile : programmesFile.programmes).map((p) => [p.id, p]));
const institutions = new Map(institutionsFile.institutions.map((i) => [i.id, i]));
const roleSkills = new Set(roles.roleSkills.map((s) => s.skill));

// last line wins; a half-written last line (the run is still appending) is skipped
const rows = new Map();
let badLines = 0;
for (const line of readFileSync(INPUT, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try {
    const r = JSON.parse(line);
    rows.set(r.id, r);
  } catch {
    badLines++;
  }
}

const skills = [];
const at = new Map();
const idx = (s) => {
  let i = at.get(s);
  if (i === undefined) at.set(s, (i = skills.push(s) - 1));
  return i;
};

const dropped = { unknownProgramme: 0, unknownSkill: 0, noSkill: 0 };

// A few pages title the programme with its course code ("BU.001 (MBA)", "DC662 - LLM (Master of Laws)"): the
// code goes, and a name left only in brackets loses them.
const displayName = (name) => {
  const n = name.replace(/^[A-Z]{1,4}[.]?\d{2,5}\s*(?:[-–]\s*)?/, "").trim();
  return (/^\((.+)\)$/.exec(n)?.[1] ?? n) || name;
};
const out = [];
let withModules = 0;
for (const r of [...rows.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  const p = programmes.get(r.id);
  if (!p) {
    dropped.unknownProgramme++;
    continue;
  }
  const real = (list) =>
    (list ?? []).filter((s) => {
      if (roleSkills.has(s)) return true;
      dropped.unknownSkill++;
      return false;
    });
  const modules = r.modules ?? [];
  const isElective = (k) => k === "elective" || k === "optional" || k === "free";
  const listsElective = modules.some((m) => isElective(m.kind));
  const core = new Set();
  const elective = new Map(); // skill → module titles
  for (const m of modules) {
    const asCore = m.kind === "core" || (m.kind === "unknown" && !listsElective);
    for (const s of real(m.skills)) {
      if (asCore) core.add(s);
      else {
        if (!elective.has(s)) elective.set(s, []);
        if (!elective.get(s).includes(m.title)) elective.get(s).push(m.title);
      }
    }
  }
  const outcome = new Set((r.outcomes ?? []).flatMap((o) => real(o.skills)).filter((s) => !core.has(s)));
  for (const s of [...core, ...outcome]) elective.delete(s);
  if (!core.size && !outcome.size && !elective.size) {
    dropped.noSkill++;
    continue;
  }
  const inst = institutions.get(p.institutionId);
  out.push({
    id: p.id,
    name: displayName(p.name),
    university: inst?.name ?? p.institutionId,
    country: inst?.country ?? null,
    qsRank: inst?.qs?.rankValue ?? null,
    url: r.url || p.sourceUrl,
    discipline: p.discipline ?? r.discipline,
    core: [...core].map(idx),
    elective: [...elective].map(([s, m]) => ({ skill: idx(s), modules: m })),
    outcome: [...outcome].map(idx),
    electiveRule: r.electiveRule ?? null,
  });
  if (modules.length) withModules++;
}

const counts = { programmes: out.length, withModules, outcomesOnly: out.length - withModules, skills: skills.length };
writeFileSync(
  OUT,
  JSON.stringify({
    built: new Date().toISOString().slice(0, 10),
    source: "official programme pages (module lists and learning outcomes), tagged with Skills Framework skills",
    counts,
    skills,
    programmes: out,
  }) + "\n",
);

console.log(`read ${rows.size} programmes from ${INPUT}${badLines ? ` (${badLines} unreadable lines skipped)` : ""}`);
console.log(`dropped: ${dropped.unknownProgramme} not in programmes.json, ${dropped.noSkill} with no skill, ${dropped.unknownSkill} skill tags not a role skill`);
console.log(`wrote ${OUT}: ${counts.programmes} programmes (${counts.withModules} with modules, ${counts.outcomesOnly} outcomes only), ${counts.skills} skills`);
