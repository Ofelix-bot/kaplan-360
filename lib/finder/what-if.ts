import { bandOf, matchRate, type MatchGlobal, type MatchInput, type MatchParams } from "@/lib/admit-model";
import { CLASS_FOUR, ukMarkToFour } from "@/lib/gpa4";
import { schemeOf, studentRank } from "@/lib/grades";
import type { Classification, PlanAnswers } from "@/lib/plan-storage";
import { matchInput } from "./row-state";

// The Finder card's what-if: the student's answers with one or two of them changed, read exactly as the list reads
// them (lib/grades.ts studentRank, then lib/finder/row-state.ts matchInput), and the smallest changes that bring a
// programme's match rate into Strong position (61% and up, lib/admit-model.ts bandOf). Nothing here is saved: the
// card keeps the changed answers in its own state.

/** How the student gave their result, so the what-if moves it in their own terms. */
export type ResultScale =
  | { kind: "gpa"; max: number; min: number; step: number }
  | { kind: "mark"; min: number; max: number; step: number }
  | { kind: "class"; values: Classification[] }
  | null;

const CLASSES: Classification[] = ["third", "2:2", "2:1", "first"];

export function resultScale(university: string | null, a: PlanAnswers): ResultScale {
  if (a.degreeGpa !== null) {
    const s = schemeOf(university);
    const max = s && "gpaScale" in s ? s.gpaScale : 4;
    return { kind: "gpa", max, min: Math.round(max * 0.5 * 100) / 100, step: 0.01 };
  }
  if (a.averageMark !== null) return { kind: "mark", min: 40, max: 100, step: 1 };
  if (a.classification && a.classification !== "unsure") return { kind: "class", values: CLASSES };
  return null;
}

/** The result as the what-if moves it: a GPA, a mark or a class. */
export type ResultValue = number | Classification;

export function resultOf(a: PlanAnswers): ResultValue | null {
  return a.degreeGpa ?? a.averageMark ?? (a.classification && a.classification !== "unsure" ? a.classification : null);
}

export function withResult(a: PlanAnswers, scale: ResultScale, v: ResultValue): PlanAnswers {
  if (!scale) return a;
  if (scale.kind === "gpa") return { ...a, degreeGpa: Number(v) };
  if (scale.kind === "mark") return { ...a, averageMark: Number(v) };
  return { ...a, classification: v as Classification };
}

/** The answers as the match rate reads them, as the Finder list does (components/finder/use-finder.ts). */
export function inputFor(a: PlanAnswers, university: string | null, awarderQs: number | null): MatchInput | null {
  const you = studentRank(university, a);
  if (!you) return null;
  const gpa = you.mark !== null ? { low: ukMarkToFour(you.mark), high: ukMarkToFour(you.mark) } : { low: CLASS_FOUR[you.rank][0], high: CLASS_FOUR[you.rank][1] };
  return matchInput(you, gpa, awarderQs, a);
}

export type WayKey = "result" | "work" | "internships" | "ielts" | "gre" | "gmat" | "result+work";
export type Way = { key: WayKey; answers: PlanAnswers; rate: number; result?: ResultValue; work?: number; internships?: number; ielts?: number; gre?: number; gmat?: number };

const strong = (rate: number) => bandOf(rate) === "strong";
const steps = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
};

export type WhatIfContext = { fit: MatchParams; g: MatchGlobal; university: string | null; awarderQs: number | null };

export function rateFor(ctx: WhatIfContext, a: PlanAnswers) {
  const input = inputFor(a, ctx.university, ctx.awarderQs);
  return input ? matchRate(ctx.fit, ctx.g, input) : null;
}

/** The first of `values` (in order) that brings the rate into Strong position, with that rate. */
function first(ctx: WhatIfContext, values: { a: PlanAnswers; v: number | Classification }[]) {
  for (const x of values) {
    const m = rateFor(ctx, x.a);
    if (m && !m.belowMinimum && strong(m.rate)) return { ...x, rate: m.rate };
  }
  return null;
}

function resultSteps(scale: ResultScale, current: ResultValue | null): ResultValue[] {
  if (!scale) return [];
  if (scale.kind === "class") {
    const i = current === null ? -1 : scale.values.indexOf(current as Classification);
    return scale.values.slice(i + 1);
  }
  const from = typeof current === "number" ? current + scale.step : scale.min;
  return steps(from, scale.max, scale.step);
}

