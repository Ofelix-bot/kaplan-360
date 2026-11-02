// Degree results on one common scale, the UK classification (1 First, 2 2:1, 3 2:2, 4 Third or below),
// so a Kaplan graduate's result can be set beside a master's entry requirement written in another
// system. Each partner university's own grading scheme, and the cross-system equivalences, are in
// data/raw/grading-schemes.json with their official sources. Conversions are approximate and say so.
// A result given as a mark or GPA is also kept as a UK mark, so a high 2:1 (65% or more) can be told
// apart from a 2:1 (lib/admit-range.ts).

import grading from "@/data/raw/grading-schemes.json";
import { levelOf, lowestNamed as lowest, type Level } from "@/lib/admit-range";
import { academicStructured } from "@/lib/pipeline/requirements";
import type { AcademicStructured } from "@/lib/pipeline/types";
import type { Classification } from "@/lib/plan-storage";

export type Rank = 1 | 2 | 3 | 4;
export const RANK_NAME: Record<Rank, string> = { 1: "First", 2: "2:1", 3: "2:2", 4: "Third" };

type Scheme =
  | { system: "uk-class"; classMin: Record<string, number> }
  | { system: "ie-gpa"; gpaScale: number; classGpaMin: Record<string, number>; sources?: { url: string }[] }
  | { system: "au-grades"; bands: Record<string, number>; gpaScale: number; gradeValues: Record<string, number> };

const SCHEMES = grading.schemes as unknown as Record<string, Scheme>;
const EQ = grading.equivalences;

/** The grading system a Kaplan partner uses, by the university's name. */
export function schemeOf(university: string | null | undefined): Scheme | null {
  return university ? (SCHEMES[university] ?? null) : null;
}

export type GpaClass = { key: "first" | "2:1" | "2:2" | "pass"; scale: number; url: string };

/**
 * A GPA's honours class under the student's own university's published bands, with the page they are
 * from: only for a GPA scheme that has its source (UCD's award classification). Below the lowest band,
 * or for any other university, null: no class is worked out where none is published.
 */
export function gpaClass(university: string | null | undefined, gpa: number | null): GpaClass | null {
  const s = schemeOf(university);
  const url = s?.system === "ie-gpa" ? s.sources?.[0]?.url : undefined;
  if (s?.system !== "ie-gpa" || !url || gpa === null) return null;
  const key = (["first", "2:1", "2:2", "pass"] as const).find((k) => s.classGpaMin[k] !== undefined && gpa >= s.classGpaMin[k]);
  return key ? { key, scale: s.gpaScale, url } : null;
}

/** A UK/Irish/Hong Kong/Singapore percentage mark as a class. */
const ukMarkRank = (m: number): Rank => (m >= EQ.ukMarks.min.first ? 1 : m >= EQ.ukMarks.min["2:1"] ? 2 : m >= EQ.ukMarks.min["2:2"] ? 3 : 4);
/** An Australian average mark (WAM) as a UK class, following UK universities' published equivalences. */
const auMarkRank = (m: number): Rank => (m >= EQ.auToUk.min.first ? 1 : m >= EQ.auToUk.min["2:1"] ? 2 : m >= EQ.auToUk.min["2:2"] ? 3 : 4);
/** A 4-point GPA as a UK class (Hong Kong honours bands). */
const gpa4Rank = (g: number): Rank => (g >= EQ.gpa4ToUk.min.first ? 1 : g >= EQ.gpa4ToUk.min["2:1"] ? 2 : g >= EQ.gpa4ToUk.min["2:2"] ? 3 : 4);
/** A 7-point GPA (Australia) as a UK class. */
const gpa7Rank = (g: number): Rank => (g >= EQ.gpa7ToUk.min.first ? 1 : g >= EQ.gpa7ToUk.min["2:1"] ? 2 : g >= EQ.gpa7ToUk.min["2:2"] ? 3 : 4);

