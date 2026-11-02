// Step 5: merge the rule-based and Claude-filled fields into curated records:
// data/raw/programmes.json (programmes + per-field evidence + Kaplan matches) and a report.
// Usage: npx tsx scripts/pipeline/build.ts

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseDurationMonths } from "../../lib/pipeline/duration";
import type { AdmissionTest } from "../../lib/pipeline/requirements";
import type { Discipline } from "../../lib/pipeline/types";
import { AI_FILE, CANDIDATES_FILE, DATA_DIR, EXTRACTED_FILE, FETCH_LOG_FILE, INSTITUTIONS_FILE, OUTPUT_FILE, REPORT_MD, UNIVERSITY_ENGLISH_FILE } from "./config";
import type { Discovery } from "./discover";
import { ENGLISH_FILE, englishFor, type UniversityEnglish } from "./english";
import type { UniversityMinimum } from "./english-university";
import { CAMPUS_COUNTRY, campusOf, pageText, type PageText } from "./extract-lib";
import type { FetchEntry } from "./fetch";
import type { AiResult } from "./extract-ai";
import type { ExtractedRecord } from "./extract";
import { REQUIREMENTS_FILE, type RequirementResult } from "./requirement-ai";
import { SOURCES } from "./sources";
import { readJson, today, writeJson } from "./util";

/** In a programme's notes when its English score is the university-wide minimum, not its own (lib/data/results.ts reads it). */
export const UNIVERSITY_WIDE_NOTE = "English: university-wide minimum for graduate applicants";
/** In a programme's notes when it is taught away from the university's home campus (lib/data/results.ts reads it). */
export const campusNote = (c: { name: string; country: string }) => `Taught at: ${c.name} | ${c.country}`;

const KAPLAN = "kaplan-higher-education-academy";
const KAPLAN_SINGAPORE = { name: "Kaplan Singapore", country: "Singapore" };

type Evidence = { field: string; value: string | null; quote: string; url: string; extractedBy: "rules" | "claude"; quoteVerified: boolean };
type KaplanProgramme = { id: string; level: string; discipline: Discipline; university: string | null; name: string };

export type Programme = {
  id: string;
  institutionId: string;
  name: string;
  degreeType: string | null;
  discipline: Discipline;
  acceptsAnyBackground: boolean;
  durationMonths: number | null;
  intakes: string | null;
  tuition: { amount: number; currency: string | null; basis: string | null; international: boolean } | null;
  ieltsOverall: number | null;
  toeflTotal: number | null;
  pteOverall: number | null;
  duolingo: number | null;
  gre: AdmissionTest | null;
  gmat: AdmissionTest | null;
  academicRequirement: string | null;
  /** full-time, part-time or both, from the page (part-time-only programmes are kept and tagged). */
  studyMode: "full-time" | "part-time" | "both" | null;
  /** Medium of instruction as the page states it. */
  teachingLanguage: string | null;
  /** "kaplan" for master's taught at Kaplan Singapore with a partner university. */
  deliveredBy: "kaplan" | null;
  /**
   * Where it is taught when that is not the university's home campus: Kaplan Singapore for the partner universities'
   * master's there, or a campus abroad ("Data Science (Dubai) MSc"). Its own entry, apart from the home campus's
   * programme of the same name (the user's rule, 2026-10-22).
   */
  campus: { name: string; country: string } | null;
  sourceUrl: string;
  lastVerified: string;
  verification: "automated";
  needsReview: boolean;
  notes: string[];
  evidence: Evidence[];
};

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** ISO currency of the first money figure in a quote ("International Fee: £21,500" → GBP); bare "$" is ambiguous. */
function currencyInQuote(quote: string): string | null {
  const m = /(£|€|A\$|AU\$|AUD|S\$|SGD|NZ\$|NZD|HK\$|HKD|US\$|USD|GBP|EUR|MOP\$?|RMB|CNY)\s?\d/.exec(quote);
  if (!m) return null;
  const s = m[1];
  return s === "£" ? "GBP" : s === "€" ? "EUR" : /^A/.test(s) ? "AUD" : /^S/.test(s) ? "SGD" : /^NZ/.test(s) ? "NZD" : /^HK/.test(s) ? "HKD" : /^US/.test(s) ? "USD" : /^MOP/.test(s) ? "MOP" : s === "RMB" ? "CNY" : s;
}

/** Currencies a fee line can give that the data can't hold (NOK 61,701, SEK 273400, CHF 850 …). */
const OTHER_CURRENCY = /\b(NOK|SEK|DKK|CHF|CZK|PLN|HUF|RUB|MYR|RM|THB|IDR|Rp|PHP|Php|TWD|NT\$|JPY|KRW|INR|BND)\s?\d|\d[\d,.\s]*\s?(NOK|SEK|DKK|CHF|CZK|PLN|HUF|RUB|Kč|zł|Ft|kr)\b/;

/**
 * Why an entry requirement can't be shown as the academic requirement (added 2026-11-01 after the sample checks):
 * a lead-in ("… prove the following:"), an English rule, a shortened-entry route, a home-country-only route,
 * or text that names no qualification at all (a course description). Null when it can be shown.
 */