/**
 * The single changes that each reach Strong position, smallest first within each kind: a better result (in the
 * student's own scale), years of full-time work, internships in the degree's field (up to three count), IELTS, and
 * GRE or GMAT where the programme counts them. When none does it alone, up to two pairs of work and result.
 */
export function waysToStrong(ctx: WhatIfContext, a: PlanAnswers): Way[] {
  const scale = resultScale(ctx.university, a);
  const out: Way[] = [];
  const result = first(ctx, resultSteps(scale, resultOf(a)).map((v) => ({ a: withResult(a, scale, v), v })));
  if (result) out.push({ key: "result", answers: result.a, rate: result.rate, result: result.v });
  const work = first(ctx, steps((a.workYears ?? 0) + 1, 10, 1).map((v) => ({ a: { ...a, workYears: v, workExperience: "have" as const }, v })));
  if (work) out.push({ key: "work", answers: work.a, rate: work.rate, work: Number(work.v) });
  const interns = first(ctx, steps((a.internshipsSame ?? 0) + 1, 3, 1).map((v) => ({ a: { ...a, internshipsSame: v }, v })));
  if (interns) out.push({ key: "internships", answers: interns.a, rate: interns.rate, internships: Number(interns.v) });
  if (a.englishTest === "ielts" && a.englishScore !== null) {
    const ielts = first(ctx, steps(a.englishScore + 0.5, 9, 0.5).map((v) => ({ a: { ...a, englishScore: v }, v })));
    if (ielts) out.push({ key: "ielts", answers: ielts.a, rate: ielts.rate, ielts: Number(ielts.v) });
  }
  if (ctx.fit.greW > 0) {
    const gre = first(ctx, steps(Math.max(300, (a.gre ?? 299) + 1), 340, 1).map((v) => ({ a: { ...a, gre: v }, v })));
    if (gre) out.push({ key: "gre", answers: gre.a, rate: gre.rate, gre: Number(gre.v) });
  }
  if (ctx.fit.gmatW > 0) {
    // GMAT Focus Edition totals end in 5.
    const gmat = first(ctx, steps(Math.max(505, (a.gmat ?? 495) + 10), 805, 10).map((v) => ({ a: { ...a, gmat: v }, v })));
    if (gmat) out.push({ key: "gmat", answers: gmat.a, rate: gmat.rate, gmat: Number(gmat.v) });
  }
  if (out.length || !scale) return out;
  for (const years of [1, 2, 3, 5]) {
    if (years <= (a.workYears ?? 0)) continue;
    const base = { ...a, workYears: years, workExperience: "have" as const };
    const both = first(ctx, resultSteps(scale, resultOf(a)).map((v) => ({ a: withResult(base, scale, v), v })));
    if (both) out.push({ key: "result+work", answers: both.a, rate: both.rate, result: both.v, work: years });
    if (out.length >= 2) break;
  }
  return out;
}

/** The highest rate within reach: every change at its top. */
export function ceilingFor(ctx: WhatIfContext, a: PlanAnswers): number {
  const scale = resultScale(ctx.university, a);
  const top = scale ? withResult(a, scale, scale.kind === "class" ? "first" : scale.max) : a;
  const m = rateFor(ctx, {
    ...top,
    workYears: 10,
    workExperience: "have",
    internshipsSame: 3,
    englishScore: a.englishTest === "ielts" ? 9 : a.englishScore,
    gre: ctx.fit.greW > 0 ? 340 : a.gre,
    gmat: ctx.fit.gmatW > 0 ? 805 : a.gmat,
  } as PlanAnswers);
  return m?.rate ?? 0;
}

/** For a student already in Strong position: the lowest result (in their own scale) that keeps it. */
export function cushionFor(ctx: WhatIfContext, a: PlanAnswers): ResultValue | null {
  const scale = resultScale(ctx.university, a);
  const current = resultOf(a);
  if (!scale || current === null) return null;
  const down = scale.kind === "class" ? scale.values.slice(0, scale.values.indexOf(current as Classification)).reverse() : steps(scale.min, Number(current) - scale.step, scale.step).reverse();
  let last: ResultValue | null = null;
  for (const v of down) {
    const m = rateFor(ctx, withResult(a, scale, v));
    if (!m || m.belowMinimum || !strong(m.rate)) break;
    last = v;
  }
  return last;
}
