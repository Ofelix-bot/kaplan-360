// The Competitiveness Index for one programme: gates first, then four weighted parts.
// - Gates (lib/stand/types.ts GateKey), in this order: degree type, grade below the official minimum,
//   English, GRE/GMAT required, years of work, subject. One failed gate: "Not eligible", no score. A gate
//   that needs an answer the student hasn't given: "Missing", no score.
// - Parts: academic 50, experience 20, tests 15, subject 15; for a programme that asks for years of work,
//   or an MBA, academic 35 and experience 35.
// - Academic, on the programme's own admitted students when at least five tier-C admits reported a GPA
//   (official minimum 30, their 25th percentile 60, median 75, 75th 90, 90th or more 100); otherwise on its
//   admitted level (lib/admit-range.ts: minimum 30, admitted level 60, one class step above it 80, two 100).
//   A programme that publishes only a minimum (admit-range basis "minimum") is read as admitting at the
//   minimum + one class step (Kaplan 360++'s rule, grounded in scripts/stand/min-gap.ts): minimum 30, + 1
//   step 60, + 2 steps 80, + 3 steps 100. Straight lines between the points. The student is scored at the
//   low end of their class when they gave a class without a mark.
// - Experience: full-time work 1 year 50, 2 years 75, 3 or more 100; internships 1 40, 2 65, 3 or more 85,
//   one in another field counting half; the higher of the two, plus 15 a research output (up to 30), 10 a
//   competition award (up to 20), 5 a project (up to 10), at most 100.
// - Tests: English at the requirement 60, half a band over 80, a band or more over 100; a waiver 60, or the
//   score's own points when they are higher; with a GRE or GMAT score in play, English 70% and GRE/GMAT 30% (at the minimum or the admits' 25th
//   percentile 60, their median 80, their 75th percentile 100). GMAT scores are compared on the Focus
//   Edition scale (lib/stand/rules.ts gmatFocus); reported admits' GMAT median is on it already (each score
//   converted before the median, scripts/pipeline/compass-build.ts).
// - Degree type: a four-year rule is met by a US or Canadian bachelor's, and by a UK or Irish honours
//   degree (Kaplan 360++'s rule). A university row is read where the degree was studied (Singapore); its
//   row for the awarding country goes beside it as a note where it reads differently.
// - Subject: the same field 100, open to any background 80, a related field 70.
// - Bands: 80 or more Safe, 65–79 Match, 50–64 Reach, below 50 Far.
// Competition (applications per place, competitive wording, QS rank) is already in the admitted level, so
// it is shown as facts, never weighted again. The index is never an admission probability.

import { LEVEL_NAME, LEVELS, stepUp, type Level } from "@/lib/admit-range";
import { englishWaiver, type Waiver } from "@/lib/english-rule";
import { ukMarkToFour } from "@/lib/gpa4";
import kaplan from "@/data/raw/kaplan-programmes.json";
import { msg } from "@/lib/i18n/translate";
import type { ResultsProgramme, ResultsUniversity, TestStatus } from "@/lib/results-types";
import minGap from "@/data/raw/stand/min-gap.json";
import { degreeTypeRule, gmatFocus, ieltsEquivalent, isGmatFocus, relatedPair, toeflSix, type DegreeTypeRule } from "./rules";
import type { Band, Competition, EnglishTestTaken, Gate, Msg, Part, PartKey, StandProfile, StandScore } from "./types";

export const WEIGHTS: Record<PartKey, number> = { academic: 50, experience: 20, tests: 15, subject: 15 };
/** For programmes that ask for years of work, and MBAs. */
export const WEIGHTS_WORK: Record<PartKey, number> = { academic: 35, experience: 35, tests: 15, subject: 15 };
/** The lowest index of each band. */
export const BAND_MIN: Record<Band, number> = { safe: 80, match: 65, reach: 50, far: 0 };
export const bandOf = (index: number): Band => (index >= BAND_MIN.safe ? "safe" : index >= BAND_MIN.match ? "match" : index >= BAND_MIN.reach ? "reach" : "far");
/** Tier-C admits with a GPA needed before their spread sets the academic points. */
export const TIER_CASES_MIN = 5;
/** Reported GRE or GMAT scores needed before their median counts. */
const TEST_CASES_MIN = 5;
/** The English sub-score with a waiver, and with no minimum on the page. */
export const WAIVER_SCORE = 60;

export const BAND_LABEL: Record<Band, string> = { safe: msg("Safe"), match: msg("Match"), reach: msg("Reach"), far: msg("Far") };
/** A programme without a score, in one line: "Not eligible: {reason}", "Missing: {item}" (the gate's reason goes in). */
export const GATE_LINE = { fail: msg("Not eligible: {reason}"), missing: msg("Missing: {item}") } as const;
/** Shown wherever the index is: what it is not. */
export const NOT_PROBABILITY = msg("The Competitiveness Index is not an admission probability: it places your profile against the programme’s official requirements and its admitted students.");

