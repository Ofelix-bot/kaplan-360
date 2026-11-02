import { inUsual, type Standing } from "@/lib/admit-range";
import { englishWaiver, needsScore } from "@/lib/english-rule";
import type { T } from "@/lib/i18n/translate";
import type { EnglishTest, IntakeWindow, PlanAnswers, SavedSearch } from "@/lib/plan-storage";
import { QS_STEPS, type ResultsProgramme, type ResultsUniversity } from "@/lib/results-types";
import type { Check } from "./compare";

// The results filters as facets. Each option shows how many programmes there would be with that
// option chosen and every other filter kept as it is, so the student sees what a choice leaves
// before making it. The student's degree result leaves out programmes whose minimum it is under, and
// can narrow the list to those where it is in the usual range of admitted students (lib/admit-range.ts);
// English, GRE/GMAT and work experience filter by the published minimums; a programme that waives the
// English test for a degree taught in English stays in, and one that doesn't state a minimum stays in.

export type Sort = SavedSearch["sort"];
/** `s`: where the student's degree result sits against the programme's admission range, or null with no result. */
export type Row = { p: ResultsProgramme; u: ResultsUniversity; c: Check[]; s: Standing | null };
export type Scope = Omit<SavedSearch, "id" | "sort">;
/** "all": every programme whose minimum the result meets; "usual": only where it is in the usual range. */
export type Stand = "all" | "usual";
export type Facets = Scope & {
  onlyStarred: boolean;
  /** The student has given a degree result (each row's `s` is set from it). */
  hasResult: boolean;
  stand: Stand;
  /** null: not set. A test with a score: programmes asking for more are out, unless they waive the test for a degree
   * taught in English. No test or no score yet: programmes that need a score from this student are out (lib/english-rule.ts). */
  english: { test: Exclude<EnglishTest, "none"> | null; score: number | null } | null;
  /** The country of the university awarding the student's degree, for English waivers (lib/english-rule.ts). */
  awardedIn: string | null;
  tests: PlanAnswers["greGmat"];
  work: PlanAnswers["workExperience"];
};
export type FacetKey = "field" | "result" | "stand" | "english" | "tests" | "work" | "country" | "qs" | "unis" | "budget" | "intake" | "starred";
/** What the field is measured against: the Kaplan degree's discipline, and the starred programmes. */
export type Context = { discipline: string | null; shortlist: Set<string> };

export const LAST_QS = QS_STEPS.length - 1;
export const WINDOWS: Record<Exclude<IntakeWindow, "any">, number> = { "jan-mar": 0b111, "jul-oct": 0b1111 << 6 };
/** The first reference for private-school students (decided 2026-10-20): Singapore, Hong Kong and Macau. */
export const ASIA = ["Singapore", "Hong Kong SAR", "Macau SAR"];
export const isAsia = (country: string) => ASIA.includes(country);
/** The country the student would study in: the campus's (Kaplan Singapore, a campus abroad), else the university's. */
export const studyCountry = (r: Pick<Row, "p" | "u">) => r.p.campus?.country ?? r.u.country;
export const requiresTest = (p: ResultsProgramme) => p.gre?.status === "required" || p.gmat?.status === "required";
/** The programme's English requirement against the student's: a waiver for a degree taught in English counts as met. */
export const englishFits = (p: ResultsProgramme, e: NonNullable<Facets["english"]>, awardedIn: string | null) => {
  if (englishWaiver(p.englishRule, awardedIn) !== "no") return true;
  if (e.test === null || e.score === null) return !needsScore(p, awardedIn);
  const need = p[e.test];
  return need === null || need <= e.score;
};

/** Where a programme is taught when that is not the university's home campus ("Taught in Dubai, United Arab Emirates"), or null. */
export function campusLabel(p: ResultsProgramme, t: T): string | null {
  if (p.kaplan) return t("Taught at Kaplan Singapore");
  if (!p.campus) return null;
  const place = p.campus.country.startsWith(p.campus.name) ? t(p.campus.country) : `${p.campus.name}, ${t(p.campus.country)}`;
  return t("Taught in {place}", { place });
}

/** "" every field; "mine" the degree's field or open to any subject; "any" open to any subject; else that field. */
export function inField(p: ResultsProgramme, field: string, discipline: string | null): boolean {
  if (!field || (field === "mine" && !discipline)) return true;
  if (field === "mine") return p.discipline === discipline || p.any;
  if (field === "any") return p.any;
  return p.discipline === field;
}

