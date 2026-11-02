// /next-steps ("Four roads from your degree"): the student's degree in the centre and four roads out of
// it, each leaf with one measure that is what it says it is, never a made-up "recommendation":
// - Further study: the programmes in scope (the student's countries and budget) split three ways, each
//   at most once: first an MBA or a programme asking for years of work (the test lib/stand/score.ts uses
//   for WEIGHTS_WORK), else the same or a related field (lib/stand/rules.ts relatedPair), else open to any
//   background; the rest belong to none. Ring: Safe + Match over the leaf's programmes (the
//   Competitiveness Index, never an admission probability).
// - Straight to work: COMPASS C2 points for the degree (MOM's rule, with Kaplan 360++'s reading where MOM
//   leaves the case open), Kaplan graduates' secured-employment rate (SWDA), and CSCSE's listing.
// - Qualifications: ACCA exemptions, ISCA's Singapore CA Qualification, the accountancy body of the
//   awarding university's country (CPA Australia, Chartered Accountants Ireland; none for a UK degree)
//   and CFA Institute's University Affiliation Program for the Kaplan degree, from data/raw/certificates.json ("Missing: data"
//   while a fact is not collected).
// - Other roads: the Match-or-better share over the three study leaves after a year of full-time work
//   (and a start a year later), or after one more internship in the field.
// The roads are computed on the degree Where you stand reads: for a diploma student, the planned one.

import { careersHref, roleHref } from "@/lib/careers/links";
import { msg } from "@/lib/i18n/translate";
import type { KaplanProgrammeOption, SchoolOption } from "@/lib/plan-options-types";
import type { PlanAnswers } from "@/lib/plan-storage";
import { epFloor, needsWorkPass } from "@/lib/ep";
import { RECEIPTS, type Receipt } from "@/lib/home/receipts";
import { universityKey } from "@/lib/pathway";
import type { ChineseName, ResultsData } from "@/lib/results-types";
import type { Move } from "@/lib/stand/aggregate";
import type { StandDegree } from "@/lib/stand/profile";
import { relatedPair } from "@/lib/stand/rules";
import { scorePrepared, WEIGHTS_WORK, type Prepared } from "@/lib/stand/score";
import { OUTCOMES, type GateKey, type Outcome, type StandProfile, type StandScore } from "@/lib/stand/types";
import kaplanProgrammes from "@/data/raw/kaplan-programmes.json";
import { internshipSteps, qualifySteps, studySteps, workFirstSteps, workSteps, type Dated, type StepDates, type StudyDates } from "./steps";
import {
  estimatedMsg,
  LINE_MAX,
  MISSING_DATA,
  monthMsg,
  type AccaCategory,
  type Activity,
  type Basis,
  type Centre,
  type Leaf,
  type Link,
  type Measure,
  type Msg,
  type NextStepsFacts,
  type PayBar,
  type QualifyBody,
  type Reference,
  type Road,
  type RoadKey,
  type Tree,
} from "./types";

/** What the tree reads from the Where you stand model (components/stand/model.tsx StandModel): pass useStand() as it is. */
export type NextStepsModel = {
  answers: PlanAnswers;
  profile: StandProfile;
  /** The programmes in the student's countries and budget, prepared (StandModel.scope). */
  scope: Prepared[];
  data: Pick<ResultsData, "universities">;
  degree: StandDegree | null;
  /** The start the goals are dated from (StandModel.start). */
  start: { year: number; month: number; stated: boolean };
  /** Kaplan's programmes and the other private schools (StandProps). */
  programmes: KaplanProgrammeOption[];
  schools: SchoolOption[];
  /** "kaplan" or another private school's id. */
  school: string;
  /** The Kaplan degree the index reads (StandModel.kaplanId). */
  kaplanId: string | null;
};

/** A message (lib/stand/types.ts Msg); named tr so scripts/i18n/extract.mjs collects its keys. */
const tr = (key: string, vars?: Msg["vars"]): Msg => (vars ? { key, vars } : { key });
const rule = (text: Msg): Basis => ({ kind: "rule", text });
const money = (n: number) => n.toLocaleString("en-SG");
/** Kaplan's 13 fields by id, in English (translated like any message: scripts/i18n/extract.mjs reads them from the data). */
const FIELDS: Record<string, string> = kaplanProgrammes.disciplines;
const KAPLAN_SCHOOL = "Kaplan Higher Education Academy";

export const ROAD_NAME: Record<RoadKey, string> = {
  study: msg("Further study"),
  work: msg("Straight to work"),
  qualify: msg("Qualifications"),
  other: msg("Other roads"),
};

// ---------- Dates ----------

const monthOfAnswer = (y: number | null, m: number | null) => (y && m ? y * 12 + m - 1 : null);

/** The first intake month (1–12) after `after`, within three years. */
function nextIntake(after: number, months: number[]): number | null {
  const y0 = Math.floor(after / 12);
  for (let y = y0; y <= y0 + 2; y++) for (const m of [...months].sort((a, b) => a - b)) if (y * 12 + m - 1 > after) return y * 12 + m - 1;
  return null;
}

/** /plan's estimate when the deck has no intake or length (lib/plan-input.ts): two months after the diploma, 18 months long. */
const PLAN_GAP = 2;
const PLAN_LENGTH = 18;

/**
 * When the bachelor's ends: the graduation month for a degree student; for a diploma student, the
 * planned degree's estimate as /plan makes it (the partner's next intake after the diploma and its
 * shortest length, from Kaplan's Degree Enrolment Day deck, March 2026).
 */
