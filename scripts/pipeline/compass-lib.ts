// Shared reading of 指南者 cases (see compass-cases.ts): which university and programme an offer title names, the
// background line (status, GPA, English score), and GPAs put on the 4-point scale so they can be compared.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { chinesePercentToFour, fivePointToFour, ukMarkToFour } from "../../lib/gpa4";
import { auToUkMark, gpa7ToUkMark } from "../../lib/grades";
import { awardedFor } from "../../lib/tiers";
import { DATA_DIR } from "./config";

/** The universities in this database, as the agency names them in offer titles. */
export const OFFER_UNIVERSITIES: [string, string][] = [
  ["香港中文大学", "chinese-university-of-hong-kong"],
  ["香港大学", "university-of-hong-kong"],
  ["香港科技大学", "hong-kong-university-of-science-and-technology"],
  ["香港理工大学", "hong-kong-polytechnic-university"],
  ["香港城市大学", "city-university-of-hong-kong"],
  ["香港浸会大学", "hong-kong-baptist-university"],
  ["香港教育大学", "education-university-of-hong-kong"],
  ["岭南大学", "lingnan-university-hong-kong"],
  ["香港都会大学", "hong-kong-metropolitan-university"],
  ["香港恒生大学", "hang-seng-university-of-hong-kong"],
  ["香港树仁大学", "hong-kong-shue-yan-university"],
  ["新加坡国立大学", "national-university-of-singapore"],
  ["南洋理工大学", "nanyang-technological-university-singapore"],
  ["新加坡管理大学", "singapore-management-university"],
  ["新加坡科技设计大学", "singapore-university-of-technology-and-design"],
];

/** Units of a university that are separate institutions (continuing-education schools, campuses elsewhere). */
const NOT_THE_UNIVERSITY = /^(?:专业进修学院|附属学院|专业及持续教育学院|SPACE|研究院)/i;

/** Universities outside Singapore and Hong Kong, as the agency names them, mapped to this database by compass-match.ts. */
export const UNIVERSITIES_FILE = path.join(DATA_DIR, "compass", "universities.json");
export type MappedUniversity = { english: string | null; country: string | null; institutionId: string | null; how: "exact" | "chosen" | "none" };
let mapped: Record<string, MappedUniversity> | null = null;
const mappedUniversities = () => (mapped ??= existsSync(UNIVERSITIES_FILE) ? (JSON.parse(readFileSync(UNIVERSITIES_FILE, "utf8")) as Record<string, MappedUniversity>) : {});
/** After compass-match.ts writes new mappings. */
export const reloadMappedUniversities = () => {
  mapped = null;
};

const offerTitle = (title: string) => title.replace(/(?:研究生)?offer\s*[一1]?\s*枚?\s*$/i, "").trim();
const NOT_A_MASTERS = /博士|哲学硕士|MPhil|PhD/i;

/**
 * Any offer title's university and programme, without a list: the longest start ending in 大学, 学院, 分校 or 校区
 * (with a campus in brackets after it) that leaves a programme naming a master's ("…硕士", MSc, MA, Master).
 */
export function titleParts(title: string): { university: string; zh: string } | null {
  const t = offerTitle(title);
  let best: { university: string; zh: string } | null = null;
  for (const m of t.matchAll(/大学|学院|分校|校区/g)) {
    let end = m.index! + m[0].length;
    const campus = /^[（(][^）)]{1,12}[）)]/.exec(t.slice(end));
    if (campus) end += campus[0].length;
    const rest = t.slice(end).trim();
    if (rest.length >= 2 && /硕士|MSc|MA\b|Master|MBA|LLM/i.test(rest)) best = { university: t.slice(0, end), zh: rest };
  }
  return best && !NOT_A_MASTERS.test(best.zh) ? best : null;
}

const plainName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
let roster: Map<string, string> | null = null;
/** A university here by its English name (case, punctuation, "The" and abbreviations in brackets aside). */
function byEnglishName(name: string): string | null {
  if (!roster) {
    const file = path.join(DATA_DIR, "..", "raw", "institutions.json");
    const list = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { institutions: { id: string; name: string }[] }).institutions : [];
    roster = new Map(list.map((i) => [plainName(i.name), i.id]));
  }
  return roster.get(plainName(name)) ?? null;
}

/**
 * A university named in Chinese or English by an applicant or the agency: the Singapore and Hong Kong list, then the
 * mapping, then each part of "悉尼大学（University of Sydney）", then the English name as it is here.
 */
