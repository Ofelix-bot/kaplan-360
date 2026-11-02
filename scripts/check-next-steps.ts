// Checks /next-steps' engine (lib/next-steps) on the real data: the /results programmes rebuilt from
// data/raw as lib/data/results.ts builds them from Supabase (requirements, admission range, English
// rules, admitted cases, fees in S$, course lengths), the facts as loadNextStepsFacts() gathers them,
// and two students on a fixed day (26 October 2026):
// - Arjun: UCD BBS (Honours) Finance top-up at Kaplan, graduating this December, Student's Pass, IELTS
//   6.5, GPA 3.2 on UCD's 4.2 scale (UK mark 62, a 2:1), Singapore and Australia, up to S$45,000
//   (his answers are written here, so the check does not follow lib/personas.ts);
// - Mei: from lib/personas.ts (business analytics diploma, then the UCD business analytics top-up).
// Asserts, for each: every ring recomputed on its own (scorePrepared over the leaf's programmes, and the
// leaves' membership by its own test); no programme in two study leaves; the Employment Pass, careers and
// CSCSE measures against the data; every line and step text at most 30 characters in English; no hedging
// word in any English string the engine produces (official quotes aside) nor in its zh-hans translations,
// and a translation for each; both layouts without overlaps, inside their bounds and the same on a second
// run, and no map edge through another node; steps at this month, +12 and +24, with the text the state
// machine gives; the Qualifications road's bodies by the awarding university's country (ACCA, ISCA,
// CPA Australia or Chartered Accountants Ireland, CFA Institute; neither for a UK degree), each badge against
// data/raw/certificates.json, on both students and on a Murdoch and a Portsmouth degree. Prints every
// leaf's measure. Exits non-zero on a failure. Usage: npx tsx scripts/check-next-steps.ts [--steps]

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import admitCases from "../data/raw/admit-cases.json";
import { edgePaths } from "../components/next-steps/edges";
import fx from "../data/raw/fx-mas.json";
import { defaultStartYear, startMonthOf } from "../components/stand/model";
import { admitRange, type AdmitEvidence, type Level } from "../lib/admit-range";
import { fixedName } from "../lib/data/fixes";
import { KAPLAN_OPTIONS, OTHER_SCHOOLS } from "../lib/data/plan-options";
import { goodReadings, requirementLevel, requirementWords } from "../lib/grades";
import { makeT } from "../lib/i18n/translate";
import { loadNextStepsFacts } from "../lib/next-steps/facts";
import { layoutColumn, layoutRadial, RADIAL_BOX } from "../lib/next-steps/layout";
import { buildNextSteps, leavesOf, type NextStepsModel } from "../lib/next-steps/tree";
import { LINE_MAX, sayAt, STEP_OFFSETS, type Layout, type Leaf, type Msg, type QualifyBody, type Reference, type Tree } from "../lib/next-steps/types";
import { academicStructured, workYears } from "../lib/pipeline/requirements";
import { PERSONAS } from "../lib/personas";
import { EMPTY_ANSWERS, plannedDegree, type PlanAnswers } from "../lib/plan-storage";
import type { EnglishRule, ResultsCases, ResultsData, ResultsProfile, ResultsProgramme, ResultsUniversity, TestStatus } from "../lib/results-types";
import { prepareAll } from "../lib/stand/aggregate";
import { standProfile, type StandDegree } from "../lib/stand/profile";
import { relatedPair } from "../lib/stand/rules";
import { scorePrepared, type Prepared } from "../lib/stand/score";
import type { GateKey, Outcome, StandProfile, StandScore } from "../lib/stand/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const raw = <T>(f: string): T => JSON.parse(readFileSync(path.join(ROOT, "data/raw", f), "utf8")) as T;
const showSteps = process.argv.includes("--steps");
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) failures.push(what);
};
const t = makeT({});
const LOCALE = "en-SG";
const en = (m: Msg) => sayAt(t, LOCALE, m);

// ---------- The /results data, from data/raw ----------

type RawInstitution = { id: string; name: string; country: string | null; tier: number; qs: { rank: string; rankValue: number } | null; kaplanPartner: boolean | null };
type RawProgramme = {
  id: string;
  institutionId: string;
  name: string;
  discipline: string | null;
  acceptsAnyBackground: boolean | null;
  durationMonths: number | null;
  intakes: string | null;
  tuition: { amount: number | null; currency: string | null; basis: string | null; international: boolean } | null;
  ieltsOverall: number | null;
  toeflTotal: number | null;
  pteOverall: number | null;
  duolingo: number | null;
  gre: TestStatus | null;
  gmat: TestStatus | null;
  academicRequirement: string | null;
  studyMode: string | null;
  deliveredBy: string | null;
  notes: string[] | null;
  sourceUrl: string;
  lastVerified: string;
};
type EnglishRead = {
  required: "all" | "unless-exempt" | "none";
  exemption: EnglishRule["exemption"];
  ielts: { overall: number } | null;
  toefl: { ibt: number } | null;
  pte: { overall: number } | null;
  duolingo: { score: number } | null;
};
type StoredSpread = { average: number | null; median: number | null; low: number | null; high: number | null } | null;

