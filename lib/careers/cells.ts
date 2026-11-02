import { DRAFT } from "@/content/draft";
import type { MatchResult, RoleKeyIndex, RoleSkill } from "./types";

// The 8-cell key-skill bars (plan E, Q20, Q21): one cell per key skill, in key-skill order, each in one state.
// Pure functions, no React: components/careers/SkillCells draws them; the master's rows (RoleMasters) add their
// own states to the same list. A skill is "coverable" when some Kaplan degree's core module links to it
// (StudentContext.coverableSkills, the same module → skill links matchRole uses).

/** The states a cell can show. Add a state here, then its look in SkillCells' CELL_LOOK. */
export type SkillCellState = "have" | "add" | "none" | "master" | "edge" | "missing";

export type SkillCell = { skill: string; state: SkillCellState };

/** Skill titles compared without case or spacing differences (as lib/careers/match.ts does). */
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** A set that answers "does some Kaplan degree's core module cover this skill?". */
export function coverableSet(coverable: readonly string[]): Set<string> {
  return new Set(coverable.map(norm));
}

/**
 * A role's key skills as cells: "have" when the match covers it, else "add" when some Kaplan degree's core
 * modules cover it, else "none". With no match (no degree picked) nothing is "have".
 */
export function keySkillCells(keySkills: readonly RoleSkill[], result: MatchResult | null, coverable: Set<string>): SkillCell[] {
  const have = new Set((result?.covered ?? []).map((c) => norm(c.skill)));
  return keySkills
    .filter((s) => s.key)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const k = norm(s.skill);
      return { skill: s.skill, state: have.has(k) ? "have" : coverable.has(k) ? "add" : "none" };
    });
}

/** Over every role's key skills: how many places name a skill no Kaplan degree's core modules cover. */
export function uncoveredShare(index: RoleKeyIndex, coverable: Set<string>): { uncovered: number; places: number; roles: number; share: number } {
  let places = 0;
  let uncovered = 0;
  for (const r of index.roles)
    for (const [skill] of r.keys) {
      places++;
      if (!coverable.has(norm(index.skills[skill]))) uncovered++;
    }
  return { uncovered, places, roles: index.roles.length, share: places ? uncovered / places : 0 };
}

const W = DRAFT.careers.gapShare;

/** A share as words ("About a third"), for the headline; the exact count sits in its footnote. */
export function shareWords(share: number): string {
  if (share < 0.07) return W.few;
  if (share < 0.15) return W.tenth;
  if (share < 0.225) return W.fifth;
  if (share < 0.29) return W.quarter;
  if (share < 0.4) return W.third;
  if (share < 0.5) return W.almostHalf;
  if (share < 0.6) return W.overHalf;
  if (share < 0.7) return W.twoThirds;
  return W.most;
}
