// Where a programme's admitted students usually are, on the UK class scale, worked out from what the
// programme and its university publish: the minimum it states, its own words about who it admits,
// official applications per place, whether it says entry is competitive, and the university's QS
// rank. It describes the programme and where a student's result sits against it; it is never a
// chance of admission, and every step it takes is listed with the card's figures.

import { fourToUkMark } from "./gpa4";
import type { Rank } from "./grades";

/** Steps on the UK class scale, as each one's lowest mark: Third 40, 2:2 50, 2:1 60, high 2:1 65, First 70. */
export const LEVELS = [40, 50, 60, 65, 70] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_NAME: Record<Level, string> = { 40: "Third", 50: "2:2", 60: "2:1", 65: "High 2:1", 70: "First" };
export const RANK_LEVEL: Record<Rank, Level> = { 1: 70, 2: 60, 3: 50, 4: 40 };
/** The highest mark inside each class: a 2:1 given without a mark may be anything from 60 to 69. */
const CLASS_TOP: Record<Rank, number> = { 1: 100, 2: 69, 3: 59, 4: 49 };

/** The step a UK mark falls in. */
export const levelOf = (mark: number): Level => [...LEVELS].reverse().find((l) => mark >= l) ?? 40;
/** `rungs` steps up the scale, no higher than a First. */
export const stepUp = (l: Level, rungs: number): Level => LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(l) + rungs)];