const institutions = raw<{ institutions: RawInstitution[] }>("institutions.json").institutions;
const tier1 = institutions.filter((i) => i.tier === 1);
const rows = raw<{ programmes: RawProgramme[] }>("programmes.json").programmes.filter((r) => r.discipline && tier1.some((i) => i.id === r.institutionId));
const used = new Set(rows.map((r) => r.institutionId));
const unis = tier1.filter((i) => used.has(i.id));
const index = new Map(unis.map((u, i) => [u.id, i]));
const english = raw<{ programmes: Record<string, EnglishRead>; universities?: Record<string, EnglishRead> }>("english-requirements.json");
const evidence = raw<{ programmes: Record<string, AdmitEvidence> }>("admission-evidence.json").programmes;
const CASES = admitCases.programmes as unknown as Record<string, ResultsCases>;
const profiles = new Map<string, Pick<ResultsProfile, "gre" | "gmat">>();
for (const p of raw<{ profiles: { programmeIds: string[]; gre: StoredSpread; gmat: StoredSpread }[] }>("class-profiles.json").profiles)
  for (const id of p.programmeIds) if (!profiles.has(id) || p.gmat || p.gre) profiles.set(id, { gre: p.gre ? { ...p.gre } : null, gmat: p.gmat ? { ...p.gmat } : null });

const good = goodReadings(rows.filter((r) => r.academicRequirement).map((r) => ({ institution: r.institutionId, text: r.academicRequirement!, country: unis[index.get(r.institutionId)!].country })));
const ASKS_A_DEGREE = /\b(bachelor|undergraduate|degree|honou?rs)\b/i;

function englishOf(id: string, institution: string) {
  const own = english.programmes[id];
  const general = english.universities?.[institution];
  const read = own && own.required !== "none" ? own : general && general.required !== "none" ? general : null;
  if (!read || read.required === "none") return { rule: null, read: null };
  return { rule: { required: read.required, exemption: read.exemption, general: read !== own } as EnglishRule, read };
}

/** lib/data/results.ts feePerYear and sgdRate, on the raw record. */
function feePerYear(r: RawProgramme): number | null {
  const f = r.tuition;
  if (!f?.international || !f.amount || !f.currency) return null;
  const rates = fx.rates as Record<string, number>;
  const rate = f.currency === "MOP" ? (rates.HKD ? rates.HKD / 1.03 : null) : (rates[f.currency] ?? null);
  if (!rate) return null;
  const basis = (f.basis ?? "").toLowerCase();
  const years = r.durationMonths ? Math.max(1, r.durationMonths / 12) : null;
  if (/year|annum|annual/.test(basis)) return Math.round(f.amount * rate);
  if (/full|total|course|programme|program/.test(basis) && years) return Math.round((f.amount * rate) / years);
  if (!basis && r.durationMonths && r.durationMonths <= 12) return Math.round(f.amount * rate);
  return null;
}

const universities: ResultsUniversity[] = unis.map((u) => ({ name: u.name, zh: null, country: u.country ?? "", qs: u.qs?.rank ?? null, qsValue: u.qs?.rankValue ?? null, partner: !!u.kaplanPartner, good: good.get(u.id) ?? null, subjects: {}, employer: null, compass: null }));
const programmes: ResultsProgramme[] = rows.map((r) => {
  const uni = unis[index.get(r.institutionId)!];
  const text = r.academicRequirement;
  const c = text ? requirementLevel(academicStructured(text), text, uni.country, good.get(r.institutionId)) : null;
  const floor: Level | null = c ? c.floor : text && ASKS_A_DEGREE.test(requirementWords(text)) ? 40 : null;
  const e = englishOf(r.id, r.institutionId);
  const taught = (r.notes ?? []).map((n) => /^Taught at: (.+?) \| (.+)$/.exec(n)).find(Boolean);
  const cases = CASES[r.id] ?? null;
  const prof = profiles.get(r.id);
  return {
    id: r.id,
    u: index.get(r.institutionId)!,
    name: fixedName(r.id, r.name),
    discipline: r.discipline!,
    any: !!r.acceptsAnyBackground,
    months: r.durationMonths,
    feeSgd: feePerYear(r),
    ielts: r.ieltsOverall ?? e.read?.ielts?.overall ?? null,
    toefl: r.toeflTotal ?? e.read?.toefl?.ibt ?? null,
    pte: r.pteOverall ?? e.read?.pte?.overall ?? null,
    duolingo: r.duolingo ?? e.read?.duolingo?.score ?? null,
    gre: r.gre?.status ? r.gre : null,
    gmat: r.gmat?.status ? r.gmat : null,
    englishRule: e.rule,
    minClass: c?.rank ?? null,
    minBasis: c?.basis ?? null,
    range: admitRange({ floor, main: c?.main ?? null, evidence: evidence[r.id], qs: uni.qs?.rankValue ?? null, cases: cases?.gpa ? { n: cases.gpa.n, p25: cases.gpa.p25 } : null }),
    work: workYears(text),
    academic: text ? text.slice(0, 280) : null,
    mode: r.studyMode ?? null,
    kaplan: r.deliveredBy === "kaplan",
    campus: taught ? { name: taught[1], country: taught[2] } : null,
    profile: prof ? (prof as ResultsProfile) : null,
    cases,
    url: r.sourceUrl,
    checked: r.lastVerified,
  } as unknown as ResultsProgramme;
});
const data = { programmes, universities } as unknown as ResultsData;
const facts = loadNextStepsFacts(ROOT);

// ---------- The students ----------

const DAY = new Date(2026, 9, 26);
const countryOf = (name: string | null) => institutions.find((i) => i.name === name)?.country ?? null;

/** The Where you stand model's parts, as components/stand/model.tsx works them out. */
function modelOf(a: PlanAnswers): NextStepsModel {
  const id = plannedDegree(a);
  const k = KAPLAN_OPTIONS.find((p) => p.id === id && p.level === "degree");
  const degree: StandDegree | null = k ? { name: k.name, university: k.university, country: countryOf(k.university), discipline: k.discipline } : null;
  const profile = standProfile(a, degree);
  const only = new Set(a.countries);
  const scope = prepareAll(data).filter((x) => (!only.size || only.has(x.country)) && (a.budget === null || x.p.feeSgd === null || x.p.feeSgd <= a.budget));
  const year = a.startYear ?? defaultStartYear(a, DAY);
  return {
    answers: a,
    profile,
    scope,
    data,
    degree,
    start: { year, month: startMonthOf(a, year), stated: a.startYear !== null },
    programmes: KAPLAN_OPTIONS,
    schools: OTHER_SCHOOLS,
    school: a.school && a.school !== "kaplan" ? a.school : "kaplan",
    kaplanId: id,
  };
}

