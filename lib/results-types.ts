// The shape of the /results data file (lib/data/results.ts builds it; components/results reads it).

import type { FittedGpaGlobal, MatchGlobal, MatchParams } from "./admit-model";
import type { AdmitRange } from "./admit-range";
import type { GoodReading } from "./grades";
import type { Tier, TierBand } from "./tiers";

export type TestStatus = { status: "required" | "optional" | "not-required" | "mentioned"; min: number | null };

/** A name for the Chinese pages (data/raw/chinese-names.json): the institution's own (official) or a translation. */
export type ChineseName = { hans: string; hant: string; official: boolean };

/**
 * The English rule as the programme's own pages (or, when they state none, its university's general admissions page)
 * word it (scripts/pipeline/english-programme.ts): a score is needed "unless-exempt" (not with a degree taught in
 * English) or from "all" applicants whose first language isn't English. Singapore and Hong Kong for now.
 */
export type EnglishRule = {
  required: "all" | "unless-exempt";
  /** The exemption for a degree taught in English, and the countries it is limited to (empty: anywhere). */
  exemption: { countries: string[]; quote: string; url: string } | null;
  /** Read from the university's general page, not the programme's own. */
  general: boolean;
};

export type ResultsProgramme = {
  id: string;
  /** Index into ResultsData.universities. */
  u: number;
  name: string;
  zh: ChineseName | null;
  discipline: string;
  /** Accepts a bachelor's in any subject (a conversion programme). */
  any: boolean;
  months: number | null;
  /** Intake months named on the page, as a 12-bit mask (bit 0 = January); 0 when not stated. */
  intake: number;
  intakeText: string | null;
  /** The international fee as the page states it. */
  fee: { amount: number; currency: string | null; basis: string | null } | null;
  /** That fee a year in S$ (MAS rate), when it can be worked out. */
  feeSgd: number | null;
  feeBasis: "year" | "course" | "one-year" | null;
  ielts: number | null;
  /** The English scores are the university-wide minimum for graduate applicants, not stated on the programme page. */
  englishUniversityWide: boolean;
  toefl: number | null;
  pte: number | null;
  duolingo: number | null;
  gre: TestStatus | null;
  gmat: TestStatus | null;
  englishRule: EnglishRule | null;
  /** Minimum UK classification named in the requirement: 1 First, 2 2:1, 3 2:2. */
  minClass: 1 | 2 | 3 | 4 | null;
  /** The requirement's own wording behind minClass when it isn't a UK class ("GPA 3.0/4", "Second Class Honours", "C+ (2.3/4)", "good degree"). */
  minBasis: string | null;
  /** The minimum and where admitted students usually are, on the UK scale, with what they were worked out from (lib/admit-range.ts). */
  range: AdmitRange;
  /** Years of work experience the requirement asks for (lib/pipeline/requirements.ts workYears), or null when it asks for none. */
  work: number | null;
  /** The academic requirement as the page words it (first 280 characters). */
  academic: string | null;
  /** full-time, part-time or both; part-time-only programmes are usually closed to student-visa holders. */
  mode: "full-time" | "part-time" | "both" | null;
  /** Medium of instruction as the page states it. */
  language: string | null;
  /** Taught at Kaplan Singapore with a partner university. */
  kaplan: boolean;
  /** Where it is taught when that is not the university's home campus (Kaplan Singapore, a campus abroad): its own entry. */
  campus: { name: string; country: string } | null;
  /** The programme's official class profile, when it publishes one (data/raw/class-profiles.json). */
  profile: ResultsProfile | null;
  /** Admitted students in an agency's published cases, when there are enough (data/raw/admit-cases.json). */
  cases: ResultsCases | null;
  /** The admission model's parameters for the match rate (lib/admit-model.ts); null for a programme the model lacks. */
  fit: MatchParams | null;
  /** Its rules that depend on the student's nationality (policy-risks.json ids, lib/finder/nationality-risk.ts); absent when none. */
  risks?: string[];
  /** Singapore professional recognition this master's itself counts toward (data/raw/professional-badges.json). */
  badges: ProfessionalBadge[] | null;
  url: string;
  checked: string;
};

/**
 * The tier of the university where admitted students took their first degree (lib/tiers.ts): mainland China by
 * Cambridge's Group A and Group B lists, elsewhere by QS 2027 on Kaplan 360++'s rule (top 120 A, 121–300 B, 301+ or
 * unranked C), a Sino-foreign university's degree as its awarding university's, a Singapore private school's degree C.
 */
export type CasesTier = Tier;
/** The six groups used before the tiers, kept as details: 985, 211, other mainland universities, or overseas by QS 2027 rank (top 50, 51–300, below or unranked). */
export type CasesGroup = "985" | "211" | "other" | "qs50" | "qs300" | "qsRest";
export type CasesSpread = { n: number; p10: number; p25: number; median: number; p75: number; p90: number; low: number; high: number };

export type CasesSource = "compass" | "gradcafe" | "feiyue" | "jjl" | "xdf";
export type CasesSourceCounts = Record<CasesSource, number>;
/** Signs of high variance (scripts/pipeline/compass-build.ts), each shown on the card. */
export type CasesFlag = "gpaWide" | "ieltsWide" | "sourcesDiffer" | "rejectedHigher" | "few";

/**
 * Applicants' reported results per programme (scripts/pipeline/compass-build.ts): 指南者留学's published cases (its own
 * clients, chosen by it, mostly mainland Chinese applicants), the GradCafe survey and Chinese universities' 飞跃手册.
 * The profile is the admits'; rejections are counted apart. GPA on the 4-point scale (lib/gpa4.ts).
 */
