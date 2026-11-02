import { fourToUkMark } from "@/lib/gpa4";
import { schemeOf, studentRank } from "@/lib/grades";
import { msg } from "@/lib/i18n/translate";
import { plannedDegree, type Classification, type FinderAnswers, type PlanAnswers } from "@/lib/plan-storage";
import type { ResultsProgramme } from "@/lib/results-types";
import { inDirections } from "./directions";

// The Programme finder's six answers next to the plan answers every other page reads. The GPA is kept as typed
// on its scale (answers.finder) and also written as the result lib/grades reads (classification, averageMark,
// degreeGpa), so the admission ranges, checks and /plan all see the same result.

export const EMPTY_FINDER: FinderAnswers = { background: null, kind: null, gpa: null, scale: null, directions: [], fee: null, regions: [] };

/** The six background chips shown first (Kaplan disciplines); "other" opens the rest. */
export const BACKGROUNDS: { id: string; label: string }[] = [
  { id: "business", label: msg("Business") },
  { id: "accounting-finance", label: msg("Finance and accounting") },
  { id: "it", label: msg("Computing and information") },
  { id: "communication", label: msg("Media") },
  { id: "psychology-counselling", label: msg("Psychology") },
];
/** Disciplines a background chip covers when it narrows the Kaplan degrees. */
const BACKGROUND_COVERS: Record<string, string[]> = { business: ["business", "marketing", "hospitality-tourism"], it: ["it", "ai-data"] };
export const backgroundCovers = (id: string) => BACKGROUND_COVERS[id] ?? [id];

/** `en`: the short English name, shown after the Chinese on Chinese pages ("本科 Bachelor"). */
export const KINDS = [
  { id: "diploma", label: msg("A diploma"), en: "Diploma" },
  { id: "bachelor", label: msg("A bachelor’s degree"), en: "Bachelor" },
] as const;

export const SCALES = [
  { id: "4.0", label: "4.0" },
  { id: "4.2", label: "4.2" },
  { id: "4.3", label: "4.3" },
  { id: "5.0", label: "5.0" },
  { id: "100", label: msg("100 (percentage)") },
  { id: "uk", label: msg("UK class") },
] as const;

export const UK_CLASSES: { id: Classification; label: string }[] = [
  { id: "first", label: msg("First") },
  { id: "2:1", label: "2:1" },
  { id: "2:2", label: "2:2" },
  { id: "third", label: msg("Third") },
  { id: "unsure", label: msg("Not sure yet") },
];

/** Tuition bands a year in S$. */
export const FEES = [
  { id: "lt30", label: msg("Under S$30k"), min: 0, max: 30000 },
  { id: "30-50", label: msg("S$30–50k"), min: 30000, max: 50000 },
  { id: "50-80", label: msg("S$50–80k"), min: 50000, max: 80000 },
  { id: "gt80", label: msg("Over S$80k"), min: 80000, max: Infinity },
] as const;

const EUROPE = new Set([
  "Netherlands", "Sweden", "Finland", "Germany", "Belgium", "Spain", "Portugal", "Switzerland", "Denmark", "Austria", "Norway", "Hungary", "France",
  "Russia", "Italy", "Czech Republic", "Poland", "Estonia", "Greece", "Luxembourg", "Iceland", "Slovenia", "Lithuania", "Latvia", "Slovakia", "Croatia", "Romania",
  "Cyprus", "Malta", "Bulgaria", "Serbia",
]);
export const REGIONS: { id: string; label: string; has: (country: string) => boolean }[] = [
  { id: "uk", label: msg("United Kingdom"), has: (c) => c === "United Kingdom" },
  { id: "ie", label: msg("Ireland"), has: (c) => c === "Ireland" },
  { id: "au", label: msg("Australia"), has: (c) => c === "Australia" },
  { id: "sg", label: msg("Singapore"), has: (c) => c === "Singapore" },
  { id: "hk", label: msg("Hong Kong SAR"), has: (c) => c === "Hong Kong SAR" },
  { id: "us", label: msg("United States"), has: (c) => c === "United States" },
  { id: "eu", label: msg("Europe"), has: (c) => EUROPE.has(c) },
];
const LISTED = (c: string) => REGIONS.some((r) => r.has(c));
export const inRegions = (country: string, ids: string[]) => !ids.length || ids.some((id) => (id === "other" ? !LISTED(country) : REGIONS.find((r) => r.id === id)?.has(country)));

export const inFee = (feeSgd: number | null, band: FinderAnswers["fee"]) => {
  if (!band || feeSgd === null) return true;
  const b = FEES.find((f) => f.id === band)!;
  return feeSgd >= b.min && feeSgd < b.max;
};