const arjun: PlanAnswers = {
  ...EMPTY_ANSWERS,
  level: "degree",
  programmeId: "ucd-bachelor-of-business-studies-honours-finance-top-up",
  graduationYear: 2026,
  graduationMonth: 12,
  status: "student-pass",
  englishTest: "ielts",
  englishScore: 6.5,
  englishTestMonth: 3,
  englishTestYear: 2026,
  degreeGpa: 3.2,
  averageMark: null,
  classification: null,
  countries: ["Singapore", "Australia"],
  intake: "any",
  budget: 45000,
  shortlist: ["university-college-dublin-master-of-science-global-finance-kaplan-singapore", "murdoch-university-master-of-business-administration-kaplan-singapore", "monash-university-master-of-professional-accounting"],
};
const mei = PERSONAS.find((p) => p.id === "mei")!.answers(DAY);
const students = [
  { name: "Arjun", answers: arjun },
  { name: "Mei", answers: mei },
];

// ---------- Words ----------

/** A Msg with each month as the word MONTH. */
const noMonths = (m: Msg): Msg =>
  m.key === "@month" ? { key: "MONTH" } : m.vars ? { key: m.key, vars: Object.fromEntries(Object.entries(m.vars).map(([k, v]) => [k, typeof v === "object" ? noMonths(v) : v])) } : m;
const HEDGE_EN = /\b(may|might|could|can|likely|unlikely|probably|perhaps|possibly|usually|typically|generally|tend to|approximately|roughly|(?:about|around) (?:\S*\d|one|two|three|four|five|ten|half))\b/i;
const HEDGE_ZH = /可能|或许|也许|大概|应该会|可以|一般|通常|不妨/;

/** Every Msg in a value, with where it is; quotes (official words) and data strings are not Msgs and are left out. */
function msgsIn(v: unknown, where: string, out: { where: string; m: Msg }[] = []) {
  if (!v || typeof v !== "object") return out;
  if (Array.isArray(v)) {
    v.forEach((x, i) => msgsIn(x, `${where}[${i}]`, out));
    return out;
  }
  const o = v as Record<string, unknown>;
  if (typeof o.key === "string" && Object.keys(o).every((k) => k === "key" || k === "vars")) {
    out.push({ where, m: o as Msg });
    return out;
  }
  for (const [k, x] of Object.entries(o)) msgsIn(x, `${where}.${k}`, out);
  return out;
}

const zh: Record<string, string> = {};
for (const f of readdirSync(path.join(ROOT, "scripts/i18n/zh-hans"))) Object.assign(zh, JSON.parse(readFileSync(path.join(ROOT, "scripts/i18n/zh-hans", f), "utf8")));
const ownZh = JSON.parse(readFileSync(path.join(ROOT, "scripts/i18n/zh-hans/15-next-steps.json"), "utf8")) as Record<string, string>;
for (const [k, v] of Object.entries(ownZh)) check(!HEDGE_ZH.test(v), `hedging word in the translation of "${k}": ${v}`);
/** Keys translated elsewhere: the fields, careers and the index's own words. */
const keysSeen = new Set<string>();

// ---------- Layouts ----------

function checkLayout(who: string, name: string, l: Layout, bounds: { width: number; height: number; margin: number }) {
  for (const n of l.nodes) {
    check(n.x >= bounds.margin && n.y >= bounds.margin && n.x + n.width <= bounds.width - bounds.margin && n.y + n.height <= bounds.height - bounds.margin, `${who} ${name}: ${n.id} outside the box (${n.x},${n.y} ${n.width}×${n.height})`);
  }
  for (let i = 0; i < l.nodes.length; i++)
    for (let j = i + 1; j < l.nodes.length; j++) {
      const a = l.nodes[i];
      const b = l.nodes[j];
      const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
      check(apart, `${who} ${name}: ${a.id} overlaps ${b.id}`);
    }
  const ids = new Set(l.nodes.map((n) => n.id));
  check(ids.size === l.nodes.length, `${who} ${name}: duplicate node ids`);
  for (const e of l.edges) check(ids.has(e.from) && ids.has(e.to), `${who} ${name}: edge ${e.id} to a missing node`);
}

/** The map's edges (components/next-steps/edges.ts): none passes through a node other than its two ends. */
function checkEdges(who: string, l: Layout) {
  const paths = edgePaths(l);
  for (const e of l.edges) {
    const d = paths[e.id];
    const v = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const p = d.includes("C") ? [0, 2, 4, 6].map((i) => ({ x: v[i], y: v[i + 1] })) : [0, 0, 2, 2].map((i) => ({ x: v[i], y: v[i + 1] }));
    for (let i = 1; i < 64; i++) {
      const s = i / 64;
      const u = 1 - s;
      const x = u * u * u * p[0].x + 3 * u * u * s * p[1].x + 3 * u * s * s * p[2].x + s * s * s * p[3].x;
      const y = u * u * u * p[0].y + 3 * u * u * s * p[1].y + 3 * u * s * s * p[2].y + s * s * s * p[3].y;
      const through = l.nodes.find((n) => n.id !== e.from && n.id !== e.to && x > n.x && x < n.x + n.width && y > n.y && y < n.y + n.height);
      if (through) {
        check(false, `${who} radial: edge ${e.id} passes through ${through.id}`);
        break;
      }
    }
  }
}