/** Straight lines between published points ([from, UK mark]), flat beyond the last one. */
function along(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1] - (points[0][0] - x);
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}
/** An Australian average mark as a UK mark, through the published class points (a pass at 50 reads as a Third). */
export const auToUkMark = (m: number) => along([[50, 40], [EQ.auToUk.min["2:2"], 50], [EQ.auToUk.min["2:1"], 60], [EQ.auToUk.min.first, 70], [100, 80]], m);
/** An Australian 7-point GPA as a UK mark, through the published class points (7 a First, 6 a 2:1, 5 a 2:2). */
export const gpa7ToUkMark = (g: number) => along([[4, 40], [EQ.gpa7ToUk.min["2:2"], 50], [EQ.gpa7ToUk.min["2:1"], 60], [EQ.gpa7ToUk.min.first, 70]], g);

const CLASS_TO_RANK: Record<Exclude<Classification, "unsure">, Rank> = { first: 1, "2:1": 2, "2:2": 3, third: 4 };

/** The Australian average-mark bands behind each UK class (EQ.auToUk), as the results page offers them. */
export const AU_BAND: Record<Rank, string> = {
  1: `average ${EQ.auToUk.min.first}% or more`,
  2: `average ${EQ.auToUk.min["2:1"]}–${EQ.auToUk.min.first - 1}%`,
  3: `average ${EQ.auToUk.min["2:2"]}–${EQ.auToUk.min["2:1"] - 1}%`,
  4: `average below ${EQ.auToUk.min["2:2"]}%`,
};

/** `mark`: the result as a UK mark when it came from a mark or GPA (a class alone leaves it null). */
export type Converted = { rank: Rank; basis: string; mark: number | null };

/**
 * The student's expected result as a UK class, from what they gave in their own university's terms:
 * a class (UK, Irish), an average mark (any) or a GPA (UCD on 4.2; Murdoch and Monash on 4).
 */
export function studentRank(
  university: string | null | undefined,
  a: { classification: Classification | null; averageMark: number | null; degreeGpa: number | null },
): Converted | null {
  const s = schemeOf(university);
  // A GPA on the university's own scale says more than the class it falls in.
  if (s?.system === "ie-gpa" && a.degreeGpa != null) {
    const g = a.degreeGpa;
    const m = s.classGpaMin;
    const rank: Rank = g >= m.first ? 1 : g >= m["2:1"] ? 2 : g >= m["2:2"] ? 3 : 4;
    const mark = along([[m["2:2"] - (m["2:1"] - m["2:2"]), 40], [m["2:2"], 50], [m["2:1"], 60], [m.first, 70], [s.gpaScale, 80]], g);
    return { rank, basis: `GPA ${g}/${s.gpaScale}`, mark };
  }
  if (a.classification && a.classification !== "unsure" && (!s || s.system !== "au-grades")) {
    const rank = CLASS_TO_RANK[a.classification];
    // A mark given with the class places it inside the class.
    const mark = a.averageMark != null && s?.system !== "ie-gpa" && ukMarkRank(a.averageMark) === rank ? a.averageMark : null;
    return { rank, basis: mark !== null ? `average ${mark}%` : RANK_NAME[rank], mark };
  }
  if (s?.system === "au-grades") {
    let mark = a.averageMark;
    let basis = mark != null ? `average ${mark}%` : "";
    if (mark == null && a.degreeGpa != null) {
      // The university's own grade values back to the lower edge of each mark band, in between proportionally.
      const steps = (["HD", "D", "C", "P"] as const).map((k) => [s.gradeValues[k], s.bands[k]] as const);
      const g = a.degreeGpa;
      const hi = steps.find(([v]) => v <= g) ?? steps[steps.length - 1];
      const lo = steps[steps.indexOf(hi) - 1];
      mark = lo ? hi[1] + ((g - hi[0]) / (lo[0] - hi[0])) * (lo[1] - hi[1]) : hi[1];
      basis = `GPA ${g}/${s.gpaScale}`;
    }
    if (mark != null) return { rank: auMarkRank(mark), basis, mark: auToUkMark(mark) };
    // A band chosen on the results page, as the UK class it stands for.
    if (a.classification && a.classification !== "unsure") {
      const rank = CLASS_TO_RANK[a.classification];
      return { rank, basis: AU_BAND[rank], mark: null };
    }
    return null;
  }
  if (a.averageMark != null) return { rank: ukMarkRank(a.averageMark), basis: `average ${a.averageMark}%`, mark: a.averageMark };
  return null;
}

