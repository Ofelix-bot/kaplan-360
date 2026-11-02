import type { AcademicStructured, EnglishScores } from "./types";

// Reads structured values from requirement text quoted from an official page. Shared by the app
// (curated records) and scripts/pipeline (collected records). Only what the text states is read.

/** Minimum UK classification, GPA (with its scale), percentage/average mark and "or equivalent". */
export function academicStructured(text: string): AcademicStructured {
  const classification = /\b2[:.]2\b|lower second/i.test(text)
    ? "2:2"
    : /\b2[:.]1\b|upper second/i.test(text)
      ? "2:1"
      : /first[- ]class/i.test(text)
        ? "First"
        : null;
  const g =
    /(?:GPA|grade point average|CGPA)[^0-9]{0,40}(\d\.\d{1,2})\s*(?:\/|out of|on a)\s*(\d(?:\.\d{1,2})?)/i.exec(text) ??
    /(\d\.\d{1,2})\s*(?:\/|out of)\s*(4(?:\.0)?|4\.3|5(?:\.0)?|7(?:\.0)?|9(?:\.0)?|10(?:\.0)?)\b/i.exec(text);
  const gpa = g && Number(g[1]) <= Number(g[2]) ? { value: Number(g[1]), scale: Number(g[2]) } : null;
  const pc = /(?:average|WAM|mark|grade|score)[^0-9%]{0,30}(\d{2}(?:\.\d)?)\s*(?:%|per ?cent|\/100|or (?:higher|above))/i.exec(text);
  const percentage = pc && Number(pc[1]) >= 40 && Number(pc[1]) <= 100 ? Number(pc[1]) : null;
  return { classification, gpa, percentage, orEquivalent: /equivalent/i.test(text) };
}

const IELTS = /IELTS[^.\n]{0,90}?\b([4-9](?:\.[05])?)\b(?!\s*(?:years?|months?|%|weeks?))/i;
const COMPONENT = [
  /([4-9](?:\.[05])?)\s*(?:or (?:above|higher|more)\s*)?(?:in|for|on|across)\s*(?:each|all|every|any)\b/i,
  /no (?:individual )?(?:component|band|sub-?(?:score|test)|element|skill|section|score|module)s?\s*(?:score\s*)?(?:below|lower than|less than|under)\s*([4-9](?:\.[05])?)/i,
  /(?:each|all|every) (?:component|band|element|skill|section|sub-?test|module)s?\s*(?:at|of)?\s*(?:least|minimum)?\s*(?:of\s*)?([4-9](?:\.[05])?)/i,
  /(?:reading|writing|listening|speaking)[^.]{0,70}?(?:at least|minimum(?: of)?|no less than|not less than|of)\s*([4-9](?:\.[05])?)/i,
];

/** IELTS overall and component minimum, TOEFL iBT total and section minimum, as the text states them. */
export function englishScores(text: string | null): EnglishScores | null {
  if (!text) return null;
  let ielts: EnglishScores["ielts"] = null;
  const i = IELTS.exec(text);
  if (i) {
    const overall = Number(i[1]);
    const after = text.slice(i.index + i[0].length, i.index + 280);
    // Scores listed per skill ("reading 6.0, writing 6.0, …"): the lowest is the component minimum.
    const perSkill = Array.from(after.matchAll(/\b(?:reading|writing|listening|speaking)\s*:?\s*([4-9](?:\.[05])?)\b/gi), (m) => Number(m[1]));
    const comp = COMPONENT.map((re) => re.exec(after)).find(Boolean);
    const min = perSkill.length >= 2 ? Math.min(...perSkill) : comp ? Number(comp[1]) : null;
    ielts = { overall, minComponent: min !== null && min <= overall ? min : null };
  }
  let toefl: EnglishScores["toefl"] = null;
  const t = /TOEFL[^.\n]{0,90}?\b(\d{2,3})\b/i.exec(text);
  if (t && Number(t[1]) >= 60 && Number(t[1]) <= 120) {
    const after = text.slice(t.index + t[0].length, t.index + 220);
    const comp = /(\d{1,2})\s*(?:or (?:above|higher)\s*)?(?:in|for|on)\s*(?:each|all|every|any)\b/i.exec(after);
    const min = comp && Number(comp[1]) <= 30 ? Number(comp[1]) : null;
    toefl = { total: Number(t[1]), minComponent: min };
  }
  return ielts || toefl ? { ielts, toefl } : null;
}

// ---------- Other tests: TOEFL, PTE, Duolingo, GRE, GMAT ----------

/** A score that follows the test's name within the same sentence, inside the test's own range. */
function scoreAfter(text: string, name: RegExp, digits: RegExp, lo: number, hi: number): number | null {
  const m = name.exec(text);
  if (!m) return null;
  const window = text.slice(m.index, m.index + 110).split(/(?<=[.;])\s/)[0];
  for (const d of window.matchAll(digits)) {
    const v = Number(d[1]);
    // The test's scale is not a score: "0 - 120 scale", "out of 120", "/120", "10–160".
    const before = window.slice(Math.max(0, d.index! - 9), d.index!);
    const after = window.slice(d.index! + d[0].length, d.index! + d[0].length + 10);
    if (/(\d\s*[-–—]\s*|\bto\s+|out of\s+|\/\s*)$/i.test(before) || /^\s*([-–—]\s*\d|scale|point scale)/i.test(after)) continue;
    if (v >= lo && v <= hi) return v;
  }
  return null;
}

