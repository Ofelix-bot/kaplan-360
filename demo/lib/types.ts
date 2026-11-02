// The shape of public/data/programmes.json (scripts/snapshot.mjs writes it from the live site's data).

export type Discipline =
  | "business"
  | "it"
  | "accounting-finance"
  | "psychology-counselling"
  | "marketing"
  | "communication"
  | "ai-data"
  | "law-criminology"
  | "hospitality-tourism"
  | "education"
  | "healthcare-nursing"
  | "construction"
  | "sports-science"

/** Where admitted students took their first degree: 985, 211, other mainland, or overseas by QS rank. */
export type MixGroup = "985" | "211" | "other" | "qs50" | "qs300" | "qsRest"
export type CaseFlag = "gpaWide" | "ieltsWide" | "sourcesDiffer" | "rejectedHigher" | "few"
export type CaseSource = "compass" | "gradcafe" | "feiyue" | "jjl"
export type TestStatus = "required" | "optional" | "not-required" | "mentioned"

export type Spread = {
  n: number
  p10: number
  p25: number
  median: number
  p75: number
  p90: number
}

/** Reported admits for one programme, aggregated. GPA on the 4-point scale. */
export type Cases = {
  n: number
  years: [number, number] | null
  gpa: Spread | null
  ielts: Spread | null
  toefl: number | null
  gre: number | null
  gmat: number | null
  mix: Record<MixGroup, number>
  status: { fresh: number; graduated: number; working: number; other: number }
  /** What the newest case pages list, out of `sampled` pages read. */
  experience: {
    sampled: number
    internship: number
    research: number
    competition: number
    work: number
    project: number
  } | null
  rejected: number
  flags: CaseFlag[]
  sources: Partial<Record<CaseSource, number>>
}

export type Programme = {
  id: string
  /** Index into Dataset.universities. */
  u: number
  name: string
  discipline: Discipline
  /** Open to a bachelor's in any subject. */
  any: boolean
  months: number | null
  /** Intake months as a 12-bit mask (bit 0 = January); 0 when not stated. */
  intake: number
  /** Tuition a year in S$ at the MAS rate, when the page states a fee. */
  feeSgd: number | null
  feeBasis: "year" | "course" | "one-year" | null
  ielts: number | null
  toefl: number | null
  gre: TestStatus | null
  gmat: TestStatus | null
  /** An English-taught degree from Singapore counts instead of a test score. */
  waiver: boolean
  minBasis: string | null
  /** Years of work experience the requirement asks for. */
  work: number | null
  mode: "full-time" | "part-time" | "both" | null
  url: string
  checked: string
  cases: Cases
}

export type University = {
  name: string
  country: string
  qs: number | null
  partner: boolean
}

export type Dataset = {
  builtAt: string
  fx: { period: string; source: string; publisher: string }
  sources: Record<CaseSource, { name: string; url: string; note: string }>
  universities: University[]
  programmes: Programme[]
}