function degreeEndOf(m: NextStepsModel, facts: NextStepsFacts): { end: Dated; diploma: StepDates["diploma"] } | null {
  const grad = monthOfAnswer(m.answers.graduationYear, m.answers.graduationMonth);
  if (grad === null) return null;
  const yours: Basis = { kind: "yours", text: tr("Your graduation month") };
  if (m.answers.level !== "diploma") return { end: { month: grad, basis: yours }, diploma: null };
  const university = m.degree?.university ?? null;
  const f = university ? facts.degrees[universityKey(university)] : undefined;
  const intake = f?.intakeMonths.length ? nextIntake(grad, f.intakeMonths) : null;
  const start = intake ?? grad + PLAN_GAP;
  const length = f?.lengthMonths?.[0] ?? PLAN_LENGTH;
  const text = f?.lengthMonths
    ? tr("Estimated as /plan does: {university}’s next intake after your diploma, {n} months long (Kaplan’s Degree Enrolment Day deck, March 2026)", { university: university!, n: length })
    : tr("Estimated as /plan does: a start 2 months after your diploma, 18 months long");
  const topUp: Dated = {
    month: start,
    basis: rule(
      intake !== null
        ? tr("Estimated as /plan does: {university}’s next intake after your diploma (Kaplan’s Degree Enrolment Day deck, March 2026)", { university: university! })
        : tr("Estimated as /plan does: a start 2 months after your diploma"),
    ),
  };
  return { end: { month: start + length - 1, basis: rule(text) }, diploma: { end: { month: grad, basis: yours }, topUp } };
}

/** The master's start: Where you stand's, moved to the same month of the first year after the degree when it falls before the degree ends. */
function startOf(m: NextStepsModel, end: Dated | null): Dated {
  let month = m.start.month;
  const basis: Basis = m.start.stated
    ? { kind: "yours", text: tr("Your start year") }
    : rule(tr("The first September after your degree (January for a January-to-March start), as Where you stand dates it"));
  if (end && month <= end.month) {
    while (month <= end.month) month += 12;
    return { month, basis: rule(tr("The first start in the same month after your degree ends")) };
  }
  return { month, basis };
}

// ---------- Further study ----------

type StudyKey = "same-field" | "conversion" | "mba";
const STUDY: { key: StudyKey; name: string }[] = [
  { key: "same-field", name: msg("Same-field master’s") },
  { key: "conversion", name: msg("Conversion master’s") },
  { key: "mba", name: msg("MBA & work-first") },
];

/**
 * The study leaf a programme belongs to, or null: an MBA or a programme asking for years of work
 * first, then the same or a related field, then open to any background.
 */
export function studyLeafOf(x: Prepared, discipline: string | null): StudyKey | null {
  if (x.weights === WEIGHTS_WORK) return "mba";
  if (discipline && (x.p.discipline === discipline || relatedPair(discipline, x.p.discipline))) return "same-field";
  if (x.p.any) return "conversion";
  return null;
}

const outcomeOf = (r: StandScore): Outcome => (r.state === "scored" ? r.band! : r.state);
const good = (o: Outcome) => o === "safe" || o === "match";
const pct = (k: number, n: number) => Math.round((100 * k) / n);

/** The answer a Missing gate asks for, as "Missing: {item}" names it (short: it is a leaf's third line). */
const GATE_ITEM: Record<GateKey, string> = {
  "degree-type": msg("degree type"),
  grade: msg("grade"),
  english: msg("English score"),
  tests: msg("GRE or GMAT"),
  work: msg("years of work"),
  subject: msg("degree field"),
};
/** Where the student gives an answer the index is missing. */
const ANSWERS_HREF = "/profile";

/**
 * Match or better as a ring over `n` programmes ("23%"); a badge when the leaf holds none. When the
 * programmes held at Missing outnumber the scored ones, the ring would read a measured share where the
 * answer is not given: the measure is "Missing: {item}" for the gate holding the most, with where to give it.
 */
function shareRing(k: number, n: number, basis: Msg, results: StandScore[]): Measure {
  if (!n) return { kind: "badge", yes: false, text: tr("None in your countries and budget"), basis: rule(tr("The programmes in your countries and budget")) };
  const missing = results.filter((r) => r.state === "missing");
  if (missing.length > results.filter((r) => r.state === "scored").length) {
    const by = new Map<GateKey, number>();
    for (const r of missing) for (const g of r.gates) if (g.state === "missing") by.set(g.key, (by.get(g.key) ?? 0) + 1);
    const [gate] = [...by].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (gate)
      return {
        kind: "missing",
        text: tr("Missing: {item}", { item: tr(GATE_ITEM[gate]) }),
        what: tr("{n} of {total} programmes wait on it", { n: money(by.get(gate)!), total: money(n) }),
        href: ANSWERS_HREF,
        basis: rule(basis),
      };
  }
  return { kind: "ring", value: k, max: n, shown: tr("{n}%", { n: pct(k, n) }), label: tr("Match or better"), basis: rule(basis) };
}

/** The official opening for a programme's start year in /plan's dates: its university's, naming it or the whole university. */
function officialOpening(x: Prepared, start: number, facts: NextStepsFacts): Dated | null {
  const year = Math.floor(start / 12);
  const own = facts.openings.filter((o) => x.p.id.startsWith(`${o.institutionId}-`));
  const fits = own.filter((o) => {
    const opens = Number(o.date.slice(0, 4)) * 12 + Number(o.date.slice(5, 7)) - 1;
    const named = Number(o.intake?.match(/20\d\d/)?.[0] ?? NaN);
    return opens < start && (o.intake ? named === year : start - opens <= 15);
  });
  const programme = fits.find((o) => o.title.toLowerCase() === x.p.name.toLowerCase());
  // A programme's name as the title is that programme's date; another programme's name is not this one's.
  const general = fits.find((o) => !/^(master|doctor|msc|ma|mba|phd)\b/i.test(o.title));
  const o = programme ?? general;
  if (!o) return null;
  const month = Number(o.date.slice(0, 4)) * 12 + Number(o.date.slice(5, 7)) - 1;
  return { month, basis: { kind: "official", text: tr("{university}’s page: applications open {month}", { university: x.u.name, month: monthMsg(month) }), url: o.url, quote: o.quote ?? undefined } };
}

/** A study leaf's master's dates from its reference programme: official opening and length when the data has them, else the rules. */
function studyDates(ref: Prepared | null, start: Dated, facts: NextStepsFacts): StudyDates {
  const opens = (ref && officialOpening(ref, start.month, facts)) ?? { month: start.month - 12, basis: rule(estimatedMsg(tr("Applications open"), tr("12 months before the start"))) };
  const months =
    ref?.p.months != null
      ? { n: ref.p.months, basis: { kind: "official", text: tr("{programme}’s page: {n} months", { programme: ref.p.name, n: ref.p.months }), url: ref.p.url } as Basis }
      : { n: 12, basis: rule(tr("12 months when the programme’s page states no length")) };
  return { opens, start, months };
}