/** Kaplan's 13 disciplines by id, in English (the page translates them like any message). */
const FIELDS: Record<string, string> = kaplan.disciplines;
const fieldName = (id: string) => tr(FIELDS[id] ?? id);

/** A message (lib/stand/types.ts Msg); named tr so scripts/i18n/extract.mjs collects its keys. */
const tr = (key: string, vars?: Msg["vars"]): Msg => (vars ? { key, vars } : { key });
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

type Point = [number, number];
/** Straight lines between points (increasing x); flat before the first and after the last. */
function along(points: Point[], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}
/** Points in order of x; where two share an x, the higher score (reaching both means reaching the higher). */
function increasing(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const [x, y] of [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    if (out.length && out[out.length - 1][0] === x) out[out.length - 1][1] = Math.max(out[out.length - 1][1], y);
    else if (!out.length || y > out[out.length - 1][1]) out.push([x, y]);
  }
  return out;
}

/** One class step up the UK scale; past a First, each 5 marks is a step. */
const nextStep = (l: number) => (l < 70 ? stepUp(l as Level, 1) : l + 5);
/** A UK mark on the class scale as words: its class, or past a First the marks above it. */
export const levelName = (mark: number): Msg => ((LEVELS as readonly number[]).includes(mark) ? tr(LEVEL_NAME[mark as Level]) : tr("First + {n} marks", { n: mark - 70 }));

const MBA = /\bMBA\b|\bmaster of business administration\b/i;
const IN_PLAY: TestStatus["status"][] = ["required", "optional", "mentioned"];
const TEST_NAME: Record<EnglishTestTaken, string> = { ielts: "IELTS", toefl: "TOEFL iBT", pte: "PTE Academic", duolingo: "Duolingo" };
const ADMITTED_BASIS: Record<Competition["admittedBasis"], string> = {
  published: msg("the programme’s own words about who it admits"),
  cases: msg("reported admitted students’ GPAs"),
  statistics: msg("official applications per place"),
  estimate: msg("its competitive wording and QS rank"),
  minimum: msg("its minimum, with nothing above it published"),
};
/** The admitted level of a programme that states no minimum at all. */
const NO_MINIMUM_BASIS = msg("no minimum stated, so any class");
/** The basis of a level-read programme's admitted level. */
const levelBasis = (p: ResultsProgramme, rule: boolean) => (rule ? MIN_STEP_BASIS : p.range.floor === null && p.range.basis === "minimum" ? NO_MINIMUM_BASIS : ADMITTED_BASIS[p.range.basis]);
/** The admitted level of a programme that publishes only a minimum, as a basis. */
const MIN_STEP_BASIS = msg("the minimum + one class step: Kaplan 360++’s rule");
/** Why the minimum + one class step (data/raw/stand/min-gap.json, from scripts/stand/min-gap.ts). */
export const MIN_STEP_RULE = msg(
  "Admitted level = the minimum + one class step: Kaplan 360++’s rule. On the {n} programmes with both a minimum and 10 or more reported GPAs, admitted students’ 25th percentile sits a median {x} UK marks above the minimum; one class step is 10 UK marks (tier-C admits: {y}).",
);
export const MIN_STEP_VARS = { n: minGap.n, x: minGap.medianMarks, y: minGap.tierC.medianMarks };
/** Compared on one GMAT scale. */
const GMAT_SCALE = msg("GMAT compared on the Focus Edition scale with GMAC’s concordance table; a score ending in 5 is a Focus Edition score, any other a 10th Edition score: Kaplan 360++’s rule");

type AcademicPoints =
  | { kind: "cases"; n: number; quartiles: boolean; spread: { p25: number; median: number; p75: number; p90: number }; points: Point[] }
  /** `admitted`: the UK mark scored 60; `rule`: the minimum + one class step (Kaplan 360++'s rule). */
  | { kind: "level"; admitted: number; rule: boolean; points: Point[] };
/** `focus`: for each reference figure, whether it is on the GMAT Focus Edition scale (reported admits' median always is). */
type TestRef = { status: TestStatus["status"]; min: number | null; points: Point[]; from: Msg[]; focus: boolean[] };

/** What doesn't depend on the student, worked out once per programme. */
export type Prepared = {
  p: ResultsProgramme;
  u: ResultsUniversity;
  /** Where it is taught: its own campus abroad, else its university's country. */
  country: string;
  weights: Record<PartKey, number>;
  degreeRule: DegreeTypeRule | null;
  /** The lowest result any route in accepts, on the UK scale (null: the page states none). */
  floor: Level | null;
  academic: AcademicPoints;
  /** Each test's minimum on the IELTS scale, as the programme states it for that test. */
  englishIelts: Partial<Record<EnglishTestTaken, number>>;
  waivers: Map<string, Waiver>;
  tests: { gre: TestRef | null; gmat: TestRef | null };
  competition: Competition;
  basis: Msg;
};

