import fx from "@/data/raw/fx-mas.json";
import { DIRECTIONS, MAX_DIRECTIONS } from "@/lib/finder/directions";
import type { ProfileReading } from "@/lib/profile-reading";
import { bannedWording } from "@/lib/rai";
import type { ResultsProgramme } from "@/lib/results-types";

// The parents' page (/parents, components/parents): a parent, or the student, writes about the child in their own
// words; Claude reads it into the planner's fields and the family's needs (lib/parent-ai.ts), the finder's rules pick
// the candidates in the browser, and Claude writes a short plan from those candidates only. This is what the server
// and the page share: the types, the fees for the whole course in S$ and RMB, and the check every written line passes
// before it is shown (no admission wording, no hedging, and no number the family or the data didn't give).

/** The text's longest allowed length, in characters (the student's one-sentence box takes 400). */
export const MAX_FAMILY_TEXT = 800;
/** The plan picks this many programmes, from at most this many candidates. */
export const PICKS = 3;
export const MAX_CANDIDATES = 20;

export const PRIORITIES = ["cost", "ranking", "duration", "career", "location", "scholarship"] as const;
export const WORRIES = ["admission", "cost", "job", "recognition", "timing"] as const;
export type Priority = (typeof PRIORITIES)[number];
export type Worry = (typeof WORRIES)[number];

/** What the text says beyond the planner's own fields. */
export type FamilyNeeds = {
  writer: "parent" | "student";
  /** What the budget covers: tuition a year, tuition for the whole master's, or everything (tuition and living) for it. */
  budgetScope: "tuition-year" | "tuition-total" | "all-total" | null;
  /** The budget in S$ at the MAS rate, and as written when it was in another currency. */
  budgetSgd: number | null;
  budgetFrom: { amount: number; currency: string } | null;
  /** Master's directions (lib/finder/directions.ts ids) the text names, or makes plain through the career it names. */
  directions: string[];
  /** The longest master's they will consider, in months ("一年制" is 12). */
  maxMonths: number | null;
  /** No programme that requires the GRE or GMAT. */
  noTests: boolean;
  /** The degree must be recognised in mainland China (CSCSE, 留服认证). */
  recognition: boolean;
  /** Where the child means to work after the master's. */
  after: "home" | "abroad" | null;
  /** The lowest QS rank they accept ("前 100" is 100). */
  qsMax: number | null;
  priorities: Priority[];
  worries: Worry[];
  /** The job or industry the text names, in its own words. */
  career: string | null;
};

export const NO_NEEDS: FamilyNeeds = {
  writer: "parent",
  budgetScope: null,
  budgetSgd: null,
  budgetFrom: null,
  directions: [],
  maxMonths: null,
  noTests: false,
  recognition: false,
  after: null,
  qsMax: null,
  priorities: [],
  worries: [],
  career: null,
};

/**
 * The planner's fields, the family's needs, and the university awarding the child's Kaplan degree when the text names it
 * but not the programme ("UCD 商科": UCD has nine business majors), which the page needs for the match.
 */
export type FamilyReading = { reading: ProfileReading; needs: FamilyNeeds; awarder: string | null };

/** A candidate as the writer sees it: facts from the programme data, nothing else. */
export type Candidate = {
  id: string;
  programme: string;
  university: string;
  country: string;
  qs: string | null;
  months: number | null;
  /** Tuition a year, and for the whole course, in S$ at the MAS rate. */
  feeYearSgd: number | null;
  feeTotalSgd: number | null;
  /** Intake months, 1–12. */
  intake: number[];
  ielts: number | null;
  /** The GRE or the GMAT is required. */
  testsRequired: boolean;
  /** The admission model's match rate, in whole percent (it orders the picks; the plan never writes it). */
  match: number | null;
};

/** What Claude wrote: the summary, a reason per pick (null when it failed the check), this month's steps, questions. */
export type FamilyPlan = {
  summary: string[];
  picks: { id: string; reason: string | null }[];
  todo: { who: "child" | "parent"; text: string }[];
  talk: string[];
};

const RATES = fx.rates as Record<string, number>;
/** The day the MAS rates were read (data/raw/fx-mas.json). */
export const FX_DATE = fx.retrievedAt;
/** An amount in S$ at the MAS rate; null for a currency without one. */
export const toSgd = (amount: number, currency: string) => (RATES[currency] ? amount * RATES[currency] : null);
/** S$ in RMB at the MAS rate. */
export const sgdToCny = (sgd: number) => Math.round(sgd / RATES.CNY);

/**
 * Tuition for the whole master's in S$: a course fee as the page states it, a one-year programme's fee, or the
 * yearly fee times the programme's years. Null when the page gives no fee or no length to multiply by.
 */
export function totalFeeSgd(p: Pick<ResultsProgramme, "feeSgd" | "feeBasis" | "months">): number | null {
  if (p.feeSgd === null) return null;
  if (p.feeBasis === "one-year") return p.feeSgd;
  if (!p.months) return null;
  return Math.round(p.feeSgd * Math.max(1, p.months / 12));
}

