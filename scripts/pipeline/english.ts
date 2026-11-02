// Step 4b: university-wide English language requirements, for universities whose programme pages
// give no IELTS score. Each source's `englishPage` is fetched politely and read by a parser for that
// page's table layout (no AI): the result is a list of rules, each with the page lines it came from.
// A programme gets the rule whose course code (Murdoch) or school name (Aston) its own page names,
// otherwise the page's standard postgraduate requirement.
// Usage: npx tsx scripts/pipeline/english.ts [--only=aston-university]

import path from "node:path";
import { DATA_DIR } from "./config";
import { pageText } from "./extract-lib";
import { politeFetch } from "./http";
import { SOURCES } from "./sources";
import { args, readJson, today, writeJson } from "./util";

export const ENGLISH_FILE = path.join(DATA_DIR, "english.json");

export type EnglishRule = {
  appliesTo: string;
  /** Course codes named in the rule (Murdoch), or text the programme page must contain (Aston school). */
  codes?: string[];
  pageText?: string;
  ielts: number;
  quote: string;
};
export type UniversityEnglish = { source: string; url: string; retrievedAt: string; standard: EnglishRule | null; rules: EnglishRule[] };

const OVERALL = /^(\d\.\d)\s*\*?\s*(overall)?$/i;

/** Murdoch: a "Standard requirements" table (undergraduate / postgraduate / research columns) and
 *  blocks of courses with higher requirements, each naming course codes such as "Counselling (C1111, M1412)". */
function parseMurdoch(lines: string[]): Pick<UniversityEnglish, "standard" | "rules"> {
  const stdAt = lines.findIndex((l) => /^standard requirements$/i.test(l));
  const ieltsAt = lines.findIndex((l, i) => i > stdAt && /^IELTS Academic/i.test(l));
  const values = lines.slice(ieltsAt, ieltsAt + 20).map((l, i) => ({ l, i: ieltsAt + i })).filter((x) => /^\d\.\d Overall$/i.test(x.l));
  const pgCol = lines.slice(stdAt, ieltsAt).findIndex((l) => /^postgraduate$/i.test(l));
  // Columns are in header order: Undergraduate, Postgraduate, Research degree.
  const pg = pgCol >= 0 ? values[1] : undefined;
  const standard = pg
    ? { appliesTo: "postgraduate courses (standard requirements)", ielts: Number(pg.l.slice(0, 3)), quote: `${lines[stdAt]} … Postgraduate … ${lines[ieltsAt]} … ${pg.l}` }
    : null;

  const rules: EnglishRule[] = [];
  const start = lines.findIndex((l) => /^postgraduate courses$/i.test(l));
  let labels: string[] = [];
  let ieltsLine: string | null = null;
  for (let i = start + 1; start >= 0 && i < lines.length; i++) {
    const l = lines[i];
    if (/^(proficiency test|minimum requirements)$/i.test(l)) continue;
    if (/IELTS\)? Academic|^IELTS One Skill Retake$/i.test(l)) { ieltsLine ??= l; continue; }
    const m = /^(\d\.\d) Overall$/i.exec(l);
    if (m && ieltsLine && labels.length) {
      const codes = labels.flatMap((x) => x.match(/\b[A-Z]\d{4}\b/g) ?? []);
      if (codes.length) rules.push({ appliesTo: labels.join("; "), codes, ielts: Number(m[1]), quote: `${labels.join(" ")} … ${ieltsLine} … ${l}` });
      labels = [];
      ieltsLine = null;
      continue;
    }
    // Course labels come before "Proficiency test"; test rows (CAE, PTE, …) come after the IELTS score.
    if (!ieltsLine && /\b[A-Z]\d{4}\b/.test(l)) labels.push(l);
    else if (!ieltsLine && labels.length === 0 && l.length < 60 && !/\d/.test(l)) continue; // area heading, e.g. "Allied Health"
  }
  return { standard, rules };
}

/** Aston: "Main Entry IELTS Minimum Band Scores (Postgraduate)" table, one row per school with the
 *  overall score in the last column. */
function parseAston(lines: string[]): Pick<UniversityEnglish, "standard" | "rules"> {
  const a = lines.findIndex((l) => /Minimum Band Scores \(Postgraduate\)$/i.test(l));
  const b = lines.findIndex((l, i) => i > a && /^Postgraduate courses \(minimum IELTS|Postgraduate Research/i.test(l));
  const rows = lines.slice(a + 1, b > a ? b : a + 60);
  const rules: EnglishRule[] = [];
  let label: string[] = [];
  let last: string | null = null;
  const flush = () => {
    if (label.length && last) {
      const name = label.join(" ");
      rules.push({ appliesTo: name, pageText: label[0].replace(/\s*-\s*MBA$/i, ""), ielts: Number(last.slice(0, 3)), quote: `${name} … ${last}` });
    }
    label = [];
    last = null;
  };
  for (const l of rows) {
    if (/^(postgraduate courses|school ?\/ ?programme|reading|writing|listening|speaking|overall)$/i.test(l)) { flush(); continue; }
    if (OVERALL.test(l)) { last = l; continue; }
    if (/^\d\.\d$|band|bands/i.test(l)) continue;
    if (last) flush();
    label.push(l);
  }
  flush();
  return { standard: null, rules };
}

const PARSERS: Record<string, (lines: string[]) => Pick<UniversityEnglish, "standard" | "rules">> = {
  "murdoch-university": parseMurdoch,
  "aston-university": parseAston,
};

/** The rule for one programme, from its URL (course code) and its page text (school name). */
export function englishFor(u: UniversityEnglish, programmeUrl: string, programmeText: string, programmeName: string): EnglishRule | null {
  const code = /\/([a-z]\d{4})$/i.exec(programmeUrl)?.[1]?.toUpperCase();
  if (code) {
    const byCode = u.rules.find((r) => r.codes?.includes(code));
    if (byCode) return byCode;
  }
  const text = programmeText.toLowerCase();
  const bySchool = u.rules
    .filter((r) => r.pageText && text.includes(r.pageText.toLowerCase()))
    // "Aston Business School - MBA" applies to the MBA; the more specific row wins.
    .sort((x, y) => Number(/mba/i.test(y.appliesTo) && /\bmba\b/i.test(programmeName)) - Number(/mba/i.test(x.appliesTo) && /\bmba\b/i.test(programmeName)) || text.indexOf(x.pageText!.toLowerCase()) - text.indexOf(y.pageText!.toLowerCase()));
  return bySchool[0] ?? u.standard;
}

async function main() {
  const a = args();
  const state = readJson<Record<string, UniversityEnglish>>(ENGLISH_FILE, {});
  for (const src of SOURCES.filter((s) => s.englishPage && (!a.only || a.only.includes(s.id)))) {
    const parse = PARSERS[src.id];
    if (!parse) { console.log(`${src.id}: no parser for its English page`); continue; }
    const res = await politeFetch(src.englishPage!);
    if (!res.ok) { console.log(`${src.id}: ${res.reason} ${res.detail}`); continue; }
    const lines = pageText({ url: res.finalUrl, html: res.body.toString("utf8") }).lines;
    const { standard, rules } = parse(lines);
    state[src.id] = { source: src.id, url: res.finalUrl, retrievedAt: today(), standard, rules };
    writeJson(ENGLISH_FILE, state);
    console.log(`${src.id}: standard ${standard?.ielts ?? "-"} · ${rules.length} rules`);
    for (const r of rules) console.log(`   ${r.ielts}  ${r.appliesTo.slice(0, 110)}`);
  }
}

if (process.argv[1]?.endsWith("english.ts")) main();
