// The admission model's experience weights, kept apart from lib/admit-experience.ts (which loads the employer lists)
// so the match rate in the browser (lib/admit-model.ts) doesn't carry those lists.

export type ExperienceClass = "mba-exec" | "required" | "preferred" | "none";

/** An internship counts this much of a job with the same fit, employer and level (a heuristic, raised slightly from 0.4; no admissions data can separate it yet). */
export const INTERN_DISCOUNT = 0.45;
/** GPA points (C-tier-equivalent, 4-point scale) that a full career score of 1 is worth, by what the programme asks for. */
export const EXPERIENCE_WEIGHT: Record<ExperienceClass, number> = {
  "mba-exec": 0.15,
  required: 0.12,
  preferred: 0.08,
  // Taught programmes that don't ask for experience: among 8,023 admits on the same programmes, those with full-time
  // work were admitted with GPAs 0.054 lower (se 0.016); internships showed no such effect (−0.003 per internship).
  none: 0.05,
};

/** MBA and executive programmes: the chance scaled by full-time work years (unanswered counts as none). Kaplan 360++'s
 *  rule, not measured: class profiles average about five years, and few admits come straight from a first degree. */
export const mbaWorkGate = (workYears: number | null) => ((workYears ?? 0) >= 2 ? 1 : (workYears ?? 0) >= 1 ? 0.5 : 0.2);
