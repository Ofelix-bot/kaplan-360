// The shapes behind /next-steps ("Four roads from your degree"): a radial map with the student's degree
// in the centre, four roads, and two or three leaves on each (three or four on Qualifications). Every
// leaf carries one measure (a ring that is a real fraction with its own unit, a yes/no badge, or
// "Missing: data"), its basis, a detail panel and its state at three months (the timeline). Pure data:
// lib/next-steps/tree.ts builds it, lib/next-steps/layout.ts places it, the page renders it.
//
// Every word is a Msg (lib/stand/types.ts) with an English key. Months travel inside a Msg as
// monthMsg(t) and are written in the page's language by sayAt(); use sayAt() for every Msg here.

import { monthYear } from "@/lib/i18n/format";
import { msg, type T } from "@/lib/i18n/translate";
import type { ChineseName } from "@/lib/results-types";
import type { Move } from "@/lib/stand/aggregate";
import { say, type GateKey, type Msg, type Outcome } from "@/lib/stand/types";

export type { Msg };

// ---------- Words ----------

/** The Msg key that carries a month (vars.t = year × 12 + month index); never translated. */
export const MONTH_KEY = "@month";
/** A month inside a Msg's vars ("Applications open {month}"): sayAt() writes it as "Sep 2027" / "2027年9月". */
export const monthMsg = (t: number): Msg => ({ key: MONTH_KEY, vars: { t } });

/** A Msg in the page's language, with its months written for `locale` (the I18nProvider's useIntlLocale()). */
export function sayAt(t: T, locale: string, m: Msg): string {
  if (m.key === MONTH_KEY) return monthYear(locale, Number(m.vars?.t ?? 0));
  if (!m.vars) return t(m.key);
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(m.vars)) vars[k] = typeof v === "object" ? sayAt(t, locale, v) : v;
  return say(t, { key: m.key, vars });
}

/** The chip's word for a "rule" basis: a status label, as /plan's Estimated; the rule itself is not shown. */
export const RULE_LABEL = msg("Estimated");
/**
 * A date Kaplan 360++ works out by its own rule ("Applications open: estimated 12 months before the
 * start"): the rule basis's text, kept for the checks; the page shows only the Estimated chip.
 */
export const ESTIMATED = msg("{what}: estimated {how} — Kaplan 360++’s rule.");
export const estimatedMsg = (what: Msg, how: Msg): Msg => ({ key: ESTIMATED, vars: { what, how } });
/** A leaf whose facts are not collected yet. */
export const MISSING_DATA = msg("Missing: data");
/** The longest leaf line and step text, in English characters. */
export const LINE_MAX = 30;

// ---------- Basis ----------

/**
 * What a number or a state rests on.
 * - "official": read from an official page or dataset; `text` names the source, `url` links it, `quote`
 *   holds its own words verbatim (shown as a quote, never translated).
 * - "rule": worked out by Kaplan 360++; `text` states the rule (kept for the checks, not shown); the page labels it RULE_LABEL.
 * - "yours": the student's own answer (their start year, their graduation month).
 */
export type Basis = {
  kind: "official" | "rule" | "yours";
  text: Msg;
  url?: string;
  /** Where on the official page or tool the quote is, in our words ("UCD, Ireland › Can't find your course? › FINANCE"): shown plain, not as a quote. */
  path?: string;
  quote?: string;
  /** When the page was read, YYYY-MM-DD. */
  read?: string;
};

// ---------- Measures ----------

/**
 * A ring: `value` of `max` (fill = value / max; max is never 0). `shown` is the figure in the ring
 * ("23%", "10/20", "9/13"), `label` its unit in words ("Match or better"). `rule` is Kaplan 360++'s
 * reading where the official source leaves a case open (the Employment Pass ring).
 */
export type Ring = { kind: "ring"; value: number; max: number; shown: Msg; label: Msg; basis: Basis; rule?: Basis };
/**
 * A yes/no fact, with the official words behind it. `open`: the source says the body decides case by
 * case, so the mark is neither a tick nor a cross (`yes` is then false).
 */
