// Shared data shapes. A value is null when the official page doesn't state it;
// it is never guessed.

export type Qualification = "diploma" | "advanced-diploma" | "degree";

export interface StudentProfile {
  qualification: Qualification;
  school: string | null; // e.g. the Singapore private school
  awardingUniversity: string | null; // the partner university that awards the degree
  major: string | null;
  result: { system: "uk-class" | "gpa" | "percentage"; value: string; scale?: number } | null;
  ielts: number | null;
  interests: string[];
}

export interface Programme {
  id: string;
  university: string;
  country: string;
  qsRank: number | null;
  name: string;
  field: string;
  academicRequirement: string | null; // quoted from the official page
  ieltsOverall: number | null;
  durationMonths: number | null;
  intake: string | null;
  deadline: string | null; // YYYY-MM-DD
  tuition: { amount: number; currency: string } | null;
  sourceUrl: string;
  lastVerified: string; // YYYY-MM-DD
}