// ---------- Qualifications ----------

/** The bodies a Kaplan degree's Qualifications road shows, written here from the awarder's country (not imported from lib/next-steps/tree.ts). */
const wantBodies = (country: string | null): QualifyBody[] =>
  country === "Australia" ? ["acca", "isca", "cpa-australia", "cfa"] : country === "Ireland" ? ["acca", "isca", "cai", "cfa"] : ["acca", "isca", "cfa"];
/** Each status a body's badge reads as yes. */
const YES: Partial<Record<QualifyBody, string[]>> = { isca: ["accredited", "recognised"], "cpa-australia": ["accredited"], cai: ["exempt"], cfa: ["affiliated"] };
/** Each leaf's name, written here as each body writes its own (ISCA's title CA (Singapore) is the Singapore CA Qualification's). */
const NAMES: Record<QualifyBody, string> = { acca: "ACCA", isca: "Singapore CA (ISCA)", "cpa-australia": "CPA Australia", cai: "Chartered Accountants Ireland", cfa: "CFA Institute" };
/** Words a qualification leaf never shows: the old names. */
const OLD_NAMES = /CPA Singapore|CPA Ireland/;

/** The Qualifications road against the awarder's country and data/raw/certificates.json: the bodies in order, each badge's yes/no and its basis. */
function checkQualify(who: string, model: NextStepsModel, tree: Tree, want?: QualifyBody[]) {
  const leaves = tree.roads[2].leaves;
  const expected = want ?? wantBodies(model.degree?.country ?? null);
  check(leaves.map((l) => l.key).join() === expected.join(), `${who}: qualifications ${leaves.map((l) => l.key).join()}, want ${expected.join()}`);
  const facts_ = facts.certificates?.programmes?.[model.kaplanId ?? ""];
  for (const l of leaves) {
    check(en(l.name) === NAMES[l.key as QualifyBody] && en(l.name).length <= LINE_MAX, `${who} ${l.id}: name "${en(l.name)}"`);
    for (const { where, m } of msgsIn(l, `${who} ${l.id}`)) check(!OLD_NAMES.test(en(noMonths(m))), `${where}: old body name in "${en(m)}"`);
    const f = facts_?.[l.key as QualifyBody];
    const yes = YES[l.key as QualifyBody];
    if (!f?.status || f.status === "unread" || !f.url) {
      check(l.measure.kind === "missing", `${who} ${l.id}: no fact, but the measure is ${l.measure.kind}`);
      continue;
    }
    if (!yes) continue;
    check(l.measure.kind === "badge" && l.measure.yes === yes.includes(f.status), `${who} ${l.id}: ${f.status} reads ${l.measure.kind === "badge" ? (l.measure.yes ? "yes" : "no") : l.measure.kind}`);
    // ISCA's "case-by-case" is neither yes nor no: an open mark, never a cross.
    check(l.measure.kind !== "badge" || !!l.measure.open === (f.status === "case-by-case"), `${who} ${l.id}: ${f.status} open mark ${l.measure.kind === "badge" && !!l.measure.open}`);
    if (l.measure.kind === "badge")
      check(l.measure.basis.kind === "official" && l.measure.basis.url === f.url && l.measure.basis.quote === f.quote && l.measure.basis.read === f.read && l.measure.basis.path === f.path, `${who} ${l.id}: basis is not the data's url, quote, read date and path`);
  }
}

// ---------- Rings, recomputed ----------

const MBA = /\bMBA\b|\bmaster of business administration\b/i;
/** The study leaf by its own test, written again here: work or MBA, then same or related field, then open. */
const leafByOwnTest = (x: Prepared, d: string | null) =>
  x.p.work !== null || MBA.test(x.p.name) ? "mba" : d && (x.p.discipline === d || relatedPair(d, x.p.discipline)) ? "same-field" : x.p.any ? "conversion" : null;
const isGood = (s: StandProfile, x: Prepared) => {
  const r = scorePrepared(s, x);
  return r.state === "scored" && (r.band === "safe" || r.band === "match");
};

/**
 * A share ring, or (R2) "Missing: {item}" with where to answer when the programmes held at Missing
 * outnumber the scored ones: a 0% ring there would read as a measured zero.
 */
function checkRing(who: string, l: Leaf, k: number, n: number, results: StandScore[]) {
  const m = l.measure;
  if (!n) {
    check(m.kind === "badge" && !m.yes, `${who} ${l.id}: no programmes, and no "none" badge`);
    return;
  }
  const missing = results.filter((r) => r.state === "missing").length;
  if (missing > results.filter((r) => r.state === "scored").length) {
    check(m.kind === "missing" && m.text.key === "Missing: {item}" && m.href === "/where-you-stand#stand-title" && !!m.basis, `${who} ${l.id}: ${missing} of ${n} held at Missing, but the measure is ${m.kind}`);
    return;
  }
  check(m.kind === "ring" && m.value === k && m.max === n, `${who} ${l.id}: ring ${m.kind === "ring" ? `${m.value}/${m.max}` : m.kind}, recomputed ${k}/${n}`);
  if (m.kind === "ring") check(en(m.shown) === `${Math.round((100 * k) / n)}%`, `${who} ${l.id}: shown ${en(m.shown)}`);
}

