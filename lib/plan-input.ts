// What buildPlan (lib/plan-timeline.ts) needs, from the student's answers and the data /plan loads:
// the shortlist in its order, the planned Kaplan degree with estimated dates, and the events and
// employers that concern them. Used in the browser by components/plan/PlanView.tsx and by
// scripts/check-plan-road.ts, so both build the same plan.

import { universityKey, type UniversityFacts } from "@/lib/pathway";
import { previewFits, type DegreeStage, type PlanActivity, type PlanEvent, type PlanInput, type PlanScholarship } from "@/lib/plan-timeline";
import type { PlanAnswers } from "@/lib/plan-storage";
import type { ResultsData } from "@/lib/results-types";

export type KaplanDegree = { id: string; name: string; university: string | null; level: string; discipline: string };
export type PlanEmployer = { name: string; url: string; intern: boolean };

/** What the /plan page gathers on the server (lib/plan-data.ts planSources) and hands to the browser. */
export type PlanSources = {
  kaplan: KaplanDegree[];
  facts: Record<string, UniversityFacts>;
  events: PlanEvent[];
  scholarships: PlanScholarship[];
  activities: PlanActivity[];
  mom: { url: string; quotes: string[] };
  /** By Kaplan discipline id. */
  employers: Record<string, PlanEmployer[]>;
  englishRules: { university: string; quote: string; url: string }[];
};

/** The first of a university's intake months after `grad` (month numbers). */
function nextIntake(grad: number, months: number[]): number | null {
  const y0 = Math.floor(grad / 12);
  for (let y = y0; y <= y0 + 2; y++) for (const m of months) if (y * 12 + m - 1 > grad) return y * 12 + m - 1;
  return null;
}

/** The Kaplan degree the plan is about: the one planned after the diploma, or the one being studied. */
export const plannedDegree = (answers: PlanAnswers, kaplan: KaplanDegree[]) => kaplan.find((k) => k.id === (answers.level === "diploma" ? answers.pathwayDegreeId : answers.programmeId)) ?? null;

/** buildPlan's input, apart from the page's language (t, locale, name, school), which the caller adds. */
export function planInput(x: { today: string; answers: PlanAnswers; data: Pick<ResultsData, "programmes" | "universities">; sources: PlanSources }): PlanInput {
  const { answers, data, sources } = x;
  // In the shortlist's order: the student ranks it on /results, first choice first.
  const byId = new Map(data.programmes.map((p) => [p.id, p]));
  const programmes = answers.shortlist.flatMap((id) => {
    const p = byId.get(id);
    return p ? [{ p, u: data.universities[p.u] }] : [];
  });
  const grad = answers.graduationYear && answers.graduationMonth ? answers.graduationYear * 12 + answers.graduationMonth - 1 : null;
  const planned = plannedDegree(answers, sources.kaplan);
  // A diploma student's degree starts at the partner's next intake after the diploma (Kaplan's deck)
  // and lasts its usual length: an estimate, said so.
  let degree: DegreeStage = null;
  if (answers.level === "diploma" && planned && grad != null) {
    const f = sources.facts[universityKey(planned.university ?? "")];
    const start = (f?.intakeMonths.length ? nextIntake(grad, f.intakeMonths) : null) ?? grad + 2;
    const length = f?.lengthMonths?.[0] ?? 18;
    degree = { name: planned.name, university: planned.university ?? "Kaplan", start, end: start + length - 1, estimate: true };
  }
  const unis = new Set([...programmes.map(({ u }) => u.name), ...(planned?.university ? [planned.university] : [])]);
  return {
    today: x.today,
    answers,
    programmes,
    degree,
    partner: planned?.university ?? null,
    // Kaplan's bachelor's previews only for a diploma student, before their degree starts, and only
    // the ones about their planned degree (its major, or its degree type when the preview names no major).
    events: sources.events.filter(
      (e) =>
        unis.has(e.university) &&
        (!e.id.startsWith("kaplan-") ||
          (!!degree &&
            e.university === degree.university &&
            !!e.date &&
            Number(e.date.slice(0, 4)) * 12 + Number(e.date.slice(5, 7)) - 1 < degree.start &&
            previewFits(e.title, degree.name))),
    ),
    scholarships: sources.scholarships,
    activities: sources.activities,
    mom: sources.mom,
    // Every private school a student can pick here is outside MOM's vacation-work list (checked on MOM's page).
    notExempt: true,
    employers: sources.employers[planned?.discipline ?? answers.schoolDiscipline ?? ""] ?? [],
    englishRules: sources.englishRules,
  };
}
