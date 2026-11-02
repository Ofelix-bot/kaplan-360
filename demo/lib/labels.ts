import type { CaseFlag, Discipline, MixGroup } from "@/lib/types"

export const DISCIPLINES: { id: Discipline; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "accounting-finance", label: "Accounting & finance" },
  { id: "ai-data", label: "AI & data" },
  { id: "it", label: "IT" },
  { id: "communication", label: "Communication" },
  { id: "education", label: "Education" },
  { id: "law-criminology", label: "Law & criminology" },
  { id: "marketing", label: "Marketing" },
  { id: "psychology-counselling", label: "Psychology & counselling" },
  { id: "healthcare-nursing", label: "Healthcare & nursing" },
  { id: "construction", label: "Construction" },
  { id: "sports-science", label: "Sports science" },
  { id: "hospitality-tourism", label: "Hospitality & tourism" },
]

export const DISCIPLINE_LABEL = Object.fromEntries(
  DISCIPLINES.map((d) => [d.id, d.label])
) as Record<Discipline, string>

/** Singapore and Hong Kong first, as Kaplan students ask about them most. */
export const COUNTRIES: { id: string; label: string; code: string }[] = [
  { id: "Singapore", label: "Singapore", code: "SG" },
  { id: "Hong Kong SAR", label: "Hong Kong", code: "HK" },
  { id: "United Kingdom", label: "United Kingdom", code: "UK" },
  { id: "Australia", label: "Australia", code: "AU" },
  { id: "United States", label: "United States", code: "US" },
  { id: "Canada", label: "Canada", code: "CA" },
  { id: "Macau SAR", label: "Macau", code: "MO" },
]

export const COUNTRY_CODE = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c.code])
) as Record<string, string>

export const COUNTRY_LABEL = Object.fromEntries(
  COUNTRIES.map((c) => [c.id, c.label])
) as Record<string, string>

export const MIX_GROUPS: { id: MixGroup; label: string }[] = [
  { id: "985", label: "985" },
  { id: "211", label: "211" },
  { id: "other", label: "Other mainland" },
  { id: "qs50", label: "Overseas, QS top 50" },
  { id: "qs300", label: "Overseas, QS 51–300" },
  { id: "qsRest", label: "Overseas, below 300" },
]

export const FLAG_TEXT: Record<CaseFlag, string> = {
  gpaWide: "Admitted GPAs spread widely, so read the band as rough.",
  ieltsWide: "Admitted IELTS scores spread widely.",
  sourcesDiffer: "The sources’ median GPAs differ by 0.3 or more.",
  rejectedHigher: "Rejected applicants reported a median GPA as high as the admits’.",
  few: "Fewer than 10 admits reported.",
}
