// The Competitiveness Index's shapes (lib/stand/score.ts): who the student is, what each programme's
// gates and parts say about them, and how the page renders the words. The index is a 0–100 reading of
// where a private-school student stands against a programme's official requirements and its admitted
// students; it is never an admission probability (reported cases are almost all admits, and none of the
// confirmed private-school cases is a rejection: nothing to calibrate a probability on).

import type { T, Vars } from "@/lib/i18n/translate";
import type { Level } from "@/lib/admit-range";
import type { Rank } from "@/lib/grades";
import type { Tier } from "@/lib/tiers";

/**
 * A message for the page to show: an English key marked with msg() (translated with t()), and its
 * placeholders. A placeholder may itself be a message (a field's name, a test's name), translated too;
 * numbers, university names and verbatim quotes go in as they are.
 */
export type Msg = { key: string; vars?: Record<string, string | number | Msg> };

/** A Msg in the page's language. */
export function say(t: T, m: Msg): string {
  if (!m.vars) return t(m.key);
  const vars: Vars = {};
  for (const [k, v] of Object.entries(m.vars)) vars[k] = typeof v === "object" ? say(t, v) : v;
  return t(m.key, vars);
}

export type Band = "safe" | "match" | "reach" | "far";
/** A programme's result for one student: a band, or why it has none. */
export type Outcome = Band | "not-eligible" | "missing";
export const OUTCOMES: Outcome[] = ["safe", "match", "reach", "far", "missing", "not-eligible"];

export type EnglishTestTaken = "ielts" | "toefl" | "pte" | "duolingo";

/**
 * The student as the index reads them. Built from the planner's answers by lib/stand/profile.ts;
 * the levers (lib/stand/aggregate.ts) change one field at a time.
 */
export type StandProfile = {
  /** "kaplan" or another private school's id (lib/data/topups.ts SCHOOLS). */
  school: string;
  /** The university awarding the degree, and its country (for English waivers). */
  awarder: { name: string; country: string | null } | null;
  /**
   * "honours": an honours degree (UK, Irish, or named so); "pass-3y": a three-year Australian pass
   * (ordinary) degree; "ordinary": another bachelor's stated as not honours; "other": a bachelor's whose
   * honours is not stated; null: not known yet.
   */
  degreeKind: "honours" | "pass-3y" | "ordinary" | "other" | null;
  /** The degree's Kaplan discipline (one of the 13). */
  discipline: string | null;
  /** Every private-school degree reads as tier C, whatever the awarding university (Kaplan 360++'s rule). */
  tier: Tier;
  /** The expected result, null when not given. */
  grade: StandGrade | null;
  english: { test: EnglishTestTaken; score: number } | { test: "none" } | null;
  gre: number | null;
  gmat: number | null;
  /** Null: not answered (a programme asking for years of work then reads "Missing"). */
  workYears: number | null;
  /** Internships in the degree's own field, and in other fields. */
  internshipsSame: number;
  internshipsOther: number;
  research: number;
  competitions: number;
  projects: number;
};

/**
 * The expected result on the UK mark scale (lib/grades.ts studentRank): `low`–`high` is the span a
 * class alone covers (a 2:1 is 60–69), the same number when a mark or GPA was given. The index scores
 * `low`. `input` is the figure the student gave, for the grade lever ("WAM 65 → 67").
 */
export type StandGrade = {
  rank: Rank;
  low: number;
  high: number;
  basis: string;
  input: { kind: "au-mark" | "uk-mark" | "gpa" | "class"; value: number | null; scale: number | null };
};

export type GateKey = "degree-type" | "grade" | "english" | "tests" | "work" | "subject";
export type Gate = {
  key: GateKey;
  state: "pass" | "fail" | "missing";
  /** Why, in one line ("Asks for a 2:1; you expect a 2:2"). For "missing", the item to add. */
  reason: Msg;
  /** Where the rule comes from: the programme's page, the university's, or Kaplan 360++'s own. */
  basis: Msg;
  /** The official words behind it, verbatim, when there are some. */
  quote?: { text: string; url: string };
  /**
   * A second reading shown beside the result, never changing it: the degree type read by the university's
   * row for the awarding country, where that row gives a different result from the Singapore one.
   */
  note?: { text: Msg; quote?: { text: string; url: string } };
};

export type PartKey = "academic" | "experience" | "tests" | "subject";
export type Part = {
  /** 0–100. */
  score: number;
  /** Percent of the index; the four add up to 100. */
  weight: number;
  basis: Msg;
  /** Each step behind the score, in order. */
  detail: Msg[];
};

/** The facts about competition that the admitted level already counts, shown beside the index (never weighted again). */
export type Competition = {
  /** The admitted level /results shows (lib/admit-range.ts). */
  admitted: Level;
  admittedBasis: "published" | "cases" | "statistics" | "estimate" | "minimum";
  perPlace: { applications: number; places: number; year: string | null; url: string } | null;
  wording: string | null;
  qs: number | null;
  /**
   * The admitted level the academic part scores against, as a UK mark (above 70: past a First), and whether
   * it is Kaplan 360++'s rule (the minimum + one class step, for a programme that publishes only a
   * minimum); null when the part reads tier-C admitted cases.
   */
  indexLevel: { mark: number; rule: boolean } | null;
};

export type StandScore = {
  id: string;
  state: "scored" | "not-eligible" | "missing";
  gates: Gate[];
  parts: Record<PartKey, Part> | null;
  /** Integer 0–100, only when scored. */
  index: number | null;
  band: Band | null;
  /** What the index rests on ("Official requirements + 14 tier-C admitted cases"). */
  basis: Msg;
  competition: Competition;
};
