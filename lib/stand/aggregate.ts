// The index over every programme: how many fall in each band by field and country, and the six levers
// ranked by how many programmes each one moves up a band or makes eligible. Runs in the browser on the
// whole /data/programmes file; each programme's fixed parts are prepared once per data object.

import { RANK_NAME, type Rank } from "@/lib/grades";
import { msg } from "@/lib/i18n/translate";
import type { ResultsData } from "@/lib/results-types";
import { classGrade, gradeAtValue } from "./profile";
import { ieltsEquivalent } from "./rules";
import { DEGREE_TYPE_ITEM, prepare, scorePrepared, type Prepared } from "./score";
import { OUTCOMES, type GateKey, type Msg, type Outcome, type StandProfile, type StandScore } from "./types";

type Data = Pick<ResultsData, "programmes" | "universities">;
const cache = new WeakMap<Data, Prepared[]>();

/** Every programme prepared (lib/stand/score.ts prepare), once per data object. */
export function prepareAll(data: Data): Prepared[] {
  let all = cache.get(data);
  if (!all) cache.set(data, (all = data.programmes.map((p) => prepare(p, data.universities[p.u]))));
  return all;
}

const outcomeOfScore = (r: StandScore): Outcome => (r.state === "scored" ? r.band! : r.state);
const outcomeOf = (s: StandProfile, x: Prepared): Outcome => outcomeOfScore(scorePrepared(s, x));
/** Each programme's outcome, in the data's order. */
export const outcomes = (profile: StandProfile, data: Data): Outcome[] => prepareAll(data).map((x) => outcomeOf(profile, x));

export type Counts = Record<Outcome, number>;
const zero = (): Counts => Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Counts;

/** Programmes by outcome: in all, and per field (Kaplan discipline id) × study country. */
export type Distribution = { total: number; counts: Counts; cells: { field: string; country: string; counts: Counts }[] };

/** `scope`: some of prepareAll(data) only (the student's countries and budget on /where-you-stand); all of them when left out. */
export function distribution(profile: StandProfile, data: Data, scope?: Prepared[]): Distribution {
  const all = scope ?? prepareAll(data);
  const counts = zero();
  const cells = new Map<string, Distribution["cells"][number]>();
  all.forEach((x) => {
    const o = outcomeOf(profile, x);
    counts[o]++;
    const k = `${x.p.discipline}|${x.country}`;
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { field: x.p.discipline, country: x.country, counts: zero() }));
    c.counts[o]++;
  });
  return { total: all.length, counts, cells: [...cells.values()] };
}

// ---------- Missing answers ----------

/** An answer the student can give, and how many programmes read Missing for want of it. */
export type MissingItem = { key: GateKey; n: number };

/**
 * The answers that hold programmes at Missing, most programmes first (a programme counts under each answer it
 * needs). A degree-type gate counts only when it asks for the degree type: a four-year rule a university
 * leaves unexplained (lib/stand/score.ts degreeGate) is not the student's to answer.
 */
export function missingItems(profile: StandProfile, data: Data, scope?: Prepared[]): MissingItem[] {
  const all = scope ?? prepareAll(data);
  const counts = new Map<GateKey, number>();
  for (const x of all) {
    const r = scorePrepared(profile, x);
    if (r.state !== "missing") continue;
    for (const g of r.gates) if (g.state === "missing" && (g.key !== "degree-type" || g.reason.key === DEGREE_TYPE_ITEM)) counts.set(g.key, (counts.get(g.key) ?? 0) + 1);
  }
  return [...counts].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
}

// ---------- Levers ----------