const RANK: Record<Outcome, number> = { "not-eligible": 0, missing: 0, far: 1, reach: 2, match: 3, safe: 4 };
const outcomeOf = (r: StandScore): Outcome => (r.state === "scored" ? r.band! : r.state);
/** The reference's groups in order, with the chip's words, and its order within a group (written here, not imported from lib/next-steps/tree.ts). */
const REF_GROUPS: [Outcome[], string][] = [
  [["match", "safe"], "Best QS among Match and Safe"],
  [["reach"], "Best QS among Reach"],
  [["missing"], "Best QS among Missing"],
  [["far", "not-eligible"], "Best QS among the rest"],
];
const byTuple = (a: Prepared, b: Prepared) =>
  (a.u.qsValue ?? Infinity) - (b.u.qsValue ?? Infinity) ||
  (a.p.feeSgd ?? Infinity) - (b.p.feeSgd ?? Infinity) ||
  (a.p.months ?? Infinity) - (b.p.months ?? Infinity) ||
  (a.p.work ?? 0) - (b.p.work ?? 0) ||
  a.p.name.localeCompare(b.p.name);

// ---------- Steps, recomputed ----------

/** The states while the degree runs: a degree student's, and a diploma student's diploma and top-up (R3). */
const STUDYING = new Set(["Studying until {month}", "Final term until {month}", "Diploma until {month}", "Top-up starts {month}", "Top-up degree under way", "Top-up degree, ends {month}"]);
const diplomaFirst = (key: string) => key === "Diploma until {month}" || key === "Top-up starts {month}";

const STUDY_OPEN = "Applications open {month}";
const STUDY_APPLY = "Apply · starts {month}";
const STUDY_DURING = "Master’s under way";
const STUDY_DONE = "Master’s done · {month}";
const month = (m: Msg | undefined) => Number((m?.vars?.month as Msg | undefined)?.vars?.t ?? NaN);

function expectStudy(m: number, opens: number, start: number, months: number): { key: string; month?: number } {
  if (m < opens) return { key: STUDY_OPEN, month: opens };
  if (m < start) return { key: STUDY_APPLY, month: start };
  if (m < start + months) return { key: STUDY_DURING };
  return { key: STUDY_DONE, month: start + months - 1 };
}

function checkSteps(who: string, tree: Tree) {
  const end = tree.centre.degreeEnd;
  for (const l of leavesOf(tree)) {
    check(l.steps.length === 3 && l.steps.every((s, i) => s.offset === STEP_OFFSETS[i] && s.month === tree.now + s.offset), `${who} ${l.id}: steps not at this month, +12 and +24`);
    for (const s of l.steps) {
      check(en(s.text).length <= LINE_MAX, `${who} ${l.id} +${s.offset}: "${en(s.text)}" is over ${LINE_MAX} characters`);
      if (s.also) check(en(s.also).length <= LINE_MAX, `${who} ${l.id} +${s.offset}: "${en(s.also)}" is over ${LINE_MAX} characters`);
    }
    // Further study (no years of work asked): the four states, from the reference's dates.
    if (l.panel.kind === "study" && (l.key !== "mba" || !l.panel.reference?.work)) {
      const ref = l.panel.reference;
      const x = ref ? data.programmes.find((p) => p.id === ref.id) : null;
      const months = x?.months ?? 12;
      const start = tree.centre.start;
      const first = l.steps.find((s) => s.text.key === STUDY_OPEN);
      const later = l.steps.find((s) => s.also?.key === STUDY_OPEN);
      // The opening: official (its basis says so) or 12 months before the start.
      const opens = first?.basis.kind === "official" ? month(first.text) : later?.alsoBasis?.kind === "official" ? month(later.also) : start - 12;
      // R3: an opening past +24 puts the student's own state on each point and the opening on the last one's second line.
      const beyond = end !== null && opens > tree.now + 24;
      for (const s of l.steps) {
        if (beyond && s.month <= end) {
          check(STUDYING.has(s.text.key), `${who} ${l.id} +${s.offset}: "${en(s.text)}" while the degree runs`);
          continue;
        }
        const want = expectStudy(s.month, opens, start, months);
        check(s.text.key === want.key && (want.month === undefined || month(s.text) === want.month), `${who} ${l.id} +${s.offset}: "${en(s.text)}", the state machine gives ${want.key} ${want.month ?? ""}`);
      }
      const last = l.steps[l.steps.length - 1];
      if (beyond) check(last.text.key === STUDY_OPEN || (last.also?.key === STUDY_OPEN && month(last.also) === opens && !!last.alsoBasis), `${who} ${l.id}: opening ${opens} past +24 is not on the last point`);
    }
    // Straight to work: studying until the degree ends, then year n of work.
    if (l.road === "work" && end !== null)
      for (const s of l.steps) {
        if (s.month <= end)
          check(STUDYING.has(s.text.key) && (diplomaFirst(s.text.key) || !s.text.vars?.month || month(s.text) === end), `${who} ${l.id} +${s.offset}: "${en(s.text)}" before the degree ends (${end})`);
        else check(s.text.vars?.n === Math.floor((s.month - end - 1) / 12) + 1, `${who} ${l.id} +${s.offset}: "${en(s.text)}" is not year ${Math.floor((s.month - end - 1) / 12) + 1} of work`);
      }
  }
}

// ---------- Run ----------

const ym = (m: number | null) => (m === null ? "—" : `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`);
const measureLine = (l: Leaf) => {
  const m = l.measure;
  const basis = m.kind === "missing" ? en(m.what) : `${m.basis.kind}: ${en(m.basis.text)}`;
  const shown = m.kind === "ring" ? `${en(m.shown)} (${m.value}/${m.max}) ${en(m.label)}` : m.kind === "badge" ? `${m.yes ? "yes" : "no"}: ${en(m.text)}` : en(m.text);
  return `${shown} — ${basis}${m.kind !== "missing" && m.rule ? ` · rule: ${en(m.rule.text)}` : ""}`;
};

