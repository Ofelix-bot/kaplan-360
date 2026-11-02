// Types shared by the programme-data pipeline (scripts/pipeline) and the site.

export type Currency = "GBP" | "HKD" | "SGD" | "AUD" | "EUR" | "NZD" | "CAD" | "USD";

/** Kaplan Singapore's 13 disciplines (data/raw/kaplan-programmes.json). */
export const DISCIPLINES = [
  "business", "it", "accounting-finance", "psychology-counselling", "marketing", "communication", "ai-data",
  "law-criminology", "hospitality-tourism", "education", "healthcare-nursing", "construction", "sports-science",
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export type AcademicStructured = {
  /** UK classification named as the minimum. */
  classification: "First" | "2:1" | "2:2" | null;
  gpa: { value: number; scale: number } | null;
  /** A percentage or weighted average mark, e.g. 70 for "an average of 70%". */
  percentage: number | null;
  /** The requirement accepts an equivalent qualification ("or equivalent"). */
  orEquivalent: boolean;
};

export type EnglishScores = {
  ielts: { overall: number; minComponent: number | null } | null;
  toefl: { total: number; minComponent: number | null } | null;
};