/** Tier-C admits' GPA spread: the stored quartiles, or (in the older shape, a median only) all admits' spread moved by the tier-C median's distance from theirs. */
function tierSpread(p: ResultsProgramme): { n: number; quartiles: boolean; spread: { p25: number; median: number; p75: number; p90: number } } | null {
  const c = p.cases?.gpaByTier.find((t) => t.tier === "C") as { tier: "C"; n: number; median: number; p25?: number; p75?: number; p90?: number } | undefined;
  if (!c || c.n < TIER_CASES_MIN) return null;
  if (c.p25 !== undefined && c.p75 !== undefined && c.p90 !== undefined) return { n: c.n, quartiles: true, spread: { p25: c.p25, median: c.median, p75: c.p75, p90: c.p90 } };
  const all = p.cases?.gpa;
  if (!all) return null;
  const shift = c.median - all.median;
  return { n: c.n, quartiles: false, spread: { p25: round2(all.p25 + shift), median: c.median, p75: round2(all.p75 + shift), p90: round2(all.p90 + shift) } };
}

function academicPoints(p: ResultsProgramme): AcademicPoints {
  const floor = p.range.floor ?? 40;
  const tier = tierSpread(p);
  if (tier) {
    const s = tier.spread;
    const cases = increasing([[s.p25, 60], [s.median, 75], [s.p75, 90], [s.p90, 100]]);
    const min = ukMarkToFour(floor);
    // The minimum is the scale's start; admits below it (other routes in) only raise what it is worth.
    const points: Point[] = min < cases[0][0] ? [[min, 30], ...cases] : [[min, along(cases, min)], ...cases.filter(([x]) => x > min)];
    return { kind: "cases", n: tier.n, quartiles: tier.quartiles, spread: s, points };
  }
  const usual = Math.max(p.range.usual, floor);
  // A minimum and nothing published above it: admitted at the minimum + one class step (Kaplan 360++'s rule).
  // With no minimum stated at all (floor null) the rule has no minimum to step from: the old anchors stay.
  const rule = p.range.basis === "minimum" && p.range.floor !== null;
  const admitted = rule ? nextStep(usual) : usual;
  const one = nextStep(admitted);
  const points: Point[] = admitted > floor ? [[floor, 30], [admitted, 60], [one, 80], [nextStep(one), 100]] : [[floor, 60], [one, 80], [nextStep(one), 100]];
  return { kind: "level", admitted, rule, points };
}

function testRef(p: ResultsProgramme, k: "gre" | "gmat"): TestRef | null {
  const t = p[k];
  if (!t || !IN_PLAY.includes(t.status)) return null;
  const cases = p.cases?.[k] as { n: number; median: number; p25?: number; p75?: number } | null | undefined;
  const reported = cases && cases.n >= TEST_CASES_MIN ? cases : null;
  const profile = p.profile?.[k];
  const from: Msg[] = [];
  const points: Point[] = [];
  const focus: boolean[] = [];
  // GMAT figures on the Focus Edition scale. Reported admits' figures are on it already (compass-build converts
  // each score before the median); a stated minimum or a class profile figure is read by its last digit.
  const gmat = k === "gmat";
  const add = (v: number, at: number, onFocus: boolean) => {
    points.push([gmat && !onFocus ? gmatFocus(v) : v, at]);
    focus.push(gmat && (onFocus || isGmatFocus(v)));
  };
  const low = reported?.p25 ?? t.min;
  if (low !== null && low !== undefined) {
    add(low, 60, reported?.p25 !== undefined);
    from.push(reported?.p25 !== undefined ? tr("Admits’ 25th percentile {score} = 60", { score: low }) : tr("Stated minimum {score} = 60", { score: low }));
  }
  const median = reported?.median ?? profile?.median ?? profile?.average ?? null;
  if (median !== null) {
    add(median, 80, !!reported);
    from.push(
      reported
        ? tr(gmat ? "Median of {n} reported admits, each score on the Focus Edition scale, {score} = 80" : "Median of {n} reported admits {score} = 80", { n: reported.n, score: median })
        : tr("Class profile median {score} = 80", { score: median }),
    );
  }
  if (reported?.p75 !== undefined) {
    add(reported.p75, 100, true);
    from.push(tr("Admits’ 75th percentile {score} = 100", { score: reported.p75 }));
  }
  return { status: t.status, min: t.min, points: increasing(points), from, focus };
}

