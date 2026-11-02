"use client";

import { createContext, use, useMemo, useRef, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { useT } from "@/components/i18n/I18nProvider";
import { checks } from "@/components/results/compare";
import { ASIA, byUniversity, englishFits, inField, isAsia, LAST_QS, passes, qsAll, requiresTest, STANDING_ORDER, studyCountry, WINDOWS, type Context, type FacetKey, type Facets, type Row, type Scope as FacetScope, type Stand, type UniversityGroup } from "@/components/results/facets";
import { useLocalName } from "@/components/results/names";
import { MAX_SAVED, saveState, yoursText, type FilterChip, type YouOnCases } from "@/components/results/words";
import { inUsual, standing } from "@/lib/admit-range";
import type { Awarder } from "@/lib/data/partners";
import { CLASS_FOUR, ukMarkToFour } from "@/lib/gpa4";
import { gpaClass, RANK_NAME, schemeOf, studentRank, type Converted, type GpaClass, type Rank } from "@/lib/grades";
import type { KaplanProgrammeOption, SchoolOption } from "@/lib/plan-options-types";
import { plannedDegree, type Classification, type EnglishTest, type IntakeWindow, type PlanAnswers, type SavedSearch } from "@/lib/plan-storage";
import { QS_STEPS, type ChineseName, type ResultsData, type ResultsUniversity } from "@/lib/results-types";
import { privateSchoolTier } from "@/lib/tiers";
import { useResultsData } from "@/lib/workspace/data";
import { usePlanStore } from "@/lib/workspace/plan-store";
import { DEFAULT_SCOPE, useWorkspace } from "@/lib/workspace/store";

// Every programme matched against the student's answers, in the browser, worked out once per change
// for the whole workspace: the rows (each requirement next to the student's answer, and where their
// result sits in the admission range), what the filters leave, how many each option would leave
// with every other filter kept, and the handlers that change answers and filters. The logic is the
// /results Finder's (components/results/facets.ts, compare.ts); only the way it is shown is new.

export type ResultValue = Rank | "unsure";
export type Have = "have" | "none" | null;
type Score = Exclude<EnglishTest, "none">;

export type PanelCounts = {
  field: { all: number; mine: number | null; any: number; byField: Record<string, number> };
  result: { value: ResultValue; label: string; n: number }[];
  /** Programmes whose minimum the result meets, and those where it is in the usual range of admitted students. */
  stand: { all: number; usual: number };
  /** Programmes open to this English score (those that state no minimum for the test included). */
  english: (test: Score, score: number) => number;
  /** With no test or no score yet: programmes that waive the test for a degree taught in English, or need no score. */
  englishNone: number;
  englishAll: number;
  tests: { any: number; none: number };
  work: { any: number; none: number };
  countries: [string, number][];
  /** Programmes in each QS step (QS_STEPS[i] up to the next), with the QS range itself left out. */
  qs: number[];
  unranked: number;
  universities: { name: string; zh: ChineseName | null; qs: string | null; n: number }[];
  budget: (v: number | null) => number;
  intake: (w: IntakeWindow) => number;
};

/** The result in finer terms, for a degree graded by class: a UK average mark, or a GPA on the university's scale (UCD's 4.2). */
/** `cls`: a GPA's class under the university's own published bands, where they have a source (lib/grades gpaClass). */
export type MarkField = { kind: "uk" | "gpa"; scale: number | null; value: number | null; cls?: GpaClass | null } | null;

/** What the server gives the workspace: the Kaplan programmes, fields, other schools, awarding universities. */
export type WorkspaceProps = {
  programmes: KaplanProgrammeOption[];
  disciplines: Record<string, string>;
  schools: SchoolOption[];
  awarders: Record<string, Awarder>;
  /** The one-sentence reader is available (app/api/profile has its key). */
  sentence: boolean;
};

type Results = {
  counts: PanelCounts;
  list: Row[];
  groups: UniversityGroup[];
  /** What-if varies the budget and results: it starts from the other filters only. */
  whatIf: { p: Row["p"]; u: ResultsUniversity }[];
  starred: Row[];
  /** Programmes each saved search finds now. */
  saved: Record<string, number>;
  inRange: number;
  near: number;
};

export type Model = WorkspaceProps & {
  data: ResultsData;
  answers: PlanAnswers;
  /** Changes the student's answers (kept in this browser). */
  update: (patch: Partial<PlanAnswers>) => void;
  degrees: KaplanProgrammeOption[];
  degreeId: string | null;
  /** The student's Kaplan degree. */
  mine: KaplanProgrammeOption | undefined;
  awarder: Awarder | undefined;
  /** The university awarding it, and its country (for English waivers). */
  university: string | null;
  awardedIn: string | null;
  /** The degree is graded by class (UK, Ireland), so the result is asked as one. */
  asksClass: boolean;
  you: Converted | null;
  result: ResultValue | null;
  tests: Have;
  field: string;
  stand: Stand | null;
  mark: MarkField;
  youCases: YouOnCases | null;
  rows: Row[];
  byId: Map<string, Row>;
  results: Results;
  current: Omit<SavedSearch, "id">;
  /** Changes when the filters or the order do: lists start again from their first page. */
  listKey: string;
  save: { isSaved: boolean; full: boolean; empty: boolean };
  /** The S$ a year a full fee bar stands for: the budget, or S$80,000 with none. */
  feeScale: number;
  /** The earliest start: the month after graduation, when known. */
  earliest: Date | null;
  fieldName: (field: string) => string;
  toggleStar: (id: string) => void;
  addToShortlist: (id: string, index?: number) => void;
  removeFromShortlist: (id: string) => void;
  reorderShortlist: (from: number, to: number) => void;
  on: {
    /** What the visitor is studying now; the chosen degree stays chosen, as the one they're on or the one they plan next. */
    level: (level: "diploma" | "degree") => void;
    degree: (id: string | null) => void;
    result: (v: ResultValue) => void;
    stand: (v: Stand) => void;
    mark: (v: number | null) => void;
    field: (field: string) => void;
    english: (test: EnglishTest | null, score: number | null) => void;
    tests: (v: Have) => void;
    work: (v: Have) => void;
    country: (country: string) => void;
    qs: (min: number, max: number) => void;
    unranked: (on: boolean) => void;
    university: (name: string) => void;
    budget: (v: number | null) => void;
    intake: (w: IntakeWindow) => void;
    removeFilter: (chip: FilterChip, value?: string) => void;
    clear: () => void;
    save: () => void;
    apply: (s: SavedSearch) => void;
    deleteSearch: (id: string) => void;
  };
};

const CLASSIFIED = new Set(["United Kingdom", "Ireland"]);
const RANK_CLASS: Record<Rank, Exclude<Classification, "unsure">> = { 1: "first", 2: "2:1", 3: "2:2", 4: "third" };
const FEE_SCALE = 80000;

const ModelContext = createContext<Model | null>(null);

export function useModel(): Model {
  const m = use(ModelContext);
  if (!m) throw new Error("useModel needs a ModelProvider with the data loaded");
  return m;
}

/** The same, before the data has loaded (the toolbar shows while it loads). */
export const useModelMaybe = () => use(ModelContext);

export function ModelProvider({ props, children }: { props: WorkspaceProps; children: ReactNode }) {
  const t = useT();
  const local = useLocalName();
  const { programmes, disciplines, awarders } = props;
  const answers = usePlanStore((s) => s.answers);
  const update = usePlanStore((s) => s.update);
  // The diploma a "Studying now: Degree" tap set aside (on.level).
  const leftDiploma = useRef<{ diploma: string | null; degree: string | null } | null>(null);
  const data = useResultsData((s) => s.data);
  const scope = useWorkspace(useShallow((s) => ({ fieldChoice: s.fieldChoice, qsMin: s.qsMin, qsMax: s.qsMax, unranked: s.unranked, universities: s.universities, onlyStarred: s.onlyStarred, stand: s.stand, sort: s.sort })));
  const setScope = useWorkspace((s) => s.setScope);
  const { fieldChoice, qsMin, qsMax, unranked, universities, onlyStarred, stand, sort } = scope;

  const degrees = useMemo(() => programmes.filter((p) => p.level === "degree"), [programmes]);
  const degreeId = plannedDegree(answers);
  const mine = degrees.find((k) => k.id === degreeId);
  const awarder = degreeId ? awarders[degreeId] : undefined;
  const university = awarder?.university ?? null;
  const awardedIn = awarder?.country ?? null;
  const asksClass = !awarder || CLASSIFIED.has(awarder.country ?? "");
  const you = studentRank(university, answers);
  const result: ResultValue | null = you ? you.rank : answers.classification === "unsure" ? "unsure" : null;
  // Not set: no English filter. "No test yet", or a test with no score yet: only programmes that don't need a score.
  const english: Facets["english"] = !answers.englishTest ? null : answers.englishTest === "none" ? { test: null, score: null } : { test: answers.englishTest, score: answers.englishScore };
  const tests: Have = answers.greGmat ?? (answers.gre !== null || answers.gmat !== null ? "have" : null);
  const field = fieldChoice ?? (mine ? "mine" : "");
  // The student among reported admitted students: their result on the 4-point scale and their degree's QS band.
  const awarding = data && university ? (data.universities.find((x) => x.name === university) ?? null) : null;
  const youCases: YouOnCases | null = university
    ? {
        gpa: you ? (you.mark !== null ? { low: ukMarkToFour(you.mark), high: ukMarkToFour(you.mark) } : { low: CLASS_FOUR[you.rank][0], high: CLASS_FOUR[you.rank][1] }) : null,
        result: you ? yoursText(t, you) : null,
        group: awarding ? (awarding.qsValue !== null && awarding.qsValue <= 50 ? "qs50" : awarding.qsValue !== null && awarding.qsValue <= 300 ? "qs300" : "qsRest") : null,
        tier: awarding ? privateSchoolTier(awarding) : null,
        university: { name: local(university, awarding?.zh ?? null).name, qs: awarding?.qs ?? null },
      }
    : null;

  // Each programme's checks depend only on the student's results and tests, not on the filters.
  const checkKey = JSON.stringify([answers.classification, answers.averageMark, answers.degreeGpa, answers.englishTest, answers.englishScore, answers.gre, answers.gmat, answers.greGmat, answers.workExperience]);
  const rows = useMemo<Row[] | null>(
    () => (data ? data.programmes.map((p) => ({ p, u: data.universities[p.u], c: checks(p, answers, university, t, awardedIn), s: you ? standing(p.range, you) : null })) : null),
    // `answers` enters through checkKey: the filters change it far more often than the checks
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, checkKey, university, t],
  );
  const byId = useMemo(() => new Map((rows ?? []).map((r) => [r.p.id, r])), [rows]);
  /** The countries each university teaches in (its campuses abroad and Kaplan Singapore included). */
  const uniCountries = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of rows ?? []) m.set(r.u.name, (m.get(r.u.name) ?? new Set()).add(studyCountry(r)));
    return m;
  }, [rows]);

  const facetScope: FacetScope = { field, countries: answers.countries, intake: answers.intake, budget: answers.budget, qsMin, qsMax, unranked, universities };
  const facets: Facets = { ...facetScope, onlyStarred, hasResult: !!you, stand, english, awardedIn, tests, work: answers.workExperience };
  const current: Omit<SavedSearch, "id"> = { ...facetScope, sort };
  const facetKey = JSON.stringify([facets, sort, answers.shortlist, answers.searches]);
  const listKey = JSON.stringify([facets, sort]);

  const results = useMemo<Results | null>(() => {
    if (!rows || !data) return null;
    const ctx: Context = { discipline: mine?.discipline ?? null, shortlist: new Set(answers.shortlist) };
    const base = (skip?: FacetKey | "academic") => rows.filter((r) => passes(r, facets, ctx, skip));
    const count = (list: Row[], fn: (r: Row) => boolean) => list.reduce((n, r) => n + (fn(r) ? 1 : 0), 0);

    const fb = base("field");
    const byField: Record<string, number> = {};
    for (const r of fb) byField[r.p.discipline] = (byField[r.p.discipline] ?? 0) + 1;
    // Each result counted as if chosen: its own place in every programme's range (the student's mark when it is their result).
    const rb = base("academic");
    const resultN = (k: Rank) =>
      count(rb, (r) => {
        const s = standing(r.p.range, { rank: k, mark: k === you?.rank ? you.mark : null });
        return s !== "below" && (stand !== "usual" || inUsual(s));
      });
    const resultOptions: PanelCounts["result"] = [
      ...(asksClass
        ? ([1, 2, 3, 4] as Rank[]).map((k) => ({ value: k, label: t(RANK_NAME[k]), n: resultN(k) }))
        : [
            { value: 1 as Rank, label: t("80%+"), n: resultN(1) },
            { value: 2 as Rank, label: t("70–79%"), n: resultN(2) },
            { value: 3 as Rank, label: t("65–69%"), n: resultN(3) },
            { value: 4 as Rank, label: t("Under 65%"), n: resultN(4) },
          ]),
      { value: "unsure", label: t("Not sure"), n: rb.length },
    ];
    const sb = base("stand");
    const eb = base("english");
    const tb = base("tests");
    const wb = base("work");
    const cb = base("country");
    const perCountry = new Map<string, number>();
    for (const r of cb) perCountry.set(studyCountry(r), (perCountry.get(studyCountry(r)) ?? 0) + 1);
    for (const c of answers.countries) if (!perCountry.has(c)) perCountry.set(c, 0);
    // Singapore, Hong Kong and Macau first (the first reference for private-school students), then by programmes.
    const countries = [...perCountry].sort((a, b) => Number(isAsia(b[0])) - Number(isAsia(a[0])) || (isAsia(a[0]) ? ASIA.indexOf(a[0]) - ASIA.indexOf(b[0]) : 0) || b[1] - a[1] || a[0].localeCompare(b[0]));
    const qb = base("qs");
    const qsBuckets = Array.from({ length: LAST_QS }, () => 0);
    for (const r of qb) {
      const q = r.u.qsValue;
      if (q === null) continue;
      let i = LAST_QS - 1;
      while (i > 0 && q < QS_STEPS[i]) i--;
      qsBuckets[i]++;
    }
    const ub = base("unis");
    const perUni = new Map<string, number>();
    for (const r of ub) perUni.set(r.u.name, (perUni.get(r.u.name) ?? 0) + 1);
    const uniList = data.universities
      .filter((u, i, all) => all.findIndex((x) => x.name === u.name) === i)
      .filter((u) => universities.includes(u.name) || ((uniCountries.get(u.name)?.size ?? 0) > 0 && (!answers.countries.length || [...uniCountries.get(u.name)!].some((c) => answers.countries.includes(c)))))
      .sort((a, b) => (a.qsValue ?? 9999) - (b.qsValue ?? 9999) || a.name.localeCompare(b.name))
      .map((u) => ({ name: u.name, zh: u.zh, qs: u.qs, n: perUni.get(u.name) ?? 0 }));
    const bb = base("budget");
    const ib = base("intake");

    const counts: PanelCounts = {
      field: {
        all: fb.length,
        mine: ctx.discipline ? count(fb, (r) => inField(r.p, "mine", ctx.discipline)) : null,
        any: count(fb, (r) => r.p.any),
        byField,
      },
      result: resultOptions,
      stand: { all: sb.length, usual: count(sb, (r) => inUsual(r.s)) },
      english: (test, score) => count(eb, (r) => englishFits(r.p, { test, score }, facets.awardedIn)),
      englishNone: count(eb, (r) => englishFits(r.p, { test: null, score: null }, facets.awardedIn)),
      englishAll: eb.length,
      tests: { any: tb.length, none: count(tb, (r) => !requiresTest(r.p)) },
      work: { any: wb.length, none: count(wb, (r) => r.p.work === null) },
      countries,
      qs: qsBuckets,
      unranked: count(qb, (r) => r.u.qsValue === null),
      universities: uniList,
      budget: (v) => (v === null ? bb.length : count(bb, (r) => r.p.feeSgd === null || r.p.feeSgd <= v)),
      intake: (w) => (w === "any" ? ib.length : count(ib, (r) => !r.p.intake || !!(r.p.intake & WINDOWS[w]))),
    };

    const fitOrder = (r: Row) => (r.s === null ? 5 : STANDING_ORDER[r.s]);
    const list = base().sort((a, b) => {
      if (sort === "fee") return (a.p.feeSgd ?? Infinity) - (b.p.feeSgd ?? Infinity) || (a.u.qsValue ?? 9999) - (b.u.qsValue ?? 9999) || a.p.name.localeCompare(b.p.name);
      // Best match: where the result is in the usual range first, then QS rank. Who partners Kaplan plays no part.
      const byFit = sort === "fit" ? fitOrder(a) - fitOrder(b) : 0;
      // Asia first: study in Singapore, Hong Kong or Macau, then QS rank.
      const asiaFirst = sort === "asia" ? Number(isAsia(studyCountry(b))) - Number(isAsia(studyCountry(a))) : 0;
      return byFit || asiaFirst || (a.u.qsValue ?? 9999) - (b.u.qsValue ?? 9999) || a.u.name.localeCompare(b.u.name) || a.p.name.localeCompare(b.p.name);
    });
    const whatIf = rows.filter((r) => passes(r, { ...facets, english: null, budget: null, onlyStarred: false }, ctx, "academic"));
    const starred = answers.shortlist.map((id) => rows.find((r) => r.p.id === id)).filter((r): r is Row => !!r);
    const saved = Object.fromEntries(answers.searches.map((s) => [s.id, rows.filter((r) => passes(r, { ...facets, ...s, onlyStarred: false }, ctx)).length]));
    return { counts, list, groups: byUniversity(list), whatIf, starred, saved, inRange: count(list, (r) => inUsual(r.s)), near: count(list, (r) => r.s === "near") };
    // `facets` and the rest enter through facetKey, rebuilt on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, data, mine, asksClass, uniCountries, facetKey, t]);

  const model = useMemo<Model | null>(() => {
    if (!data || !rows || !results) return null;
    const scheme = schemeOf(university);
    const mark: MarkField = !degreeId || !asksClass ? null : scheme?.system === "ie-gpa" ? { kind: "gpa", scale: scheme.gpaScale, value: answers.degreeGpa, cls: gpaClass(university, answers.degreeGpa) } : { kind: "uk", scale: null, value: answers.averageMark };
    /** The class a mark or GPA alone falls in. */
    const markRank = (m: number | null, gpa: number | null) => (m === null && gpa === null ? null : (studentRank(university, { classification: null, averageMark: m, degreeGpa: gpa })?.rank ?? null));
    const setCountries = (next: string[]) => {
      update({ countries: next });
      // A university chosen earlier stays only if it teaches in one of the countries now chosen.
      setScope({ universities: universities.filter((u) => !next.length || [...(uniCountries.get(u) ?? [])].some((c) => next.includes(c))) });
    };
    const { isSaved, full } = saveState(answers.searches, current);
    const empty = !field && !answers.countries.length && qsAll(facetScope) && unranked && !universities.length && (answers.intake ?? "any") === "any" && answers.budget === null;
    const shortlist = answers.shortlist;
    return {
      ...props,
      data,
      answers,
      update,
      degrees,
      degreeId,
      mine,
      awarder,
      university,
      awardedIn,
      asksClass,
      you,
      result,
      tests,
      field,
      stand: you ? stand : null,
      mark,
      youCases,
      rows,
      byId,
      results,
      current,
      listKey,
      save: { isSaved, full, empty },
      feeScale: answers.budget ?? FEE_SCALE,
      earliest: answers.level === "degree" && answers.graduationMonth && answers.graduationYear ? new Date(answers.graduationYear, answers.graduationMonth, 1) : null,
      fieldName: (f) =>
        f === "mine"
          ? t("{field}, or open to any subject", { field: mine ? t(disciplines[mine.discipline] ?? mine.discipline) : t("Your field") })
          : f === "any"
            ? t("Open to any subject")
            : t(disciplines[f] ?? f),
      toggleStar: (id) => update({ shortlist: shortlist.includes(id) ? shortlist.filter((x) => x !== id) : [...shortlist, id] }),
      addToShortlist: (id, index) => {
        if (shortlist.includes(id)) return;
        const at = index ?? shortlist.length;
        update({ shortlist: [...shortlist.slice(0, at), id, ...shortlist.slice(at)] });
      },
      removeFromShortlist: (id) => update({ shortlist: shortlist.filter((x) => x !== id) }),
      reorderShortlist: (from, to) => {
        const next = [...shortlist];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        update({ shortlist: next });
      },
      on: {
        level: (level) => {
          if (level === answers.level) return;
          const id = degreeId === "not-listed" ? null : degreeId;
          if (level === "degree") {
            // Kept for a tap back to Diploma: the diploma comes back if the degree wasn't changed meanwhile.
            leftDiploma.current = { diploma: answers.programmeId, degree: id };
            update({ level, programmeId: id, pathwayDegreeId: null });
          } else {
            const kept = leftDiploma.current && leftDiploma.current.degree === id ? leftDiploma.current.diploma : null;
            update({ level, programmeId: kept, pathwayDegreeId: id });
          }
          setScope({ fieldChoice: null });
        },
        degree: (id) => {
          update(answers.level === "diploma" ? { pathwayDegreeId: id } : { level: "degree", programmeId: id });
          setScope({ fieldChoice: null });
        },
        result: (v) => {
          if (v === "unsure") update({ classification: "unsure", averageMark: null, degreeGpa: null });
          // A mark or GPA in another class no longer describes the result.
          else if (asksClass) update({ classification: RANK_CLASS[v], ...(markRank(answers.averageMark, answers.degreeGpa) !== v ? { averageMark: null, degreeGpa: null } : {}) });
          // An Australian degree's band: a mark already in it stays; another band replaces the mark.
          else if (you?.rank !== v) update({ classification: RANK_CLASS[v], averageMark: null, degreeGpa: null });
        },
        stand: (v) => setScope({ stand: v }),
        // The mark behind a class (UK degrees) or the GPA (UCD, on 4.2): optional, it places the result inside its class.
        mark: (v) => {
          const gpa = mark?.kind === "gpa";
          const rank = gpa ? markRank(null, v) : markRank(v, null);
          update({ ...(gpa ? { degreeGpa: v } : { averageMark: v }), ...(rank ? { classification: RANK_CLASS[rank] } : {}) });
        },
        field: (f) => setScope({ fieldChoice: f }),
        english: (test, score) => update({ englishTest: test, englishScore: score }),
        tests: (v) => update({ greGmat: v, ...(v === "none" ? { gre: null, gmat: null } : {}) }),
        // The years on Where you stand follow: none is 0, and "have" clears a 0 there.
        work: (v) => update({ workExperience: v, ...(v === "none" ? { workYears: 0 } : v === "have" && answers.workYears === 0 ? { workYears: null } : {}) }),
        country: (c) => setCountries(answers.countries.includes(c) ? answers.countries.filter((x) => x !== c) : [...answers.countries, c]),
        qs: (min, max) => setScope({ qsMin: min, qsMax: max }),
        unranked: (on) => setScope({ unranked: on }),
        university: (name) => setScope({ universities: universities.includes(name) ? universities.filter((u) => u !== name) : [...universities, name] }),
        budget: (v) => update({ budget: v }),
        intake: (w) => update({ intake: w }),
        removeFilter: (chip, value) => {
          if (chip === "field") setScope({ fieldChoice: "" });
          else if (chip === "country") setCountries(answers.countries.filter((c) => c !== value));
          else if (chip === "qs") setScope({ qsMin: 0, qsMax: LAST_QS });
          else if (chip === "unranked") setScope({ unranked: true });
          else if (chip === "university") setScope({ universities: universities.filter((u) => u !== value) });
          else if (chip === "intake") update({ intake: "any" });
          else if (chip === "budget") update({ budget: null });
          else setScope({ onlyStarred: false });
        },
        clear: () => {
          update({ countries: [], intake: "any", budget: null });
          setScope({ ...DEFAULT_SCOPE, fieldChoice: "", stand, sort });
        },
        save: () => {
          if (isSaved || full || empty || answers.searches.length >= MAX_SAVED) return;
          update({ searches: [...answers.searches, { id: Date.now().toString(36), ...current }] });
        },
        apply: (s) => {
          setScope({ fieldChoice: s.field, qsMin: s.qsMin, qsMax: s.qsMax, unranked: s.unranked, universities: s.universities, onlyStarred: false, sort: s.sort });
          update({ countries: s.countries, intake: s.intake, budget: s.budget });
        },
        deleteSearch: (id) => update({ searches: answers.searches.filter((s) => s.id !== id) }),
      },
    };
    // Everything here follows from the values below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, rows, results, answers, props, university, asksClass, degreeId, mine, you, stand, field, listKey, t, local, update, setScope, universities, uniCountries, unranked]);

  return <ModelContext value={model}>{children}</ModelContext>;
}