const oneOf = <T extends string>(v: unknown, values: readonly T[]): T | null => (typeof v === "string" && (values as readonly string[]).includes(v) ? (v as T) : null);
const listOf = <T extends string>(v: unknown, values: readonly T[]): T[] => (Array.isArray(v) ? [...new Set(v.map((x) => oneOf(x, values)).filter((x): x is T => x !== null))] : []);
const intIn = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** Needs with only the values each field allows: the reader's output, and the page's copy sent back with the plan call. */
export function cleanNeeds(x: Partial<Record<keyof FamilyNeeds, unknown>>): FamilyNeeds {
  const budgetSgd = intIn(x.budgetSgd, 1000, 3_000_000);
  const from = x.budgetFrom as { amount?: unknown; currency?: unknown } | null | undefined;
  // Without the quotes a model sometimes writes for "none" ("\"\"").
  const career = typeof x.career === "string" ? x.career.replace(/^[\s"'“”「」]+|[\s"'“”「」]+$/g, "").slice(0, 60) : "";
  return {
    writer: x.writer === "student" ? "student" : "parent",
    budgetScope: budgetSgd ? oneOf(x.budgetScope, ["tuition-year", "tuition-total", "all-total"] as const) : null,
    budgetSgd,
    budgetFrom:
      budgetSgd && from && typeof from.amount === "number" && from.amount > 0 && typeof from.currency === "string" && RATES[from.currency] && from.currency !== "SGD"
        ? { amount: from.amount, currency: from.currency }
        : null,
    directions: listOf(
      x.directions,
      DIRECTIONS.map((d) => d.id),
    ).slice(0, MAX_DIRECTIONS),
    maxMonths: intIn(x.maxMonths, 6, 48),
    noTests: x.noTests === true,
    recognition: x.recognition === true,
    after: oneOf(x.after, ["home", "abroad"] as const),
    qsMax: intIn(x.qsMax, 1, 1500),
    priorities: listOf(x.priorities, PRIORITIES),
    worries: listOf(x.worries, WORRIES),
    career: career || null,
  };
}

// The hedging words the site never writes (G5, the same lists as scripts/check-stand.ts), with the Traditional forms,
// and the Chinese for promising or rating an admission decision (lib/rai.ts holds the English).
const HEDGE_EN = /\b(may|might|could|likely|unlikely|probably|perhaps|possibly|usually|typically|generally|tend to|approximately|roughly|(?:about|around) (?:\S*\d|one|two|three|four|five|ten|half))\b/i;
const HEDGE_ZH = /可能|或许|或許|也许|也許|大概|应该会|應該會|一般来说|一般來說|通常|可以考虑|可以考慮|不妨/;
// A promise, not the caveat that there is none ("不保证录取" stays).
const ADMISSION_ZH = /(?<!不|无法|無法|不能|没法|沒法|无|無)(?:保证|保證)|保录|保錄|包录|包錄|录取率|錄取率|概率|機率|几率|幾率|一定能|肯定能|稳上|穩上/;
// The facts' own wording for a gap ("IELTS not stated"), and the list's numbers ("pick 3", "第 3 号"): the plan says
// nothing about what the data doesn't give, and names programmes by their names.
const NOT_STATED = /not stated|where stated|未列明|未写明|未寫明|未注明|未註明|未说明|未說明|未标明|未標明|\b(?:pick|candidate|no\.)\s*#?\d|第\s*\d+\s*[号號]/i;
const CJK = /[㐀-鿿]/;
const NUMBER = /\d+(?:[.,]\d+)*/g;
const plain = (n: string) => String(Number(n.replace(/,/g, "")));

/** A line in the page's language: Chinese pages take lines with Chinese in them, English pages lines without. */
export const inLanguage = (line: string, locale: string) => (locale === "en" ? !CJK.test(line) : CJK.test(line));

/**
 * The numbers a written line may use: the family's own (in their text, and as the reader recorded them: the budget as
 * written, the longest length, the QS rank), the candidates' facts (QS rank, months and years, IELTS, intake months),
 * this year and the next three, and 1 to 3 for counting.
 */
export function allowedNumbers(text: string, candidates: Candidate[], today: Date, needs?: FamilyNeeds): Set<string> {
  const out = new Set<string>();
  const add = (v: number | string | null | undefined) => {
    if (v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(String(v).replace(/,/g, "")))) out.add(plain(String(v)));
  };
  [1, 2, 3].forEach(add);
  if (needs) [needs.budgetFrom?.amount, needs.budgetSgd, needs.maxMonths, needs.qsMax].forEach(add);
  for (let y = today.getFullYear(); y <= today.getFullYear() + 3; y++) add(y);
  for (const n of text.match(NUMBER) ?? []) add(n);
  for (const c of candidates) {
    for (const q of c.qs?.replace(/^=/, "").split("-") ?? []) add(q);
    add(c.months);
    if (c.months) add(c.months / 12);
    add(c.ielts);
    c.intake.forEach(add);
  }
  return out;
}

/** A written line the page may show: no admission wording, no hedging, nothing about a gap in the data, and only numbers it was given. */
export function lineOk(line: string, allowed: Set<string>): boolean {
  if (bannedWording(line) || HEDGE_EN.test(line) || HEDGE_ZH.test(line) || ADMISSION_ZH.test(line) || NOT_STATED.test(line)) return false;
  return (line.match(NUMBER) ?? []).every((n) => allowed.has(plain(n)));
}