const toIelts = (test: EnglishTestTaken, v: number | null) => (v === null ? undefined : (ieltsEquivalent(test, v) ?? undefined));

/** The parts of the index that depend only on the programme. */
export function prepare(p: ResultsProgramme, u: ResultsUniversity): Prepared {
  const country = p.campus?.country ?? u.country;
  const academic = academicPoints(p);
  const stats = p.range.from.find((f) => f.k === "stats");
  const wording = p.range.from.find((f) => f.k === "competitive");
  const englishIelts: Prepared["englishIelts"] = {};
  for (const test of ["ielts", "toefl", "pte"] as const) {
    const v = toIelts(test, p[test]);
    if (v !== undefined) englishIelts[test] = v;
  }
  return {
    p,
    u,
    country,
    weights: p.work !== null || MBA.test(p.name) ? WEIGHTS_WORK : WEIGHTS,
    degreeRule: degreeTypeRule(p.academic, country, u.name),
    floor: p.range.floor,
    academic,
    englishIelts,
    waivers: new Map(),
    tests: { gre: testRef(p, "gre"), gmat: testRef(p, "gmat") },
    competition: {
      admitted: p.range.usual,
      admittedBasis: p.range.basis,
      perPlace: stats?.k === "stats" ? { applications: stats.applications, places: stats.places, year: stats.year, url: stats.url } : null,
      wording: wording?.k === "competitive" ? wording.quote : null,
      qs: u.qsValue,
      indexLevel: academic.kind === "level" ? { mark: academic.admitted, rule: academic.rule } : null,
    },
    basis:
      academic.kind === "cases"
        ? tr("Official requirements + {n} tier-C admitted cases", { n: academic.n })
        : tr("Official requirements + admitted level ({basis})", { basis: tr(levelBasis(p, academic.rule)) }),
  };
}

const prepared = new WeakMap<ResultsProgramme, Prepared>();
/** prepare(), once per programme object. */
export function preparedOf(p: ResultsProgramme, u: ResultsUniversity): Prepared {
  let x = prepared.get(p);
  if (!x) prepared.set(p, (x = prepare(p, u)));
  return x;
}

// ---------- Gates ----------

const PAGE = tr("The programme’s entry requirement");

/** The degree-type gate's item when the student has not said what their degree is. */
export const DEGREE_TYPE_ITEM = msg("Your degree type: the programme asks for {asks}");
/** Bachelor's degrees from these countries are four-year degrees. */
const FOUR_YEAR_COUNTRIES = new Set(["United States", "Canada"]);
/** An honours degree from these countries counts as a four-year bachelor's: Kaplan 360++'s rule. */
const HONOURS_AS_FOUR_YEAR = new Set(["United Kingdom", "Ireland"]);

const COUNTRY_READING: Record<Gate["state"], string> = {
  pass: msg("Read by the awarding country’s rule ({country}): passes"),
  fail: msg("Read by the awarding country’s rule ({country}): does not pass"),
  missing: msg("Read by the awarding country’s rule ({country}): needs your degree type"),
};

/**
 * The degree type read by the university's own row for the awarding country (data/raw/stand/degree-type-rules.json
 * byAwardingCountry), as a note beside the Singapore reading where the two differ; the gate keeps the Singapore one.
 */
function withCountryReading(gate: Gate, r: DegreeTypeRule, s: StandProfile): Gate {
  const country = s.awarder?.country;
  const row = country ? r.byAwardingCountry?.find((c) => c.country === country) : undefined;
  const k = s.degreeKind;
  if (!row || k === null) return gate;
  const state: Gate["state"] = row.rule === "any" || k === "honours" ? "pass" : k === "other" ? "missing" : "fail";
  if (state === gate.state) return gate;
  return { ...gate, note: { text: tr(COUNTRY_READING[state], { country: tr(country!) }), quote: { text: row.quote, url: row.url } } };
}

function degreeGate(x: Prepared, s: StandProfile): Gate {
  const gate = degreeRead(x, s);
  const r = x.degreeRule;
  return r?.source === "university" ? withCountryReading(gate, r, s) : gate;
}