type Scored = { x: Prepared; r: StandScore; o: Outcome };
/** Highest index first, then by name. */
const byIndex = (a: Scored, b: Scored) => (b.r.index ?? -1) - (a.r.index ?? -1) || a.x.p.name.localeCompare(b.x.p.name);

/**
 * Kaplan 360++'s rule for the outcome groups a leaf's reference comes from, in order: the first group
 * with a programme in it, each with the chip's words and the rule spelt out for the basis.
 */
export const REFERENCE_GROUPS: { outcomes: Outcome[]; why: string; among: string }[] = [
  { outcomes: ["match", "safe"], why: msg("Best QS among Match and Safe"), among: msg("Match and Safe") },
  { outcomes: ["reach"], why: msg("Best QS among Reach"), among: msg("Reach (none in Match or Safe)") },
  { outcomes: ["missing"], why: msg("Best QS among Missing"), among: msg("Missing (none in Match, Safe or Reach)") },
  { outcomes: ["far", "not-eligible"], why: msg("Best QS among the rest"), among: msg("Far and Not eligible") },
];

/** Best QS 2027 rank of the university (unranked last), then lowest fee, shortest course (unstated last), fewest years of work (none stated: 0), then name. */
export const byReference = (a: Prepared, b: Prepared) =>
  (a.u.qsValue ?? Infinity) - (b.u.qsValue ?? Infinity) ||
  (a.p.feeSgd ?? Infinity) - (b.p.feeSgd ?? Infinity) ||
  (a.p.months ?? Infinity) - (b.p.months ?? Infinity) ||
  (a.p.work ?? 0) - (b.p.work ?? 0) ||
  a.p.name.localeCompare(b.p.name);

/**
 * The programme a leaf's timeline is dated from: the first on the student's shortlist, else by
 * Kaplan 360++'s rule (REFERENCE_GROUPS, then byReference). Not the highest index: that favours the
 * programmes easiest to enter, often a Kaplan partner's.
 */
function reference(list: Scored[], shortlist: string[]): { s: Scored; why: Msg; basis: Basis } | null {
  for (const id of shortlist) {
    const s = list.find((y) => y.x.p.id === id);
    if (s) return { s, why: tr("On your shortlist"), basis: { kind: "yours", text: tr("The first programme on your shortlist in this leaf") } };
  }
  for (const g of REFERENCE_GROUPS) {
    const s = list.filter((y) => g.outcomes.includes(y.o)).sort((a, b) => byReference(a.x, b.x))[0];
    if (!s) continue;
    const qs = s.x.u.qs ? tr("QS 2027 rank {rank}", { rank: s.x.u.qs }) : tr("Not in QS 2027");
    const fee = s.x.p.feeSgd !== null ? tr("S${fee}", { fee: money(s.x.p.feeSgd) }) : tr("Fee not stated");
    return {
      s,
      why: tr(g.why),
      basis: rule(
        tr("Among {among}: the best QS 2027 rank, then the lowest fee, the shortest course, the fewest years of work, then name. {university}: {qs}; {fee}.", {
          among: tr(g.among),
          university: s.x.u.name,
          qs,
          fee,
        }),
      ),
    };
  }
  return null;
}

const WHERE_YOU_STAND: Link = { href: "/results", label: tr("Programme finder"), what: tr("Your match rate on every programme") };

function studyLeaf(key: StudyKey, name: string, list: Scored[], m: NextStepsModel, dates: StepDates, start: Dated, facts: NextStepsFacts): Leaf {
  list.sort(byIndex);
  const n = list.length;
  const k = list.filter((s) => good(s.o)).length;
  const held = new Map<string, { gate: GateKey; state: "fail" | "missing"; n: number }>();
  for (const { r } of list)
    if (r.state !== "scored")
      for (const g of r.gates)
        if (g.state !== "pass") {
          const id = `${g.key}|${g.state}`;
          const h = held.get(id) ?? { gate: g.key, state: g.state, n: 0 };
          h.n++;
          held.set(id, h);
        }
  const ref = reference(list, m.answers.shortlist);
  const field = m.profile.discipline ? FIELDS[m.profile.discipline] : null;
  const line =
    key === "same-field" ? (field && field.length <= LINE_MAX ? tr(field) : tr("Your field and related ones")) : key === "conversion" ? tr("Open to any background") : tr("Needs years of full-time work");
  const sd = studyDates(ref?.s.x ?? null, start, facts);
  const work = ref?.s.x.p.work ?? null;
  // A programme asking for years of work starts once they are done: the first same-month start after them.
  const need = work !== null && dates.degreeEnd ? Math.max(0, work - (m.profile.workYears ?? 0)) : 0;
  let plan = sd;
  if (key === "mba" && need > 0 && dates.degreeEnd) {
    let month = start.month;
    while (month < dates.degreeEnd.month + 1 + 12 * need) month += 12;
    const s2: Dated = { month, basis: rule(tr("The first start after {n} years of full-time work, counted from your degree’s end", { n: need })) };
    plan = { ...studyDates(ref!.s.x, s2, facts), work: { years: need } };
  }
  const reference_: Reference | null = ref
    ? { id: ref.s.x.p.id, name: ref.s.x.p.name, zh: ref.s.x.p.zh, university: ref.s.x.u.name, universityZh: ref.s.x.u.zh, outcome: ref.s.o, index: ref.s.r.index, months: ref.s.x.p.months ?? null, work, url: ref.s.x.p.url, why: ref.why, basis: ref.basis }
    : null;
  const links: Link[] = ref
    ? [{ href: `/results/compare?ids=${encodeURIComponent(ref.s.x.p.id)}`, label: tr("Open in the Programme Finder"), what: tr("Opens {programme} on /results, with every field listed", { programme: ref.s.x.p.name }) }, WHERE_YOU_STAND]
    : [WHERE_YOU_STAND];
  return {
    id: `study/${key}`,
    key,
    road: "study",
    name: tr(name),
    line,
    measure: shareRing(k, n, tr("Competitiveness Index · {k} of {n} programmes", { k, n }), list.map((s) => s.r)),
    panel: {
      kind: "study",
      total: n,
      counts: OUTCOMES.map((outcome) => ({ outcome, n: list.filter((s) => s.o === outcome).length })),
      held: [...held.values()].sort((a, b) => b.n - a.n),
      reference: reference_,
      programmes: list.map((s) => s.x.p.id),
      links,
    },
    steps: studySteps(dates, plan),
  };
}