/** A leaf's reference as printed: programme · university, QS 2027 rank, fee, months, outcome and why. */
const refLine = (model: NextStepsModel, ref: Reference | null) => {
  if (!ref) return "—";
  const x = model.scope.find((y) => y.p.id === ref.id);
  return `${ref.name} · ${ref.university} [QS ${x?.u.qs ?? "unranked"}, ${x?.p.feeSgd != null ? `S$${x.p.feeSgd.toLocaleString("en-SG")}` : "fee —"}, ${ref.months ?? "—"} mo, ${ref.outcome}] (${en(ref.why)})`;
};

for (const { name, answers } of students) {
  const model = modelOf(answers);
  const tree = buildNextSteps(model, facts, DAY);
  const again = buildNextSteps(model, facts, DAY);
  check(JSON.stringify(tree) === JSON.stringify(again), `${name}: the tree differs on a second run`);
  const leaves = leavesOf(tree);
  check(tree.roads.map((r) => r.key).join() === "study,work,qualify,other", `${name}: roads ${tree.roads.map((r) => r.key).join()}`);
  check(new Set(leaves.map((l) => l.id)).size === leaves.length, `${name}: duplicate leaf ids`);

  // Every string the engine produces: at most 30 characters for lines, no hedging word, translated.
  for (const { where, m } of msgsIn(tree, name)) {
    const s = en(m);
    // Months are written as a token first: "May 2028" names a month, not a hedge.
    check(!HEDGE_EN.test(en(noMonths(m))), `${where}: hedging word in "${s}"`);
    const walk = (x: Msg) => {
      if (x.key !== "@month") keysSeen.add(x.key);
      for (const v of Object.values(x.vars ?? {})) if (typeof v === "object") walk(v);
    };
    walk(m);
  }
  for (const l of leaves) check(en(l.line).length <= LINE_MAX, `${name} ${l.id}: line "${en(l.line)}" is over ${LINE_MAX} characters`);

  // Further study: membership by its own test, no programme twice, rings from scorePrepared.
  const p = model.profile;
  const studyLeaves = tree.roads[0].leaves;
  const seen = new Map<string, string>();
  for (const l of studyLeaves) {
    if (l.panel.kind !== "study") continue;
    for (const id of l.panel.programmes) {
      check(!seen.has(id), `${name}: ${id} in ${seen.get(id)} and ${l.id}`);
      seen.set(id, l.id);
    }
    const want = model.scope.filter((x) => leafByOwnTest(x, p.discipline) === l.key).map((x) => x.p.id).sort();
    check(JSON.stringify([...l.panel.programmes].sort()) === JSON.stringify(want), `${name} ${l.id}: ${l.panel.programmes.length} programmes, the leaf's own test gives ${want.length}`);
    const xs = model.scope.filter((x) => l.panel.kind === "study" && l.panel.programmes.includes(x.p.id));
    checkRing(name, l, xs.filter((x) => isGood(p, x)).length, xs.length, xs.map((x) => scorePrepared(p, x)));
    check(l.panel.counts.reduce((s, c) => s + c.n, 0) === l.panel.total, `${name} ${l.id}: outcome counts don't add up to ${l.panel.total}`);
    // The reference: the first shortlisted programme in the leaf, else the best by (QS 2027, fee, months,
    // years of work, name) within the first non-empty group of Match + Safe, Reach, Missing, the rest.
    const ref = l.panel.reference;
    const listed = answers.shortlist.find((id) => l.panel.kind === "study" && l.panel.programmes.includes(id));
    let want_: Prepared | null = null;
    let wantWhy = "";
    if (listed) [want_, wantWhy] = [xs.find((x) => x.p.id === listed)!, "On your shortlist"];
    else
      for (const [group, why] of REF_GROUPS) {
        const best = xs.filter((x) => group.includes(outcomeOf(scorePrepared(p, x)))).sort(byTuple)[0];
        if (best) {
          [want_, wantWhy] = [best, why];
          break;
        }
      }
    check((ref?.id ?? null) === (want_?.p.id ?? null), `${name} ${l.id}: reference ${ref?.id ?? "none"}, the rule gives ${want_?.p.id ?? "none"}`);
    if (ref) {
      check(en(ref.why).length <= 30, `${name} ${l.id}: reference why "${en(ref.why)}" is over 30 characters`);
      check(en(ref.why) === wantWhy, `${name} ${l.id}: reference why "${en(ref.why)}", want "${wantWhy}"`);
      check(ref.basis.kind === (listed ? "yours" : "rule"), `${name} ${l.id}: reference basis is ${ref.basis.kind}`);
      check(ref.outcome === outcomeOf(scorePrepared(p, want_!)), `${name} ${l.id}: reference outcome ${ref.outcome}`);
    }
  }
  // The other roads date their master's from the first study leaf's reference (same-field first).
  const firstRef = studyLeaves.map((l) => (l.panel.kind === "study" ? l.panel.reference : null)).find(Boolean) ?? null;
  const firstX = firstRef ? model.scope.find((x) => x.p.id === firstRef.id) : null;
  check(!firstRef || (!!firstX && tree.roads[3].leaves.length === 2), `${name}: the other roads' reference ${firstRef?.id ?? "none"} is not in scope`);
  // Other roads: the same share over the three leaves' programmes after each change.
  const union = model.scope.filter((x) => seen.has(x.p.id));
  const [workFirst, internFirst] = tree.roads[3].leaves;
  const withWork = { ...p, workYears: (p.workYears ?? 0) + 1 };
  const withIntern = { ...p, internshipsSame: p.internshipsSame + 1 };
  checkRing(name, workFirst, union.filter((x) => isGood(withWork, x)).length, union.length, union.map((x) => scorePrepared(withWork, x)));
  checkRing(name, internFirst, union.filter((x) => isGood(withIntern, x)).length, union.length, union.map((x) => scorePrepared(withIntern, x)));
  // R8: "What moves" holds only changes up the outcome order; Missing → Not eligible is counted by the gate that fails.
  for (const [l, after] of [
    [workFirst, withWork],
    [internFirst, withIntern],
  ] as const) {
    if (l.panel.kind !== "other") continue;
    for (const mv of l.panel.moves) check(RANK[mv.to] > RANK[mv.from], `${name} ${l.id}: "${mv.from} → ${mv.to}" listed under What moves`);
    const closed = new Map<GateKey, number>();
    for (const x of union) {
      const before = outcomeOf(scorePrepared(p, x));
      const r = scorePrepared(after, x);
      if (outcomeOf(r) === "not-eligible" && before !== "not-eligible") for (const g of r.gates) if (g.state === "fail") closed.set(g.key, (closed.get(g.key) ?? 0) + 1);
    }
    const got = Object.fromEntries(l.panel.closed.map((c) => [c.gate, c.n]));
    check(JSON.stringify(got) === JSON.stringify(Object.fromEntries([...closed].sort((a, b) => b[1] - a[1]))), `${name} ${l.id}: closed ${JSON.stringify(got)}, recomputed ${JSON.stringify(Object.fromEntries(closed))}`);
  }
  // Straight to work.
  const [ep, careers, home] = tree.roads[1].leaves;
  const awarder = universities.find((u) => u.name === p.awarder?.name);
  const points = !p.awarder ? 0 : awarder?.qsValue != null && awarder.qsValue <= 100 ? 20 : 10;
  check(ep.measure.kind === "ring" && ep.measure.value === points && ep.measure.max === 20, `${name}: EP ${ep.measure.kind === "ring" ? ep.measure.value : ep.measure.kind}, MOM's rule gives ${points}`);
  check(careers.measure.kind === "ring" && careers.measure.value === facts.kaplan.secured && careers.measure.max === 100, `${name}: careers ring is not Kaplan's ${facts.kaplan.secured}%`);
  const listed = facts.cscse.rows.some((r) => r.institution === "Kaplan Higher Education Academy" && r.university?.startsWith(p.awarder?.name ?? "?"));
  check(home.measure.kind === "badge" && home.measure.yes === listed, `${name}: CSCSE badge against the notice (${listed})`);
  checkSteps(name, tree);
  // R3: no timeline repeats one state at all three points (the qualifications state facts, not dates).
  for (const l of leaves)
    if (l.road !== "qualify") check(new Set(l.steps.map((s) => en(s.text))).size > 1, `${name} ${l.id}: "${en(l.steps[0].text)}" at all three points`);
  // R3: a diploma student is on the diploma until their graduation month.
  if (tree.centre.diploma && tree.centre.graduation !== null)
    for (const l of leaves)
      for (const s of l.steps)
        if (s.month <= tree.centre.graduation && STUDYING.has(s.text.key)) check(s.text.key === "Diploma until {month}" && month(s.text) === tree.centre.graduation, `${name} ${l.id} +${s.offset}: "${en(s.text)}" during the diploma`);

  // Layouts: no overlap, inside the box, the same twice.
  const radial = layoutRadial(tree);
  checkLayout(name, "radial", radial, { ...RADIAL_BOX, margin: 8 });
  checkEdges(name, radial);
  // Both students' degrees are UCD's (Ireland): ACCA, ISCA, Chartered Accountants Ireland, CFA Institute.
  checkQualify(name, model, tree, ["acca", "isca", "cai", "cfa"]);
  check(JSON.stringify(radial) === JSON.stringify(layoutRadial(again)), `${name}: radial layout differs on a second run`);
  for (const width of [343, 288]) {
    const col = layoutColumn(tree, { width });
    checkLayout(name, `column ${width}`, col, { width, height: col.height, margin: 0 });
    check(JSON.stringify(col) === JSON.stringify(layoutColumn(again, { width })), `${name}: column layout differs on a second run`);
  }

  // Print.
  const c = tree.centre;
  console.log(`\n== ${name}: ${c.diploma ? `${c.diploma.name} → ` : ""}${c.degree?.name ?? "?"} · ${c.degree?.university ?? "?"} · ${c.degree?.school}; field ${c.field ? en(c.field) : "—"}`);
  console.log(`  graduation ${ym(c.graduation)}, degree ends ${ym(c.degreeEnd)} (${en(c.degreeEndBasis.text)}), start ${ym(c.start)} (${en(c.startBasis.text)}); ${model.scope.length} programmes in scope`);
  for (const r of tree.roads) {
    console.log(`  ${en(r.name)}`);
    for (const l of r.leaves) {
      console.log(`    ${en(l.name)} · ${en(l.line)}: ${measureLine(l)}`);
      if (l.panel.kind === "study") console.log(`      ${l.panel.total} programmes: ${l.panel.counts.map((x) => `${x.outcome} ${x.n}`).join(", ")}; held: ${l.panel.held.map((h) => `${h.gate}/${h.state} ${h.n}`).join(", ") || "none"}; reference ${refLine(model, l.panel.reference)}`);
      if (l.panel.kind === "other") console.log(`      now ${l.panel.now.k}/${l.panel.now.n} → ${l.panel.after.k}/${l.panel.after.n}; ${l.panel.moves.slice(0, 3).map((m) => `${m.from}→${m.to} ${m.n}`).join(", ")}${l.panel.activities.length ? `; activities: ${l.panel.activities.map((a) => a.short).join(" | ")}` : ""}`);
      if (showSteps || r.key !== "qualify") console.log(`      steps: ${l.steps.map((s) => `${ym(s.month)} ${en(s.text)}${s.also ? ` / ${en(s.also)}` : ""} [${s.basis.kind}]`).join(" · ")}`);
    }
  }
  console.log(`  layouts: radial ${radial.nodes.length} nodes in ${radial.width}×${radial.height}; column 343 wide, ${layoutColumn(tree, { width: 343 }).height} px tall`);
}