/** The degree-type gate as read where the degree was studied (Singapore). */
function degreeRead(x: Prepared, s: StandProfile): Gate {
  const r = x.degreeRule;
  if (!r) return { key: "degree-type", state: "pass", reason: tr("No four-year or honours-only rule"), basis: PAGE };
  const basis = r.source === "university" ? tr("{university}’s Singapore entry page", { university: r.university! }) : PAGE;
  const quote = { text: r.quote, url: r.url || x.p.url };
  const asks = r.rule === "four-year" ? tr("a four-year bachelor’s") : tr("an honours degree");
  const k = s.degreeKind;
  const missing = tr(DEGREE_TYPE_ITEM, { asks });
  if (k === null) return { key: "degree-type", state: "missing", reason: missing, basis, quote };
  if (k === "pass-3y") return { key: "degree-type", state: "fail", reason: tr("Asks for {asks}; yours is a three-year Australian degree", { asks }), basis, quote };
  if (r.rule === "honours") {
    if (k === "ordinary") return { key: "degree-type", state: "fail", reason: tr("Asks for an honours degree; yours is not an honours degree"), basis, quote };
    if (k === "other") return { key: "degree-type", state: "missing", reason: missing, basis, quote };
    return { key: "degree-type", state: "pass", reason: tr("Asks for an honours degree; yours is one"), basis, quote };
  }
  const country = s.awarder?.country ?? null;
  if (country && FOUR_YEAR_COUNTRIES.has(country))
    return { key: "degree-type", state: "pass", reason: tr("Asks for a four-year bachelor’s; a bachelor’s from {country} is a four-year degree", { country: tr(country) }), basis, quote };
  if (country && HONOURS_AS_FOUR_YEAR.has(country) && k === "honours")
    return { key: "degree-type", state: "pass", reason: tr("Asks for a four-year bachelor’s; an honours degree from {country} counts as one: Kaplan 360++’s rule", { country: tr(country) }), basis, quote };
  // Any other degree, a UK or Irish one without honours included: the university does not say how it reads one.
  const who = r.source === "university" ? r.university! : x.u.name;
  return {
    key: "degree-type",
    state: "missing",
    reason: country ? tr("How {university} reads your degree from {country}: it asks for a four-year bachelor’s and does not say", { university: who, country: tr(country) }) : missing,
    basis,
    quote,
  };
}

function gradeGate(x: Prepared, s: StandProfile): Gate {
  const basis = tr("The programme’s stated minimum, on the UK class scale");
  const quote = x.p.academic ? { text: x.p.academic, url: x.p.url } : undefined;
  const f = x.floor;
  const g = s.grade;
  // The academic part needs the grade even where no minimum is stated.
  if (!g) return { key: "grade", state: "missing", reason: tr("Your expected grade"), basis, quote };
  if (f === null) return { key: "grade", state: "pass", reason: tr("No minimum grade stated"), basis, quote };
  const need = tr(LEVEL_NAME[f]);
  if (g.high < f) return { key: "grade", state: "fail", reason: tr("Asks for a {need} (UK mark {floor}); yours reads as UK mark {mark}", { need, floor: f, mark: round1(g.high) }), basis, quote };
  if (g.low < f)
    return { key: "grade", state: "missing", reason: tr("Your average mark: your class covers UK marks {low}–{high}, and the minimum is {floor}", { low: g.low, high: g.high, floor: f }), basis, quote };
  return { key: "grade", state: "pass", reason: tr("Asks for a {need}; you meet it", { need }), basis, quote };
}

/** A score below the programme's own minimum for that test, on the test's own scale (TOEFL iBT 0–120 against 1–6 compared on 1–6). */
const below = (test: EnglishTestTaken, score: number, need: number) => (test === "toefl" && score > 6 !== need > 6 ? toeflSix(score) < toeflSix(need) : score < need);

type Measured = { refTest: EnglishTestTaken; need: number; margin: number; below: boolean; converted: boolean };
/**
 * The student's IELTS, TOEFL iBT or PTE Academic against the programme: its minimum for the same test, else its
 * IELTS one, else any other. Against the same test the raw score decides whether it is below (the concordance
 * tables step in bands: TOEFL 99 and 100 read as the same IELTS band); the margin is in IELTS bands.
 */
function measure(x: Prepared, e: { test: Exclude<EnglishTestTaken, "duolingo">; score: number }): Measured | null {
  const i = x.englishIelts;
  const refTest: EnglishTestTaken | null = i[e.test] !== undefined ? e.test : i.ielts !== undefined ? "ielts" : i.toefl !== undefined ? "toefl" : i.pte !== undefined ? "pte" : null;
  if (!refTest) return null;
  const need = x.p[refTest]!;
  const margin = round1(ieltsEquivalent(e.test, e.score)! - i[refTest]!);
  return { refTest, need, margin, below: refTest === e.test ? below(e.test, e.score, need) : margin < 0, converted: refTest !== e.test || e.test !== "ielts" };
}