// ---------- Straight to work ----------

/** MOM's words on COMPASS C2 (read 2026-10-26), beside the homepage receipts (lib/home/receipts.ts). */
const MOM_FAQ = "https://www.mom.gov.sg/faq/compass/how-do-peis-qualify-for-compass-c2-criteria";
const MOM_EP = "https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility";
const MOM_READ = "2026-10-26";
const QUOTE_PEI_10 =
  "To be awarded COMPASS C2 10 points, applicants should have qualifications from awarding institutions that are evaluated by international recognition bodies, such as the UK ENIC.";
const QUOTE_SELECT =
  "For applicants with degree programmes offered by PEIs and awarded by overseas partner universities recognised by UK ENIC, employers should select the name of the awarding overseas partner university in their application forms.";
const QUOTE_DIPLOMA =
  "COMPASS C2 points are not accorded for non-degree PEI qualifications (e.g. self-developed diplomas including postgraduate and professional qualifications) by default.";
const QUOTE_PASS = "Your application needs to earn 40 points to pass COMPASS.";
/** The highest QS World University Rankings place MOM's 20-point row names. */
const QS_TOP = 100;

const official = (r: Receipt, text: Msg): Basis => ({ kind: "official", text, url: r.url, quote: r.quote, read: r.read });
const mom = (quote: string, url: string, text: Msg): Basis => ({ kind: "official", text, url, quote, read: MOM_READ });

type Ep = { route: "top100" | "pei" | "diploma"; points: 0 | 10 | 20; awarder: { name: string; zh: ChineseName | null; qs: string | null } | null; quotes: Basis[]; rule: Basis | null; pei: Basis | null };

/**
 * COMPASS C2 points for the degree, from MOM's pages only: a degree taught at a PEI earns 10 when its
 * awarding university is recognised by UK ENIC, and the employer names that university; a degree from a
 * QS top-100 university earns 20. MOM does not say in words what a PEI-taught degree from a top-100
 * awarder earns: Kaplan 360++ reads it from the awarder MOM has the employer name (QS 2027, 100 or
 * better: 20), and shows MOM's PEI page, which names 10 points, beside it. A diploma alone: 0.
 */
function epOf(m: NextStepsModel): Ep {
  const faqPei = mom(QUOTE_PEI_10, MOM_FAQ, tr("MOM: how PEIs qualify for 10 points under C2"));
  const faqSelect = mom(QUOTE_SELECT, MOM_FAQ, tr("MOM: how PEIs qualify for 10 points under C2"));
  const university = m.profile.awarder?.name ?? null;
  if (!university || (m.answers.level === "diploma" && !m.degree)) {
    return { route: "diploma", points: 0, awarder: null, quotes: [mom(QUOTE_DIPLOMA, MOM_FAQ, tr("MOM: non-degree PEI qualifications"))], rule: null, pei: null };
  }
  const u = m.data.universities.find((x) => x.name === university);
  const awarder = { name: university, zh: u?.zh ?? null, qs: u?.qs ?? null };
  const qs = u?.qsValue ?? null;
  if (qs !== null && qs <= QS_TOP) {
    return {
      route: "top100",
      points: 20,
      awarder,
      quotes: [official(RECEIPTS["c2-top100"], tr("MOM: COMPASS C2, the 20-point row")), faqSelect],
      rule: rule(
        qs === QS_TOP
          ? tr("MOM’s PEI page names 10 points; MOM’s EP page gives 20 points to degrees from QS top-100 universities, and MOM has the employer name the awarding partner university. Kaplan 360++ reads it from the awarder: {university}, QS 2027 rank {rank}, on the 100 cut-off, 20 points.", {
              university,
              rank: u?.qs ?? String(qs),
            })
          : tr("MOM names the awarding partner university for a PEI degree and gives 20 points to degrees from QS top-100 universities; it does not say which applies to a PEI degree from one. Kaplan 360++ reads it from the awarder: {university}, QS 2027 rank {rank}, 20 points.", {
              university,
              rank: u?.qs ?? String(qs),
            }),
      ),
      pei: faqPei,
    };
  }
  return {
    route: "pei",
    points: 10,
    awarder,
    quotes: [faqPei, official(RECEIPTS["c2-pei"], tr("MOM: COMPASS C2, the 10-point row"))],
    rule:
      m.school === "kaplan"
        ? rule(tr("Kaplan 360++ reads every Kaplan partner university as recognised by UK ENIC: each is a public university in the UK, Ireland or Australia."))
        : rule(tr("10 points when UK ENIC recognises {university}: MOM’s condition", { university })),
    pei: null,
  };
}

/** The field's first career by sortOrder, and its line: "{title} · S${wage}", the title shortened only when the line passes 30 characters. */
const SHORT_TITLE: Record<string, string> = {
  "Data Analyst / Data Scientist": msg("Data Analyst"),
  "AI / Machine Learning Engineer": msg("AI/ML Engineer"),
  "Cybersecurity Analyst": msg("Security Analyst"),
  "Financial Analyst / FinTech": msg("Financial Analyst"),
  "Digital Marketing Manager": msg("Digital Marketer"),
  "Supply Chain & Logistics Manager": msg("Logistics Manager"),
  "Counsellor / Psychology Associate": msg("Counsellor"),
};
/** The ten old careers (data/raw/careers.json) → the nearest new /careers role page: the same list as
 *  next.config.ts's 308s (data/raw/careers-roles.json "redirects"). */
const CAREER_ROLE: Record<string, string> = {
  "data-analyst-scientist": "data-analyst-associate-data-engineer",
  "ai-ml-engineer": "artificial-intelligence-machine-learning-engineer",
  "cybersecurity-analyst": "security-operations-analyst",
  "financial-analyst-fintech": "business-analyst-market-research-analyst-market-analyst",
  "digital-marketing-manager": "digital-marketing-executive",
  "supply-chain-logistics-manager": "logistics-solutions-analyst",
  "software-engineer": "software-engineer",
  "registered-nurse": "staff-nurse",
  "counsellor-psychology-associate": "counsellor",
  "communications-pr": "digital-marketing-executive",
};
function careerOf(discipline: string | null, facts: NextStepsFacts) {
  if (!discipline) return null;
  return [...facts.careers].sort((a, b) => a.sortOrder - b.sortOrder).find((c) => c.disciplines.includes(discipline) && c.median !== null) ?? null;
}

