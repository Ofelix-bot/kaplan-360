// The fixed tables the Competitiveness Index reads, each from its own file in data/raw/stand with its
// source: the English test and GMAT concordances, the related-discipline pairs and the university-wide
// rules that close entry to a three-year Australian pass degree.

import concordance from "@/data/raw/stand/concordance.json";
import degreeTypeRules from "@/data/raw/stand/degree-type-rules.json";
import related from "@/data/raw/stand/related-disciplines.json";
import type { EnglishTestTaken } from "./types";

// ---------- English tests on the IELTS scale ----------

/** The highest value whose row the score reaches; rows are [lowest score, value], best first. */
const reached = (rows: number[][], score: number): number | null => rows.find(([min]) => score >= min)?.[1] ?? null;

/**
 * A TOEFL iBT total on the 1–6 scale (21 January 2026 on). A total above 6 is on the 0–120 scale and is
 * first read with ETS's comparison of the two scales.
 * Source: ETS, https://www.ets.org/content/ets-org/ca/en/toefl/institutions/ibt/score-scale-update.html
 */
export const toeflSix = (score: number): number => (score > 6 ? (reached(concordance.toefl.from120, score) ?? 1) : score);

/**
 * A score as an IELTS Academic band: IELTS as it is; TOEFL iBT through ETS's TOEFL (1–6)–IELTS table (same
 * page as above); PTE Academic through Pearson's concordance (https://www.pearsonpte.com/the-test/scores/,
 * updated with the study published in July 2025). Below each table's last row: half a band under it.
 * Duolingo has no concordance here (null).
 */
export function ieltsEquivalent(test: EnglishTestTaken, score: number): number | null {
  if (test === "ielts") return score;
  if (test === "toefl") return reached(concordance.toefl.ielts, toeflSix(score)) ?? 3.5;
  if (test === "pte") return reached(concordance.pte.ielts, score) ?? 4;
  return null;
}

export const CONCORDANCE_SOURCES = { toefl: concordance.toefl.source, pte: concordance.pte.source, gmat: concordance.gmat.source };

// ---------- GMAT on the Focus Edition scale ----------

/** A score ending in 5 is a GMAT Focus Edition score (205–805); any other a 10th Edition (classic) one (200–800): Kaplan 360++'s rule. */
export const isGmatFocus = (score: number): boolean => Math.round(score) % 10 === 5;

/** Each 10th Edition total (200, 210 … 800) and the middle of the Focus Edition totals GMAC's table pairs it with. */
const CLASSIC_TO_FOCUS: [number, number][] = (() => {
  const paired = new Map<number, number[]>();
  for (const [tenth, focus] of concordance.gmat.rows) paired.set(tenth, [...(paired.get(tenth) ?? []), focus]);
  return [...paired].map(([tenth, f]): [number, number] => [tenth, (Math.min(...f) + Math.max(...f)) / 2]).sort((a, b) => a[0] - b[0]);
})();

/**
 * A GMAT total on the Focus Edition scale: a Focus Edition score as it is; a 10th Edition score through
 * GMAC's concordance table (https://go.gmac.com/hubfs/07.Assessments/GMAT%20Exam/GMAT_Total_Concordance_Aug2026.pdf),
 * the middle of the Focus scores the table pairs it with, straight lines between its rows (a median of
 * reported scores falls between them).
 */
export function gmatFocus(score: number): number {
  if (isGmatFocus(score)) return score;
  const rows = CLASSIC_TO_FOCUS;
  if (score <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) {
    const [x0, y0] = rows[i - 1];
    const [x1, y1] = rows[i];
    if (score <= x1) return y0 + ((score - x0) / (x1 - x0)) * (y1 - y0);
  }
  return rows[rows.length - 1][1];
}

// ---------- Related disciplines ----------

export type RelatedPair = { a: string; b: string; reason: string };
/** Kaplan 360++'s table of related disciplines among Kaplan's 13 (data/raw/stand/related-disciplines.json), both ways. */
export const RELATED_PAIRS: RelatedPair[] = related.pairs;
const RELATED = new Map<string, RelatedPair>();
for (const p of RELATED_PAIRS) {
  RELATED.set(`${p.a}|${p.b}`, p);
  RELATED.set(`${p.b}|${p.a}`, p);
}
/** The pair joining two disciplines, or null (also for the same discipline). */
export const relatedPair = (x: string, y: string): RelatedPair | null => RELATED.get(`${x}|${y}`) ?? null;