/** The English gate, and the margin over the requirement in IELTS bands (null: no score measured, or no minimum). */
function englishGate(x: Prepared, s: StandProfile): { gate: Gate; margin: number | null; waived: boolean } {
  const p = x.p;
  const awardedIn = s.awarder?.country ?? "";
  let w = x.waivers.get(awardedIn);
  if (w === undefined) x.waivers.set(awardedIn, (w = englishWaiver(p.englishRule, awardedIn || null)));
  const exemption = p.englishRule?.exemption ? { text: p.englishRule.exemption.quote, url: p.englishRule.exemption.url } : undefined;
  const basis = tr("The programme’s English requirement");
  const e = s.english;
  if (w === "yes") {
    // A score the student holds still counts where it is worth more than the waiver.
    const m = e && e.test !== "none" && e.test !== "duolingo" ? measure(x, { test: e.test, score: e.score }) : null;
    return { gate: { key: "english", state: "pass", reason: tr("Waived for a degree taught in English"), basis, quote: exemption }, margin: m && !m.below ? m.margin : null, waived: true };
  }
  const stated = p.englishRule !== null || [p.ielts, p.toefl, p.pte, p.duolingo].some((v) => v !== null);
  if (!stated) return { gate: { key: "english", state: "pass", reason: tr("No English requirement stated"), basis }, margin: null, waived: false };
  if (!e || e.test === "none") {
    const reason = w === "maybe" ? tr("An English test score: the waiver names degrees from {country}, and yours was studied in Singapore", { country: awardedIn }) : tr("An English test score");
    return { gate: { key: "english", state: "missing", reason, basis, quote: exemption }, margin: null, waived: false };
  }
  const name = TEST_NAME[e.test];
  if (e.test === "duolingo") {
    if (p.duolingo === null) {
      const any = p.ielts !== null || p.toefl !== null || p.pte !== null;
      if (any) return { gate: { key: "english", state: "missing", reason: tr("An IELTS, TOEFL iBT or PTE Academic score: the page lists no Duolingo minimum"), basis }, margin: null, waived: false };
      return { gate: { key: "english", state: "pass", reason: tr("No minimum score stated"), basis }, margin: 0, waived: false };
    }
    if (e.score < p.duolingo) return { gate: { key: "english", state: "fail", reason: tr("Asks for {test} {need}; you have {score}", { test: name, need: p.duolingo, score: e.score }), basis }, margin: null, waived: false };
    return { gate: { key: "english", state: "pass", reason: tr("Asks for {test} {need}; you have {score}", { test: name, need: p.duolingo, score: e.score }), basis }, margin: 0, waived: false };
  }
  const m = measure(x, { test: e.test, score: e.score });
  if (!m) return { gate: { key: "english", state: "pass", reason: tr("No minimum score stated"), basis }, margin: 0, waived: false };
  const reason = tr("Asks for {test} {need}; you have {yours} {score}", { test: TEST_NAME[m.refTest], need: m.need, yours: name, score: e.score });
  const how = m.converted ? tr("Compared on the IELTS scale with ETS’s and Pearson’s official tables") : basis;
  if (m.below) return { gate: { key: "english", state: "fail", reason, basis: how }, margin: null, waived: false };
  return { gate: { key: "english", state: "pass", reason, basis: how }, margin: m.margin, waived: false };
}

function testsGate(x: Prepared, s: StandProfile): Gate {
  const basis = tr("The programme’s entry requirement");
  const req = (["gre", "gmat"] as const).filter((k) => x.p[k]?.status === "required");
  if (!req.length) return { key: "tests", state: "pass", reason: tr("No GRE or GMAT required"), basis };
  const names = req.map((k) => k.toUpperCase()).join(" / ");
  const held = req.filter((k) => s[k] !== null);
  if (!held.length) return { key: "tests", state: "missing", reason: tr("A {test} score", { test: names }), basis };
  // GMAT on one scale: the Focus Edition (a score ending in 5 is one, any other a 10th Edition score).
  const on = (k: "gre" | "gmat", v: number) => (k === "gmat" ? gmatFocus(v) : v);
  const ok = held.find((k) => x.p[k]!.min === null || on(k, s[k]!) >= on(k, x.p[k]!.min!));
  if (!ok) {
    const k = held[0];
    const mixed = k === "gmat" && isGmatFocus(s.gmat!) !== isGmatFocus(x.p.gmat!.min!);
    return { key: "tests", state: "fail", reason: tr("Asks for {test} {need}; you have {score}", { test: k.toUpperCase(), need: x.p[k]!.min!, score: s[k]! }), basis: mixed ? tr(GMAT_SCALE) : basis };
  }
  const mixed = ok === "gmat" && x.p.gmat!.min !== null && isGmatFocus(s.gmat!) !== isGmatFocus(x.p.gmat!.min);
  return { key: "tests", state: "pass", reason: tr("{test} required; you have a score", { test: ok.toUpperCase() }), basis: mixed ? tr(GMAT_SCALE) : basis };
}