function workRoad(m: NextStepsModel, facts: NextStepsFacts, dates: StepDates, mbas: { n: number; basis: Basis }): Leaf[] {
  const k = facts.kaplan;
  const survey: Basis = {
    kind: "official",
    text: tr("SWDA PEI graduate employment survey {cohort} · {n} respondents in the labour force", { cohort: k.cohort, n: k.respondents }),
    url: k.source.url,
    quote: k.quote,
  };
  const career = careerOf(m.profile.discipline, facts);
  const wage: Basis = { kind: "official", text: tr("MOM Occupational Wage Tables 2025: median gross monthly wage, full-time residents of all ages, {period}", { period: facts.wageSource.period }), url: facts.wageSource.url };
  const pay: PayBar[] = [{ label: tr("Kaplan graduates’ median"), value: k.median, basis: { ...survey, text: tr("SWDA PEI graduate employment survey {cohort}: Kaplan Higher Education Academy’s median gross monthly salary", { cohort: k.cohort }) } }];
  if (career?.median) pay.push({ label: tr(career.title), value: career.median, basis: wage });

  // Employment Pass.
  const ep = epOf(m);
  const pass = { text: tr("An application needs 40 points in total"), basis: mom(QUOTE_PASS, MOM_EP, tr("MOM: Employment Pass eligibility, how to pass COMPASS")) };
  // The floor at the student's age when they graduate, for their sector, on the schedule that applies then (lib/ep.ts).
  const floor = epFloor(m.answers, m.profile.discipline === "accounting-finance");
  const floorLabel =
    floor.age === null
      ? tr("EP minimum qualifying salary")
      : floor.sector === "financial"
        ? tr("EP minimum qualifying salary at {age}, financial services", { age: floor.age })
        : tr("EP minimum qualifying salary at {age}", { age: floor.age });
  const epPay: PayBar[] = [...pay, { label: floorLabel, value: floor.value, basis: official(RECEIPTS["ep-age"], tr("MOM: Employment Pass eligibility, qualifying salary by age")) }];
  const epLeaf: Leaf = {
    id: "work/ep",
    key: "ep",
    road: "work",
    name: tr("Employment Pass"),
    line: tr("Your degree’s COMPASS points"),
    measure: { kind: "ring", value: ep.points, max: 20, shown: tr("{n}/20", { n: ep.points }), label: tr("COMPASS C2 points"), basis: ep.quotes[0], ...(ep.rule ? { rule: ep.rule } : {}) },
    panel: {
      kind: "ep",
      route: ep.route,
      points: ep.points,
      awarder: ep.awarder,
      pass,
      pei: ep.pei,
      quotes: ep.quotes,
      pay: epPay,
      diploma: m.answers.level === "diploma" && ep.route !== "diploma" ? mom(QUOTE_DIPLOMA, MOM_FAQ, tr("MOM: your diploma alone earns 0 points")) : null,
    },
    steps: workSteps(dates, "work", mbas),
  };

  // Careers in the field.
  const title = career ? (`${career.title} · S$${money(career.median!)}`.length > LINE_MAX ? (SHORT_TITLE[career.title] ?? career.title) : career.title) : null;
  const careersLeaf: Leaf = {
    id: "work/careers",
    key: "careers",
    road: "work",
    name: tr("Careers in your field"),
    line: career && title ? tr("{title} · S${wage}", { title: tr(title), wage: money(career.median!) }) : tr("Kaplan graduates, all fields"),
    measure: { kind: "ring", value: k.secured, max: 100, shown: tr("{n}%", { n: k.secured }), label: tr("Kaplan graduates in work"), basis: survey },
    panel: {
      kind: "careers",
      career: career ? { id: career.id, title: career.title, median: career.median! } : null,
      pay,
      links: career
        ? [
            ...(CAREER_ROLE[career.id] ? [{ href: roleHref(CAREER_ROLE[career.id]), label: tr("See this career"), what: tr("Pay, skills and master’s programmes for {career}", { career: tr(career.title) }) }] : []),
            { href: careersHref(), label: tr("All careers"), what: tr("Your degree’s industries and roles in demand") },
          ]
        : [{ href: careersHref(), label: tr("All careers"), what: tr("Your degree’s industries and roles in demand") }],
    },
    steps: workSteps(dates, "work", mbas),
  };

  // Work back home: Kaplan (or the student's school) × the awarding university on CSCSE's notice.
  const c = facts.cscse;
  const school = m.school === "kaplan" ? KAPLAN_SCHOOL : (m.schools.find((s) => s.id === m.school)?.name ?? null);
  const awarder = m.profile.awarder?.name ?? null;
  const key = (s: string) => s.toLowerCase().replace(/\b(the|university|of|at newcastle|national|ireland|,)\b/g, " ").replace(/[^a-z]+/g, " ").trim();
  const row = school && awarder ? (c.rows.find((r) => r.institution === school && r.university && key(r.university) === key(awarder)) ?? null) : null;
  const published = Number(c.published.slice(0, 4)) * 12 + Number(c.published.slice(5, 7)) - 1;
  const notice: Basis = { kind: "official", text: tr("CSCSE’s notice published {date}", { date: c.published }), url: c.url, quote: row ? `${row.university} · ${row.institution} · ${row.from}` : undefined };
  const from = row ? Number(row.from.slice(0, 4)) * 12 + Number(row.from.slice(5, 7)) - 1 : null;
  const homeMeasure: Measure =
    !school || !awarder
      ? { kind: "missing", text: tr(MISSING_DATA), what: tr("Your school and awarding university") }
      : { kind: "badge", yes: !!row, text: row ? tr("Listed by CSCSE") : tr("Not listed by CSCSE"), basis: notice };
  const homeLeaf: Leaf = {
    id: "work/home",
    key: "home",
    road: "work",
    name: tr("Work back home"),
    line: from !== null ? tr("Certificates after {month}", { month: monthMsg(from) }) : school && awarder ? tr("Not on CSCSE’s {month} list", { month: monthMsg(published) }) : tr("Your school and awarder needed"),
    measure: homeMeasure,
    panel: {
      kind: "home",
      listed: !school || !awarder ? null : !!row,
      from,
      row: row?.university ?? null,
      notes: [notice, ...(c.onCampus ? [{ kind: "official", text: tr("Kaplan’s CSCSE page: CSCSE asks for programmes completed on campus, in person"), url: c.onCampus.url } as Basis] : [])],
    },
    steps: workSteps(dates, row ? "home" : "uncertified"),
  };
  // Citizens and permanent residents need no work pass: no Employment Pass leaf.
  return needsWorkPass(m.answers) ? [epLeaf, careersLeaf, homeLeaf] : [careersLeaf, homeLeaf];
}

