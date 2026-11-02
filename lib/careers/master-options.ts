import type { MasterOption } from "@/lib/careers/types";

// The master's a role page can recommend, from data/raw/master-skills.json (scripts/careers/build-master-skills.mjs).
// Pure, so scripts/check-masters.ts runs it without Next; lib/data/careers-db.ts getRoleMasterOptions feeds it the file.

/** One programme of data/raw/master-skills.json; skills are indexes into the file's `skills`. */
export type MasterSkillsRow = {
  id: string;
  name: string;
  university: string;
  country: string | null;
  qsRank: number | null;
  url: string;
  discipline: string;
  core: number[];
  elective: { skill: number; modules: string[] }[];
  outcome: number[];
  electiveRule: string | null;
};

export type MasterSkillsFile = {
  built: string;
  source: string;
  counts: { programmes: number; withModules: number; outcomesOnly: number; skills: number };
  skills: string[];
  programmes: MasterSkillsRow[];
};

/**
 * Most options a role page carries (it is prerendered, and the list goes to the client). A guard only: with the
 * beaten programmes left out no role comes near it (scripts/check-masters.ts fails if one reaches it).
 */
export const MAX_MASTER_OPTIONS = 250;

/** How many other options must beat a programme on every count before it is left out. */
const KEEP_BEHIND = 3;

type Candidate = { option: MasterOption; core: number; all: number; qs: number };

const bits = (n: number) => {
  let c = 0;
  for (let x = n; x; x &= x - 1) c++;
  return c;
};

/**
 * The master's in `disciplines` that add at least one of `keySkills`, lists cut to those skills. The ranking a
 * student sees (lib/careers/masters.ts) only ever rewards more key skills in the core, more in core plus electives,
 * and a better QS rank, so a programme that 3 others match or beat on all three can never reach the top 3 for any
 * student and is left out; then at most `max`, most core skills first.
 */
export function masterOptionsFor(file: MasterSkillsFile, disciplines: string[], keySkills: string[], max = MAX_MASTER_OPTIONS): MasterOption[] {
  const order = keySkills.slice(0, 31);
  const bit = new Map<number, number>();
  file.skills.forEach((s, i) => {
    const k = order.indexOf(s);
    if (k >= 0) bit.set(i, 1 << k);
  });
  const inField = new Set(disciplines);
  const named = (mask: number) => order.filter((_, k) => mask & (1 << k));

  const candidates: Candidate[] = [];
  for (const p of file.programmes) {
    if (!inField.has(p.discipline)) continue;
    let core = 0;
    for (const i of [...p.core, ...p.outcome]) core |= bit.get(i) ?? 0;
    const elective = new Map<number, string[]>();
    for (const e of p.elective) {
      const b = bit.get(e.skill);
      if (b && !(core & b)) elective.set(b, e.modules);
    }
    let all = core;
    for (const b of elective.keys()) all |= b;
    if (!all) continue;
    candidates.push({
      core,
      all,
      qs: p.qsRank ?? Infinity,
      option: {
        id: p.id,
        name: p.name,
        university: p.university,
        country: p.country,
        qsRank: p.qsRank,
        url: p.url,
        core: named(core),
        elective: [...elective].sort(([a], [b]) => a - b).map(([b, modules]) => ({ skill: order[Math.log2(b)], modules })),
        electiveRule: p.electiveRule,
      },
    });
  }

  candidates.sort((a, b) => bits(b.core) - bits(a.core) || bits(b.all) - bits(a.all) || a.qs - b.qs || a.option.id.localeCompare(b.option.id));
  // Anything that beats a candidate sorts before it, and a left-out one's 3 betters also beat what it beats, so
  // counting only the kept ones is enough.
  const kept: Candidate[] = [];
  for (const c of candidates) {
    let behind = 0;
    for (const k of kept) {
      if ((k.core & c.core) === c.core && (k.all & c.all) === c.all && k.qs <= c.qs && ++behind >= KEEP_BEHIND) break;
    }
    if (behind < KEEP_BEHIND) kept.push(c);
  }
  return kept.slice(0, max).map((c) => c.option);
}
