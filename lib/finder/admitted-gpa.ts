import type { FittedGpaGlobal, MatchParams } from "@/lib/admit-model";
import type { ResultsCases } from "@/lib/results-types";

// A programme's admitted GPA on the 4-point scale admits report, drawn the same way whether it has reported admits
// or not. With five or more reported GPAs it is their spread (the Kaplan 360++ database). Without, it is the
// matching algorithm's fit: the model's median and interquartile range (C-tier-equivalent, data/raw/admit-model.json),
// less the tier shift its admits would carry on average (the fitted C-tier share at its K; A and B split as across all
// reported admits), the tails as a normal spread. A fit can differ from real admissions; the card says so.

export type AdmittedGpa = { p10: number; p25: number; median: number; p75: number; p90: number; fitted: boolean; n: number | null; years: [number, number] | null };

const REPORTED_MIN = 5;

export function admittedGpa(fit: MatchParams | null, cases: ResultsCases | null, global: FittedGpaGlobal, tierShift: { A: number; B: number }): AdmittedGpa | null {
  const gpa = cases?.gpa;
  if (gpa && gpa.n >= REPORTED_MIN) return { p10: gpa.p10, p25: gpa.p25, median: gpa.median, p75: gpa.p75, p90: gpa.p90, fitted: false, n: gpa.n, years: cases?.years ?? null };
  if (!fit || fit.p25 === undefined || fit.iqr === undefined) return null;
  const cShare = 1 / (1 + Math.exp(-(global.cShare.a + global.cShare.b * (fit.k - global.cShare.center))));
  const shift = (1 - cShare) * (global.aShareOfAB * tierShift.A + (1 - global.aShareOfAB) * tierShift.B);
  const iqr = Math.max(fit.iqr, 0.08);
  const sd = iqr / 1.35;
  const raw = (v: number) => Math.min(4, Math.round((v - shift) * 100) / 100);
  return { p10: raw(fit.k - 1.2816 * sd), p25: raw(fit.p25), median: raw(fit.k), p75: raw(fit.p25 + iqr), p90: raw(fit.k + 1.2816 * sd), fitted: true, n: null, years: null };
}
