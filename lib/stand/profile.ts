// The planner's answers (lib/plan-storage.ts) as the Competitiveness Index reads them. Every
// private-school degree is tier C whatever its awarding university (lib/tiers.ts: outside mainland China
// QS 2027 top 120 A, 121–300 B, 301+ or unranked C; mainland China by Cambridge's list): Kaplan 360++'s
// rule, with no further discount.

import { levelOf, RANK_LEVEL } from "@/lib/admit-range";
import { fourToUkMark } from "@/lib/gpa4";
import { auToUkMark, rankOfLevel, RANK_NAME, schemeOf, studentRank, type Rank } from "@/lib/grades";
import type { PlanAnswers } from "@/lib/plan-storage";
import type { Tier } from "@/lib/tiers";
import type { StandGrade, StandProfile } from "./types";

/** The tier every private-school degree is read as. */
export const PRIVATE_TIER: Tier = "C";

/** The degree the student holds or plans: a Kaplan degree (kaplan-programmes.json with its awarder's country), or another school's. */
export type StandDegree = { name: string | null; university: string | null; country: string | null; discipline: string | null; honours?: boolean | null };

/** The top mark of each class: a class alone covers its whole band. */
const CLASS_TOP: Record<Rank, number> = { 1: 100, 2: 69, 3: 59, 4: 49 };

/** Another private school's degree from its answers (school, awarding university, honours, field). */
export const otherSchoolDegree = (a: PlanAnswers): StandDegree => ({
  name: null,
  university: a.schoolAwarder,
  country: a.schoolAwarderCountry,
  discipline: a.schoolDiscipline,
  honours: a.schoolHonours,
});

/**
 * Honours; a three-year Australian pass degree; a bachelor's stated as not honours ("ordinary"); another
 * bachelor's whose honours is not stated ("other"); or not known. A UK or Irish degree with honours not
 * answered reads as honours, an Australian one as a pass degree (the answer box shows the same).
 */
export function degreeKind(d: StandDegree | null): StandProfile["degreeKind"] {
  if (!d) return null;
  if (d.honours === true || /hons|honou?rs/i.test(d.name ?? "")) return "honours";
  if (d.country === "Australia") return "pass-3y";
  if (d.honours === false) return "ordinary";
  if (honoursByCountry(d.country)) return "honours";
  return d.country ? "other" : null;
}

/** An unanswered honours question as the index reads it for the awarder's country: true for UK and Irish, false for Australian. */
export const honoursByCountry = (country: string | null): boolean | null =>
  country === "United Kingdom" || country === "Ireland" ? true : country === "Australia" ? false : null;

/**
 * The expected result on the UK mark scale. The partner universities' own schemes first (lib/grades.ts
 * studentRank); for an awarder without one, an Australian average mark through the published Australian
 * bands and a North American GPA through the 4-point bands (lib/gpa4.ts).
 */
export function standGrade(a: Pick<PlanAnswers, "classification" | "averageMark" | "degreeGpa">, d: StandDegree | null): StandGrade | null {
  const university = d?.university ?? null;
  const scheme = schemeOf(university);
  const au = scheme?.system === "au-grades" || (!scheme && d?.country === "Australia");
  if (!scheme && a.averageMark != null && d?.country === "Australia") {
    const m = auToUkMark(a.averageMark);
    return { rank: rankOfLevel(levelOf(m)), low: m, high: m, basis: `average ${a.averageMark}%`, input: { kind: "au-mark", value: a.averageMark, scale: null } };
  }
  if (!scheme && a.degreeGpa != null && (d?.country === "United States" || d?.country === "Canada")) {
    const m = fourToUkMark(a.degreeGpa);
    return { rank: rankOfLevel(levelOf(m)), low: m, high: m, basis: `GPA ${a.degreeGpa}/4`, input: { kind: "gpa", value: a.degreeGpa, scale: 4 } };
  }
  const r = studentRank(university, a);
  if (!r) return null;
  if (r.mark !== null) {
    const kind = a.averageMark != null && r.basis.startsWith("average") ? (au ? "au-mark" : "uk-mark") : "gpa";
    const value = kind === "gpa" ? a.degreeGpa : a.averageMark;
    return { rank: r.rank, low: r.mark, high: r.mark, basis: r.basis, input: { kind, value, scale: kind === "gpa" ? (scheme && "gpaScale" in scheme ? scheme.gpaScale : 4) : null } };
  }
  return { ...classGrade(r.rank), basis: r.basis || RANK_NAME[r.rank] };
}

/** A class given without a mark: its whole band, scored at the low end. */
export const classGrade = (rank: Rank): StandGrade => ({ rank, low: RANK_LEVEL[rank], high: CLASS_TOP[rank], basis: RANK_NAME[rank], input: { kind: "class", value: null, scale: null } });

/**
 * The grade at another figure on the student's own scale (the grade lever): a WAM, an average mark or a GPA
 * read through the awarder's scheme as standGrade reads the answer.
 */
export function gradeAtValue(g: StandGrade, value: number, awarder: StandProfile["awarder"]): StandGrade | null {
  const d: StandDegree = { name: null, university: awarder?.name ?? null, country: awarder?.country ?? null, discipline: null };
  const none = { classification: null, averageMark: null, degreeGpa: null };
  if (g.input.kind === "gpa") return standGrade({ ...none, degreeGpa: value }, d);
  if (g.input.kind === "au-mark" || g.input.kind === "uk-mark") return standGrade({ ...none, averageMark: value }, d);
  return null;
}

const count = (n: number | null | undefined) => Math.max(0, Math.round(n ?? 0));

/** The profile the index scores, from the answers and the degree they are about. */
export function standProfile(a: PlanAnswers, degree: StandDegree | null): StandProfile {
  return {
    school: a.school ?? "kaplan",
    awarder: degree?.university ? { name: degree.university, country: degree.country } : null,
    degreeKind: degreeKind(degree),
    discipline: degree?.discipline ?? a.schoolDiscipline ?? null,
    tier: PRIVATE_TIER,
    grade: standGrade(a, degree),
    english: !a.englishTest ? null : a.englishTest === "none" ? { test: "none" } : a.englishScore == null ? null : { test: a.englishTest, score: a.englishScore },
    gre: a.gre,
    gmat: a.gmat,
    workYears: a.workYears ?? (a.workExperience === "none" ? 0 : null),
    internshipsSame: count(a.internshipsSame),
    internshipsOther: count(a.internshipsOther),
    research: count(a.research),
    competitions: count(a.competitions),
    projects: count(a.projects),
  };
}