export type Badge = { kind: "badge"; yes: boolean; open?: true; text: Msg; basis: Basis; rule?: Basis };
/**
 * Facts not collected yet, or an answer the student has not given: `text` is MISSING_DATA or
 * "Missing: {item}", `what` says which. Shown, never hidden. `href`: where to give the answer; `basis`:
 * what the count in `what` rests on (a study leaf held at Missing).
 */
export type MissingMeasure = { kind: "missing"; text: Msg; what: Msg; href?: string; basis?: Basis };
export type Measure = Ring | Badge | MissingMeasure;

// ---------- Steps (the timeline) ----------

/** The three moments the timeline shows: this month, 12 and 24 months on. */
export const STEP_OFFSETS = [0, 12, 24] as const;
export type StepOffset = (typeof STEP_OFFSETS)[number];

/**
 * A leaf's state at one moment. `text` is at most LINE_MAX characters in English; `also` is a second
 * line of the same length (the MBAs that open with two years of work, the next date when it lies past
 * +24); `month` is year × 12 + month index. `rule`: Kaplan 360++'s rule beside an official basis.
 */
export type Step = { offset: StepOffset; month: number; text: Msg; also?: Msg; basis: Basis; rule?: Basis; alsoBasis?: Basis };

// ---------- Panels ----------

/** A link inside the site (the page prefixes the language), with what it opens. */
export type Link = { href: string; label: Msg; what: Msg };
/** A monthly pay figure in S$, with its source. */
export type PayBar = { label: Msg; value: number; basis: Basis };

/** The programme a study leaf's timeline is dated from: the student's shortlisted one in the leaf, else its highest index. */
export type Reference = {
  id: string;
  name: string;
  /** The programme's and the university's Chinese names (lib/local-name.ts), when the data has them. */
  zh: ChineseName | null;
  university: string;
  universityZh: ChineseName | null;
  outcome: Outcome;
  index: number | null;
  /** The course length on its page, in months (null: not stated). */
  months: number | null;
  /** Years of full-time work it asks for (null: none stated). */
  work: number | null;
  url: string;
  /** Why this programme, in the chip's words ("Best QS among Match and Safe"). */
  why: Msg;
  /** The same, spelt out: Kaplan 360++'s rule (QS 2027, fee, length, work, name) or the student's shortlist. */
  basis: Basis;
};

export type StudyPanel = {
  kind: "study";
  /** Programmes in the leaf (in scope: the student's countries and budget). */
  total: number;
  /** Programmes per outcome, in OUTCOMES order (lib/stand/types.ts): the stacked bar. */
  counts: { outcome: Outcome; n: number }[];
  /** The gates holding programmes at Not eligible ("fail") or Missing ("missing"), most first; a programme counts under each such gate. */
  held: { gate: GateKey; state: "fail" | "missing"; n: number }[];
  reference: Reference | null;
  /** The leaf's programme ids, highest index first. */
  programmes: string[];
  links: Link[];
};

export type EpPanel = {
  kind: "ep";
  /** "top100": a QS top-100 awarder (20 points); "pei": another degree taught at a PEI (10); "diploma": no degree (0). */
  route: "top100" | "pei" | "diploma";
  points: 0 | 10 | 20;
  /** The awarding university and its QS World University Rankings 2027 rank as published ("=100"). */
  awarder: { name: string; zh: ChineseName | null; qs: string | null } | null;
  /** "An application needs 40 points in total", with MOM's words. */
  pass: { text: Msg; basis: Basis };
  /** For a PEI-taught degree read at 20 ("top100"): MOM's PEI page, which names 10 points, shown beside the 20. */
  pei: Basis | null;
  /** MOM's words behind the points, in order. */
  quotes: Basis[];
  /** Kaplan graduates' median pay, the career's MOM median and the EP minimum qualifying salary. */
  pay: PayBar[];
  /** For a diploma student: the diploma alone earns 0 points (MOM's words). */
  diploma: Basis | null;
};

