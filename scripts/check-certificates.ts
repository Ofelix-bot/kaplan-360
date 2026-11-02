// Checks data/raw/certificates.json (professional-qualification facts for the "Qualifications" road of /next-steps):
// - every Kaplan programme whose level is not "diploma" (data/raw/kaplan-programmes.json) has an entry, and no other;
// - ACCA's 13 exams are named with ACCA's own codes, and every exempt code is one of the nine exemptable exams;
// - each body's fact has a valid status, an https URL, a non-empty quote and a read date (YYYY-MM-DD);
// - an ACCA exempt list appears exactly when the status is "exempt", and its count equals its length;
// - ISCA and Chartered Accountants Ireland facts have the same shape, their URLs sit on the body's own
//   host, and Chartered Accountants Ireland appears exactly on the University College Dublin degrees;
//   CPA Ireland (incorporated into Chartered Accountants Ireland on 1 September 2024) is no longer a body.
// Prints the status mix per body. Exits non-zero on a failure. Usage: npx tsx scripts/check-certificates.ts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(ROOT, file), "utf8")) as T;
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) failures.push(what);
};

type Fact = {
  status: string;
  url: string;
  path?: string;
  quote: string;
  read: string;
  note?: string;
  exempt?: string[] | null;
  count?: number | null;
  assessed?: boolean;
  category?: { name: string; example: string | null; law?: boolean };
};
type Certificates = {
  dataset: string;
  checked: string;
  bodies: Record<string, { name: string; url: string; quote: string; exams?: string[] }>;
  programmes: Record<string, Record<string, Fact>>;
  notes: string[];
};
const data = read<Certificates>("data/raw/certificates.json");
const programmes = read<{ programmes: { id: string; level: string; university: string | null }[] }>("data/raw/kaplan-programmes.json").programmes;

