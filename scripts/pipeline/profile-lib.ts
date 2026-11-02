import { readFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config";
import { pageText } from "./extract-lib";
import { pdfPages } from "./pdf";

// Shared by the class-profile steps (profile-discover.ts, profile-fetch.ts, profile-ai.ts).

export const PROFILE_DIR = path.join(DATA_DIR, "profiles");
export const PROFILE_SOURCES_FILE = path.join(PROFILE_DIR, "sources.json");
export const PROFILE_SEARCH_FILE = path.join(PROFILE_DIR, "search.json");
export const PROFILE_AI_FILE = path.join(PROFILE_DIR, "ai.json");

export type ProfilePage = {
  url: string;
  institutionId: string;
  /** The programme whose page holds or links to the profile (empty for sitemap and search finds). */
  programmeIds: string[];
  kind: "inline" | "link" | "sitemap" | "search";
  /** For "inline": the line where the profile starts, so only that part of the page is read. */
  anchor?: string;
};

/** A heading or link that introduces a class profile. */
export const PROFILE_ANCHOR =
  /\b(class|cohort|intake|student) profile\b|\bclass of 20\d\d\b|\bincoming class\b|\bclass (composition|snapshot|statistics|at a glance)\b|\bcohort (statistics|snapshot)\b|\bmeet the class\b|\bour (current )?(class|cohort)\b|\bcurrent cohort\b|\bthe (\d{4}(\/\d{2,4})?|current) cohort\b/i;
/** A figure a class profile gives. */
export const PROFILE_FIGURE =
  /\baverage age\b|\bmedian age\b|\bage range\b|\b\d{1,3} nationalit(y|ies)\b|\bnationalities\b|\b(average|median|mean) (gmat|gre|gpa|undergraduate gpa|cgpa|work experience|years)\b|\b(gmat|gre|gpa|cgpa)\b.{0,30}\b(average|median|mean|range)\b|\bundergraduate (institutions|universities|schools|majors|backgrounds?)\b|\b\d{1,3}\s?%\s*(international|female|women|male|men|of (the )?(class|cohort|students))\b|\b(international|female|women) students?\b.{0,12}\d{1,3}\s?%|\byears? of (full-time |professional |relevant )?work experience\b|\b(class|cohort) size\b|\bcountries represented\b|\bstudents (in the class|enrolled)\b/i;

/** The text of a cached page, as lines: HTML through the extraction rules' reader, PDF through PDF.js (unpdf). */
export async function pageLines(url: string, file: string): Promise<string[]> {
  if (file.endsWith(".pdf")) return (await pdfPages(file)).flatMap((t) => t.split(/\n+/)).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  return pageText({ url, html: readFileSync(file, "utf8") }).lines;
}

/** For comparing a quote with the page: straight quotes, one space, lower case. */
export const squash = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[‐‑–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();

const DEGREE_WORDS =
  /\b(master|masters|master's|of|in|science|arts|the|and|programme|program|degree|msc|m\.sc|ma|ms|mba|mres|mphil|meng|mfin|mcom|full[- ]time|part[- ]time|\d{4}(\/\d{2,4})?|intake|cohort|class|profile)\b/g;

/** A university's short name in a profile's title ("The NUS MSc in Finance", "HKUST MSc in Marketing"). */
const SCHOOL_WORDS = /\b(nus|ntu|smu|sutd|hku|hkust|cuhk|polyu|cityu|hkbu|eduhk|lse|ucl|ucd|tcd|mbs|nyu|mit|ucla)\b/g;

/** The words of a programme name that tell it apart: "MSc in Business Analytics (MSBA)" → business, analytics, msba. */
export function nameWords(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[()[\],.:;'"/|-]/g, " ")
      .replace(DEGREE_WORDS, " ")
      .replace(SCHOOL_WORDS, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
}

/** A programme name's initials: "Master of Science in Global Operations" → "msgo". */
export function acronym(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(of|in|and|the|for|with)$/.test(w))
    .flatMap((w) => (w === "msc" ? ["master", "science"] : w === "ma" ? ["master", "arts"] : [w]))
    .map((w) => w[0])
    .join("");
}

/** A profile that names the programme by its initials ("HKUST MSGO"). */
export const namedByAcronym = (profile: string, programme: string) => {
  const a = acronym(programme);
  return a.length >= 3 && profile.toLowerCase().split(/[^a-z]+/).includes(a);
};

/** How alike two programme names are (0–1), on their telling words. */
export function nameMatch(a: string, b: string): number {
  const x = nameWords(a);
  const y = nameWords(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / new Set([...x, ...y]).size;
}