export const TEST_NAMES = {
  toefl: /\bTOEFL\b/i,
  pte: /\bPTE\b(?: Academic)?/i,
  duolingo: /\bDuolingo\b/i,
  gre: /\bGRE\b/,
  gmat: /\bGMAT\b(?: Focus)?/i,
} as const;

/** TOEFL iBT total (60–120), PTE Academic overall (30–90), Duolingo English Test (80–160). */
export function englishTestScore(test: "toefl" | "pte" | "duolingo", text: string): number | null {
  if (test === "toefl") return /TOEFL[^.\n]{0,40}(?:paper|PBT|ITP)/i.test(text) && !/iBT/i.test(text) ? null : scoreAfter(text, TEST_NAMES.toefl, /\b(\d{2,3})\b/g, 60, 120);
  if (test === "pte") return scoreAfter(text, TEST_NAMES.pte, /\b(\d{2})\b/g, 30, 90);
  return scoreAfter(text, TEST_NAMES.duolingo, /\b(\d{2,3})\b/g, 80, 160);
}

export type AdmissionTest = { status: "required" | "optional" | "not-required" | "mentioned"; min: number | null };

/**
 * Whether the page asks for the GRE or GMAT, from the sentence that names it: "not required" and
 * waivers first (they also contain "required"), then optional or recommended, then required.
 * A score is read only in the test's own range (GRE total 260–340, GMAT 200–805).
 */
export function admissionTest(test: "gre" | "gmat", text: string): AdmissionTest | null {
  const m = TEST_NAMES[test].exec(text);
  if (!m) return null;
  const start = Math.max(0, text.lastIndexOf(".", m.index) + 1);
  const end = text.indexOf(".", m.index + m[0].length);
  const s = text.slice(start, end < 0 ? undefined : end);
  // A waiver alone says nothing either way (the test is usually required unless waived).
  const status: AdmissionTest["status"] = /\b(not|no longer)\s+(be\s+|an?\s+)?(required|necessary|needed|mandatory|compulsory|considered|accepted|sought|requested)\b|\bdo(?:es)? not (?:require|need)|\bno (?:GRE|GMAT)\b|\bnot need/i.test(s)
    ? "not-required"
    : /\boptional\b|\brecommended\b|\bencouraged\b|\bmay (?:submit|provide|include|be asked|require|be required)\b|\bif (?:available|you have)\b|\bstrengthen\b|\bdiscretion\b|\bcase[- ]by[- ]case\b/i.test(s)
      ? "optional"
      : /\brequired\b|\bmust\b|\bneed to (?:submit|provide|take|have)\b|\brequires?\b|\bmandatory\b|\bminimum\b/i.test(s)
        ? "required"
        : "mentioned";
  const min = test === "gre" ? scoreAfter(s, TEST_NAMES.gre, /\b(\d{3})\b/g, 260, 340) : scoreAfter(s, TEST_NAMES.gmat, /\b(\d{3})\b/g, 200, 805);
  return { status, min };
}

// ---------- Work experience ----------

const YEARS_N = String.raw`\d+|one|two|three|four|five|six|seven|eight|nine|ten`;
const YEARS_KIND = String.raw`full[- ]time|relevant|professional|managerial|post[- ]?(?:qualification|graduation|graduate|degree|bachelor'?s)|paid|work(?:ing)?|industry|supervisory|management|leadership|practical|clinical|teaching|business|related|significant|continuous|appropriate`;
const WORK_YEARS = new RegExp(
  String.raw`\b(${YEARS_N})\+?\s*(?:\(\d+\)\s*)?(?:(?:to|-|–)\s*(?:${YEARS_N})\s*)?(?:or more\s+|plus\s+)?years?['’]?\s+(?:of\s+)?(?:(?:${YEARS_KIND})[\s,]+(?:and\s+)?)*(?:work|professional|managerial|industry|employment|experience)\b`,
  "i",
);
const YEARS_WORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/**
 * The years of work experience an academic requirement asks for ("a bachelor's degree and a minimum
 * of three years' full-time managerial experience"), or null. Not when the experience is another way
 * in (after "or", for a 2:2 or another degree, "may be considered"), only preferred, or listed
 * without saying it is needed (an entry option for a shorter version of the course).
 */