/** A grade or class the requirement states ("2:2 honours degree", "GPA 3.0", "upper second", "65%"). */
const GRADE = /\b2[:.][12]\b|\bfirst[- ]class\b|\b(upper|lower) second\b|second[- ]class|\bgpa\b|\bcgpa\b|\bwam\b|\b\d{2}\s?%|\baverage\b|\bgrade\b|\bhonou?rs\b|\bclass\b|\bcredit average\b/i;

/**
 * An entry requirement that ends by leading into a list the page gives next: the last sentence when it is only the
 * lead-in ("… in any discipline. Applicants will also need:"), else the colon marked as cut ("… quantitative study such as …").
 */
function tidyRequirement(text: string): string {
  const t = text.trim();
  if (!/:\s*$/.test(t)) return t;
  const sentences = t.split(/(?<=[.!?])\s+/);
  if (sentences.length > 1) return sentences.slice(0, -1).join(" ");
  return t.replace(/\s*:\s*$/, " …");
}

function requirementProblem(text: string): string | null {
  const qualification = /degree|bachelor|undergraduate|graduate|gpa|cgpa|grade|honou?rs|\bclass\b|average|\bwam\b|ects|credits?|qualification|diploma|licenciatura|first[- ]cycle|\b2[:.][12]\b|\blevel [67]\b|\bNFQ\b/i;
  // Only a lead-in, with no grade of its own ("Applicants with a Swiss bachelor's degree must prove the following:").
  if (/(:|\bthe following|\bas follows)\s*\.?\s*$/i.test(text.trim()) && !GRADE.test(text)) return "a lead-in, not the requirement";
  if (!qualification.test(text)) return "names no qualification";
  // "The Master of Social Work (MSW); Non-Thesis (45 credit) program focuses on …" (McGill): the course, not its entry.
  if (/^(the|this) .{0,100}\b(program|programme|course|degree)\b (focuses|offers|provides|is designed|aims|prepares|explores|combines|gives)\b/i.test(text.trim())) return "a course description";
  // ("… studied English for at least five years … your final grade or average grade …" is still the English rule, KIT.)
  if (/\b(english|ielts|toefl)\b/i.test(text) && !/degree|bachelor|gpa|honou?rs|\bclass\b/i.test(text)) return "an English rule";
  // The route into a shortened version (Macquarie's 1.5-year entry), not a mention of recognition of prior learning.
  if (/\bshortened (version|duration|program|programme|course|pathway|entry)|reduced[- ](duration|volume)|\bwith advanced standing\b/i.test(text)) return "a shortened-entry route";
  // "If you have completed one of the following bachelor's degrees … you automatically fulfil …" (Copenhagen): named degrees.
  if (/one of the following (bachelor['’]?s? )?(degrees|programmes)|automatically (fulfil|meet|qualify)|legal right of admission|guaranteed admission/i.test(text)) return "a route for named degrees only";
  // ("Holders of a bachelor's degree from a Swiss university-level institution will be admitted …", Basel: the country after the degree.)
  const HOME = "danish|swedish|norwegian|finnish|dutch|flemish|german|swiss|austrian|spanish|italian|french|portuguese|czech|polish|hungarian|estonian|russian";
  if (
    (new RegExp(`\\b(${HOME})\\b[^.]{0,40}\\b(bachelor|degree|diploma)`, "i").test(text) ||
      new RegExp(`\\b(bachelor|degree|diploma)[^.]{0,30}\\bfrom an? (${HOME})\\b`, "i").test(text)) &&
    !/equivalent|comparable|international|foreign|abroad|other countr|recogni[sz]ed/i.test(text)
  )
    return "a home-country route";
  return null;
}

const SEMESTERS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };

/** European countries whose universities teach in another language first (the roster's names). */
const EUROPE_NOT_ENGLISH =
  /^(Spain|Portugal|France|Italy|Germany|Netherlands|Belgium|Luxembourg|Switzerland|Austria|Sweden|Norway|Denmark|Finland|Iceland|Greece|Cyprus|Russia|Hungary|Czech Republic|Poland|Estonia|Latvia|Lithuania|Slovakia|Slovenia|Croatia|Romania|Bulgaria)$/;

/**
 * The full-time length to show, from the quote it was read from (added 2026-11-01): a range ("1 or 2 years
 * depending on prior qualifications", "One to two years") is not one length; "4 semesters" is 24 months; a
 * part-time length isn't the length of a programme that also runs full-time; under 9 months only when the quote
 * says months. `reason` says why a length was dropped.
 */
function checkedDuration(months: number, quote: string, partTimeOnly: boolean): { months: number | null; reason?: string } {
  // A master's runs 6 months to 3 years; 90 is the ECTS count read as months (RWTH).
  if (months < 6 || months > 36) return { months: null, reason: `${months} months is not a master's length` };
  // (Also "180 ECTS … or three years of full-time study", Turku's entry rule.)
  if (/bachelor|undergraduate|tertiary|\bfees?\b|\b180 ects\b|\b180 credits\b/i.test(quote)) return { months: null, reason: `the entry degree's or the fee's length: "${quote.slice(0, 80)}"` };
  // "A rigorous one-year full-time program plus one semester dedicated to the Master Final Work" (ISEG): more than the year.
  if (/\bplus (one|a|another|an additional) (semester|term|year)\b/i.test(quote)) return { months: null, reason: `a length plus more: "${quote.slice(0, 80)}"` };
  // "1 year for the M1, 1 year for the M2" (Université Paris Cité): two years, not one.
  if (/\bM1\b/.test(quote) && /\bM2\b/.test(quote)) return { months: null, reason: `length per year of study: "${quote.slice(0, 80)}"` };
  // "A candidate … who has completed the Postgraduate Diploma … shall usually follow a programme of one year" (Otago): one route's length.
  if (/\bwho (has|have) completed\b|\badvanced standing\b|\bcredit for prior\b/i.test(quote)) return { months: null, reason: `the length for one entry route: "${quote.slice(0, 80)}"` };
  const range = /\b(\d+(?:[.,]\d)?|one|two|three)\s*(?:years?\s*)?(to|-|–|or)\s*(\d+(?:[.,]\d)?|two|three|four)\s*(years?|months?|yrs?)\b/i.exec(quote);
  // "1 year or 2 years in sandwich mode": the longer one is another version (placement, part-time), not a range.
  const otherVersion = range?.[2].toLowerCase() === "or" && /sandwich|placement|internship|industry|part[- ]time/i.test(quote.slice(range.index));
  if (range && !otherVersion) return { months: null, reason: `length varies: "${quote.slice(0, 120)}"` };
  // An even count of semesters is whole academic years ("4 semesters" = 2 years); an odd count is not (3 semesters is
  // one year in the UK, 18 months at Basel), so it isn't converted.
  const sem = /\b(\d|two|three|four|five|six)\s+semesters?\b/i.exec(quote);
  // ("two semesters of coursework followed by the writing of a Master's thesis", UZH: not the whole length.)
  if (sem && !/\bmonths?\b|\byears?\b/i.test(quote) && /followed by|\bplus\b|\bthesis\b|dissertation|internship|\bof coursework\b/i.test(quote))
    return { months: null, reason: `semesters of coursework only: "${quote.slice(0, 80)}"` };
  if (sem && !/\bmonths?\b|\byears?\b/i.test(quote)) {
    const n = SEMESTERS[sem[1].toLowerCase()] ?? Number(sem[1]);
    return n % 2 === 0 ? { months: n * 6 } : { months: null, reason: `${n} semesters: the length in months isn't stated` };
  }
  if (/part[- ]time/i.test(quote) && !/full[- ]time/i.test(quote) && !partTimeOnly) return { months: null, reason: "only a part-time length on the page" };
  if (months < 9 && !/\b\d+\s*months?\b/i.test(quote)) return { months: null, reason: `under 9 months without a stated month count: "${quote.slice(0, 80)}"` };
  return { months };
}

/**
 * The partner university awarding a master's taught at Kaplan Singapore, as its page names it: in the title ("… -
 * University College Dublin | Kaplan", "… | Murdoch University at Kaplan (Singapore)") or the award line ("… will be
 * awarded the Master of … from University College Dublin"). The name that comes first.
 */
function awardingPartner(pages: PageText[], partners: { id: string; names: string[] }[]): string | null {
  const text = pages.flatMap((p) => [p.title ?? "", ...p.lines.filter((l) => /\bawarded\b.*\bfrom\b|reasons to choose/i.test(l))]).join("\n").toLowerCase();
  let best: { id: string; at: number } | null = null;
  for (const p of partners)
    for (const n of p.names) {
      const at = text.indexOf(n.toLowerCase());
      if (at >= 0 && (!best || at < best.at)) best = { id: p.id, at };
    }
  return best?.id ?? null;
}

function main() {
  const extracted = readJson<ExtractedRecord[]>(EXTRACTED_FILE, []);
  const ai = readJson<Record<string, AiResult>>(AI_FILE, {});
  const english = readJson<Record<string, UniversityEnglish>>(ENGLISH_FILE, {});
  const universityEnglish = readJson<Record<string, UniversityMinimum>>(UNIVERSITY_ENGLISH_FILE, {});
  const requirements = readJson<Record<string, RequirementResult>>(REQUIREMENTS_FILE, {});
  // Universities whose requirement isn't shown as text; the programme page is linked instead (2026-11-01).
  const linkOnly = new Set(readJson<{ ids: string[] }>(path.join(DATA_DIR, "requirement-link-only.json"), { ids: [] }).ids);
  // Universities held back from the data until their sample check passes (2026-11-01: Europe), so data:load leaves them out.
  const held = new Set(readJson<{ ids: string[] }>(path.join(DATA_DIR, "held.json"), { ids: [] }).ids);
  // Fields a university's pages were found to give wrongly in its check (2026-11-01, per-university check): left empty there.
  const blocks = readJson<{ blocks: Record<string, ("tuition" | "ielts" | "duration")[]> }>(path.join(DATA_DIR, "field-blocks.json"), { blocks: {} }).blocks;
  const log = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
  const roster = readJson<{ institutions: { id: string; name: string; tier?: number; country?: string | null; kaplanPartner?: unknown; kaggle?: { names?: string[] } | null }[] }>(INSTITUTIONS_FILE, { institutions: [] });
  const countryOf = new Map(roster.institutions.map((i) => [i.id, i.country ?? null]));
  const partners = roster.institutions.filter((i) => i.kaplanPartner).map((i) => ({ id: i.id, names: [i.name, ...(i.kaggle?.names ?? [])] }));
  const awarders: Record<string, number> = {};
  const kaplan = readJson<{ programmes: KaplanProgramme[] }>(new URL("../../data/raw/kaplan-programmes.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), { programmes: [] });

  const programmes: Programme[] = [];
  for (const r of extracted) {
    const x = r.result;
    if (!x?.name || !x.degreeType || !x.discipline) continue;
    const f = ai[r.base]?.fields ?? {};
    const ev: Evidence[] = [];
    const notes = [...x.notes.filter((n) => !/not found/.test(n))];
    const rule = (field: string, value: string | null, key: string) => {
      const e = x.evidence[key];
      if (e) ev.push({ field, value, quote: e.text, url: e.url, extractedBy: "rules", quoteVerified: true });
    };
    const claude = (field: string, value: string | null, a?: { quote: string; url: string; verified: boolean }) => {
      if (a) ev.push({ field, value, quote: a.quote, url: a.url, extractedBy: "claude", quoteVerified: a.verified });
    };

    rule("name", x.name, "name");

    // Tuition: Claude's international fee (verified quote) first; the rules can't tell home from international fees.
    let tuition: Programme["tuition"] = null;
    if (f.tuitionInternational) {
      const t = JSON.parse(String(f.tuitionInternational.value)) as { amount: number; currency: string | null; basis: string | null };
      // The currency symbol in the page's own figure line wins over the model's answer.
      const currency = currencyInQuote(f.tuitionInternational.quote) ?? t.currency ?? x.tuition?.currency ?? null;
      // A fee in a currency the data can't hold ("NOK 61,701 (approximately USD 6,005)"): not shown rather than mislabelled.
      const other = OTHER_CURRENCY.exec(f.tuitionInternational.quote);
      const otherFirst = other && other.index <= (/(£|€|A\$|AU\$|AUD|S\$|SGD|NZ\$|NZD|HK\$|HKD|US\$|USD|GBP|EUR)\s?\d/.exec(f.tuitionInternational.quote)?.index ?? Infinity);
      if (otherFirst) notes.push(`fee dropped: its currency can't be held ("${f.tuitionInternational.quote.slice(0, 80)}")`);
      // A fee per credit ("€75 per credit", UAB) isn't the programme's fee; nor is 0 or a figure under 500 (IP Paris stored 0).
      else if (/per (credit|ects|unit|point|subject|course)\b|\/\s*(credit|ects)\b/i.test(f.tuitionInternational.quote) || !(t.amount >= 500))
        notes.push(`fee dropped: not a programme fee ("${f.tuitionInternational.quote.slice(0, 80)}")`);
      else {
        // The basis the fee line itself states, when the label didn't ("Tuition fee: EUR 15,000/academic year", LUT; "12,000 EUR/year", CEU).
        const q = f.tuitionInternational.quote;
        const basis =
          t.basis ??
          // ("annual" alone isn't a basis: "(may be subject to annual increase)".)
          (/\/\s*(academic )?year\b|per (academic )?year|\d\s*a year\b|\(\d{4} annual\)|\/\s*yr?\b|\bp\.a\.|per annum/i.test(q)
            ? "per year"
            : /per semester|\/\s*semester/i.test(q)
              ? "per semester"
              : /\btotal\b|whole programme|full programme|\/\s*programme|per programme|full course/i.test(q)
                ? "full course"
                : null);
        tuition = { ...t, basis, currency, international: true };
        claude("tuition", `${tuition.currency ?? ""} ${tuition.amount}`.trim(), f.tuitionInternational);
      }
    } else if (x.tuition) {
      tuition = { amount: x.tuition.amount, currency: x.tuition.currency, basis: x.tuition.basis, international: false };
      rule("tuition", `${x.tuition.currency} ${x.tuition.amount}`, "tuition");
      notes.push("tuition from rules: not confirmed as the international fee");
    }

    // An IELTS line for undergraduates or for graduating is not the master's entry score (Otago, NSYSU, 2026-11-01);
    // a line that only mentions the applicant's undergraduate degree ("… if you have studied an undergraduate degree …") is.
    const NOT_ENTRY_IELTS = /\bfor undergraduate (study|studies|students|programmes|programs|admission|entry)|required for undergraduate|undergraduate (entry|admission) requirement|graduation requirement|requirements? for graduation|exit requirement/i;
    let ielts = x.englishScores?.ielts?.overall ?? null;
    if (ielts !== null && x.evidence.english && NOT_ENTRY_IELTS.test(x.evidence.english.text)) {
      notes.push("IELTS dropped: the line is for undergraduates or for graduating");
      ielts = null;
    }
    if (ielts !== null) rule("ielts", String(ielts), "english");
    else if (f.ieltsOverall && NOT_ENTRY_IELTS.test(f.ieltsOverall.quote)) notes.push("IELTS dropped: the line is for undergraduates or for graduating");
    else if (f.ieltsOverall && Number(f.ieltsOverall.value) < 5.5 && !/minimum|entry|admission|requir/i.test(f.ieltsOverall.quote)) {
      // A low score with no word saying it is the entry minimum ("IELTS 5 0 0" in Mahidol's graduation criteria).
      notes.push(`IELTS dropped: ${f.ieltsOverall.value} is not stated as the entry minimum`);
    } else if (f.ieltsOverall) {
      ielts = Number(f.ieltsOverall.value);
      claude("ielts", String(ielts), f.ieltsOverall);
    } else if (english[r.source]) {
      // The university's English requirements page, matched by course code or school name.
      const u = english[r.source];
      // Only the programme's own content (from its heading on): site menus list every school.
      const text = r.pages
        .map((url) => {
          const p = pageText({ url, html: readFileSync(log[url].file!, "utf8") });
          const start = Math.max(0, p.lines.findIndex((l) => p.h1.includes(l)));
          return p.lines.slice(start).join(" ");
        })
        .join(" ");
      const rule = englishFor(u, r.base, text, x.name);
      if (rule) {
        ielts = rule.ielts;
        ev.push({ field: "ielts", value: String(ielts), quote: rule.quote, url: u.url, extractedBy: "rules", quoteVerified: true });
        notes.push(`IELTS from the university's English requirements page (${rule.codes ? "by course code" : rule.pageText ? "by school" : "standard postgraduate requirement"})`);
      }
    }

    // Last resort: the university-wide minimum for graduate applicants (english-university.ts), marked as such.
    const uni = universityEnglish[r.source];
    if (ielts === null && uni?.ielts && !NOT_ENTRY_IELTS.test(uni.ielts.quote)) {
      ielts = uni.ielts.value;
      ev.push({ field: "ielts", value: String(ielts), quote: uni.ielts.quote, url: uni.url, extractedBy: "claude", quoteVerified: true });
      notes.push(UNIVERSITY_WIDE_NOTE);
    }

    // Other tests, by rule from the programme's own page; TOEFL also from the English requirement line.
    const tests = x.tests ?? { toefl: null, pte: null, duolingo: null, gre: null, gmat: null };
    // Only iBT totals (0–120): older paper and computer-based scores (up to 677 and 300) are another scale.
    // A total on the 0–120 scale; 1–6 band scores (the 2026 iBT scale) are left blank.
    const ibt = (n: number | null | undefined) => typeof n === "number" && Number.isInteger(n) && n > 6 && n <= 120;
    let toefl = ibt(tests.toefl) ? tests.toefl : null;
    if (toefl !== null) rule("toefl", String(toefl), "toefl");
    else if (ibt(x.englishScores?.toefl?.total)) {
      toefl = x.englishScores!.toefl!.total;
      rule("toefl", String(toefl), "english");
    } else if (f.toeflTotal && ibt(Number(f.toeflTotal.value))) {
      toefl = Number(f.toeflTotal.value);
      claude("toefl", String(toefl), f.toeflTotal);
    } else if (uni?.toefl && ibt(uni.toefl.value)) {
      toefl = uni.toefl.value;
      ev.push({ field: "toefl", value: String(toefl), quote: uni.toefl.quote, url: uni.url, extractedBy: "claude", quoteVerified: true });
      if (!notes.includes(UNIVERSITY_WIDE_NOTE)) notes.push(UNIVERSITY_WIDE_NOTE);
    }
    for (const k of ["pte", "duolingo"] as const) if (tests[k] !== null) rule(k, String(tests[k]), k);
    for (const k of ["gre", "gmat"] as const) {
      const t = tests[k];
      if (t) rule(k, t.min ? `${t.status} (${t.min})` : t.status, k);
    }

    let duration = x.duration ? parseDurationMonths(x.duration) : null;
    if (duration !== null) rule("duration", String(duration), "duration");
    else if (f.durationMonths) {
      duration = Number(f.durationMonths.value);
      claude("duration", String(duration), f.durationMonths);
    }

    let intakes = x.intake;
    if (intakes) rule("intakes", intakes, "intake");
    else if (f.intakes && f.intakes.value != null && String(f.intakes.value).trim()) {
      intakes = String(f.intakes.value);
      claude("intakes", intakes, f.intakes);
    }

    // Claude's reading of the requirement (requirement-ai.ts) replaces the rules' sentence where it was run, including
    // when it found none for international applicants.
    const reread = requirements[r.base];
    const ruleAcademic = reread ? null : x.academic ? tidyRequirement(x.academic) : null;
    let academic = ruleAcademic && !requirementProblem(ruleAcademic) ? ruleAcademic : null;
    if (ruleAcademic && !academic) notes.push(`academic requirement dropped: ${requirementProblem(ruleAcademic)}`);
    if (reread?.requirement && !requirementProblem(reread.requirement)) {
      academic = reread.requirement;
      ev.push({ field: "academicRequirement", value: academic, quote: reread.requirement, url: reread.url ?? r.base, extractedBy: "claude", quoteVerified: true });
    } else if (reread) notes.push(`academic requirement not shown: ${reread.requirement ? requirementProblem(reread.requirement) : reread.dropped}`);
    else if (academic) rule("academicRequirement", academic, "academic");
    else if (f.academicRequirement) {
      const a = tidyRequirement(String(f.academicRequirement.value));
      const problem = requirementProblem(a);
      if (problem) notes.push(`academic requirement dropped: ${problem}`);
      else {
        academic = a;
        claude("academicRequirement", academic, f.academicRequirement);
      }
    }
    if (academic && linkOnly.has(r.source)) {
      academic = null;
      ev.splice(0, ev.length, ...ev.filter((e) => e.field !== "academicRequirement"));
      notes.push("academic requirement: see the official page");
    }
    if (x.background) rule("background", x.background, "background");

    // Study mode and teaching language: Claude's verified quotes; the rules only see a part-time-only page.
    let studyMode: Programme["studyMode"] = null;
    const sm = f.studyMode ? String(f.studyMode.value).toLowerCase() : "";
    if (/both|full.*part|part.*full/.test(sm)) studyMode = "both";
    else if (/part/.test(sm)) studyMode = "part-time";
    else if (/full/.test(sm)) studyMode = "full-time";
    if (studyMode) claude("studyMode", studyMode, f.studyMode);
    else if (notes.includes("part-time only")) studyMode = "part-time";
    const teachingLanguage = f.teachingLanguage && String(f.teachingLanguage.value).trim() ? String(f.teachingLanguage.value).trim() : null;
    if (teachingLanguage) claude("teachingLanguage", teachingLanguage, f.teachingLanguage);
    // Continental Europe is English-taught only (2026-11-01; Chinese-taught Hong Kong and Macau programmes stay): a page
    // that names no English ("French", "Dutch") is left out, and so is one taught in English and another language
    // ("English and French", ULB).
    const country = countryOf.get(r.source) ?? null;
    const continental = !!country && EUROPE_NOT_ENGLISH.test(country);
    if (continental && teachingLanguage && !/english/i.test(teachingLanguage)) {
      console.log(`left out (not taught in English: ${teachingLanguage}): ${x.name} (${r.base})`);
      continue;
    }
    // ("English, some courses in French", Lausanne, is English and another language too.)
    if (continental && teachingLanguage && !/^english\.?$/i.test(teachingLanguage)) {
      console.log(`left out (taught in English and another language: ${teachingLanguage}): ${x.name} (${r.base})`);
      continue;
    }

    // The length, checked against the quote it came from (after the study mode: a part-time-only programme keeps its part-time length).
    const durationQuote = ev.find((e) => e.field === "duration")?.quote;
    if (duration !== null && durationQuote) {
      const c = checkedDuration(duration, durationQuote, studyMode === "part-time");
      if (c.months === null) {
        notes.push(`duration dropped: ${c.reason}`);
        ev.splice(ev.findIndex((e) => e.field === "duration"), 1);
      } else if (c.months !== duration) ev[ev.findIndex((e) => e.field === "duration")].value = String(c.months);
      duration = c.months;
    }

    for (const field of blocks[r.source] ?? []) {
      if (field === "tuition") tuition = null;
      if (field === "ielts") ielts = null;
      if (field === "duration") duration = null;
      ev.splice(0, ev.length, ...ev.filter((e) => e.field !== field));
      notes.push(`${field}: not read reliably from this university's pages; see the official page`);
    }

    const missing = [!tuition && "tuition", ielts === null && "IELTS", !academic && "academic requirement"].filter(Boolean);
    if (missing.length) notes.push(`missing: ${missing.join(", ")}`);
    if (tuition && !tuition.international) notes.push("check fee type");

    // Kaplan's master's are the partner university's programmes, taught at Kaplan Singapore; a campus abroad named in
    // brackets ("Data Science (Dubai) MSc", "Master of Public Health (Kaplan, Singapore)") is the university's own too.
    // Either is its own entry, apart from the home campus's programme of the same name.
    let institutionId = r.source;
    let campus: Programme["campus"] = null;
    if (r.source === KAPLAN) {
      const awarder = awardingPartner(r.pages.map((url) => pageText({ url, html: readFileSync(log[url].file!, "utf8") })), partners);
      if (awarder) institutionId = awarder;
      else console.log(`No awarding university found for Kaplan's ${x.name} (${r.base})`);
      awarders[awarder ?? "none"] = (awarders[awarder ?? "none"] ?? 0) + 1;
      campus = KAPLAN_SINGAPORE;
    } else {
      const at = campusOf(x.name);
      const country = at ? CAMPUS_COUNTRY[at.place] : null;
      if (at && country && country !== countryOf.get(r.source))
        campus = /kaplan/i.test(at.partner ?? "") ? KAPLAN_SINGAPORE : { name: at.place.replace(/\b[a-z]/g, (c) => c.toUpperCase()), country };
    }
    if (campus) notes.push(campusNote(campus));
    const named = campus && (campus === KAPLAN_SINGAPORE ? /kaplan/i.test(x.name) : x.name.toLowerCase().includes(campus.name.toLowerCase()));
    programmes.push({
      id: `${institutionId}-${slug(x.name)}${campus && !named ? `-${slug(campus.name)}` : ""}`,
      institutionId,
      name: x.name,
      degreeType: x.degreeType,
      discipline: x.discipline,
      acceptsAnyBackground: x.acceptsAnyBackground,
      durationMonths: duration,
      intakes,
      tuition,
      ieltsOverall: ielts,
      toeflTotal: toefl,
      pteOverall: tests.pte,
      duolingo: tests.duolingo,
      gre: tests.gre,
      gmat: tests.gmat,
      academicRequirement: academic,
      studyMode,
      teachingLanguage,
      deliveredBy: campus === KAPLAN_SINGAPORE ? "kaplan" : null,
      campus,
      sourceUrl: r.base,
      lastVerified: r.fetchedAt?.slice(0, 10) ?? today(),
      verification: "automated",
      needsReview: missing.length > 0 || (tuition !== null && !tuition.international),
      notes,
      evidence: ev,
    });
  }

  // The same course published at two URLs (e.g. Aston's "…/project-management-msc-msc" and
  // "…/project-management-msc/september-2027"): keep the more complete record.
  // A partner's own listing of a master's taught at Kaplan ("Master of Public Health (Kaplan, Singapore)") is the same
  // course as Kaplan's page, which wins a tie: it gives the Singapore fee and intakes.
  const filled = (p: Programme) => [p.tuition?.international, p.ieltsOverall, p.durationMonths, p.intakes, p.academicRequirement].filter((v) => v !== null && v !== undefined && v !== false).length;
  const rank = (p: Programme) => filled(p) + (p.sourceUrl.includes("kaplan.com.sg") ? 0.5 : 0);
  const byCourse = new Map<string, Programme>();
  for (const p of programmes) {
    const at = campusOf(p.name);
    const k = `${p.institutionId}|${(at && p.campus ? p.name.replace(at.bracket, "") : p.name).toLowerCase().replace(/\s+/g, " ").trim()}|${p.degreeType}|${p.campus?.name ?? ""}`;
    const prev = byCourse.get(k);
    if (!prev || rank(p) > rank(prev)) byCourse.set(k, p);
  }
  const duplicates = programmes.length - byCourse.size;
  const kept = new Set(byCourse.values());
  programmes.splice(0, programmes.length, ...programmes.filter((p) => kept.has(p)));
  if (duplicates) console.log(`Merged ${duplicates} duplicate course page(s)`);
  // A partner's own listing of a Kaplan-taught master's that Kaplan Singapore now lists under a newer name: dropped for
  // Kaplan's current page (the user's rule, 2026-11-02: keep the newest).
  const SUPERSEDED: Record<string, string> = {
    "https://www.northumbria.ac.uk/study-at-northumbria/courses/msc-healthcare-management-singapore-dtphmk6":
      "Kaplan lists it as MSc Healthcare Leadership and Management (18 months, part-time); the Kaplan page this one links to returns 403",
  };
  const superseded = programmes.filter((p) => SUPERSEDED[p.sourceUrl]);
  programmes.splice(0, programmes.length, ...programmes.filter((p) => !SUPERSEDED[p.sourceUrl]));
  if (superseded.length) console.log(`Dropped ${superseded.length} superseded page(s): ${superseded.map((p) => p.name).join(", ")}`);
  // A second programme with the same name at the university (another intake, or a page the merge kept apart): a
  // short hash of its page address, so the id stays the same between builds (a running count shifted whenever
  // programmes were added). Given after the merge, so the page kept from a merged pair has the plain id (2026-10-22).
  const seen = new Set<string>();
  for (const p of programmes) {
    if (seen.has(p.id)) p.id = `${p.id}-${createHash("sha1").update(p.sourceUrl).digest("hex").slice(0, 6)}`;
    seen.add(p.id);
  }
  // Held universities go to their own file for checking, not into the data data:load reads.
  const heldOut = programmes.filter((p) => held.has(p.institutionId));
  programmes.splice(0, programmes.length, ...programmes.filter((p) => !held.has(p.institutionId)));
  writeJson(path.join(DATA_DIR, "held-programmes.json"), { builtAt: today(), held: [...held], programmes: heldOut });
  if (heldOut.length) console.log(`Held back: ${heldOut.length} programmes at ${new Set(heldOut.map((p) => p.institutionId)).size} universities (data/pipeline/held-programmes.json)`);
  console.log(`Kaplan's master's by awarding university: ${Object.entries(awarders).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  console.log(`Taught away from the home campus: ${programmes.filter((p) => p.campus).length} (${[...new Set(programmes.filter((p) => p.campus).map((p) => p.campus!.name))].join(", ")})`);

  // Matches: a master's matches Kaplan degrees in the same discipline (direct), or every Kaplan
  // degree when it accepts any background (conversion). Diplomas reach it through a Kaplan degree.
  const degrees = kaplan.programmes.filter((p) => !/diploma/.test(p.level));
  const matches = programmes.flatMap((p) =>
    degrees
      .filter((d) => p.acceptsAnyBackground || d.discipline === p.discipline)
      .map((d) => ({
        programmeId: p.id,
        kaplanProgrammeId: d.id,
        matchType: d.discipline === p.discipline ? "direct" : "conversion",
        reason: d.discipline === p.discipline ? `Same discipline (${p.discipline})` : "Accepts a bachelor's in any subject",
        evidenceQuote: p.academicRequirement,
      })),
  );

  const names = new Map(roster.institutions.map((r) => [r.id, r.name]));
  writeJson(OUTPUT_FILE, {
    dataset: "Postgraduate programmes from official university pages",
    builtAt: today(),
    notes: [
      "Fields come from the official programme page: by rule from the page text, or by Claude (Haiku) when the rules could not read them. Every value keeps the quote it was read from; Claude's quotes are checked verbatim against the page and dropped when they don't match.",
      "tuition.international = true only when the international (overseas) fee was identified; rule-read fees are flagged for review.",
      "Matches: direct = same Kaplan discipline; conversion = the programme accepts a bachelor's in any subject. Kaplan diplomas reach a master's through a Kaplan degree.",
    ],
    counts: { programmes: programmes.length, needsReview: programmes.filter((p) => p.needsReview).length, matches: matches.length },
    programmes,
    matches,
  });

  // Report
  const fill = (k: (p: Programme) => unknown) => programmes.filter((p) => k(p) !== null && k(p) !== undefined).length;
  const by = (k: (p: Programme) => string) => Object.entries(programmes.reduce<Record<string, number>>((m, p) => ((m[k(p)] = (m[k(p)] ?? 0) + 1), m), {}));
  const md = [
    `# Programme pipeline report (${today()})`,
    "",
    `Programmes: ${programmes.length} · needs review: ${programmes.filter((p) => p.needsReview).length} · Kaplan matches: ${matches.length}`,
    "",
    "| Field | Filled | By Claude |",
    "| --- | --- | --- |",
    ...([
      ["International tuition", (p: Programme) => (p.tuition?.international ? 1 : null), "tuition"],
      ["IELTS overall", (p: Programme) => p.ieltsOverall, "ielts"],
      ["Duration", (p: Programme) => p.durationMonths, "duration"],
      ["Intakes", (p: Programme) => p.intakes, "intakes"],
      ["Academic requirement", (p: Programme) => p.academicRequirement, "academicRequirement"],
    ] as const).map(([label, k, field]) => `| ${label} | ${fill(k)} / ${programmes.length} | ${programmes.filter((p) => p.evidence.some((e) => e.field === field && e.extractedBy === "claude")).length} |`),
    "",
    "By university: " + by((p) => names.get(p.institutionId) ?? p.institutionId).map(([k, v]) => `${k} ${v}`).join(" · "),
    "",
    "By discipline: " + by((p) => p.discipline).map(([k, v]) => `${k} ${v}`).join(" · "),
    "",
    "## Tier-1 coverage",
    "",
    "| Institution | Country | Programmes | Status |",
    "| --- | --- | --- | --- |",
    ...tier1Coverage(),
  ].join("\n");
  writeFileSync(REPORT_MD, md + "\n");

  /** Every tier-1 institution: programmes collected, or why there are none yet. */
  function tier1Coverage(): string[] {
    const candidates = readJson<Record<string, Discovery>>(CANDIDATES_FILE, {});
    const count = programmes.reduce<Record<string, number>>((m, p) => ((m[p.institutionId] = (m[p.institutionId] ?? 0) + 1), m), {});
    return roster.institutions
      .filter((i) => i.tier === 1)
      .map((i) => {
        const src = SOURCES.find((s) => s.id === i.id);
        const status = !src
          ? "not configured yet"
          : src.skip
            ? `skipped: ${src.skip}`
            : count[i.id]
              ? "collected"
              : candidates[i.id]?.urls.length
                ? "candidates found, not yet extracted"
                : `no candidates: ${candidates[i.id]?.notes.join("; ") ?? "not discovered"}`;
        return { i, n: count[i.id] ?? 0, status };
      })
      .sort((a, b) => b.n - a.n)
      .map(({ i, n, status }) => `| ${i.name}${i.kaplanPartner ? " (Kaplan partner)" : ""} | ${i.country ?? ""} | ${n} | ${status.replace(/\|/g, "/").slice(0, 160)} |`);
  }
  console.log(md);
}

main();