export function institutionFor(name: string): string | null {
  const one = (n: string) => OFFER_UNIVERSITIES.find(([zh]) => zh === n)?.[1] ?? mappedUniversities()[n]?.institutionId ?? null;
  const n = name.trim();
  if (!n) return null;
  const parts = /^(.+?)\s*[（(]\s*([^（()）]+?)\s*[)）]\s*$/.exec(n);
  return one(n) ?? (parts ? (one(parts[1]) ?? one(parts[2]) ?? byEnglishName(parts[2])) : null) ?? (/[a-z]/i.test(n) ? byEnglishName(n) : null);
}

/** The university and the programme an offer title names; null for universities not here, doctorates and MPhils. */
export function splitTitle(title: string): { institutionId: string; zh: string } | null {
  const t = offerTitle(title);
  for (const [zh, id] of OFFER_UNIVERSITIES) {
    if (!t.startsWith(zh)) continue;
    const rest = t.slice(zh.length).trim();
    // A campus elsewhere ("香港中文大学（深圳）") is another institution: the general mapping decides.
    if (/^[（(]/.test(rest)) break;
    if (!rest || NOT_THE_UNIVERSITY.test(rest)) return null;
    if (NOT_A_MASTERS.test(rest)) return null;
    return { institutionId: id, zh: rest };
  }
  const parts = titleParts(title);
  const id = parts ? mappedUniversities()[parts.university]?.institutionId : null;
  return parts && id ? { institutionId: id, zh: parts.zh } : null;
}

/** fresh: applying in the final year (应届生, 大四); working: the line states work experience; graduated: 已毕业 without it. */
export type Status = "fresh" | "graduated" | "working" | "other";
export type Background = {
  status: Status | null;
  workYears: number | null;
  gpa: number | null;
  ielts: number | null;
  toefl: number | null;
  gre: number | null;
  gmat: number | null;
};

const NUMBER_WORDS: Record<string, number> = { 半: 0.5, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

/** "一年工作经验，GPA3.28，雅思6.5，GRE325" → working (1 year), 3.28, IELTS 6.5, GRE 325. */
export function parseBackground(s: string): Background {
  const work = /(半|[一两二三四五六七八九十]|\d+(?:\.\d+)?)\s*年(?:半)?(?:以上)?(?:全职)?工作经验/.exec(s);
  const workYears = work ? (NUMBER_WORDS[work[1]] ?? Number(work[1])) + (/年半/.test(work[0]) ? 0.5 : 0) : /半年工作/.test(s) ? 0.5 : null;
  const status: Status | null = workYears !== null || /工作经验|在职/.test(s) ? "working" : /应届|大四/.test(s) ? "fresh" : /已毕业/.test(s) ? "graduated" : /其他/.test(s) ? "other" : null;
  const num = (re: RegExp, lo: number, hi: number) => {
    const m = re.exec(s);
    const v = m ? Number(m[1]) : NaN;
    return v >= lo && v <= hi ? v : null;
  };
  return {
    status,
    workYears,
    gpa: num(/GPA\s*[:：]?\s*(\d+(?:\.\d+)?)/i, 0.01, 100),
    ielts: num(/雅思\s*[:：]?\s*(\d(?:\.\d)?)(?!\d)/, 4, 9),
    toefl: num(/托福\s*[:：]?\s*(\d{2,3})(?!\d)/, 30, 120),
    gre: num(/GRE\s*[:：]?\s*(\d{3})(?!\d)/i, 260, 340),
    gmat: num(/GMAT\s*[:：]?\s*(\d{3})(?!\d)/i, 200, 805),
  };
}

export type GpaRule = "four" | "four-three" | "five-cn" | "percent-cn" | "uk-mark" | "au-seven" | "au-mark" | "korea" | "ucd-4.2";

// The conversions themselves are in lib/gpa4.ts (shared with the results page, which puts the visitor's own result
// on the same scale) and lib/grades.ts (Australian grades on the UK scale).
export const GPA_RULE_TEXT: Record<GpaRule, string> = {
  four: "reported on the 4-point scale",
  "four-three": "4.3-point scale: anything above an A (4.0) counted as 4.0",
  "five-cn": "5-point GPA (e.g. Nanjing, Tongji): 45 + 10 × GPA as a percentage, as Tongji University's own table gives (5 = 95, 4 = 85, 3 = 75), then Peking University's rule",
  "percent-cn": "percentage mark, converted with Peking University's rule GPA = 4 − 3(100 − X)²/1600",
  "uk-mark": "UK percentage mark (Xi'an Jiaotong-Liverpool's and Nottingham Ningbo's marks too), converted with the commonly cited bands (First 3.7–4.0, 2:1 3.3–3.6, 2:2 about 2.7, Third about 2.0)",
  "au-seven": "Australian 7-point GPA, put on the UK scale with UK universities' published equivalences (7 a First, 6 a 2:1, 5 a 2:2), then the UK bands",
  "au-mark": "Australian average mark, put on the UK scale with UK universities' published equivalences (80% a First, 70% a 2:1, 65% a 2:2), then the UK bands",
  korea: "4.5-point scale, scaled by 4/4.5",
  "ucd-4.2":
    "University College Dublin's 4.2-point GPA: its class by UCD's own table (First 3.68–4.20, 2:1 3.08–3.67, 2:2 2.48–3.07, Pass 2.00–2.47), then the UK bands (First 3.7–4.0, 2:1 3.3–3.6, 2:2 2.7, Pass 2.0), straight-line within a class",
};

/** A UCD 4.2-point GPA on the 4-point scale (GPA_RULE_TEXT["ucd-4.2"]); null below a Pass. */
export function ucdToFour(v: number): number | null {
  const within = (lo: number, hi: number, to: number, toHi: number) => Math.round((to + ((v - lo) / (hi - lo)) * (toHi - to)) * 100) / 100;
  if (v > 4.2 || v < 2) return null;
  if (v >= 3.68) return within(3.68, 4.2, 3.7, 4);
  if (v >= 3.08) return within(3.08, 3.67, 3.3, 3.6);
  return v >= 2.48 ? 2.7 : 2;
}

/**
 * Mainland universities whose students report GPAs on a 5-point scale, told from the values they report: often above
 * 4.3, or mostly above 4.0 (a 4.3-point scale rarely averages above 4.0). Needs at least three reports.
 */
export function fivePointSchools(reports: { school: string; gpa: number }[]): Set<string> {
  const by = new Map<string, number[]>();
  for (const r of reports) if (r.gpa <= 5) by.set(r.school, [...(by.get(r.school) ?? []), r.gpa]);
  const out = new Set<string>();
  for (const [school, vs] of by) {
    if (vs.length < 3) continue;
    const above = (x: number) => vs.filter((v) => v > x).length / vs.length;
    if (above(4.3) >= 0.2 || above(4) >= 0.5) out.add(school);
  }
  return out;
}

/**
 * Sino-foreign universities in China whose graduates report UK-style marks (70 a First, 60 a 2:1), as their awarding
 * universities mark: Xi'an Jiaotong-Liverpool, Nottingham Ningbo (data/raw/tiers/awarded-by.json).
 */
export const ukMarksSchool = (school: string | null) => !!school && awardedFor(school)?.marks === "uk";

/**
 * A reported GPA on the 4-point scale. `country` is the undergraduate university's country (null when unknown);
 * mainland universities report 4-point, 4.3-point or 5-point GPAs, or percentage averages; `fivePoint` marks a
 * school told to use the 5-point scale (fivePointSchools); `ukMarks` one whose marks are UK marks (ukMarksSchool),
 * read as a UK university's. Returns null when the scale can't be told.
 */
export function toFourPoint(v: number, from: { mainland: boolean; country: string | null; fivePoint?: boolean; ukMarks?: boolean }): { gpa: number; rule: GpaRule } | null {
  const round = (g: number) => Math.round(Math.min(4, Math.max(0, g)) * 100) / 100;
  if (!(v > 0)) return null;
  if (from.ukMarks) return toFourPoint(v, { mainland: false, country: "United Kingdom" });
  if (from.mainland) {
    if (v <= 5 && (from.fivePoint || v > 4.3)) return { gpa: fivePointToFour(v), rule: "five-cn" };
    if (v <= 4) return { gpa: round(v), rule: "four" };
    if (v <= 4.3) return { gpa: 4, rule: "four-three" };
    if (v >= 60 && v <= 100) return { gpa: chinesePercentToFour(v), rule: "percent-cn" };
    return null;
  }
  if (v <= 4) return { gpa: round(v), rule: "four" };
  if (v <= 4.3) return { gpa: 4, rule: "four-three" };
  const c = from.country ?? "";
  if (c === "Australia") {
    if (v <= 7) return { gpa: ukMarkToFour(gpa7ToUkMark(v)), rule: "au-seven" };
    if (v >= 50 && v <= 100) return { gpa: ukMarkToFour(auToUkMark(v)), rule: "au-mark" };
    return null;
  }
  if (c === "United Kingdom" || c === "Ireland") {
    if (v >= 40 && v <= 100) return { gpa: ukMarkToFour(v), rule: "uk-mark" };
    return null;
  }
  if (c === "South Korea" && v <= 4.5) return { gpa: round((v * 4) / 4.5), rule: "korea" };
  return null;
}