export type CareersPanel = {
  kind: "careers";
  /** The field's first career in data/raw/careers.json by sortOrder; `title` is an English key for t(). */
  career: { id: string; title: string; median: number } | null;
  /** Kaplan graduates' median (SWDA) against the career's MOM median (all ages). */
  pay: PayBar[];
  links: Link[];
};

export type HomePanel = {
  kind: "home";
  /** Kaplan × the awarding university on CSCSE's notice; null when the awarder is not known. */
  listed: boolean | null;
  /** The month after which CSCSE certifies the pair's certificates (the notice's "…之后", by the certificate's date). */
  from: number | null;
  /** The row's university as the notice names it. */
  row: string | null;
  notes: Basis[];
};

/**
 * The professional bodies on the Qualifications road: ACCA, ISCA (the Institute of Singapore Chartered
 * Accountants: the Singapore CA Qualification), the accountancy body of the awarding university's
 * country (CPA Australia, or Chartered Accountants Ireland, into which CPA Ireland's members and
 * students were incorporated on 1 September 2024; none for a UK degree) and CFA Institute.
 */
export type QualifyBody = "acca" | "isca" | "cpa-australia" | "cai" | "cfa";
export type QualifyPanel = {
  kind: "qualify";
  body: QualifyBody;
  /** The body's name as data/raw/certificates.json gives it. */
  bodyName: string | null;
  status: string | null;
  /** Kaplan 360++'s rule behind the count, for a degree ACCA has not assessed (its category, matched by the title). */
  rule: Basis | null;
  /** ACCA: the category that rule picks (ACCA's words), for a degree ACCA has not assessed. */
  category: AccaCategory | null;
  /** ACCA: the exams the degree exempts, and all 13. */
  exempt: string[] | null;
  exams: string[];
  /** The programme's own entry: the body's page about this degree, with its words. */
  basis: Basis | null;
  /** The body's page about its scheme. */
  bodyBasis: Basis | null;
  note: string | null;
};

/** An activity from data/raw/plan-activities.json; `short`, `note` and `link` are English keys for t(), `title` stays as published. */
export type Activity = { id: string; kind: string; mode: string; title: string; short: string; note: string | null; link: string | null; url: string; universities: string[] };

export type OtherPanel = {
  kind: "other";
  /** What changes ("One more year of full-time work, and a start one year later"). */
  change: Msg;
  /** Match or better over the three study leaves' programmes, now and after the change. */
  now: { k: number; n: number };
  after: { k: number; n: number };
  /** The changes up the outcome order (Far → Reach, Missing → Match…), largest first. */
  moves: Move[];
  /** Programmes Missing before the change and Not eligible after it: the answer is now known and another gate fails, by that gate. */
  closed: { gate: GateKey; n: number }[];
  /** Internship options that fit the student's pass (empty for "work-first"). */
  activities: Activity[];
  /** The pass rule behind the options. */
  rule: Basis | null;
};

export type Panel = StudyPanel | EpPanel | CareersPanel | HomePanel | QualifyPanel | OtherPanel;

// ---------- The tree ----------

export type RoadKey = "study" | "work" | "qualify" | "other";
export type LeafKey = "same-field" | "conversion" | "mba" | "ep" | "careers" | "home" | QualifyBody | "work-first" | "internship-first";

export type Leaf = {
  /** Unique across the tree: "{road}/{key}". */
  id: string;
  key: LeafKey;
  road: RoadKey;
  name: Msg;
  /** One line under the name, at most LINE_MAX characters in English. */
  line: Msg;
  measure: Measure;
  panel: Panel;
  /** This month, +12 and +24, in that order. */
  steps: Step[];
};

export type Road = { key: RoadKey; name: Msg; leaves: Leaf[] };

