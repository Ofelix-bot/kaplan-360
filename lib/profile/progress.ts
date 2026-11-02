import { finderOf, hasEnglish, hasGrade, required } from "@/lib/finder/answers";
import { plannedDegree, type PlanAnswers } from "@/lib/plan-storage";

// /profile's two parts and what each needs (components/profile/ProfileApp.tsx). Part 1 is what the Career Compass
// and the Programme finder both read; Part 2 only the finder. Each "needed" item is one square of the part's
// progress; the year of birth is needed (and counted) only from someone who would need a work pass. The finder
// and the Compass read the same counts to say what is missing (components/profile/ProfileGap.tsx).

export type Item = { id: string; done: boolean };
export type PartProgress = { needed: Item[]; optional: Item[] };

const pass = (a: PlanAnswers) => a.sgStatus === "student-pass" || a.sgStatus === "other-pass";

/** A Kaplan degree (studied now or planned next), or another school's awarding university and field. */
export function hasDegree(a: PlanAnswers): boolean {
  if (a.school && a.school !== "kaplan") return !!a.schoolAwarder && !!a.schoolDiscipline;
  const id = plannedDegree(a);
  return !!id && id !== "not-listed";
}

export const hasGraduation = (a: PlanAnswers) => a.graduated !== null && !!a.graduationYear && !!a.graduationMonth;

/** `electives`: the degree has electives to tick (otherwise the item isn't offered). */
export function part1(a: PlanAnswers, electives: boolean): PartProgress {
  return {
    needed: [
      { id: "degree", done: hasDegree(a) },
      { id: "graduation", done: hasGraduation(a) },
      { id: "status", done: a.sgStatus !== null },
      { id: "nationality", done: !!a.nationality },
      ...(pass(a) ? [{ id: "birthYear", done: !!a.birthYear }] : []),
    ],
    optional: [...(electives ? [{ id: "electives", done: a.electives.length > 0 }] : []), { id: "experience", done: a.experience.length > 0 }, { id: "certificates", done: a.certificates.length > 0 }],
  };
}

export function part2(a: PlanAnswers): PartProgress {
  const f = finderOf(a);
  return {
    needed: [
      { id: "grade", done: hasGrade(a) },
      { id: "directions", done: f.directions.length > 0 },
      { id: "english", done: hasEnglish(a) },
    ],
    optional: [
      { id: "fee", done: !!f.fee },
      { id: "regions", done: f.regions.length > 0 },
      { id: "tests", done: a.gre !== null || a.gmat !== null },
      { id: "research", done: (a.research ?? 0) > 0 || (a.competitions ?? 0) > 0 || (a.projects ?? 0) > 0 },
    ],
  };
}

export const doneCount = (items: Item[]) => items.filter((i) => i.done).length;
export const complete = (p: PartProgress) => p.needed.every((i) => i.done);

export { hasEnglish, hasGrade };

/** What the Programme finder still needs before it lists programmes (lib/finder/answers.ts required). */
export function finderMissing(a: PlanAnswers): ("degree" | "gpa" | "directions" | "english")[] {
  const r = required(a);
  return (["degree", "gpa", "directions", "english"] as const).filter((k) => !r[k]);
}