// The qualification leaves on a sample file (data/raw/certificates.json is written by another
// collection): Arjun's degree with 9 ACCA exemptions, CPA Australia accredited, not in CFA's programme;
// an "unread" entry and a missing body read "Missing: data".
{
  const id = arjun.programmeId!;
  const sample: NonNullable<typeof facts.certificates> = {
    checked: "2026-10-26",
    bodies: { acca: { name: "ACCA", exams: ["BT", "MA", "FA", "LW", "PM", "TX", "FR", "AA", "FM", "SBL", "SBR", "AFM", "APM"], url: "https://example.org/acca" } },
    programmes: {
      [id]: {
        acca: { status: "exempt", exempt: ["BT", "MA", "FA", "LW", "PM", "TX", "FR", "AA", "FM"], count: 9, url: "https://example.org/acca/ucd", quote: "sample", read: "2026-10-26" },
        "cpa-australia": { status: "accredited", url: "https://example.org/cpa/ucd", quote: "sample", read: "2026-10-26" },
        cfa: { status: "not-listed", url: "https://example.org/cfa", quote: "sample", read: "2026-10-26" },
      },
      [mei.pathwayDegreeId!]: { acca: { status: "unread" } },
    },
  };
  const a = buildNextSteps(modelOf(arjun), { ...facts, certificates: sample }, DAY).roads[2].leaves;
  const by = (k: string) => a.find((l) => l.key === k)!;
  const [acca, cpa, cfa] = [by("acca"), by("cpa-australia"), by("cfa")];
  check(!cpa, "sample: Arjun's UCD degree shows CPA Australia");
  check(by("cai")?.measure.kind === "missing" && by("isca")?.measure.kind === "missing", "sample: Chartered Accountants Ireland and ISCA, absent from the sample, do not read Missing: data");
  check(acca.measure.kind === "ring" && acca.measure.value === 9 && acca.measure.max === 13 && en(acca.measure.shown) === "9/13", `sample: ACCA ring ${acca.measure.kind === "ring" ? en(acca.measure.shown) : acca.measure.kind}`);
  check(cfa.measure.kind === "badge" && !cfa.measure.yes, "sample: CFA badge is not no");
  check(en(acca.steps[0].text) === "9 exemptions at graduation" && en(acca.steps[1].text) === "4 ACCA exams to sit", `sample: ACCA steps ${acca.steps.map((s) => en(s.text)).join(" / ")}`);
  for (const l of a) for (const s of l.steps) check(en(s.text).length <= LINE_MAX, `sample ${l.id}: "${en(s.text)}" is over ${LINE_MAX} characters`);
  const b = buildNextSteps(modelOf(mei), { ...facts, certificates: sample }, DAY).roads[2].leaves;
  check(b.every((l) => l.measure.kind === "missing"), "sample: Mei's unread and missing entries do not read Missing: data");
  console.log(`\nsample certificates: ${a.map((l) => `${en(l.name)} ${measureLine(l)} [${l.steps.map((s) => en(s.text)).join(" / ")}]`).join("; ")}`);
}

