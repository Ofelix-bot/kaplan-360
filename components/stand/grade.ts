import { schemeOf } from "@/lib/grades";
import type { Classification, PlanAnswers } from "@/lib/plan-storage";
import type { StandDegree } from "@/lib/stand/profile";

// How the student gives their grade, in their awarding university's own scheme: Murdoch's and
// Monash's average mark (WAM), UCD's GPA on 4.2, a UK or Irish class with an optional average mark;
// for another awarder, an Australian WAM, a North American GPA on 4, else a class (lib/stand/profile.ts
// reads each one the same way).

export type GradeKind = { kind: "wam" } | { kind: "gpa"; scale: number } | { kind: "class" };

export function gradeKind(d: StandDegree | null): GradeKind | null {
  if (!d?.university) return null;
  const s = schemeOf(d.university);
  if (s?.system === "au-grades") return { kind: "wam" };
  if (s?.system === "ie-gpa") return { kind: "gpa", scale: s.gpaScale };
  if (s?.system === "uk-class") return { kind: "class" };
  if (d.country === "Australia") return { kind: "wam" };
  if (d.country === "United States" || d.country === "Canada") return { kind: "gpa", scale: 4 };
  return { kind: "class" };
}

export const CLASSES: { value: Exclude<Classification, "unsure">; label: string }[] = [
  { value: "first", label: "First" },
  { value: "2:1", label: "2:1" },
  { value: "2:2", label: "2:2" },
  { value: "third", label: "Third" },
];

/** The grade fields of the answers, as one patch (for the simulator to save). */
export const gradeFields = (a: PlanAnswers): Pick<PlanAnswers, "classification" | "averageMark" | "degreeGpa"> => ({ classification: a.classification, averageMark: a.averageMark, degreeGpa: a.degreeGpa });
