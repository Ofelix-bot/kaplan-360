import type { PlanAnswers } from "@/lib/plan-storage";

// What "Fill in the form for me" reads from a student's sentence (lib/profile-ai.ts on the server,
// components/plan/ProfileSentence.tsx in the browser): only the planner's own fields, each already
// checked against the values that field allows.

export type ProfilePatch = Partial<
  Pick<
    PlanAnswers,
    | "level"
    | "programmeId"
    | "school"
    | "schoolDiscipline"
    | "graduationMonth"
    | "graduationYear"
    | "status"
    | "sgStatus"
    | "nationality"
    | "graduated"
    | "birthYear"
    | "classification"
    | "englishTest"
    | "englishScore"
    | "englishTestMonth"
    | "englishTestYear"
    | "averageMark"
    | "degreeGpa"
    | "countries"
    | "intake"
    | "budget"
  >
>;

export type ProfileReading = {
  patch: ProfilePatch;
  /** The budget as the student wrote it, when it was in another currency (converted at MAS rates). */
  budgetFrom: { amount: number; currency: string } | null;
  /** A Kaplan student's field when the sentence named no single programme: they choose it on the form. */
  field: string | null;
  /** Master's directions named (lib/finder/directions.ts ids, up to three); absent from the parents' reader. */
  directions?: string[];
};

/**
 * The answers with a sentence's fields applied. A new level or programme clears what depended on the
 * old one, as choosing it on the form does.
 */
export function withSentence(answers: PlanAnswers, patch: ProfilePatch): PlanAnswers {
  const reset: Partial<PlanAnswers> = {};
  if (patch.level && patch.level !== answers.level) Object.assign(reset, { programmeId: null, pathwayDegreeId: null, school: null, schoolDiscipline: null, diplomaLevel: null });
  if (patch.programmeId && patch.programmeId !== answers.programmeId) Object.assign(reset, { pathwayDegreeId: null, school: null, schoolDiscipline: null });
  if (patch.school) Object.assign(reset, { programmeId: null, pathwayDegreeId: null });
  return { ...answers, ...reset, ...patch };
}

/** The sentence's longest allowed length, in characters. */
export const MAX_SENTENCE = 400;

/** Files sent with a sentence (screenshots, school emails): checked in the browser and again on the server. */
export const MAX_FILES = 3;
export const MAX_PDF_BYTES = 2 * 1024 * 1024;
export const MAX_PDF_PAGES = 10;
/** Images are scaled down in the browser to this longest edge (what the model reads at full detail). */
export const MAX_IMAGE_EDGE = 1568;
/** An image after scaling; anything larger was not scaled. Three images and a PDF stay under Netlify's 6 MB request. */
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