/** UK classes as requirements name them, lowest first: Roman numerals, Hong Kong and New Zealand divisions, Australian honours bands. */
export const NAMED_CLASSES: [RegExp, Level][] = [
  [/\bthird[- ]class\b|\b3rd[- ]class\b/i, 40],
  // A plain "second class" (UK, Hong Kong) covers the 2:2 as well; Ireland's "strong second class" and "Grade I" are a 2:1.
  [/\b2[:.]2\b|\b2\s?\(ii\)|\bII[:.]\s?(?:2|ii)\b|lower second|second[- ]class[^.;,]{0,25}\blower\b|\b(?:second|2nd)[- ]lower\b|\blower division\b|\bsecond division\b|\bdivision (?:two|2|ii)\b|\bH2B\b|\bIIB\b|second[- ]class honou?rs,?\s*\(?grade (?:2|ii|two)\b|\b(?<!(?:strong|upper|lower|high) )second[- ]class\b(?!(?:[^.;]|\.(?=\d)){0,30}(?:\b(?:upper|lower|division|grade|div)\b|\bH?2[:.]?[12]\b))/i, 50],
  [/\b2[:.]1\b|\b2\s?\(i\)|\bII[:.]\s?(?:1|i)\b|upper second|second[- ]class[^.;,]{0,25}\bupper\b|\b(?:second|2nd)[- ]upper\b|\bupper division\b|\bfirst division\b|\bdivision (?:one|1|i)\b|\bH2A\b|\bIIA\b|\b2A honou?rs|\bstrong second[- ]class\b|second[- ]class honou?rs,?\s*\(?grade (?:1|i|one)\b/i, 60],
  // "a First" as a class, not "a first degree" (a bachelor's).
  [/\bfirst[- ]class\b|\b1st[- ]class\b|\bH1\b|(?<=\b(?:a|an|with|hold(?:s|ing)?|ha(?:ve|s|d)|achiev(?:e|ed|ing)|obtain(?:ed)?|award(?:ed)?)\s+)firsts?\b(?!\s*[-–]?\s*(?:degree|year|time|language|name|step|semester|round|cycle|of|in|qualification|bachelor|undergraduate|university|honours degree)\b)/i, 70],
];
/** A 2:1 with "high", "strong" or "good" before it (65% or more, as KCL and UCL word it). */
export const HIGH_TWO_ONE = /\b(?:high|strong|good|very good)\s+(?:2[:.]1\b|upper second|II[:.]\s?(?:1|i)\b|2\(i\))/i;

/** The lowest class a text names; a 2:1 named only as a high or strong one is a high 2:1. */
export function lowestNamed(text: string): Level | null {
  const found = NAMED_CLASSES.filter(([re]) => re.test(text)).map(([, l]) => l);
  if (!found.length) return null;
  const l = Math.min(...found) as Level;
  if (l !== 60 || !HIGH_TWO_ONE.test(text)) return l;
  return NAMED_CLASSES[2][0].test(text.replace(new RegExp(HIGH_TWO_ONE.source, "gi"), " ")) ? 60 : 65;
}

/**
 * A level named in a sentence about who is admitted ("Nearly all successful applicants hold a First
 * Class degree", "preferably 2nd Upper and above"): the lowest one it names, as a class, one of
 * Singapore's honours grades (Merit 2:2, Distinction 2:1), or a 4-point GPA read with the Hong Kong
 * honours bands (lib/grades.ts): 3.6 First, 3.0 2:1, 2.5 2:2.
 */
export function levelNamed(sentence: string): Level | null {
  const found: Level[] = [];
  const named = lowestNamed(sentence);
  if (named !== null) found.push(named);
  if (/honou?rs[^.;]{0,6}\(?\s*(?:with\s+)?merit|\bmerit\s*\/\s*second class/i.test(sentence)) found.push(50);
  const g = /\b(?:GPA|grade point average)[^.\d]{0,40}?([0-4]\.\d{1,2})(?:\s*(?:\/|out of|on a)\s*(4(?:\.0)?|4\.3))?/i.exec(sentence);
  if (g) {
    const v = Number(g[1]) * (g[2] && Number(g[2]) === 4.3 ? 4 / 4.3 : 1);
    found.push(v >= 3.6 ? 70 : v >= 3 ? 60 : v >= 2.5 ? 50 : 40);
  }
  return found.length ? (Math.min(...found) as Level) : null;
}

/** What the pipeline found on a programme's own pages (scripts/pipeline/admit-evidence.ts). */
export type AdmitEvidence = {
  /** The programme's own words about who it admits, and the level they name. */
  stated?: { level: Level; quote: string; url: string };
  /** Official applications and places for one intake or a few years' average (LSE, Oxford). */
  stats?: { applications: number; places: number; year: string | null; quote: string; url: string };
  /** The page says entry is competitive, or that meeting the minimum doesn't guarantee a place. */
  competitive?: { quote: string; url: string };
};

/** One input behind a range, to show with it. */
export type AdmitFrom =
  | { k: "stated"; quote: string; url: string }
  | { k: "cases"; n: number; p25: number }
  | { k: "stats"; applications: number; places: number; year: string | null; url: string }
  | { k: "competitive"; quote: string }
  | { k: "qs"; rank: number }
  | { k: "minimum" };

export type AdmitRange = {
  /** The lowest result the programme accepts (40: a bachelor's of any class), or null when its page states no requirement. */
  floor: Level | null;
  /** The requirement without its other routes in ("a 2:1; a 2:2 with work experience may be considered" → 2:1). */
  main: Level | null;
  /** Admitted students usually have this result or more. */
  usual: Level;
  /** "published": the programme says so; "cases": from reported admitted students' GPAs; "statistics": from its applications per place; "estimate": from its wording and QS rank; "minimum": nothing suggests more than the minimum. */
  basis: "published" | "cases" | "statistics" | "estimate" | "minimum";
  from: AdmitFrom[];
};

/** Reported admitted students needed before their GPAs set the usual level. */
export const CASES_MIN = 20;

/** Applications per place: from 10 two steps above the minimum, from 5 one step. */
export const RATIO_TWO = 10;
export const RATIO_ONE = 5;
/** QS ranks that count as selective without other evidence: the top 50 one step, the top 10 with competitive wording two. */
export const QS_ONE = 50;
export const QS_TWO = 10;

/**
 * The range, in this order of evidence:
 * 1. The programme's own words about who it admits: their level (never below the minimum).
 * 2. Reported admitted students (CASES_MIN or more): the level three quarters of them reach, their GPA on the
 *    4-point scale put back on the UK scale (lib/gpa4.ts), never below the minimum.
 * 3. Official applications per place: 10 or more, two steps above the minimum; 5 to 10, one step.
 * 4. Otherwise its wording and the university's rank: competitive wording or the QS top 50, one step;
 *    both competitive wording and the QS top 10, two steps.
 * 5. Otherwise the minimum itself.
 */
export function admitRange(x: {
  floor: Level | null;
  main?: Level | null;
  evidence: AdmitEvidence | undefined;
  qs: number | null;
  /** Reported admitted students' GPA on the 4-point scale: how many, and the 25th percentile. */
  cases?: { n: number; p25: number } | null;
}): AdmitRange {
  // Steps count from the main requirement, not from a lower route in ("a 2:2 with work experience").
  const base = x.main ?? x.floor ?? 40;
  const e = x.evidence ?? {};
  const floor = x.floor;
  const main = x.main ?? x.floor;
  if (e.stated) return { floor, main, usual: Math.max(base, e.stated.level) as Level, basis: "published", from: [{ k: "stated", quote: e.stated.quote, url: e.stated.url }] };
  if (x.cases && x.cases.n >= CASES_MIN)
    return { floor, main, usual: Math.max(base, levelOf(fourToUkMark(x.cases.p25))) as Level, basis: "cases", from: [{ k: "cases", n: x.cases.n, p25: x.cases.p25 }] };
  if (e.stats && e.stats.places > 0) {
    const ratio = e.stats.applications / e.stats.places;
    const rungs = ratio >= RATIO_TWO ? 2 : ratio >= RATIO_ONE ? 1 : 0;
    return {
      floor,
      main,
      usual: stepUp(base, rungs),
      basis: "statistics",
      from: [{ k: "stats", applications: e.stats.applications, places: e.stats.places, year: e.stats.year, url: e.stats.url }],
    };
  }
  const from: AdmitFrom[] = [];
  if (e.competitive) from.push({ k: "competitive", quote: e.competitive.quote });
  const ranked = x.qs !== null && x.qs <= QS_ONE;
  if (ranked) from.push({ k: "qs", rank: x.qs! });
  const rungs = e.competitive && x.qs !== null && x.qs <= QS_TWO ? 2 : e.competitive || ranked ? 1 : 0;
  if (!rungs) return { floor, main, usual: base, basis: "minimum", from: [{ k: "minimum" }] };
  return { floor, main, usual: stepUp(base, rungs), basis: "estimate", from };
}

/**
 * Where a student's result sits against a range:
 * "below" under the minimum; "edge" at the minimum only if their result is high in its class;
 * "meets" at or over the minimum, under the usual level; "near" in the usual range if their result is
 * high in its class; "in" in the usual range. `mark` is the result as a UK mark when it is known
 * from a mark or GPA; a class alone covers its whole band (a 2:1 is 60 to 69).
 */
export type Standing = "below" | "edge" | "meets" | "near" | "in";

export function standing(r: AdmitRange, you: { rank: Rank; mark: number | null }): Standing {
  const lo = you.mark ?? RANK_LEVEL[you.rank];
  const hi = you.mark ?? CLASS_TOP[you.rank];
  if (r.floor !== null && hi < r.floor) return "below";
  if (lo >= r.usual) return "in";
  if (hi >= r.usual) return "near";
  if (r.floor !== null && lo < r.floor) return "edge";
  return "meets";
}

/** In the usual range, or possibly (a class whose band reaches it). */
export const inUsual = (s: Standing | null) => s === "in" || s === "near";