function workGate(x: Prepared, s: StandProfile): Gate {
  const basis = tr("The programme’s entry requirement");
  const need = x.p.work;
  if (need === null) return { key: "work", state: "pass", reason: tr("No years of work required"), basis };
  const quote = x.p.academic ? { text: x.p.academic, url: x.p.url } : undefined;
  if (s.workYears === null) return { key: "work", state: "missing", reason: tr("Your years of full-time work: the programme asks for {n}", { n: need }), basis, quote };
  const reason = tr(need === 1 ? "Asks for 1 year of full-time work; you have {have}" : "Asks for {n} years of full-time work; you have {have}", { n: need, have: s.workYears });
  return { key: "work", state: s.workYears < need ? "fail" : "pass", reason, basis, quote };
}

/** The subject gate, and the subject part's score when it passes. */
function subjectGate(x: Prepared, s: StandProfile): { gate: Gate; score: number } {
  const p = x.p;
  const basis = tr("The programme’s field and Kaplan 360++’s table of related fields");
  const theirs = fieldName(p.discipline);
  if (s.discipline === p.discipline) return { gate: { key: "subject", state: "pass", reason: tr("Same field: {field}", { field: theirs }), basis }, score: 100 };
  if (p.any) return { gate: { key: "subject", state: "pass", reason: tr("Open to any background"), basis: tr("The programme’s entry requirement") }, score: 80 };
  if (!s.discipline) return { gate: { key: "subject", state: "missing", reason: tr("Your degree’s field"), basis }, score: 0 };
  const mine = fieldName(s.discipline);
  const pair = relatedPair(s.discipline, p.discipline);
  if (pair) return { gate: { key: "subject", state: "pass", reason: tr("Related field: {mine} and {field}", { mine, field: theirs }), basis }, score: 70 };
  return { gate: { key: "subject", state: "fail", reason: tr("Open to {field} and related fields; yours is {mine}", { field: theirs, mine }), basis }, score: 0 };
}

// ---------- Parts ----------

function academicPart(x: Prepared, s: StandProfile, weight: number): Part {
  const g = s.grade!;
  const a = x.academic;
  // Where the scale starts, and what the start is worth when it is below the first anchor (30).
  const thirty = a.points[0][1] === 30;
  const start =
    x.floor === null
      ? tr(thirty ? "No minimum stated: a Third (UK mark 40) = 30" : "No minimum stated: a Third (UK mark 40) starts the scale")
      : x.p.minClass === null
        ? // A requirement that asks for a degree and names no class (lib/data/results.ts): a Third is the floor.
          tr(thirty ? "Any bachelor’s: a Third (UK mark 40) = 30" : "Any bachelor’s: a Third (UK mark 40) starts the scale")
        : tr(thirty ? "Official minimum {level} (UK mark {mark}) = 30" : "Official minimum {level} (UK mark {mark}) starts the scale", { level: tr(LEVEL_NAME[x.floor]), mark: x.floor });
  if (a.kind === "cases") {
    const gpa = ukMarkToFour(g.low);
    const sp = a.spread;
    return {
      score: Math.round(along(a.points, gpa)),
      weight,
      basis: tr("Official minimum + {n} tier-C admitted cases", { n: a.n }),
      detail: [
        tr("Your result: UK mark {mark}, GPA {gpa}/4", { mark: round1(g.low), gpa }),
        start,
        a.quartiles
          ? tr("Tier-C admits’ GPA: 25th percentile {p25} = 60, median {median} = 75, 75th {p75} = 90, 90th {p90} = 100", sp)
          : tr("Tier-C admits’ median {median} = 75; their 25th, 75th and 90th percentiles are all admits’ moved by the same distance: {p25} = 60, {p75} = 90, {p90} = 100", sp),
      ],
    };
  }
  return {
    score: Math.round(along(a.points, g.low)),
    weight,
    basis: tr("Official minimum + admitted level ({basis})", { basis: tr(levelBasis(x.p, a.rule)) }),
    detail: [
      tr("Your result: UK mark {mark}", { mark: round1(g.low) }),
      start,
      ...(a.rule ? [tr(MIN_STEP_RULE, MIN_STEP_VARS)] : []),
      tr("Admitted level {level} (UK mark {mark}) = 60; one class step above it = 80, two = 100", { level: levelName(a.admitted), mark: a.admitted }),
    ],
  };
}

const WORK_SCORE = [0, 50, 75, 100];
const INTERN_SCORE = [0, 40, 65, 85];
const byCount = (table: number[], n: number) => table[Math.min(n, table.length - 1)];