// ---------- Qualifications ----------

const BODY: Record<QualifyBody, { name: string; line: string }> = {
  acca: { name: msg("ACCA"), line: msg("Exams your degree exempts") },
  isca: { name: msg("Singapore CA (ISCA)"), line: msg("Singapore CA Qualification") },
  "cpa-australia": { name: msg("CPA Australia"), line: msg("Accreditation for CPA Program") },
  cai: { name: msg("Chartered Accountants Ireland"), line: msg("The ACA qualification") },
  cfa: { name: msg("CFA Institute"), line: msg("University Affiliation Program") },
};
/**
 * The accountancy body of the awarding university's country (the degree's awarder as the data names it,
 * with its country): CPA Australia, and for Ireland Chartered Accountants Ireland, which incorporated CPA
 * Ireland's members and students on 1 September 2024 (CPA Ireland takes no new students). A UK degree
 * has none.
 */
const HOME_BODY: Record<string, QualifyBody> = { Australia: "cpa-australia", Ireland: "cai" };

/** The Qualifications road's bodies, in order: ACCA, ISCA, the awarder's country's body (if any), CFA Institute. */
export function qualifyBodies(country: string | null): QualifyBody[] {
  const home = country ? HOME_BODY[country] : undefined;
  return ["acca", "isca", ...(home ? [home] : []), "cfa"];
}
/** Chartered Accountants Ireland's residence rule, read on its check-your-exemptions page on 2026-10-26. */
const CAI_RESIDENCE = "“Applicants for our programme must live on the island of Ireland while completing their studies with us.”";
/** ACCA's exams when the file lists none: 13. */
const ACCA_EXAMS = 13;

/**
 * Kaplan 360++'s rule behind an ACCA count for a degree ACCA has not assessed: the category whose
 * subject-title examples on ACCA's calculator name the degree's subject (NON-RELEVANT when none does),
 * and a Business Law major read as Law as a joint or minor subject. Null for an assessed degree.
 */
function accaRule(entry: { assessed?: boolean; category?: AccaCategory } | undefined): Basis | null {
  const c = entry?.assessed === false ? entry.category : undefined;
  if (!c) return null;
  if (!c.example) return rule(tr("ACCA has not assessed this degree. Kaplan 360++ reads it as {category}: no subject-title example on ACCA’s calculator names its subject.", { category: c.name }));
  return rule(
    c.law
      ? tr("ACCA has not assessed this degree. Kaplan 360++ reads it under ACCA’s category {category}, whose subject-title examples name “{example}”, and its Business Law major as Law as a joint or minor subject, which adds LW.", { category: c.name, example: c.example })
      : tr("ACCA has not assessed this degree. Kaplan 360++ reads it under ACCA’s category {category}, whose subject-title examples name “{example}”.", { category: c.name, example: c.example }),
  );
}

/**
 * What the page behind a body's fact is, named for what it is: ACCA's calculator and CPA Australia's
 * course page are pages for the degree; ISCA publishes two lists (one of accredited degrees, one of
 * universities); a "not-listed" fact (Chartered Accountants Ireland's included) is from a list.
 */
function factSource(key: QualifyBody, status: string | undefined, bodyName: string): Msg {
  if (key === "isca") return status === "accredited" ? tr("ISCA’s list of accredited degrees") : tr("ISCA’s list of universities");
  if (status === "not-listed") return tr("{body}’s list", { body: bodyName });
  return tr("{body}’s page for this degree", { body: bodyName });
}

