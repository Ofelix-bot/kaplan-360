// The GradCafe admissions results survey (thegradcafe.com/survey): applicants' own reports of master's decisions
// (accepted, rejected, wait listed) with season, status (American, international), GPA and GRE where given. Read
// per university in this database, newest first, back to 2022, through the pipeline's real browser (the survey
// pages answer scripted requests with errors); robots.txt allows /survey, one page at a time, no login. Comments
// are not kept. Included at the site owner's direction for academic use; GradCafe's terms limit reuse to personal,
// non-commercial use, and the site owner is seeking permission (2026-10-22).
// Singapore and Hong Kong first, then by QS rank; at most --pages=N pages (20 results each) per university.
// Writes data/pipeline/gradcafe/results.json. Usage: PIPELINE_INTERVAL_MS=3000 PIPELINE_BROWSER_PORT=9340
// PIPELINE_BROWSER_IDLE_MS=1500 npx tsx scripts/pipeline/gradcafe-results.ts [--only=<institution ids>] [--pages=N]

import { mkdirSync } from "node:fs";
import path from "node:path";
import { closeBrowser } from "./browser";
import { DATA_DIR, INSTITUTIONS_FILE, OUTPUT_FILE } from "./config";
import { politeFetch, routeThroughBrowser } from "./http";
import { args, keepRunning, readJson, today, writeJson } from "./util";

export const GRADCAFE_DIR = path.join(DATA_DIR, "gradcafe");
export const GRADCAFE_FILE = path.join(GRADCAFE_DIR, "results.json");
const BASE = "https://www.thegradcafe.com";
const SINCE = "2022-01-01";
const MAX_PAGES = 40;
const COUNTRIES = ["United States", "Canada", "United Kingdom", "Australia", "Ireland", "New Zealand", "Hong Kong SAR", "Singapore"];
const ASIA = ["Singapore", "Hong Kong SAR"];

export type GradcafeResult = {
  id: string;
  institutionId: string;
  /** The university as GradCafe names it, and the programme as the applicant wrote it. */
  institution: string;
  programme: string;
  degree: string;
  added: string | null;
  decision: "accepted" | "rejected" | "waitlisted" | "interview" | "other";
  season: string | null;
  status: "american" | "international" | "other" | null;
  gpa: number | null;
  gre: number | null;
};

const MONTHS: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const isoDate = (s: string) => {
  const m = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/.exec(s);
  return m ? `${m[3]}-${MONTHS[m[1]] ?? "01"}-${m[2].padStart(2, "0")}` : null;
};
const text = (html: string) =>
  html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** The results on one survey page: a row with the result link, then the rows under it up to the next result. */
export function parseSurvey(html: string, institutionId: string): { results: GradcafeResult[]; next: string | null } {
  const body = html.slice(html.indexOf("<tbody"), html.lastIndexOf("</tbody>"));
  const rows = body.split(/<tr[\s>]/).slice(1);
  const results: GradcafeResult[] = [];
  let current: { id: string; cells: string[]; extra: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const [institution = "", programme = "", degree = "", added = "", decisionText = ""] = current.cells;
    const all = [...current.cells, ...current.extra].join(" | ");
    const decision = /accepted/i.test(decisionText) ? "accepted" : /rejected/i.test(decisionText) ? "rejected" : /wait/i.test(decisionText) ? "waitlisted" : /interview/i.test(decisionText) ? "interview" : "other";
    const gpa = /GPA\s*([0-4](?:\.\d{1,2})?)/.exec(all);
    const gre = /GRE\s*(\d{3})\b/.exec(all);
    results.push({
      id: current.id,
      institutionId,
      institution,
      programme,
      degree,
      added: isoDate(added),
      decision,
      season: /((?:Fall|Spring|Summer|Winter) \d{4})/.exec(all)?.[1] ?? null,
      status: /\bInternational\b/.test(all) ? "international" : /\bAmerican\b/.test(all) ? "american" : /\bOther\b/.test(all) ? "other" : null,
      gpa: gpa ? Number(gpa[1]) : null,
      gre: gre && Number(gre[1]) >= 260 && Number(gre[1]) <= 340 ? Number(gre[1]) : null,
    });
    current = null;
  };
  for (const r of rows) {
    const link = /href="\/result\/(\d+)"/.exec(r);
    if (link) {
      flush();
      // The main row: school, programme and degree (two spans), date added, decision.
      current = { id: link[1], cells: text(r.slice(0, r.indexOf("Total comments") > 0 ? r.indexOf("Total comments") : undefined)), extra: [] };
    } else if (current) current.extra.push(...text(r));
  }
  flush();
  const next = /href="(https:\/\/www\.thegradcafe\.com\/survey\?[^"]*cursor=[^"]+)"[^>]*>\s*(?:<[^>]+>\s*)*Next/i.exec(html)?.[1]?.replace(/&amp;/g, "&") ?? null;
  return { results, next };
}