// The Qualifications road by the awarder's country, on the real data: a Murdoch degree (Australia) adds
// CPA Australia, a Portsmouth degree (UK, Lin's in lib/personas.ts) adds no CPA body; both maps place
// their leaves without overlap and with no edge through a node.
for (const [who, programmeId, want] of [
  ["Murdoch accounting", "murdoch-bachelor-of-business-in-accounting", ["acca", "isca", "cpa-australia", "cfa"]],
  ["Lin (Portsmouth)", PERSONAS.find((p) => p.id === "lin")!.answers(DAY).programmeId!, ["acca", "isca", "cfa"]],
  ["BCU business (case-by-case)", "bcu-ba-hons-business-administration-top-up", ["acca", "isca", "cfa"]],
] as [string, string, QualifyBody[]][]) {
  const model = modelOf({ ...arjun, programmeId, degreeGpa: null, shortlist: [] });
  check(model.kaplanId === programmeId && !!model.degree, `${who}: ${programmeId} is not a Kaplan degree`);
  const tree = buildNextSteps(model, facts, DAY);
  checkQualify(who, model, tree, want);
  const radial = layoutRadial(tree);
  checkLayout(who, "radial", radial, { ...RADIAL_BOX, margin: 8 });
  checkEdges(who, radial);
  for (const l of tree.roads[2].leaves) {
    check(en(l.line).length <= LINE_MAX, `${who} ${l.id}: line "${en(l.line)}" is over ${LINE_MAX} characters`);
    for (const st of l.steps) check(en(st.text).length <= LINE_MAX, `${who} ${l.id}: "${en(st.text)}" is over ${LINE_MAX} characters`);
    for (const { where, m } of msgsIn(l, `${who} ${l.id}`)) {
      check(!HEDGE_EN.test(en(noMonths(m))), `${where}: hedging word in "${en(m)}"`);
      if (m.key !== "@month") keysSeen.add(m.key);
    }
  }
  console.log(`
${who} (${model.degree?.university}, ${model.degree?.country}): ${tree.roads[2].leaves.map((l) => `${en(l.name)} ${measureLine(l)}`).join("; ")}`);
}

// Every key the trees showed has a zh-hans translation (fields and careers come from other files).
for (const k of keysSeen) check(k in zh || !/[A-Za-z]/.test(k), `no zh-hans translation for "${k}"`);
console.log(`\n${keysSeen.size} messages checked for hedging words and translations`);

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("check-next-steps: all checks passed");