function qualifyRoad(m: NextStepsModel, facts: NextStepsFacts, dates: StepDates): Leaf[] {
  const file = facts.certificates;
  const id = m.school === "kaplan" ? m.kaplanId : null;
  return qualifyBodies(m.degree?.country ?? m.profile.awarder?.country ?? null).map((key) => {
    const { name, line } = BODY[key];
    const body = file?.bodies?.[key];
    const entry = id ? file?.programmes?.[id]?.[key] : undefined;
    const exams = body?.exams?.length ? body.exams : [];
    const max = exams.length || ACCA_EXAMS;
    const basis: Basis | null = entry?.url ? { kind: "official", text: factSource(key, entry.status, body?.name ?? name), url: entry.url, path: entry.path, quote: entry.quote, read: entry.read } : null;
    const bodyBasis: Basis | null = body?.url
      ? { kind: "official", text: key === "isca" ? tr("ISCA’s page") : tr("{body}’s page", { body: body.name ?? name }), url: body.url, quote: body.quote }
      : null;
    const known = !!entry && !!entry.status && entry.status !== "unread" && !!basis;
    const what = !id ? tr("A Kaplan degree to look up") : tr("{body}’s facts for your degree: not collected yet", { body: tr(name) });
    let measure: Measure = { kind: "missing", text: tr(MISSING_DATA), what };
    const accaBasis = key === "acca" ? accaRule(entry) : null;
    let facts_: { during?: Msg; after: Msg; basis: Basis } | null = null;
    if (known && key === "acca" && (entry.status === "exempt" || entry.status === "none")) {
      const k = entry.status === "none" ? 0 : (entry.count ?? entry.exempt?.length ?? 0);
      measure = { kind: "ring", value: k, max, shown: tr("{k}/{n}", { k, n: max }), label: tr("ACCA exams exempt"), basis: basis!, ...(accaBasis ? { rule: accaBasis } : {}) };
      facts_ = { during: k ? tr("{n} exemptions at graduation", { n: k }) : tr("No ACCA exemptions"), after: tr("{n} ACCA exams to sit", { n: max - k }), basis: basis! };
    } else if (known && key === "isca" && (entry.status === "accredited" || entry.status === "recognised" || entry.status === "case-by-case" || entry.status === "not-listed")) {
      // ISCA: an accredited degree is named on its list; a recognised one's university is on its list of
      // universities recognised for the Foundation Programme; either way the route is the Foundation
      // Programme, then the Professional Programme. A degree whose university is not on that list is
      // assessed case by case (the list's own words): neither yes nor no. Not-listed: the list covers
      // degrees, and this qualification is not one.
      const s = entry.status;
      const yes = s === "accredited" || s === "recognised";
      measure = {
        kind: "badge",
        yes,
        ...(s === "case-by-case" ? { open: true as const } : {}),
        text: s === "accredited" ? tr("Accredited degree (ISCA)") : yes ? tr("University recognised by ISCA") : s === "case-by-case" ? tr("Case-by-case (ISCA)") : tr("Not on ISCA’s lists"),
        basis: basis!,
      };
      facts_ = {
        after: s === "accredited" ? tr("Foundation, with exemptions") : yes ? tr("Foundation Programme entry") : s === "case-by-case" ? tr("ISCA assesses case by case") : tr("Not on ISCA’s lists"),
        basis: basis!,
      };
    } else if (known && key === "cpa-australia" && (entry.status === "accredited" || entry.status === "not-listed")) {
      const yes = entry.status === "accredited";
      measure = { kind: "badge", yes, text: yes ? tr("Accredited by CPA Australia") : tr("Not on CPA Australia’s list"), basis: basis! };
      facts_ = { after: yes ? tr("CPA Program entry open") : tr("Not CPA Australia-accredited"), basis: basis! };
    } else if (known && key === "cai" && (entry.status === "exempt" || entry.status === "not-listed")) {
      // Chartered Accountants Ireland: a degree on its exemptions list, or not on it. Every graduate of a
      // recognised university starts the ACA; a non-accredited degree applies for exemptions case by case
      // (the entry's quote), and the student lives on the island of Ireland while studying: the same
      // page's residence rule, which closes the route to a student living in Singapore, so the step
      // after graduation states it with that sentence as its basis.
      const yes = entry.status === "exempt";
      measure = { kind: "badge", yes, text: yes ? tr("On its exemptions list") : tr("Not on its exemptions list"), basis: basis! };
      const residence: Basis = {
        kind: "official",
        text: tr("Chartered Accountants Ireland’s exemptions page"),
        url: entry.url,
        path: "Check your exemptions › Other qualifications - non-accredited programmes",
        quote: CAI_RESIDENCE,
        read: entry.read,
      };
      facts_ = yes ? { after: tr("ACA with listed exemptions"), basis: basis! } : { after: tr("Live on the island of Ireland"), basis: residence };
    } else if (known && key === "cfa" && (entry.status === "affiliated" || entry.status === "not-listed")) {
      const yes = entry.status === "affiliated";
      measure = { kind: "badge", yes, text: yes ? tr("In CFA Institute’s UAP") : tr("Not in CFA Institute’s UAP"), basis: basis! };
      facts_ = { after: yes ? tr("In CFA Institute’s UAP") : tr("Not in CFA Institute’s UAP"), basis: basis! };
    }
    return {
      id: `qualify/${key}`,
      key,
      road: "qualify",
      name: tr(name),
      line: tr(line),
      measure,
      panel: {
        kind: "qualify",
        body: key,
        bodyName: body?.name ?? null,
        status: entry?.status ?? null,
        rule: accaBasis,
        category: key === "acca" && entry?.assessed === false ? (entry.category ?? null) : null,
        exempt: key === "acca" ? (entry?.exempt ?? null) : null,
        exams: key === "acca" ? exams : [],
        basis,
        bodyBasis,
        note: entry?.note ?? null,
      },
      // The rule behind the count stands beside the official basis on every step that states it.
      steps: qualifySteps(dates, facts_).map((s) => (accaBasis && facts_ && s.basis === facts_.basis ? { ...s, rule: accaBasis } : s)),
    } satisfies Leaf;
  });
}

// ---------- Other roads ----------

const RANK: Record<Outcome, number> = { "not-eligible": 0, missing: 0, far: 1, reach: 2, match: 3, safe: 4 };

/**
 * Match or better over `list` after a change to the profile, with the changes up the outcome order
 * (`moves`) and the programmes that were Missing and are Not eligible after it (`closed`): the answer is
 * now known and another gate fails, counted under each gate that fails.
 */
function after(list: Scored[], profile: StandProfile): { k: number; moves: Move[]; closed: { gate: GateKey; n: number }[]; results: StandScore[] } {
  const moves = new Map<string, Move>();
  const closed = new Map<GateKey, number>();
  const results: StandScore[] = [];
  let k = 0;
  for (const s of list) {
    const r = scorePrepared(profile, s.x);
    results.push(r);
    const to = outcomeOf(r);
    if (good(to)) k++;
    if (to === "not-eligible" && s.o !== "not-eligible") {
      for (const g of r.gates) if (g.state === "fail") closed.set(g.key, (closed.get(g.key) ?? 0) + 1);
      continue;
    }
    if (RANK[to] <= RANK[s.o]) continue;
    const id = `${s.o}>${to}`;
    const mv = moves.get(id) ?? { from: s.o, to, n: 0 };
    mv.n++;
    moves.set(id, mv);
  }
  return {
    k,
    results,
    moves: [...moves.values()].sort((a, b) => b.n - a.n || RANK[b.to] - RANK[a.to]),
    closed: [...closed].map(([gate, n]) => ({ gate, n })).sort((a, b) => b.n - a.n),
  };
}

/**
 * The activities that fit the student's pass: online ones for a Student's Pass or another pass, all for
 * citizens and PRs; a university's own only for its students (a degree student at that awarder, not a
 * diploma student yet); none whose applications have closed.
 */
function activitiesFor(m: NextStepsModel, facts: NextStepsFacts, today: string): Activity[] {
  const inPerson = m.answers.status === "citizen-pr";
  const awarder = m.answers.level === "degree" ? (m.profile.awarder?.name ?? null) : null;
  return facts.activities
    .filter((a) => (inPerson || a.mode === "online") && (!a.universities.length || (awarder !== null && a.universities.includes(awarder))) && !(a.applyBy && a.applyBy < today))
    .map((a) => ({ id: a.id, kind: a.kind, mode: a.mode, title: a.title, short: a.short, note: a.note, link: a.link, url: a.url, universities: a.universities }));
}