/** Within the QS range: unranked universities count only when they are included. */
export function inQs(qs: number | null, s: Pick<Scope, "qsMin" | "qsMax" | "unranked">): boolean {
  if (qs === null) return s.unranked;
  return qs >= QS_STEPS[s.qsMin] && (s.qsMax === LAST_QS || qs <= QS_STEPS[s.qsMax]);
}
export const qsAll = (s: Pick<Scope, "qsMin" | "qsMax">) => s.qsMin === 0 && s.qsMax === LAST_QS;
/** "1–200", "500–1500+". */
export const qsRange = (s: Pick<Scope, "qsMin" | "qsMax">) => `${QS_STEPS[s.qsMin]}–${s.qsMax === LAST_QS ? `${QS_STEPS[LAST_QS]}+` : QS_STEPS[s.qsMax]}`;

/** Where the student's result sits, in three: in the usual range, at or over the minimum only, or no result to place. */
export const fit = (r: Row): "in" | "reach" | "unknown" => (r.s === null ? "unknown" : inUsual(r.s) ? "in" : "reach");
/** The order of the "best fit" sort: in the usual range first, then possibly, then over the minimum, then at it only if high in its class. */
export const STANDING_ORDER: Record<Standing, number> = { in: 0, near: 1, meets: 2, edge: 3, below: 4 };

/**
 * Whether a programme shows under these filters, leaving out `skip` (the facet whose options are being
 * counted). "academic" leaves out both the result and the usual-range filter, which depend on each other.
 */
export function passes(r: Row, f: Facets, ctx: Context, skip?: FacetKey | "academic"): boolean {
  const { p, u } = r;
  if (skip !== "field" && !inField(p, f.field, ctx.discipline)) return false;
  if (skip !== "result" && skip !== "academic" && r.s === "below") return false;
  if (skip !== "stand" && skip !== "academic" && f.hasResult && f.stand === "usual" && !inUsual(r.s)) return false;
  if (skip !== "english" && f.english && !englishFits(p, f.english, f.awardedIn)) return false;
  if (skip !== "tests" && f.tests === "none" && requiresTest(p)) return false;
  if (skip !== "work" && f.work === "none" && p.work !== null) return false;
  if (skip !== "country" && f.countries.length && !f.countries.includes(studyCountry(r))) return false;
  if (skip !== "qs" && !inQs(u.qsValue, f)) return false;
  if (skip !== "unis" && f.universities.length && !f.universities.includes(u.name)) return false;
  if (skip !== "intake" && f.intake && f.intake !== "any" && p.intake && !(p.intake & WINDOWS[f.intake])) return false;
  if (skip !== "budget" && f.budget !== null && p.feeSgd !== null && p.feeSgd > f.budget) return false;
  if (skip !== "starred" && f.onlyStarred && !ctx.shortlist.has(p.id)) return false;
  return true;
}

/** Two filter sets are the same search when every saved filter matches (order of countries and universities aside). */
export function sameSearch(a: Omit<SavedSearch, "id">, b: Omit<SavedSearch, "id">): boolean {
  const same = (x: string[], y: string[]) => x.length === y.length && x.every((v) => y.includes(v));
  return (
    a.field === b.field &&
    (a.intake ?? "any") === (b.intake ?? "any") &&
    a.budget === b.budget &&
    a.qsMin === b.qsMin &&
    a.qsMax === b.qsMax &&
    a.unranked === b.unranked &&
    a.sort === b.sort &&
    same(a.countries, b.countries) &&
    same(a.universities, b.universities)
  );
}

export type UniversityGroup = {
  /** Index into ResultsData.universities. */
  index: number;
  u: ResultsUniversity;
  rows: Row[];
  /** Programmes where the student's result is in the usual range, over the minimum only, or not given. */
  in: number;
  reach: number;
  unknown: number;
  feeMin: number | null;
  feeMax: number | null;
};

/** The programmes by university, in the order the sort gives their first programme. */
export function byUniversity(list: Row[]): UniversityGroup[] {
  const groups = new Map<number, UniversityGroup>();
  for (const r of list) {
    let g = groups.get(r.p.u);
    if (!g) groups.set(r.p.u, (g = { index: r.p.u, u: r.u, rows: [], in: 0, reach: 0, unknown: 0, feeMin: null, feeMax: null }));
    g.rows.push(r);
    g[fit(r)]++;
    if (r.p.feeSgd !== null) {
      g.feeMin = g.feeMin === null ? r.p.feeSgd : Math.min(g.feeMin, r.p.feeSgd);
      g.feeMax = g.feeMax === null ? r.p.feeSgd : Math.max(g.feeMax, r.p.feeSgd);
    }
  }
  return [...groups.values()];
}
