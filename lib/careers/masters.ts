import type { SkillCellState } from "./cells";
import { bandFor, bandRank } from "./match";
import type { MasterOption, MatchBand, MatchResult } from "./types";

// The role page's three master's (plan F, Q22–Q24, Q26–Q30, Q36–Q38). Pure functions, no React: the role
// page's client part and scripts/check-careers-match.ts share them.
//
// - Candidates: every master's of the role's industry (lib/data/careers-db getRoleMasterOptions); their
//   skills are already only the role's key skills.
// - Per master's: coreAdds = its core skills the student misses; electiveAdds = its elective skills the
//   student misses and the core does not add, with the fewest electives that add them all; edgeAdds = the
//   added skills no Kaplan degree's core covers ("edge" skills). After = have + both, banded by bandFor with a
//   fitting field: the master's is in the role's own field.
// - Order: slot 1 = the most edge skills added (ties: band after, then n after); slots 2–3 = band after, then
//   n after, then more core adds, then QS rank (lower first), then name. Whether the university partners
//   Kaplan plays no part. A master's that adds nothing is left out. With no degree picked, "have" is empty.

/** Skill titles compared without case or spacing differences (as lib/careers/match.ts does). */
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

export type MasterPick = {
  option: MasterOption;
  /** Missing key skills its core modules (and outcome claims) add, in the role's order. */
  coreAdds: string[];
  /** Missing key skills only its electives add, in the role's order. */
  electiveAdds: string[];
  /** The fewest electives that add every electiveAdds skill, most skills first. */
  electives: string[];
  /** The added skills (core or elective) no Kaplan degree's core covers. */
  edgeAdds: string[];
  /** Key skills covered after the master's: have + coreAdds + electiveAdds. */
  nAfter: number;
  m: number;
  bandAfter: MatchBand;
  /** True for slot 1 when it was chosen for its edge skills. */
  edge: boolean;
};

export type MastersInput = {
  /** The role's key skills, in their sort order. */
  keySkills: readonly string[];
  /** The student's match for the role (lib/careers/match matchFor); null with no degree picked. */
  result: MatchResult | null;
  /** Key skills some Kaplan degree's core covers (StudentContext.coverableSkills); the rest are edge skills. */
  coverable: readonly string[];
  options: readonly MasterOption[];
};

/** The cell of one key skill in a master's bar. */
export type MasterCell = Extract<SkillCellState, "have" | "master" | "edge" | "missing">;

/** The key skills no Kaplan degree's core covers, in the role's order. */
export function edgeSkills(keySkills: readonly string[], coverable: readonly string[]): string[] {
  const on = new Set(coverable.map(norm));
  return keySkills.filter((s) => !on.has(norm(s)));
}

/** The fewest modules that add every skill (greedy: the module adding most of what is left, then its order). */
function fewestElectives(skills: readonly string[], elective: MasterOption["elective"]): string[] {
  const left = new Set(skills.map(norm));
  const offers = new Map<string, Set<string>>();
  for (const e of elective) {
    const k = norm(e.skill);
    if (!left.has(k)) continue;
    for (const m of e.modules) offers.set(m, (offers.get(m) ?? new Set()).add(k));
  }
  const out: string[] = [];
  while (left.size) {
    let best: string | null = null;
    let gain = 0;
    for (const [m, ks] of offers) {
      const g = [...ks].filter((k) => left.has(k)).length;
      if (g > gain) [best, gain] = [m, g];
    }
    if (!best) break;
    out.push(best);
    for (const k of offers.get(best)!) left.delete(k);
    offers.delete(best);
  }
  return out;
}

/** What one master's adds for this student. */
export function masterPick(option: MasterOption, keySkills: readonly string[], have: ReadonlySet<string>, edge: ReadonlySet<string>): MasterPick {
  const core = new Set(option.core.map(norm));
  const elective = new Set(option.elective.map((e) => norm(e.skill)));
  const missing = keySkills.filter((s) => !have.has(norm(s)));
  const coreAdds = missing.filter((s) => core.has(norm(s)));
  const electiveAdds = missing.filter((s) => !core.has(norm(s)) && elective.has(norm(s)));
  const edgeAdds = [...coreAdds, ...electiveAdds].filter((s) => edge.has(norm(s)));
  const m = keySkills.length;
  const nAfter = keySkills.length - missing.length + coreAdds.length + electiveAdds.length;
  return {
    option,
    coreAdds,
    electiveAdds,
    electives: fewestElectives(electiveAdds, option.elective),
    edgeAdds: keySkills.filter((s) => edgeAdds.includes(s)),
    nAfter,
    m,
    bandAfter: bandFor(nAfter, m, "fit", false),
    edge: false,
  };
}

const qs = (p: MasterPick) => p.option.qsRank ?? Number.POSITIVE_INFINITY;

/** Slots 2–3: band after, n after, more core adds, QS rank (lower first), name. */
export function byMatch(a: MasterPick, b: MasterPick): number {
  return (
    bandRank(b.bandAfter) - bandRank(a.bandAfter) ||
    b.nAfter - a.nAfter ||
    b.coreAdds.length - a.coreAdds.length ||
    qs(a) - qs(b) ||
    a.option.name.localeCompare(b.option.name) ||
    a.option.university.localeCompare(b.option.university)
  );
}

/** Slot 1: the most edge skills added, then as byMatch. */
export function byEdge(a: MasterPick, b: MasterPick): number {
  return b.edgeAdds.length - a.edgeAdds.length || byMatch(a, b);
}

/** The cells of a master's bar, one per key skill in the role's order. */
export function masterCells(pick: MasterPick, keySkills: readonly string[], have: ReadonlySet<string>): MasterCell[] {
  const core = new Set(pick.coreAdds);
  const elective = new Set(pick.electiveAdds);
  const edge = new Set(pick.edgeAdds);
  return keySkills.map((s) => (have.has(norm(s)) ? "have" : core.has(s) || elective.has(s) ? (edge.has(s) ? "edge" : "master") : "missing"));
}

/** The key skills the student has, as normalised titles (empty with no degree picked). */
export function haveSet(result: MatchResult | null): Set<string> {
  return new Set((result?.covered ?? []).map((c) => norm(c.skill)));
}

/**
 * The three master's for a role and a student. Slot 1 is the edge pick when some master's adds an edge
 * skill; otherwise all three go by match. One entry per programme id, and one per university + name.
 */
export function pickMasters({ keySkills, result, coverable, options }: MastersInput, count = 3): MasterPick[] {
  const have = haveSet(result);
  const edge = new Set(edgeSkills(keySkills, coverable).map(norm));
  const seen = new Set<string>();
  const picks: MasterPick[] = [];
  for (const o of options) {
    const key = `${norm(o.university)}|${norm(o.name)}`;
    if (seen.has(o.id) || seen.has(key)) continue;
    seen.add(o.id).add(key);
    const p = masterPick(o, keySkills, have, edge);
    if (p.coreAdds.length + p.electiveAdds.length > 0) picks.push(p);
  }
  if (!picks.length) return [];
  const first = [...picks].sort(byEdge)[0];
  const out: MasterPick[] = [];
  if (first.edgeAdds.length > 0) out.push({ ...first, edge: true });
  const rest = picks.filter((p) => !out.some((o) => o.option.id === p.option.id)).sort(byMatch);
  return [...out, ...rest].slice(0, count);
}