// ---------- Degree type ----------

/** A university's own row for the country that awards the degree: "any" names a bachelor's of any length or type, "honours" an honours degree. */
export type CountryDegreeRule = { country: string; rule: "any" | "honours"; quote: string; url: string };
export type DegreeTypeRule = {
  source: "programme" | "university";
  rule: "four-year" | "honours";
  quote: string;
  url: string;
  university?: string;
  /** University rows only: its rule for each awarding country it names (data/raw/stand/degree-type-rules.json byAwardingCountry). */
  byAwardingCountry?: CountryDegreeRule[];
};

/** University-wide rows from data/raw/stand/degree-type-rules.json (confirmed verbatim on 2026-10-25; awarding-country rows 2026-10-26), by the university's name. */
const UNIVERSITY_RULES = new Map(degreeTypeRules.rules.map((r) => [r.university, r]));

const FOUR_YEAR = /\b(?:four|4)[- ]year\b/i;
/** "Bachelor (Honours) degree", "bachelor's degree with honours", "an honours degree", "Bachelor Honours Degree". */
const HONOURS =
  /\bbachelor(?:['’]?s)?(?: degree)?\s*(?:\(\s*honou?rs\s*\)|with honou?rs)|\bhonou?rs (?:bachelor|degree)|\bbachelor honou?rs\b|\bembedded honou?rs\b/i;
/** Wording that leaves a three-year or pass degree a way in: it names one, or says honours is only preferred. */
const THREE_YEAR = /\b(?:three|3)[- ]year|\bpreferabl|\bpass degree|\bordinary degree/i;
/** An Australian bachelor's at AQF level 7 (a pass degree) named as a route, unless it is a four-year one. */
const AQF_SEVEN = /\bbachelor[^.;]{0,20}\(?\s*AQF\s*(?:level\s*)?7\b/i;
/** A plain bachelor's as a route of its own ("a recognised bachelor's degree"), not one qualified as four-year or honours. */
const PLAIN_BACHELOR =
  /(?<!(?:four|4)[- ]year\s|honou?rs\s)\b(?:a|an|any|completed|recognised|recognized|relevant|good)\s+(?:(?:completed|recognised|recognized|relevant|good|undergraduate|first)\s+)*bachelor(?:['’]?s)?(?:\s+degree)?(?!\s*(?:\(\s*honou?rs|with honou?rs|honou?rs|\(hons))/i;
/** The stored text stops at "or": further routes in were not captured, so the text alone cannot close entry. */
const CUT_AT_OR = /\bor\s*[.:;,]?\s*$/i;
/** lib/data/results.ts keeps the first 280 characters of a requirement: routes after the cut are not seen, so a text that long cannot close entry. */
const KEPT = 280;
/** UK and Irish requirements name honours classes ("2:1 honours degree or equivalent"); a three-year degree enters there through the grade equivalence instead. */
const CLASS_SYSTEMS = new Set(["United Kingdom", "Ireland"]);

/**
 * The rule, if any, that closes a programme to a three-year Australian pass degree: first its own
 * requirement text (a four-year bachelor's, or an honours degree outside the UK and Ireland, with no
 * three-year, pass or plain bachelor's route beside it), then its university's verified row.
 */
export function degreeTypeRule(text: string | null, country: string, university: string): DegreeTypeRule | null {
  const open = (t: string) => THREE_YEAR.test(t) || PLAIN_BACHELOR.test(t) || (AQF_SEVEN.test(t) && !FOUR_YEAR.test(t));
  if (text && text.length < KEPT && !open(text) && !CUT_AT_OR.test(text.trim())) {
    if (FOUR_YEAR.test(text)) return { source: "programme", rule: "four-year", quote: text, url: "" };
    if (!CLASS_SYSTEMS.has(country) && HONOURS.test(text)) return { source: "programme", rule: "honours", quote: text, url: "" };
  }
  const u = UNIVERSITY_RULES.get(university);
  return u
    ? { source: "university", rule: u.rule as DegreeTypeRule["rule"], quote: u.quote, url: u.url, university: u.university, byAwardingCountry: u.byAwardingCountry as CountryDegreeRule[] }
    : null;
}