/** GradCafe's names for the few whose database name it doesn't know. */
const SEARCH_NAMES: Record<string, string> = { ucl: "University College London" };
/** The name to search GradCafe for: without "The", abbreviations in brackets, or a place after a comma ("…, Singapore"). */
export function searchName(inst: { id: string; name: string }): string {
  if (SEARCH_NAMES[inst.id]) return SEARCH_NAMES[inst.id];
  const name = inst.name.replace(/\s*\([^)]*\)/g, "").replace(/^The\s+/i, "").trim();
  const [head, place] = name.split(/\s*,\s*/);
  return place && /^(Singapore|Hong Kong|London|Edinburgh|Australia|The University of Dublin|University of London)$/i.test(place) ? head : name;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/** Edit distance, or 3 for anything further apart than two. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}
const abbreviations = (s: string) => [...s.matchAll(/\(([^)]+)\)/g)].map((m) => norm(m[1]));

/**
 * Whether the university an applicant named is the one searched for. GradCafe's search is loose, so a search for one
 * university also returns others ("Chinese University of Hong Kong, Shenzhen" for CUHK, "University of South Wales"
 * for UNSW). Kept: the same name (case, punctuation, "The" and abbreviations in brackets aside), a misspelling of it
 * (two letters off), the start of a distinctive name ("Stanford", "Imperial"), or its abbreviation ("MIT", "UC Berkeley").
 */
export function sameInstitution(theirs: string, inst: { id: string; name: string }): boolean {
  const a = norm(theirs);
  const names = [norm(inst.name), norm(searchName(inst))];
  if (!a) return false;
  if (names.includes(a)) return true;
  if (names.some((b) => b.length >= 10 && distance(a, b) <= 2)) return true;
  if (a.length >= 4 && !/^(university|college|institute|school)\b/.test(a) && names.some((b) => b.startsWith(a))) return true;
  const ours = abbreviations(inst.name);
  return ours.includes(a) || abbreviations(theirs).some((x) => ours.includes(x)) || (a.startsWith("uc ") && names.includes(`university of california ${a.slice(3)}`));
}

async function main() {
  const a = args();
  routeThroughBrowser([BASE]);
  mkdirSync(GRADCAFE_DIR, { recursive: true });
  const { institutions } = readJson<{ institutions: { id: string; name: string; country: string | null; qs?: { rankValue?: number | null } | null }[] }>(INSTITUTIONS_FILE, { institutions: [] });
  const byId = new Map(institutions.map((i) => [i.id, i]));
  const stored = readJson<{ results: GradcafeResult[]; done: string[] }>(GRADCAFE_FILE, { results: [], done: [] });
  // Results read before the check above are checked now.
  const results = new Map(stored.results.filter((r) => byId.has(r.institutionId) && sameInstitution(r.institution, byId.get(r.institutionId)!)).map((r) => [r.id, r]));
  console.log(`Stored results kept: ${results.size} of ${stored.results.length}`);
  const done = new Set(stored.done);
  const save = () => writeJson(GRADCAFE_FILE, { source: "The GradCafe admissions survey (thegradcafe.com/survey)", checked: today(), results: [...results.values()], done: [...done] });

  const withProgrammes = new Set(readJson<{ programmes: { institutionId: string }[] }>(OUTPUT_FILE, { programmes: [] }).programmes.map((p) => p.institutionId));
  const todo = institutions
    .filter((i) => withProgrammes.has(i.id) && COUNTRIES.includes(i.country ?? "") && (!a.only || a.only.includes(i.id)) && (a.refresh || !done.has(i.id)))
    .sort((x, y) => Number(!ASIA.includes(x.country ?? "")) - Number(!ASIA.includes(y.country ?? "")) || (x.qs?.rankValue ?? 9999) - (y.qs?.rankValue ?? 9999));
  const maxPages = Number(process.argv.find((x) => x.startsWith("--pages="))?.slice(8)) || MAX_PAGES;
  console.log(`Universities to read: ${todo.length}`);

  for (const inst of todo) {
    let url: string | null = `${BASE}/survey/?institution=${encodeURIComponent(searchName(inst))}&degree=Masters&sort=newest`;
    let pages = 0, kept = 0, failed = false;
    while (url && pages < maxPages) {
      const r = await politeFetch(url);
      pages++;
      if (!r.ok) {
        console.log(`${inst.id}: ${r.reason} ${r.detail}`);
        if (r.reason === "robots" || r.reason === "blocked") {
          save();
          await closeBrowser();
          return;
        }
        // A first page that fails (GradCafe answers some searches with HTTP 500) is left for a later run.
        failed = pages === 1;
        break;
      }
      const { results: found, next } = parseSurvey(r.body.toString("utf8"), inst.id);
      const recent = found.filter((x) => (x.added ?? "9999") >= SINCE);
      for (const x of recent) {
        if (!sameInstitution(x.institution, inst)) continue;
        results.set(x.id, x);
        kept++;
      }
      url = recent.length === found.length && found.length ? next : null;
    }
    if (failed) continue;
    done.add(inst.id);
    save();
    console.log(`${inst.id.padEnd(55)} pages ${pages} · results kept ${kept} · total ${results.size}`);
  }
  save();
  console.log(`Results: ${results.size}`);
  await closeBrowser();
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/pipeline/gradcafe-results.ts")) {
  keepRunning();
  main();
}