function otherRoad(m: NextStepsModel, facts: NextStepsFacts, dates: StepDates, start: Dated, study: Scored[], ref: Prepared | null, today: string): Leaf[] {
  const n = study.length;
  const now = study.filter((s) => good(s.o)).length;
  const workYears = (m.profile.workYears ?? 0) + 1;
  const w = after(study, { ...m.profile, workYears });
  const i = after(study, { ...m.profile, internshipsSame: m.profile.internshipsSame + 1 });
  const later: Dated = { month: start.month + 12, basis: rule(tr("Your start one year later, after a year of full-time work")) };
  const status = m.answers.status;
  const online = status !== "citizen-pr";
  const work = RECEIPTS["work-pq"];
  return [
    {
      id: "other/work-first",
      key: "work-first",
      road: "other",
      name: tr("Work a year first"),
      line: tr("Apply with a year of work"),
      measure: shareRing(w.k, n, tr("Competitiveness Index with one more year of full-time work · {k} of {n} programmes", { k: w.k, n }), w.results),
      panel: { kind: "other", change: tr("One more year of full-time work, and a start one year later"), now: { k: now, n }, after: { k: w.k, n }, moves: w.moves, closed: w.closed, activities: [], rule: null },
      steps: workFirstSteps(dates, studyDates(ref, later, facts)),
    },
    {
      id: "other/internship-first",
      key: "internship-first",
      road: "other",
      name: tr("One more internship first"),
      line: status === "student-pass" ? tr("Online, for Student’s Pass") : status === "citizen-pr" ? tr("In person, in your field") : status === "other-pass" ? tr("Online; check your pass") : tr("In your field, before applying"),
      measure: shareRing(i.k, n, tr("Competitiveness Index with one more internship in your field · {k} of {n} programmes", { k: i.k, n }), i.results),
      panel: {
        kind: "other",
        change: tr("One more internship in your field"),
        now: { k: now, n },
        after: { k: i.k, n },
        moves: i.moves,
        closed: i.closed,
        activities: activitiesFor(m, facts, today),
        rule: status === "student-pass" ? official(work, tr("MOM: Student’s Pass holders and part-time work")) : null,
      },
      steps: internshipSteps(dates, studyDates(ref, start, facts), online),
    },
  ];
}

// ---------- The tree ----------

/**
 * The whole map for one student, from the Where you stand model (`useStand()` as it is), the facts
 * loadNextStepsFacts() gathered on the server, and today. Deterministic: the same inputs give the
 * same tree. Every leaf is there whatever the data; a leaf without its facts reads "Missing: data".
 */
export function buildNextSteps(m: NextStepsModel, facts: NextStepsFacts, today: Date): Tree {
  const now = today.getFullYear() * 12 + today.getMonth();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const ends = degreeEndOf(m, facts);
  const end = ends?.end ?? null;
  const start = startOf(m, end);
  const dates: StepDates = { now, degreeEnd: end, diploma: ends?.diploma ?? null };

  // Further study: each programme in scope in one leaf at most.
  const groups: Record<StudyKey, Scored[]> = { "same-field": [], conversion: [], mba: [] };
  for (const x of m.scope) {
    const key = studyLeafOf(x, m.profile.discipline);
    if (!key) continue;
    const r = scorePrepared(m.profile, x);
    groups[key].push({ x, r, o: outcomeOf(r) });
  }
  const studyLeaves = STUDY.map(({ key, name }) => studyLeaf(key, name, groups[key], m, dates, start, facts));
  const study = [...groups["same-field"], ...groups.conversion, ...groups.mba];

  // The MBA-leaf programmes that pass every gate with two years of full-time work (the +24 work steps).
  const two = { ...m.profile, workYears: Math.max(2, m.profile.workYears ?? 0) };
  const mbas = {
    n: groups.mba.filter((s) => scorePrepared(two, s.x).state === "scored").length,
    basis: rule(tr("Programmes in MBA & work-first that pass every gate with 2 years of full-time work (Competitiveness Index)")),
  };
  // The other roads date their master's from the same-field leaf's reference, else the first leaf with one.
  const ref = studyLeaves.map((l) => (l.panel.kind === "study" ? l.panel.reference : null)).find(Boolean) ?? null;
  const refX = ref ? (m.scope.find((x) => x.p.id === ref.id) ?? null) : null;

  const roads: Road[] = [
    { key: "study", name: tr(ROAD_NAME.study), leaves: studyLeaves },
    { key: "work", name: tr(ROAD_NAME.work), leaves: workRoad(m, facts, dates, mbas) },
    { key: "qualify", name: tr(ROAD_NAME.qualify), leaves: qualifyRoad(m, facts, dates) },
    { key: "other", name: tr(ROAD_NAME.other), leaves: otherRoad(m, facts, dates, start, study, refX, iso) },
  ];

  const diploma = m.answers.level === "diploma" ? (m.programmes.find((p) => p.id === m.answers.programmeId) ?? null) : null;
  const schoolName = m.school === "kaplan" ? "Kaplan" : (m.schools.find((s) => s.id === m.school)?.name ?? m.school);
  const centre: Centre = {
    degree: m.degree ? { id: m.school === "kaplan" ? m.kaplanId : null, name: m.degree.name, university: m.degree.university, school: schoolName } : null,
    diploma: diploma ? { id: diploma.id, name: diploma.name } : null,
    field: m.profile.discipline && FIELDS[m.profile.discipline] ? tr(FIELDS[m.profile.discipline]) : null,
    graduation: monthOfAnswer(m.answers.graduationYear, m.answers.graduationMonth),
    degreeEnd: end?.month ?? null,
    degreeEndBasis: end?.basis ?? { kind: "yours", text: tr("Add your graduation month to date this") },
    start: start.month,
    startBasis: start.basis,
  };
  return { now, centre, roads };
}

/** Every leaf of a tree, road by road. */
export const leavesOf = (tree: Tree): Leaf[] => tree.roads.flatMap((r) => r.leaves);