export type LeverKey = "grade" | "ielts" | "internship" | "work" | "research" | "later";
export type Move = { from: Outcome; to: Outcome; n: number };
/** The grade lever's figure on the student's own scale: a WAM, an average mark, a GPA out of `scale`, or a class (as its UK mark, 70 a First). */
export type LeverTarget = { value: number; unit: "wam" | "mark" | "gpa" | "class"; scale: number | null };
export type Lever = {
  key: LeverKey;
  /** "GPA 2.5 → 2.6", "WAM 65 → 66", "Classification 2:1 → First", "IELTS 6.5 → 7". */
  label: Msg;
  /** False when it cannot change anything for this student (no grade given, IELTS 9 already). */
  applicable: boolean;
  /** Programmes moving up a band, and programmes turning from Not eligible or Missing to a score. */
  up: number;
  eligible: number;
  /** Every change of outcome, largest first ("Reach → Match: 12"). */
  moves: Move[];
  /** A lever with the same effect on the index, listed once on the page. */
  sameAs?: LeverKey;
  /** The grade lever: the figure it reaches, on the student's own scale. */
  target?: LeverTarget;
};

/** Each lever's name, for one that doesn't apply. */
export const LEVER_NAME: Record<LeverKey, string> = {
  grade: msg("A higher grade"),
  ielts: msg("IELTS +0.5"),
  internship: msg("One more internship in your field"),
  work: msg("One more year of full-time work"),
  research: msg("One more research output"),
  later: msg("Start one year later"),
};

/** Higher is better; Not eligible and Missing have no band. */
const RANK: Record<Outcome, number> = { "not-eligible": 0, missing: 0, far: 1, reach: 2, match: 3, safe: 4 };
/** The score the planner offers first for IELTS (lib/english-tests.ts), for a student with no test yet. */
const FIRST_IELTS = 6.5;

/** A message (lib/stand/types.ts Msg); named tr so scripts/i18n/extract.mjs collects its keys. */
const tr = (key: string, vars?: Msg["vars"]): Msg => (vars ? { key, vars } : { key });

type Change = { profile: StandProfile; label: Msg; target?: LeverTarget };
const r2 = (x: number) => Math.round(x * 100) / 100;
/** The grade lever's steps on each scale: a tenth of a GPA point, one mark. */
const GPA_STEP = 0.1;
const MARK_STEP = 1;
const GRADE_LABEL = { gpa: msg("GPA {from} → {to}"), wam: msg("WAM {from} → {to}"), mark: msg("Average mark {from} → {to}") } as const;

/** A programme whose outcome a better grade can change: scored, or held back by the grade gate alone. */
const gradeSensitive = (r: StandScore) => r.state === "scored" || r.gates.every((g) => g.state === "pass" || g.key === "grade");

/**
 * The smallest change on the student's own scale that moves at least one programme up a band or opens it:
 * a GPA a tenth of a point at a time (up to the scale's top), a WAM or an average mark one mark at a time
 * (up to 100), a class to the next class. With nothing moving, the first step.
 */
function gradeLever(s: StandProfile, all: Prepared[], base: StandScore[]): Change | null {
  const g = s.grade;
  if (!g) return null;
  const i = g.input;
  const sensitive = all.filter((_, k) => gradeSensitive(base[k]));
  const rank = new Map(all.map((x, k) => [x, RANK[outcomeOfScore(base[k])]]));
  const moves = (p: StandProfile) => sensitive.some((x) => RANK[outcomeOf(p, x)] > rank.get(x)!);
  if (i.kind === "class") {
    if (g.rank === 1) return null;
    const next = (g.rank - 1) as Rank;
    const grade = classGrade(next);
    return {
      profile: { ...s, grade },
      label: tr("Classification {from} → {to}", { from: tr(RANK_NAME[g.rank]), to: tr(RANK_NAME[next]) }),
      target: { value: grade.low, unit: "class", scale: null },
    };
  }
  if (i.value === null) return null;
  const gpa = i.kind === "gpa";
  const top = gpa ? (i.scale ?? 4) : 100;
  const step = gpa ? GPA_STEP : MARK_STEP;
  const unit: keyof typeof GRADE_LABEL = gpa ? "gpa" : i.kind === "au-mark" ? "wam" : "mark";
  let first: Change | null = null;
  for (let n = 1; r2(i.value + n * step) <= top; n++) {
    const to = r2(i.value + n * step);
    const grade = gradeAtValue(g, to, s.awarder);
    if (!grade) return first;
    const vars = { from: i.value, to };
    const change: Change = {
      profile: { ...s, grade },
      label: tr(GRADE_LABEL[unit], vars),
      target: { value: to, unit, scale: gpa ? (i.scale ?? 4) : null },
    };
    first ??= change;
    if (moves(change.profile)) return change;
  }
  return first;
}