export type Centre = {
  /** The degree the roads are computed on (for a diploma student, the planned one). */
  degree: { id: string | null; name: string | null; university: string | null; school: string } | null;
  /** A diploma student's diploma. */
  diploma: { id: string; name: string } | null;
  /** The degree's field (one of Kaplan's 13). */
  field: Msg | null;
  /** The graduation month the student gave (their diploma's, for a diploma student). */
  graduation: number | null;
  /** When the bachelor's ends, and why: the graduation month, or the planned degree's estimate. */
  degreeEnd: number | null;
  degreeEndBasis: Basis;
  /** The master's start the study steps are dated from, and why. */
  start: number;
  startBasis: Basis;
};

export type Tree = {
  /** This month (year × 12 + month index): the timeline's first moment. */
  now: number;
  centre: Centre;
  /** study, work, qualify, other: in that order. */
  roads: Road[];
};

// ---------- Layout ----------

export type LayoutNode = { id: string; kind: "centre" | "road" | "leaf"; road?: RoadKey; x: number; y: number; width: number; height: number; layer: 0 | 1 | 2 };
export type LayoutEdge = { id: string; from: string; to: string; road: RoadKey };
/** Node positions in px from the top left; `width` and `height` are the whole drawing's. */
export type Layout = { width: number; height: number; nodes: LayoutNode[]; edges: LayoutEdge[] };

/** Node ids: the centre, a road, a leaf. A leaf's node id is its Leaf.id. */
export const CENTRE_ID = "centre";
export const roadId = (road: RoadKey) => `road:${road}`;

// ---------- Facts (lib/next-steps/facts.ts loads them on the server) ----------

/**
 * ACCA's category for a degree it has not assessed, chosen by Kaplan 360++'s rule: the one whose
 * subject-title examples on ACCA's calculator name the degree's subject (`example`, ACCA's words; null
 * for NON-RELEVANT: no example names it). `law`: a Business Law major read as Law as a joint or minor
 * subject, which adds LW under ACCA's asterisk note.
 */
export type AccaCategory = { name: string; example: string | null; law?: boolean };

/** data/raw/certificates.json, as another collection writes it. Any part can be absent. */
export type CertificatesFile = {
  checked?: string;
  bodies?: Partial<Record<QualifyBody, { name?: string; exams?: string[]; url?: string; quote?: string }>>;
  programmes?: Record<
    string,
    Partial<
      Record<
        QualifyBody,
        { status?: string; exempt?: string[] | null; count?: number | null; url?: string; path?: string; quote?: string; read?: string; note?: string; assessed?: boolean; category?: AccaCategory }
      >
    >
  >;
  notes?: string[];
};

/**
 * The facts the tree reads besides the Where you stand model, small enough to send to the browser:
 * loadNextStepsFacts() gathers them on the server and the page passes them down as a prop.
 */
export type NextStepsFacts = {
  /** data/raw/careers.json: every career's title, fields, order and MOM median gross wage, with the wage table's source. */
  careers: { id: string; title: string; disciplines: string[]; sortOrder: number; median: number | null }[];
  wageSource: { title: string; url: string; period: string };
  /** data/raw/employment.json sg-kaplan-2024-25: Kaplan graduates in the SWDA survey. */
  kaplan: { cohort: string; secured: number; median: number; respondents: number; quote: string; source: { name: string; url: string } };
  /** data/raw/cscse-sg-2026-09.json: the notice and its rows (university, institution, "YYYY-MM"). */
  cscse: { title: string; published: string; url: string; rows: { university: string | null; institution: string; from: string }[]; onCampus: { text: string; url: string } | null };
  /** data/raw/plan-activities.json. */
  activities: (Activity & { applyBy: string | null; start: string | null })[];
  /** Official application openings from data/raw/plan-dates.json (kind "applications-open"). */
  openings: { institutionId: string; title: string; date: string; intake: string | null; url: string; quote: string | null }[];
  /** The partner universities' intake months and degree lengths, by lib/pathway.ts universityKey (Kaplan's Degree Enrolment Day deck, March 2026). */
  degrees: Record<string, { intakeMonths: number[]; lengthMonths: [number, number] | null; page: number | null }>;
  /** data/raw/certificates.json, or null while it does not exist. */
  certificates: CertificatesFile | null;
};