export type ResultsCases = {
  n: number;
  /** Admits from each source. */
  sources: CasesSourceCounts;
  /** Median admitted GPA per source with at least five, to show where they disagree. */
  gpaBySource: { source: CasesSource; n: number; median: number }[];
  rejected: { n: number; sources: CasesSourceCounts; gpa: CasesSpread | null } | null;
  waitlisted: number;
  flags: CasesFlag[];
  /** Years the cases were published, oldest and newest, once they are dated. */
  years: [number, number] | null;
  /** Admits by their first degree's tier, of those whose first degree is reported (GradCafe gives none). */
  mix: Record<CasesTier, number>;
  gpa: CasesSpread | null;
  /** GPA quartiles and 90th percentile by first-degree tier, for each tier with at least five reported GPAs (lib/tiers.ts tierBand). */
  gpaByTier: ({ tier: CasesTier } & TierBand)[];
  /** The same admits in the six groups used before the tiers (same total as `mix`), for details. */
  groups: Record<CasesGroup, number>;
  /** Median GPA by those groups (overseas as one), where at least five cases. */
  gpaByGroup: { group: "985" | "211" | "other" | "overseas"; n: number; median: number }[];
  ielts: CasesSpread | null;
  toefl: CasesSpread | null;
  gre: { n: number; median: number } | null;
  /** The median of the reported GMAT scores, each first put on the Focus Edition scale (GMAC's concordance). */
  gmat: { n: number; median: number; edition: "focus" } | null;
  /** Applying in the final year, after graduating, or with work experience stated (median years among those). */
  status: { fresh: number; graduated: number; working: number; other: number; workYears: number | null };
  /** The experiences the newest cases' pages list: how many of those sampled list each kind. */
  experience: { sampled: number; internship: number; work: number; research: number; competition: number; project: number; other: number; none: number } | null;
};

type Shares = { name: string; pct: number | null }[];
type Spread = { average: number | null; median: number | null; low: number | null; high: number | null };

/** Who was admitted, as the programme's own class profile states it: facts to read, not a test the student is scored against. */
export type ResultsProfile = {
  /** The class the figures describe, as the page words it ("Class of 2026"). */
  intake: string | null;
  classSize: number | null;
  internationalPct: number | null;
  womenPct: number | null;
  nationalities: number | null;
  age: Spread | null;
  workYears: number | null;
  withWorkPct: number | null;
  gpa: (Spread & { scale: number | null; label: string | null }) | null;
  gmat: Spread | null;
  gre: Spread | null;
  undergradInstitutionsCount: number | null;
  undergradInstitutions: Shares;
  undergradRegions: Shares;
  regions: Shares;
  majors: Shares;
  url: string;
  checked: string;
};

/** The QS World University Ranking scale of the results' rank range: a range is two indexes into it, the last meaning "and below". */
export const QS_STEPS = [1, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500] as const;

/** `good`: how the university reads "a good degree" (lib/grades.ts goodReadings), when one of its programmes asks for one. */
export type ResultsUniversity = {
  name: string;
  zh: ChineseName | null;
  country: string;
  qs: string | null;
  qsValue: number | null;
  partner: boolean;
  good: GoodReading | null;
  /** Its standing in each discipline its programmes are in, where a subject ranking has it (data/raw/subject-strength.json). */
  subjects: Record<string, SubjectStanding>;
  /** QS WUR 2027 Employer Reputation, university-wide (data/raw/qs-employer-2027.json). */
  employer: { score: number; rank: string | null } | null;
  /** On MOM's COMPASS C2 list of top-tier institutions (data/raw/compass-top-tier.json). */
  compass: CompassListing | null;
};

/**
 * A university's standing in one discipline: QS by Subject 2026 rank as published (a band past 50), ShanghaiRanking
 * GRAS 2025 rank as its band, and QS's Employer reputation score in the subject. `v` is the rank's first number.
 */
export type SubjectStanding = {
  qs?: { rank: string; v: number; subject: string };
  gras?: { rank: string; v: number };
  employer?: { score: number; rank: string | null; subject: string };
};

/** COMPASS C2: group A counts every faculty; group B only the faculties named, mapped to our disciplines. */
export type CompassListing = { group: "A" } | { group: "B"; faculties: { name: string; agency: string; disciplines: string[] }[] };

export type ProfessionalBadge = { kind: "psychology" | "accounting" | "law"; body: string; note: string; url: string };

/** Where the finder's subject strength, industry recognition and badges come from. */
export type StandingSources = {
  qs: { title: string; url: string };
  gras: { title: string; url: string };
  employer: { title: string; url: string; retrievedAt: string };
  compass: { title: string; url: string; effective: string } | null;
  badges: { checked: string; rules: Record<ProfessionalBadge["kind"], { text: string; url: string }> } | null;
};

export type ResultsData = {
  builtAt: string;
  fx: { period: string; source: string; publisher: string };
  /** The report sources behind ResultsProgramme.cases. */
  cases: { sources: Record<CasesSource, { name: string; url: string; note: string }>; checked: string } | null;
  universities: ResultsUniversity[];
  programmes: ResultsProgramme[];
  /** The admission model's global constants for the match rate (lib/admit-model.ts). */
  match: MatchGlobal;
  /** Drawing a programme's admitted GPA where none is reported (lib/finder/admitted-gpa.ts). */
  fittedGpa: FittedGpaGlobal;
  standing: StandingSources;
};