const BODIES = ["acca", "isca", "cpa-australia", "cai", "cfa"] as const;
type Body = (typeof BODIES)[number];
const STATUSES: Record<Body, string[]> = {
  acca: ["exempt", "none", "unread"],
  // accredited: the degree is on ISCA's accredited-degree list; recognised: the university is on its recognised list.
  // case-by-case: the university is not on the recognised list, which says ISCA then assesses case by case;
  // not-listed: the list does not cover the qualification at all (it covers degrees).
  isca: ["accredited", "recognised", "case-by-case", "not-listed", "unread"],
  "cpa-australia": ["accredited", "not-listed", "unread"],
  // exempt: the degree is on Chartered Accountants Ireland's exemptions list; not-listed: it is not.
  cai: ["exempt", "not-listed", "unread"],
  cfa: ["affiliated", "not-listed", "unread"],
};
// Bodies whose facts appear only on some degrees: the awarding university decides.
const ONLY: Partial<Record<Body, string>> = { cai: "University College Dublin" };
// Every URL of these bodies (body entry and facts) must sit on the body's own site.
const HOSTS: Partial<Record<Body, string>> = { isca: "isca.org.sg", cai: "charteredaccountants.ie" };
const onHost = (u: string, host: string) => {
  try {
    const h = new URL(u).hostname;
    return h === host || h.endsWith(`.${host}`);
  } catch {
    return false;
  }
};
// Applied Knowledge and Applied Skills: the only exams ACCA awards exemptions from.
const EXEMPTABLE = ["BT", "MA", "FA", "LW", "PM", "TX", "FR", "AA", "FM"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const https = (u: unknown) => typeof u === "string" && /^https:\/\/[^\s]+$/.test(u);
const text = (s: unknown) => typeof s === "string" && s.trim().length > 0;

// 0. The file and its bodies.
check(data.dataset === "Professional-qualification facts for Kaplan degrees", `dataset is "${data.dataset}"`);
check(DATE.test(data.checked), `checked "${data.checked}" is not a date`);
check(Array.isArray(data.notes) && data.notes.every(text), "notes must be non-empty strings");
for (const b of BODIES) {
  const body = data.bodies[b];
  check(!!body, `bodies.${b} missing`);
  if (!body) continue;
  check(text(body.name), `bodies.${b}.name empty`);
  check(https(body.url), `bodies.${b}.url not https: ${body.url}`);
  check(text(body.quote), `bodies.${b}.quote empty`);
  const host = HOSTS[b];
  if (host) check(onHost(body.url, host), `bodies.${b}.url not on ${host}: ${body.url}`);
}
const exams = data.bodies.acca?.exams ?? [];
check(exams.length === 13, `ACCA lists ${exams.length} exams, expected 13`);
for (const code of [...EXEMPTABLE, "SBL", "SBR"]) check(exams.includes(code), `ACCA exams lack ${code}`);

// 1. Scope: every non-diploma Kaplan programme, and nothing else.
const scope = programmes.filter((p) => p.level !== "diploma").map((p) => p.id);
for (const id of scope) check(id in data.programmes, `${id} missing`);
for (const id of Object.keys(data.programmes)) check(scope.includes(id), `${id} is not an in-scope Kaplan programme`);

// 2. Every fact.
const mix: Record<string, Record<string, number>> = Object.fromEntries(BODIES.map((b) => [b, {}]));
for (const [id, entry] of Object.entries(data.programmes)) {
  const university = programmes.find((p) => p.id === id)?.university ?? null;
  for (const k of Object.keys(entry)) check((BODIES as readonly string[]).includes(k), `${id}: unknown body "${k}"`);
  // A Chartered Accountants Ireland fact that is not an exemption says where its student lives (its own words).
  const cai = entry.cai;
  if (cai && cai.status === "not-listed") check(!!cai.note?.includes("must live on the island of Ireland"), `${id} cai: note lacks the island-of-Ireland rule`);
  for (const b of BODIES) {
    const f = entry[b];
    const only = ONLY[b];
    if (only && university !== only) {
      check(!f, `${id}: ${b} is for ${only} degrees only`);
      continue;
    }
    check(!!f, `${id}: ${b} missing`);
    if (!f) continue;
    const where = `${id} ${b}`;
    const host = HOSTS[b];
    if (host) check(onHost(f.url, host), `${where}: url not on ${host}: ${f.url}`);
    check(STATUSES[b].includes(f.status), `${where}: status "${f.status}"`);
    check(https(f.url), `${where}: url not https: ${f.url}`);
    check(text(f.quote), `${where}: quote empty`);
    check(DATE.test(f.read), `${where}: read "${f.read}" is not a date`);
    check(f.note === undefined || text(f.note), `${where}: note empty`);
    if (f.status === "unread") check(text(f.note), `${where}: unread without a reason in note`);
    // `path` is our navigation text, shown plain; the quote after it is the page's own words.
    check(f.path === undefined || (text(f.path) && !f.path.startsWith("“") && !/:\s*$/.test(f.path)), `${where}: path "${f.path}"`);
    mix[b][f.status] = (mix[b][f.status] ?? 0) + 1;
    if (b !== "acca") {
      check(f.assessed === undefined && f.category === undefined, `${where}: assessed/category are ACCA's only`);
      // Quotes are the page's own words, in curly quotes.
      if (HOSTS[b]) check(f.quote.startsWith("“") && f.quote.endsWith("”"), `${where}: quote not in “…”`);
      // A Chartered Accountants Ireland exempt list names that body's own exams, so only its shape is checked.
      if (b === "cai" && f.status === "exempt") {
        const list = f.exempt ?? [];
        check(list.length > 0 && list.every(text), `${where}: exempt without an exempt list`);
        check(f.count === list.length, `${where}: count ${f.count} but ${list.length} exempt`);
      } else check(f.exempt == null && f.count == null, `${where}: exempt list with status "${f.status}"`);
      continue;
    }
    if (f.status !== "unread") check(typeof f.assessed === "boolean", `${where}: assessed is not a boolean`);
    if (f.category) {
      const c = f.category;
      check(f.assessed === false, `${where}: a category on an assessed degree`);
      check(text(c.name), `${where}: category name empty`);
      check(c.example === null || text(c.example), `${where}: category example empty`);
      check(c.law === undefined || typeof c.law === "boolean", `${where}: category law is not a boolean`);
      check(!c.law || (f.exempt ?? []).includes("LW"), `${where}: category law without LW exempt`);
    }
    if (f.assessed === false && f.status === "exempt") check(!!f.category, `${where}: an unassessed exempt degree without a category`);
    if (f.status === "exempt") {
      const list = f.exempt ?? [];
      check(Array.isArray(f.exempt) && list.length > 0, `${where}: exempt without an exempt list`);
      check(f.count === list.length, `${where}: count ${f.count} but ${list.length} exempt`);
      check(new Set(list).size === list.length, `${where}: exempt list repeats a code`);
      for (const code of list) check(EXEMPTABLE.includes(code), `${where}: ${code} is not an exemptable ACCA exam`);
    } else {
      check(f.exempt === null || f.exempt === undefined, `${where}: exempt list with status "${f.status}"`);
      check(f.count === null || f.count === undefined, `${where}: count with status "${f.status}"`);
    }
  }
}

console.log(`certificates: ${Object.keys(data.programmes).length} programmes (in scope ${scope.length}), checked ${data.checked}`);
for (const b of BODIES) console.log(`  ${b}: ${Object.entries(mix[b]).map(([s, n]) => `${s} ${n}`).join(", ")}`);
if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("all certificate checks pass");