export function workYears(text: string | null): number | null {
  if (!text) return null;
  // Sentences, and requirements the page runs together without a full stop ("…at least B A minimum of 5 years…"),
  // unless "or" / "and" joins them.
  const sentences = text.split(/(?<=[.;•])\s+|\n+|(?<=[A-Za-z0-9)])(?<!\b(?:or|and))\s+(?=(?:A minimum of|Minimum of|At least|Applicants (?:must|should)|Candidates (?:must|should))\b)/);
  let at = 0;
  for (const sentence of sentences) {
    const start = text.indexOf(sentence, at);
    at = start < 0 ? at : start + sentence.length;
    const m = WORK_YEARS.exec(sentence);
    if (!m) continue;
    const before = sentence.slice(0, m.index);
    const after = sentence.slice(m.index + m[0].length, m.index + m[0].length + 80);
    // "or (an) equivalent" after a qualification names the same one, not another way in (a sentence that opens with it is one).
    if ([...before.replace(/(?<=\S[\s(]*)\bor\s+(?:an?\s+)?(?:international\s+)?equivalent\b/gi, "").matchAll(/\b(and|or)\b/gi)].pop()?.[1].toLowerCase() === "or") continue;
    if (
      /\b(if you (?:do not|don['’]t) have|without|in lieu|instead of|alternatively|otherwise|in place of|not meet|do not hold|don['’]t hold|prefer(?:ably|s|red)?|consider(?:ed)?|in these circumstances|in such cases|such applicants|these applicants|with other|normally aged|mature|other (?:degree|subject|discipline|qualification)s?)\b/i.test(before)
    )
      continue;
    // A lower class with experience is another way in only when a higher class is asked for first ("a 2:1, or a
    // 2:2 with three years…"); "a 2:2 degree and three years' work experience" asks everyone for the years.
    if (
      /\b(2:2|2\.2|lower second|third class|pass degree)\b/i.test(before) &&
      /\b(2:1|2\.1|upper second|first[- ]class)\b/i.test(text.slice(0, Math.max(0, start)) + before.slice(0, before.search(/\b(2:2|2\.2|lower second|third class|pass degree)\b/i)))
    )
      continue;
    // A route the university only weighs ("Applicants with a 2:2 … and one year of experience … may be considered").
    // A bracketed aside ("(students with 2 years … will be considered case by case)") and "must" keep the years asked for.
    if (
      !/\bmust\b/i.test(before) &&
      /\b(?:may|will|can)\s+(?:also\s+|exceptionally\s+)?be\s+considered\b|\bconsidered on an? (?:individual|case)|\bcase[- ]by[- ]case\b/i.test(sentence.slice(m.index).replace(/\([^)]*\)/g, " "))
    )
      continue;
    // What the course would "ideally" have is not a requirement, there or in a sentence after it.
    if (/\bideally\b/i.test(text.slice(0, Math.max(0, start)) + before)) continue;
    // "with" right before the years asks for them too ("a Bachelor’s Degree with 2 years of relevant working experience"),
    // and so does "and" after the degree set off by a comma or "or above" ("2:2 degree or an approved professional
    // qualification, and three years’ …"). A bare "a Bachelor degree in a related discipline and two years …" is
    // often the route to a shorter version (Griffith), so it is not read as asked of everyone.
    const withYears =
      /\bwith\s+(?:at least\s+|a minimum of\s+|minimum\s+)?$/i.test(before) || /\b(?:degree|qualification)s?\b[^.;]{0,80}(?:,\s+|\bor above\s+)and\s+(?:at least\s+|a minimum of\s+)?$/i.test(before);
    if (!withYears &&!/\b(must|required?|requires|requiring|need(?:ed|s)?|minimum|at least|plus|expected|should|evidence of|in addition|also|accumulated|hold|have|has|possess)\b/i.test(before + m[0])) continue;
    // Entry options run together ("A Bachelor degree with a GPA of 5/7 A Bachelor degree with a GPA of 4/7 and three years…").
    if ((before.match(/\b(?:an?|completion of an?)\s+(?:recognised\s+)?(?:bachelor|undergraduate|honours)/gi)?.length ?? 0) > 1) continue;
    if (/^\s*\)/.test(after) || /^\s*(?:,\s*)?(?:or|may|can)\b/i.test(after)) continue;
    // Another route follows that the stored text cuts off ("…management level position^, or").
    if (/,\s*or\s*$/i.test(sentence)) continue;
    if (/^[^.;]{0,60}?\b(preferred|desirable|an advantage|advantageous|an asset|beneficial|recommended|not required|not essential|considered)\b/i.test(after)) continue;
    const n = YEARS_WORD[m[1].toLowerCase()] ?? Number(m[1]);
    if (n >= 1 && n <= 20) return n;
  }
  return null;
}

/** "MSc", "MA", "MCom", "MFin", "Master's"… from a programme name. */
export function degreeTypeOf(name: string): string | null {
  if (/\bMSc\b|M\.Sc|Master of Science/i.test(name)) return "MSc";
  if (/\bMA\b|Master of Arts/.test(name)) return "MA";
  if (/\bMCom\b|Master of Commerce/i.test(name)) return "MCom";
  if (/\bMFin\b|Master of Finance/i.test(name)) return "MFin";
  if (/\bMS\b/.test(name)) return "MS";
  if (/\bMLitt\b/i.test(name)) return "MLitt";
  if (/Master/i.test(name)) return "Master's";
  return null;
}