/** Half a band more on IELTS: from the student's IELTS, or the IELTS equivalent of their TOEFL or PTE; without a test, IELTS 6.5. */
function ieltsLever(s: StandProfile): Change | null {
  const e = s.english;
  if (!e || e.test === "none") return { profile: { ...s, english: { test: "ielts", score: FIRST_IELTS } }, label: tr("IELTS {to}", { to: FIRST_IELTS }) };
  const now = ieltsEquivalent(e.test, e.score);
  if (now === null || now >= 9) return null;
  const to = Math.min(9, now + 0.5);
  return { profile: { ...s, english: { test: "ielts", score: to } }, label: e.test === "ielts" ? tr("IELTS {from} → {to}", { from: now, to }) : tr("IELTS {to} (your score reads as IELTS {from})", { from: now, to }) };
}

/**
 * The six levers, each against the student's outcomes now, sorted by programmes moved up or made
 * eligible. "Start one year later" is the year spent in full-time work before the start: the index has no
 * other time factor, so it moves the same programmes as one more year of work.
 */
export function levers(profile: StandProfile, data: Data, scope?: Prepared[]): Lever[] {
  const all = scope ?? prepareAll(data);
  const scores = all.map((x) => scorePrepared(profile, x));
  const base = scores.map(outcomeOfScore);
  const work = (profile.workYears ?? 0) + 1;
  const tries: { key: LeverKey; change: Change | null; sameAs?: LeverKey }[] = [
    { key: "grade", change: gradeLever(profile, all, scores) },
    { key: "ielts", change: ieltsLever(profile) },
    { key: "internship", change: { profile: { ...profile, internshipsSame: profile.internshipsSame + 1 }, label: tr("One more internship in your field") } },
    { key: "work", change: { profile: { ...profile, workYears: work }, label: tr(work === 1 ? "1 year of full-time work" : "{n} years of full-time work", { n: work }) } },
    { key: "research", change: { profile: { ...profile, research: profile.research + 1 }, label: tr("One more research output") } },
    { key: "later", change: { profile: { ...profile, workYears: work }, label: tr("Start one year later, with a year of full-time work") }, sameAs: "work" },
  ];
  const out: Lever[] = tries.map(({ key, change, sameAs }) => {
    if (!change) return { key, label: tr(LEVER_NAME[key]), applicable: false, up: 0, eligible: 0, moves: [] };
    const moves = new Map<string, Move>();
    let up = 0;
    let eligible = 0;
    all.forEach((x, i) => {
      const to = outcomeOf(change.profile, x);
      const from = base[i];
      if (to === from) return;
      if (RANK[to] > RANK[from]) {
        if (RANK[from] === 0) eligible++;
        else up++;
      }
      const k = `${from}>${to}`;
      const mv = moves.get(k);
      if (mv) mv.n++;
      else moves.set(k, { from, to, n: 1 });
    });
    return {
      key,
      label: change.label,
      applicable: true,
      up,
      eligible,
      moves: [...moves.values()].sort((a, b) => b.n - a.n),
      ...(sameAs ? { sameAs } : {}),
      ...(change.target ? { target: change.target } : {}),
    };
  });
  return out.sort((a, b) => b.up + b.eligible - (a.up + a.eligible) || Number(!!a.sameAs) - Number(!!b.sameAs));
}
