import { LEVEL_NAME, type AdmitRange, type Level } from "@/lib/admit-range";
import { RANK_NAME, type Converted } from "@/lib/grades";
import type { T } from "@/lib/i18n/translate";
import type { SavedSearch } from "@/lib/plan-storage";
import type { CasesGroup, CasesSource, CasesTier, TestStatus } from "@/lib/results-types";
import { basisText } from "./compare";
import { sameSearch } from "./facets";

// Words the /results workspace shares between its parts: how an admission range, a result, reported
// admits' groups and sources, and saved searches are named.

/** The UK scale's steps, short. */
export const SHORT: Record<Level, string> = { 40: "Third", 50: "2:2", 60: "2:1", 65: "High 2:1", 70: "First" };
/** What an admitted range rests on, as its badge names it: "Basis: 14 reported admits". `n` counts the cases behind a "cases" basis. */
export function basisLabel(t: T, basis: AdmitRange["basis"], n: number | null): string {
  if (basis === "published") return t("Basis: the programme’s own words");
  if (basis === "cases") return n !== null ? t("Basis: {n} reported admits", { n }) : t("Basis: reported admits");
  if (basis === "statistics") return t("Basis: official applications per place");
  if (basis === "estimate") return t("Basis: Kaplan 360++’s estimate from the page’s wording and QS rank");
  return t("Basis: published minimum only");
}

/** A range's basis label, with the number of reported admits its "cases" basis counts. */
export const rangeBasis = (t: T, r: AdmitRange) => {
  const c = r.from.find((f) => f.k === "cases");
  return basisLabel(t, r.basis, c && c.k === "cases" ? c.n : null);
};

/** "First", "High 2:1 or above", "Any degree class". */
export const usualText = (t: T, l: Level) => (l === 70 ? t("First") : l === 40 ? t("Any degree class") : t("{level} or above", { level: t(LEVEL_NAME[l]) }));

/** The student's result in words: "2:1", "2:1 (average 62%)" for a UK mark, "≈ 2:1 (average 72%)" when converted. */
export function yoursText(t: T, you: Converted): string {
  const name = RANK_NAME[you.rank];
  if (you.basis === name) return t(name);
  const avg = /^average (\d+(?:\.\d+)?)%$/.exec(you.basis);
  const exact = avg !== null && you.mark !== null && Math.abs(Number(avg[1]) - you.mark) < 0.01;
  return t(exact ? "{grade} ({basis})" : "≈ {grade} ({basis})", { grade: t(name), basis: basisText(t, you.basis) });
}

export const SOURCE_NAME: Record<CasesSource, string> = { compass: "指南者", gradcafe: "GradCafe", feiyue: "飞跃手册", jjl: "金吉列", xdf: "新东方" };
export const GROUPS: CasesGroup[] = ["985", "211", "other", "qs50", "qs300", "qsRest"];
/** Fewer reported GPAs than this are listed as they are, not summed up as a range. */
export const GPA_MIN = 5;
export const GROUP_NAME: Record<CasesGroup, string> = {
  "985": "985 universities",
  "211": "211 universities",
  other: "Other mainland universities",
  qs50: "Overseas, QS top 50",
  qs300: "Overseas, QS 51–300",
  qsRest: "Overseas, QS 301+ or unranked",
};
export const BY_NAME: Record<string, string> = { "985": "985", "211": "211", other: "Other mainland", overseas: "Overseas" };
export const TEST_STATUS: Record<TestStatus["status"], string> = { required: "required", optional: "optional", "not-required": "not required", mentioned: "mentioned on the page" };

/** The visitor among reported admitted students. */
export type YouOnCases = {
  /** Their result on the 4-point scale: one value from a mark or GPA, a span from a class alone. */
  gpa: { low: number; high: number } | null;
  /** Their result in words ("2:1", "2:1 (average 62%)"). */
  result: string | null;
  /** The group their degree's awarding university falls in, and that university. */
  group: CasesGroup | null;
  /** The tier their degree is read as: a Kaplan degree as its awarding university's (lib/tiers.ts privateSchoolTier). */
  tier: CasesTier | null;
  university: { name: string; qs: string | null } | null;
};

export const MAX_SAVED = 5;
export type FilterChip = "field" | "country" | "qs" | "unranked" | "university" | "intake" | "budget" | "starred";

/** Whether the current filters are saved already, or the five places are full. */
export const saveState = (saved: SavedSearch[], current: Omit<SavedSearch, "id">) => ({ isSaved: saved.some((s) => sameSearch(s, current)), full: saved.length >= MAX_SAVED });
