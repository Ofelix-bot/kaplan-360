import { LEVELS, type AdmitRange, type Level } from "@/lib/admit-range";
import { fourToUkMark } from "@/lib/gpa4";
import { msg } from "@/lib/i18n/translate";
import type { ResultsCases } from "@/lib/results-types";
import { PRIVATE_SCHOOL_TIER, tierBand, type TierBand } from "@/lib/tiers";

// Where a private school's degree stands on a programme's admission range. Every private-school degree is read as
// tier C (QS 301+ or unranked), whatever the awarding university (lib/tiers.ts PRIVATE_SCHOOL_TIER): experience,
// not a university rule, so it is shown as a marker beside the range and never changes the range or its filter. The
// marker is the programme's tier C admits: with at least five tier C GPAs their median and middle half (p25–p75);
// otherwise the programme's admitted level unchanged, with the basis that level has.

/** `marks`: the marker's span as UK marks, the admission range's scale, low to high. */
export type TopUpMarker =
  /** The programme's tier C admits' GPAs, the span their middle half; `median` as a UK mark. */
  | { k: "cases"; marks: [number, number]; band: TierBand; median: number }
  /** Too few tier C GPAs: the programme's admitted level, the span its step, and what it rests on (`n`: the reported admits behind a "cases" basis). */
  | { k: "range"; marks: [number, number]; level: Level; basis: AdmitRange["basis"]; n: number | null };

/** The UK mark where a step ends: the next step's, the First's at 80 (GPA 4.0 through lib/gpa4.ts's bands). */
const stepEnd = (l: Level) => LEVELS.find((x) => x > l) ?? 80;

/** The marker for a private-school degree on this programme's range. */
export function topUpMarker(range: AdmitRange, cases: ResultsCases | null | undefined): TopUpMarker {
  const band = tierBand(cases, PRIVATE_SCHOOL_TIER);
  if (band) return { k: "cases", band, median: fourToUkMark(band.median), marks: [fourToUkMark(band.p25), fourToUkMark(band.p75)] };
  // Just inside the step's end, so the bracket stops at the step's edge, not the next one's.
  const reported = range.from.find((f) => f.k === "cases");
  return { k: "range", level: range.usual, basis: range.basis, n: reported && reported.k === "cases" ? reported.n : null, marks: [range.usual, stepEnd(range.usual) - 0.001] };
}

/**
 * Official statements near the question, one verbatim line each (checked 2026-10-25). None is about top-ups as
 * such: no university checked says a private school's graduates need higher grades.
 */
export const RELATED_RULES: { university: string; page: string; quote: string; url: string }[] = [
  {
    university: "The University of Edinburgh",
    page: msg("Singapore entry equivalents"),
    quote: "Equivalent qualifications vary depending on which institution awarded your degree.",
    url: "https://study.ed.ac.uk/programmes/regions/singapore",
  },
  {
    university: "The University of Melbourne",
    page: msg("Graduate course entry requirements"),
    quote: "Your final WAM may be adjusted depending on your previous institution's accreditation, subject grading, and pass marks.",
    url: "https://study.unimelb.edu.au/find/courses/graduate/master-of-contemporary-chinese-studies/entry-requirements/",
  },
  {
    university: "Singapore Management University",
    page: msg("Master of Management admission requirements"),
    quote:
      "SMU graduates with cumulative GPAs of 3.0/4.0 or better, and graduates from local Autonomous Universities (NUS, NTU, SUSS, SUTD, SIT) with cumulative GPAs of 3.5/5.0 or better will not require a GMAT/GRE/SMU Admissions Test score for admissions.",
    url: "https://business.smu.edu.sg/master-management/admissions/admission-requirements",
  },
];