// ---------- Requirements ----------

/** The letter grade a requirement names, on a 4-point scale ("C+ or above" → 2.3, "a B+ Grade Point Average" → 3.3). */
function letterRequirement(text: string): { letter: string; gpa: number } | null {
  const m =
    /\b(?:grade|average|overall|result|GPA)[^.]{0,40}?\b([ABC][+-]?)\s*(?:or\s+(?:above|better|higher))/i.exec(text) ??
    /\b([ABC][+-]?)\s+or\s+(?:above|better)\b/.exec(text) ??
    /\b([ABC][+-]?)\s+(?:[Gg]rade [Pp]oint [Aa]verage|GPA|[Aa]verage)\b/.exec(text) ??
    /\baverage (?:grade )?of (?:at least )?(?:an? )?["“]?([ABC][+-]?)["”]?(?=[\s,.;)])/.exec(text) ??
    /\baverage in the ([ABC][+-]?) range\b/.exec(text) ??
    // "a minimum average of 75% (B+)": the letter beside the percentage, in its own system.
    /\baverage of (?:at least )?\d{2}(?:\.\d)?\s*%\s*\(([ABC][+-]?)\)/.exec(text);
  const values = EQ.letterGpa4.values as Record<string, number>;
  return m && values[m[1].toUpperCase()] != null ? { letter: m[1].toUpperCase(), gpa: values[m[1].toUpperCase()] } : null;
}

/** Where a requirement turns to other ways in: classes named after this are alternatives, not the main requirement. */
const ALTERNATIVE =
  /\b(?:(?:may|will|can) (?:also )?be (?:considered|accepted)|deemed sufficient|considered on (?:a|an) (?:case|individual)|exceptional(?:ly)?|in exceptional|on an individual basis|alternatively|although|however|applicants (?:with|holding|who hold) (?:a |an )?(?:2[:.]2|lower second|third|lower))/i;
/** A sentence about the students admitted ("The mean undergraduate grade point average of entering students is 3.6"): who is admitted, not the minimum. */
const CLASS_FIGURE = /\b(?:mean|average|median)\b[^.]{0,50}\b(?:of|for|among) (?:our |the )?(?:entering|admitted|incoming|enrolled|accepted|current) (?:students|class|cohort)\b/i;

