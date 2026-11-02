// Match rate: how closely a Kaplan student's profile matches a programme, from the admission model
// (data/raw/admit-model.json, built by scripts/admit-model/run.py; explained step by step on the "Core Algorithm" page).
//
//   x     = the student's result on the 4-point scale
//           + the awarding university's tier shift, corrected for private-institution teaching (delta), kept between
//             C tier and that tier
//           + career value (lib/admit-weights.ts, as lib/admit-experience.ts values roles), the better of GRE / GMAT (lib/admit-tests.ts), the IELTS rule
//   curve = c × sigmoid((x − θ) / s)
//   match = max(curve, floor band × c × sigmoid((K − θ) / s)) × background factor (× the work gate on MBA and
//           executive programmes, lib/admit-weights.ts), or none below the stated minimum.
//
// Bands: under 30% a gap to close, 30–60% in range, above 60% a strong position.

import { EXPERIENCE_WEIGHT, INTERN_DISCOUNT, mbaWorkGate, type ExperienceClass } from "./admit-weights";
import { gmatBonus, greBonus, ieltsAdjustment } from "./admit-tests";
import type { Tier } from "./tiers";

/** One programme's parameters (lib/data/results.ts copies them from the model). */
export type MatchParams = {
  /** Admitted median and threshold (C-tier-equivalent GPA, 4-point scale), and the curve's slope. */
  k: number;
  theta: number;
  s: number;
  /** Ceiling and background factor. */
  c: number;
  bg: number;
  elite: boolean;
  /** The stated minimum on the UK mark scale (40 Third … 70 First), and the floor band's factor for its country. */
  floor: number | null;
  fbf: number | null;
  exp: ExperienceClass;
  /** GRE and GMAT weights: 1 required, 0.5 optional or mentioned, 0 not required. */
  greW: number;
  gmatW: number;
  /** The lowest IELTS minimum among the university's programmes. */
  ieltsBase: number | null;
  /** The admitted 25th percentile and interquartile range behind the curve (C-tier-equivalent), for drawing the admitted GPA. */
  p25?: number;
  iqr?: number;
  /** θ’s standard error where the programme has reported admits (lib/algorithm/sample.ts draws with it; the rest use the model’s value for none). */
  thetaSe?: number;
};

/** How a programme without reported admits is drawn on the GPA scale admits report (lib/finder/admitted-gpa.ts). */
export type FittedGpaGlobal = {
  /** The fitted share of admits from C-tier universities against competitiveness K. */
  cShare: { a: number; b: number; center: number };
  /** A-tier admits' share of A and B together, across all reported admits. */
  aShareOfAB: number;
  /** The fitted median's error on universities the model had not seen (GPA points, RMSE). */
  medianRmse: number;
};

/** The model's global constants: tier shifts and the private-institution offset. */
export type MatchGlobal = { tierShift: Record<Tier, number>; delta: number; /** δ’s posterior sd, for the 80% range. */ deltaSd?: number };

/** The student, as the finder knows them. */
export type MatchInput = {
  /** The result on the 4-point scale (lib/gpa4.ts), and on the UK mark scale for the minimum. */
  gpa4: number;
  mark: number;
  /** The tier of the university that awards the Kaplan degree (lib/tiers.ts tierByQs). */
  awarderTier: Tier | null;
  /** Full-time work years and internships, in the degree's field and in others. */
  workYears: number | null;
  internshipsSame: number | null;
  internshipsOther: number | null;
  ielts: number | null;
  gre: number | null;
  gmat: number | null;
};

export type MatchBand = "gap" | "range" | "strong";
export type Match = { rate: number; band: MatchBand; belowMinimum: boolean };

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** The band of a rate as shown (whole percent), so a 29.96% shown as "30%" is in range, not a gap. */
export const bandOf = (rate: number): MatchBand => {
  const shown = Math.round(rate * 100);
  return shown < 30 ? "gap" : shown <= 60 ? "range" : "strong";
};

/**
 * Career value from the counts the finder has (no job titles): one full-time role of middling fit at an established
 * employer (analyst level, senior after three years), each internship in the degree's field at full fit and each
 * other one at the default fit, internships discounted; the best three count 1, ½ and ¼, a score of 1.5 is full.
 */
export function careerFromCounts(workYears: number | null, same: number | null, other: number | null): number {
  const values: number[] = [];
  if (workYears && workYears > 0) values.push(0.6 * 0.75 * (workYears >= 3 ? 0.85 : 0.7));
  for (let i = 0; i < Math.min(same ?? 0, 3); i++) values.push(1 * 0.75 * 0.7 * INTERN_DISCOUNT);
  for (let i = 0; i < Math.min(other ?? 0, 3); i++) values.push(0.4 * 0.75 * 0.7 * INTERN_DISCOUNT);
  values.sort((a, b) => b - a);
  const s = values.slice(0, 3).reduce((t, v, i) => t + v * [1, 0.5, 0.25][i], 0);
  return Math.min(1, s / 1.5);
}

/** The student's place on the curve's scale (x above): the result plus the tier shift and the bonuses. */
export function matchPosition(p: MatchParams, g: MatchGlobal, you: MatchInput): number {
  const top = g.tierShift[you.awarderTier ?? "C"];
  const shift = top > 0 ? Math.min(Math.max(top + g.delta, 0), top) : 0;
  const tests = Math.max(p.greW * greBonus(you.gre), p.gmatW * gmatBonus(you.gmat));
  const bonus = EXPERIENCE_WEIGHT[p.exp] * careerFromCounts(you.workYears, you.internshipsSame, you.internshipsOther) + tests + ieltsAdjustment(you.ielts, p.elite ? "elite" : "taught", p.ieltsBase);
  return you.gpa4 + shift + bonus;
}

export function matchRate(p: MatchParams, g: MatchGlobal, you: MatchInput): Match {
  if (p.floor !== null && you.mark < p.floor) return { rate: 0, band: "gap", belowMinimum: true };
  const curve = p.c * sigmoid((matchPosition(p, g, you) - p.theta) / p.s);
  const atFloor = p.floor !== null && p.fbf !== null ? p.fbf * p.c * sigmoid((p.k - p.theta) / p.s) : 0;
  const rate = Math.max(curve, atFloor) * p.bg * (p.exp === "mba-exec" ? mbaWorkGate(you.workYears) : 1);
  return { rate, band: bandOf(rate), belowMinimum: false };
}
