import { matchRate, type Match, type MatchGlobal, type MatchInput } from "@/lib/admit-model";
import { inUsual, LEVELS, RANK_LEVEL, stepUp } from "@/lib/admit-range";
import { tierByQs } from "@/lib/tiers";
import type { Converted } from "@/lib/grades";
import type { PlanAnswers } from "@/lib/plan-storage";
import type { Row } from "@/components/results/facets";

// What a finder card shows for one programme against the student: the three requirement pills (grade, English,
// experience), from the same checks /results uses (components/results/compare.ts, lib/admit-range.ts), and the match
// rate under "Where you are" (lib/admit-model.ts).

export type State = "met" | "gap" | "none" | "unset" | "unknown";

/** The degree result against the usual range of admitted students: in it, under it, or not given. */
export function gradeState(r: Row, you: Converted | null): State {
  if (!you) return "unset";
  if (r.s === null) return "unknown";
  return inUsual(r.s) ? "met" : "gap";
}

/** English from the programme's check: met (a score or a waiver), a gap, not filled in, or not stated on the page. */
export function englishState(r: Row, a: PlanAnswers): State {
  const c = r.c.find((x) => x.label === "English");
  if (!c) return r.p.ielts === null && r.p.toefl === null ? "unknown" : a.englishTest ? "unknown" : "unset";
  if (c.state === "meets") return "met";
  if (c.state === "below") return "gap";
  return a.englishTest === null || a.englishScore === null ? "unset" : "unknown";
}

/** Years of full-time work the requirement asks for, against the student's. */
export function workState(r: Row, a: PlanAnswers): State {
  if (r.p.work === null) return "none";
  if (a.workYears !== null) return a.workYears >= r.p.work ? "met" : "gap";
  if (a.workExperience === "none") return "gap";
  return a.workExperience === "have" ? "unknown" : "unset";
}

/** A requirement the student can't meet as they stand, which keeps the programme off the finder's list. */
export type HardMiss = "part-time" | "work" | "english";

/**
 * Part-time only, for a student on a Student's Pass or who hasn't said (the pass is for full-time study); fewer
 * years of full-time work than the page asks for (none given counts as none); an English score under the
 * minimum with no waiver.
 */
export function hardMisses(r: Row, a: PlanAnswers): HardMiss[] {
  const out: HardMiss[] = [];
  if (r.p.mode === "part-time" && a.status !== "citizen-pr" && a.status !== "other-pass") out.push("part-time");
  const years = a.workYears ?? (a.workExperience === "have" ? null : 0);
  if (r.p.work !== null && years !== null && years < r.p.work) out.push("work");
  if (englishState(r, a) === "gap") out.push("english");
  return out;
}

/** The first of them, the one the list counts a programme under. */
export const hardMiss = (r: Row, a: PlanAnswers): HardMiss | null => hardMisses(r, a)[0] ?? null;

/**
 * The five dots: 0 with no result to place, 1 at the minimum only if the result is high in its class, 2 over the
 * minimum but under the usual range, 3 possibly in it, 4 in it, 5 a step or more above where it starts.
 */
export function dots(r: Row, you: Converted | null): number {
  if (!you || r.s === null || r.s === "below") return 0;
  if (r.s === "edge") return 1;
  if (r.s === "meets") return 2;
  if (r.s === "near") return 3;
  const lo = you.mark ?? RANK_LEVEL[you.rank];
  return r.p.range.usual < LEVELS[LEVELS.length - 1] && lo >= stepUp(r.p.range.usual, 1) ? 5 : 4;
}

/** Fewer gaps first, then the dots. */
export const gaps = (states: State[]) => states.filter((s) => s === "gap").length;

/**
 * The student as the match rate needs them: the result on the 4-point scale (the middle of its span when only the
 * class is known) and on the UK mark scale, the tier of the university awarding the Kaplan degree (by its QS rank),
 * experience, IELTS, GRE and GMAT. Null until there is a result.
 */
export function matchInput(you: Converted | null, gpa: { low: number; high: number } | null, awarderQs: number | null, a: PlanAnswers): MatchInput | null {
  if (!you || !gpa) return null;
  return {
    gpa4: (gpa.low + gpa.high) / 2,
    mark: you.mark ?? RANK_LEVEL[you.rank],
    awarderTier: tierByQs(awarderQs),
    workYears: a.workYears,
    internshipsSame: a.internshipsSame,
    internshipsOther: a.internshipsOther,
    ielts: a.englishTest === "ielts" ? a.englishScore : null,
    gre: a.gre,
    gmat: a.gmat,
  };
}

/** One programme's match rate, or null with no result yet or no model parameters for it. */
export const rowMatch = (r: Row, g: MatchGlobal, input: MatchInput | null): Match | null => (input && r.p.fit ? matchRate(r.p.fit, g, input) : null);