/** "A good degree", "a good honours degree", "a good Bachelor's degree" (not "good command of English", "in good standing"). */
export const GOOD_DEGREE =
  /\bgood\s+(?:(?:first|undergraduate|bachelor'?s?|bachelors|honou?rs|university|four-year|4-year|UK|relevant|academic|overseas|recognised|recognized)\s+){0,3}(?:degree|bachelor)|\bwith good honou?rs\b|\bgood honou?rs\b/i;
/** Wording that asks for more than a good degree. */
const STRONG_DEGREE = /\b(?:very good|strong|excellent|outstanding|exceptional)\s+(?:(?:undergraduate|bachelor'?s?|honou?rs|academic|first)\s+){0,2}(?:degree|record|results|grades|GPA|performance)\b/i;

/**
 * How a university reads "a good degree": "own-words" when another of its requirements names the class
 * beside the phrase (`quote`); "most-programmes" when most of its other requirements (`n` of `of`) ask
 * for that class; "word" otherwise, as a 2:2, the least a good degree means on any reading.
 */
export type GoodReading = { level: Level; how: "own-words" | "most-programmes" | "word"; quote?: string; n?: number; of?: number };

/**
 * "(preferably a 2:1)", "preferably with Honours: Merit": a preference, read as who is usually admitted (lib/admit-range.ts), not as the minimum.
 * It ends at ", with" too: "preferably in Science, …, or a related discipline, with a grade point average of at least B" (NUS) still asks for the B.
 */
const PREFERENCE = /\(?\s*\bpreferabl[ey]\b[^.;)]*?(?=,\s+with\b|[.;)]|$)\)?/gi;
/**
 * A requirement without text that names classes only to explain them ("Our entry requirements are listed
 * using standard UK undergraduate degree classifications i.e. first-class honours, upper second-class
 * honours and lower second-class honours", Loughborough).
 */
export const requirementWords = (text: string) => text.replace(/\bi\.e\./gi, "ie").replace(/[^.]*\blisted using (?:the )?standard UK (?:undergraduate )?degree classifications\b[^.]*\.?/gi, " ");

/** Grades to keep once enrolled ("a cumulative GPA of at least 3.0 to graduate"), and words of admission. */
const PROGRESS = /\b(?:to graduate|eligible to graduate|satisfactory (?:academic )?progress|to remain in|good standing|to continue in|academic probation|must complete a total of)\b/i;
const ADMISSION = /\b(?:admission|admitted|entry|applicants?|apply|application)\b/i;
/** Systems whose percentage marks read like the UK's (EQ.ukMarks). */
const UK_MARKS = new Set(["United Kingdom", "Ireland", "Hong Kong SAR", "Singapore", "Macau SAR"]);

export type RequirementLevel = Converted & {
  /** The lowest result any route in accepts, as a step on the UK scale. */
  floor: Level;
  /** The requirement before any alternatives ("a 2:1; applicants with a 2:2 may be considered" → 2:1). */
  main: Level;
};

/**
 * A master's academic requirement on the UK scale, from its own wording: a class (Roman numerals,
 * divisions and honours bands included; Hong Kong's "Second Class Honours" means at least a 2:2),
 * Singapore's honours grades, a GPA (4, 4.2, 4.3 or 7 points), a letter grade, an Australian
 * "credit average", a percentage (read in the country's system), or "a good degree" (as the
 * university itself reads it, `good`). Null when it names none of these.
 */
export function requirementLevel(s: AcademicStructured, full: string, country: string | null, good?: GoodReading | null): RequirementLevel | null {
  const at = (floor: Level, basis: string, main: Level = floor): RequirementLevel => ({ rank: rankOfLevel(floor), basis, mark: null, floor, main: Math.max(main, floor) as Level });
  const text = requirementWords(full).replace(PREFERENCE, " ");
  const st = text === full ? s : academicStructured(text);
  const named = lowest(text);
  if (named !== null) {
    // The main requirement is what comes before the sentence that opens another route in.
    const cut = ALTERNATIVE.exec(text);
    const from = cut ? Math.max(text.lastIndexOf(". ", cut.index), text.lastIndexOf("; ", cut.index)) : -1;
    const main = cut ? (lowest(from > 0 ? text.slice(0, from + 1) : text.slice(0, cut.index)) ?? named) : named;
    return at(named, named === 65 ? "High 2:1" : RANK_NAME[rankOfLevel(named)], main);
  }
  if (/second[- ]class honou?rs|second class \(?honou?rs\)?|\bsecond[- ]class\b/i.test(text)) return at(50, "Second Class Honours");
  // Singapore's honours grades (NUS, NTU): Highest Distinction, Distinction, Merit.
  if (/highest distinction/i.test(text) && /honou?rs/i.test(text)) return at(70, "Honours (Highest Distinction)");
  if (/honou?rs[^.;]{0,6}\(?\s*(?:with\s+)?merit|merit\s*\/\s*second class|honou?rs merit/i.test(text)) return at(50, "Honours (Merit)");
  if (/honou?rs[^.;]{0,6}\(?\s*(?:with\s+)?distinction\b/i.test(text) && !/average/i.test(text)) return at(60, "Honours (Distinction)");
  // A grade the student must keep during the programme or to graduate is not an entry requirement,
  // and an admitted class's average is who gets in (scripts/pipeline/admit-evidence.ts), not the minimum.
  if ((PROGRESS.test(text) && !ADMISSION.test(text)) || CLASS_FIGURE.test(text)) return null;
  const gpa = st.gpa ?? gpaWithoutSlash(text, country);
  if (gpa) {
    const v = gpa.value;
    const r = gpa.scale === 7 ? gpa7Rank(v) : gpa.scale === 4 ? gpa4Rank(v) : gpa.scale === 4.3 ? gpa4Rank(v * (4 / 4.3)) : gpa.scale === 4.2 ? gpa4Rank(v * (4 / 4.2)) : null;
    if (r !== null) return at(rankLevel(r), `GPA ${v}/${gpa.scale}`);
  }
  const l = letterRequirement(text);
  if (l) return at(rankLevel(gpa4Rank(l.gpa)), `${l.letter} (${l.gpa}/4)`);
  if (/high distinction average|average (?:of|at) high distinction/i.test(text)) return at(70, "High Distinction average");
  if (/distinction average|average (?:of|at) distinction/i.test(text)) return at(60, "Distinction average");
  if (/credit average|average (?:of|at) credit|credit \(?(?:65|60)/i.test(text)) return at(50, "Credit average");
  // Percentages only where the system is known: an American or Canadian 70% is a B, not a First.
  const pct = st.percentage ?? wamWithoutPercent(text);
  if (pct != null && country === "Australia") return at(levelOf(auToUkMark(pct)), `${pct}%`);
  if (pct != null && country && UK_MARKS.has(country)) return at(levelOf(pct), `${pct}%`);
  if (GOOD_DEGREE.test(text) || STRONG_DEGREE.test(text)) {
    const g = good?.level ?? 50;
    return STRONG_DEGREE.test(text) ? at(Math.max(g, 60) as Level, "strong degree") : at(g, "good degree");
  }
  return null;
}

/** Each university's reading of "a good degree" (GoodReading), from all of its programmes' requirements. */
export function goodReadings(rows: { institution: string; text: string; country: string | null }[]): Map<string, GoodReading> {
  const own = new Map<string, { level: Level; quote: string }[]>();
  const mains = new Map<string, Level[]>();
  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => m.set(k, [...(m.get(k) ?? []), v]);
  for (const r of rows) {
    const text = r.text.replace(PREFERENCE, " ");
    const m = GOOD_DEGREE.exec(text);
    if (m) {
      // The class named right after the phrase, in the same sentence ("a good honours degree (2:1 or above)").
      const near = text.slice(m.index, m.index + m[0].length + 80).split(/[.;]\s/)[0];
      const l = lowest(near);
      if (l !== null) push(own, r.institution, { level: Math.max(l, 50) as Level, quote: near.trim() });
      continue;
    }
    const f = requirementLevel(academicStructured(r.text), r.text, r.country);
    if (f) push(mains, r.institution, f.main);
  }
  // The most common value; a tie goes to the lower class, so no one is left out on a guess.
  const mode = (xs: Level[]) => {
    const n = new Map<Level, number>();
    for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  };
  const out = new Map<string, GoodReading>();
  for (const inst of new Set([...own.keys(), ...mains.keys()])) {
    const said = own.get(inst);
    if (said?.length) {
      const [level] = mode(said.map((x) => x.level));
      out.set(inst, { level, how: "own-words", quote: said.find((x) => x.level === level)!.quote });
      continue;
    }
    // A good degree is at most a 2:1 on any reading, however high the university's usual minimum.
    const all = mains.get(inst) ?? [];
    const level = Math.min(mode(all)[0], 60) as Level;
    out.set(inst, level >= 50 ? { level, how: "most-programmes", n: all.filter((x) => x >= level).length, of: all.length } : { level: 50, how: "word" });
  }
  return out;
}

/** The class of a step (a high 2:1 is a 2:1). */
export const rankOfLevel = (l: Level): Rank => (l >= 70 ? 1 : l >= 60 ? 2 : l >= 50 ? 3 : 4);
const rankLevel = (r: Rank): Level => ({ 1: 70, 2: 60, 3: 50, 4: 40 })[r] as Level;

/** "a GPA of 3.0 on the 4-point scale"; a US or Canadian "minimum GPA of 3.0" (the 4-point scale is the norm there). */
function gpaWithoutSlash(text: string, country: string | null): { value: number; scale: number } | null {
  // Australia's 7-point GPA is often written without decimals ("a minimum GPA of 5/7").
  const seven = /(?:GPA|grade point average)[^0-9]{0,40}\b([4-7](?:\.\d{1,2})?)\s*(?:\/|out of)\s*7(?:\.0)?\b/i.exec(text);
  if (seven) return { value: Number(seven[1]), scale: 7 };
  const scaled = /(?:GPA|grade point average)[^0-9]{0,40}(\d\.\d{1,2})\s*on (?:a|the) (\d(?:\.\d)?)[- ]point/i.exec(text) ?? /\b(\d\.\d{1,2})\s*on (?:a|the) (\d(?:\.\d)?)[- ]point/i.exec(text);
  if (scaled && Number(scaled[1]) <= Number(scaled[2])) return { value: Number(scaled[1]), scale: Number(scaled[2]) };
  if (country === "United States" || country === "Canada") {
    // Not the scale itself ("GPA calculated on 4.0 scale").
    const m = /(?:GPA|grade point average)[^0-9.]{0,30}\b([1-3]\.\d{1,2}|4\.0)\b(?!\s*(?:-?\s*point|scale|grading))/i.exec(text);
    if (m) return { value: Number(m[1]), scale: 4 };
  }
  return null;
}

/** "a WAM of 65", "weighted average mark of at least 70" (no % sign). */
function wamWithoutPercent(text: string): number | null {
  const m = /\b(?:WAM|weighted average mark|average mark)\s*(?:of|:)?\s*(?:at least\s*|a minimum of\s*)?(\d{2})(?:\.\d)?\b(?!\s*(?:credit|points|units|cp))/i.exec(text);
  return m && Number(m[1]) >= 40 && Number(m[1]) <= 100 ? Number(m[1]) : null;
}

/** The older reader's shape: a class and the wording it came from (scripts/plan/test-grades.ts). */
export function requirementRank(s: AcademicStructured, text: string, country: string | null): Converted | null {
  const r = requirementLevel(s, text, country);
  return r ? { rank: r.rank, basis: r.basis, mark: null } : null;
}

/** The sources behind a conversion, for the card's tooltip. */
// Only the rules this comparison used: the student's own scheme, the Australian bands when either side
// is an Australian mark, and the GPA bands when the requirement is a GPA or a letter grade.
export function conversionNote(university: string | null | undefined, basis?: string | null, t: (s: string) => string = (s) => s): string {
  const s = schemeOf(university);
  const own = s ? `${university}: ${t(s.system === "uk-class" ? "UK classes by mark" : s.system === "ie-gpa" ? "classes by GPA on 4.2" : "grades by mark and GPA")}` : "";
  const au = s?.system === "au-grades" || /WAM|weighted average|credit average|distinction average/i.test(basis ?? "");
  const gpa7 = /\/\s*7\b/.test(basis ?? "");
  const gpa = !gpa7 && /gpa|\/\s*4|\b[A-C][+-]?\b/i.test(basis ?? "");
  return [own, au && t(EQ.auToUk.rule), gpa && t(EQ.gpa4ToUk.rule), gpa7 && t(EQ.gpa7ToUk.rule)].filter(Boolean).join(" · ");
}
