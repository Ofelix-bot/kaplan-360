// Shared by /pathway (server) and its view (browser): Kaplan degrees and the partner universities'
// facts from Kaplan's Degree Enrolment Day deck (March 2026).

export type PathwayDegree = { id: string; name: string; type: string; discipline: string; university: string; studentPass: boolean | null; url: string };

/** From the deck: the months 2026 intakes started in, and how long the degree takes. */
export type UniversityFacts = { intakeMonths: number[]; lengthMonths: [number, number] | null; page: number | null };

/** One key for a university however it is written: "Northumbria University at Newcastle" = "Northumbria University". */
export const universityKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b(the|university|of|at newcastle)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