/** The experience part's score and its steps (the same for every programme). */
export function experienceScore(s: StandProfile): { score: number; detail: Msg[] } {
  const work = byCount(WORK_SCORE, Math.floor(s.workYears ?? 0));
  const same = byCount(INTERN_SCORE, s.internshipsSame);
  // An internship in another field counts half of what it adds.
  const intern = same + (byCount(INTERN_SCORE, s.internshipsSame + s.internshipsOther) - same) / 2;
  const research = Math.min(30, 15 * s.research);
  const competitions = Math.min(20, 10 * s.competitions);
  const projects = Math.min(10, 5 * s.projects);
  const score = Math.round(Math.min(100, Math.max(work, intern) + research + competitions + projects));
  const detail = [
    tr(s.workYears === 1 ? "Full-time work: 1 year = {score}" : "Full-time work: {years} years = {score}", { years: s.workYears ?? 0, score: work }),
    tr("Internships: {same} in your field, {other} in others = {score}", { same: s.internshipsSame, other: s.internshipsOther, score: round1(intern) }),
    tr("The higher of the two counts, plus research {research}, competition awards {competitions}, projects {projects}", { research, competitions, projects }),
  ];
  return { score, detail };
}

function testsPart(x: Prepared, s: StandProfile, english: { margin: number | null; waived: boolean }, weight: number): Part {
  const fromScore = english.margin === null ? null : Math.min(100, WAIVER_SCORE + 40 * english.margin);
  const e = Math.round(english.waived ? Math.max(WAIVER_SCORE, fromScore ?? 0) : (fromScore ?? WAIVER_SCORE));
  const detail: Msg[] = [
    english.waived
      ? fromScore !== null && fromScore > WAIVER_SCORE
        ? tr("English: {margin} bands over the requirement = {score}, more than the waiver’s 60", { margin: english.margin!, score: e })
        : tr("English: waived = 60")
      : english.margin === null
        ? tr("English: no minimum stated = 60")
        : tr("English: {margin} bands over the requirement = {score}", { margin: english.margin, score: e }),
  ];
  // A GRE or GMAT score the programme asks for or accepts; one below an optional test's minimum is left out.
  for (const k of ["gmat", "gre"] as const) {
    const ref = x.tests[k];
    const mine = s[k];
    if (!ref || mine === null) continue;
    const v = k === "gmat" ? gmatFocus(mine) : mine;
    const first = ref.points[0];
    if (first && v < first[0] && first[1] === 60 && ref.status !== "required") continue;
    const g = Math.round(ref.points.length ? (v < ref.points[0][0] ? 60 : along(ref.points, v)) : 60);
    // Say so where a 10th Edition and a Focus Edition figure meet.
    const mixed = k === "gmat" && ref.focus.some((f) => f !== isGmatFocus(mine));
    detail.push(tr("{test} {score}: {points}", { test: k.toUpperCase(), score: mine, points: g }), ...ref.from, ...(mixed ? [tr(GMAT_SCALE)] : []), tr("English 70%, {test} 30%", { test: k.toUpperCase() }));
    return { score: Math.round(0.7 * e + 0.3 * g), weight, basis: tr("The programme’s requirements and admitted students’ scores"), detail };
  }
  return { score: e, weight, basis: tr("The programme’s English requirement"), detail };
}

// ---------- The index ----------

/** Scores a prepared programme. */
export function scorePrepared(s: StandProfile, x: Prepared): StandScore {
  const english = englishGate(x, s);
  const subject = subjectGate(x, s);
  const gates = [degreeGate(x, s), gradeGate(x, s), english.gate, testsGate(x, s), workGate(x, s), subject.gate];
  const state = gates.some((g) => g.state === "fail") ? "not-eligible" : gates.some((g) => g.state === "missing") ? "missing" : "scored";
  const base = { id: x.p.id, gates, basis: x.basis, competition: x.competition };
  if (state !== "scored") return { ...base, state, parts: null, index: null, band: null };
  const w = x.weights;
  const exp = experienceScore(s);
  const parts: Record<PartKey, Part> = {
    academic: academicPart(x, s, w.academic),
    experience: { score: exp.score, weight: w.experience, basis: tr("Your experience, on Kaplan 360++’s table"), detail: exp.detail },
    tests: testsPart(x, s, english, w.tests),
    subject: { score: subject.score, weight: w.subject, basis: tr("The programme’s field and Kaplan 360++’s table of related fields"), detail: [subject.gate.reason] },
  };
  const index = Math.round((parts.academic.score * w.academic + parts.experience.score * w.experience + parts.tests.score * w.tests + parts.subject.score * w.subject) / 100);
  return { ...base, state, parts, index, band: bandOf(index) };
}

/**
 * The Competitiveness Index for one programme. `context.university` is the programme's university
 * (ResultsData.universities[p.u]).
 */
export function scoreProgramme(profile: StandProfile, programme: ResultsProgramme, context: { university: ResultsUniversity }): StandScore {
  return scorePrepared(profile, preparedOf(programme, context.university));
}