/** The finder's answers; an honours degree (asked separately until 2026-11-02) is now a bachelor's. */
export function finderOf(a: PlanAnswers): FinderAnswers {
  const f = { ...EMPTY_FINDER, ...(a.finder ?? {}) };
  return f.kind === "honours" ? { ...f, kind: "bachelor" } : f;
}

/** The degree's kind as the finder asks it, from the answers other pages set. */
export function kindOf(a: PlanAnswers): FinderAnswers["kind"] {
  const f = finderOf(a);
  if (f.kind) return f.kind;
  if (a.level === "diploma") return "diploma";
  if (a.level === "degree") return "bachelor";
  return null;
}

/** The scale the GPA is asked on by default: the awarding university's own. */
export function defaultScale(university: string | null): string {
  const s = schemeOf(university);
  if (s?.system === "uk-class") return "uk";
  if (s?.system === "ie-gpa") return String(s.gpaScale);
  if (s?.system === "au-grades" && s.gpaScale === 4) return "4.0";
  return "4.0";
}

const SCALE_MAX: Record<string, number> = { "4.0": 4, "4.2": 4.2, "4.3": 4.3, "5.0": 5, "100": 100 };
export const scaleMax = (scale: string) => SCALE_MAX[scale] ?? 4;

const RANK_CLASS = { 1: "first", 2: "2:1", 3: "2:2", 4: "third" } as const;

/**
 * The result fields lib/grades reads, from a GPA on a scale. On the university's own scale it is kept as is (UCD's
 * 4.2, Murdoch's and Monash's 4); a percentage is an average mark; any other scale is put on the 4-point scale in
 * proportion and read as a UK mark (lib/gpa4.ts), with its class.
 */
export function resultFields(university: string | null, scale: string, value: number | null, cls: Classification | null): Pick<PlanAnswers, "classification" | "averageMark" | "degreeGpa"> {
  if (scale === "uk") return { classification: cls, averageMark: null, degreeGpa: null };
  if (value === null) return { classification: null, averageMark: null, degreeGpa: null };
  const s = schemeOf(university);
  const max = scaleMax(scale);
  if (scale === "100") {
    if (s?.system === "au-grades") return { classification: null, averageMark: value, degreeGpa: null };
    const rank = studentRank(null, { classification: null, averageMark: value, degreeGpa: null })?.rank;
    return { classification: rank ? RANK_CLASS[rank] : null, averageMark: value, degreeGpa: null };
  }
  if ((s?.system === "ie-gpa" || s?.system === "au-grades") && s.gpaScale === max) return { classification: null, averageMark: null, degreeGpa: value };
  if (s?.system === "ie-gpa" || s?.system === "au-grades") return { classification: null, averageMark: null, degreeGpa: Math.round((value / max) * s.gpaScale * 100) / 100 };
  const mark = fourToUkMark((value / max) * 4);
  const rank = studentRank(null, { classification: null, averageMark: mark, degreeGpa: null })?.rank;
  return { classification: rank ? RANK_CLASS[rank] : null, averageMark: mark, degreeGpa: null };
}

/** A result in any form: a class (or "not sure yet"), an average mark, or a GPA (the finder's as typed, or the degree's own). */
export const hasGrade = (a: PlanAnswers) => a.classification !== null || a.averageMark !== null || a.degreeGpa !== null || finderOf(a).gpa !== null;

/** A test with its score and date, or "not yet". */
export const hasEnglish = (a: PlanAnswers) => a.englishTest === "none" || (!!a.englishTest && a.englishScore !== null && !!a.englishTestYear && !!a.englishTestMonth);

/**
 * The four answers the list needs: the Kaplan degree (the background and level follow from it), a result, the
 * directions and English. /profile's Part 2 asks the same (lib/profile/progress.ts).
 */
export function required(a: PlanAnswers): { degree: boolean; gpa: boolean; directions: boolean; english: boolean } {
  const id = plannedDegree(a);
  return {
    degree: !!kindOf(a) && !!id && id !== "not-listed",
    gpa: hasGrade(a),
    directions: finderOf(a).directions.length > 0,
    english: hasEnglish(a),
  };
}
export const allRequired = (a: PlanAnswers) => Object.values(required(a)).every(Boolean);

/** In the finder's scope: directions, fee band and regions (the result's minimum is applied by the list). */
export const inScope = (p: ResultsProgramme, country: string, f: FinderAnswers) => inDirections(p, f.directions) && inFee(p.feeSgd, f.fee) && inRegions(country, f.regions);
