// Joins the openings checks (data/raw/career-employers.json) with each employer's list memberships:
// Fortune Global 500 2026 (data/raw/fortune-global-500-2026.json), LinkedIn Top Companies Singapore
// 2026, and the employers named in Kaplan's 2021/22 graduate survey. Writes data/raw/career-companies.json
// for npm run data:load. Usage: npx tsx scripts/careers/build-employers.ts
//
// --roles: joins data/raw/career-role-openings.json (check-openings.ts --roles) the same way and writes
// data/raw/career-role-employers.json as { built, rows: career_role_employers rows } (snake_case). Only
// checked employers are kept (status ok / no-listing; a failed check is not a check, so the page shows
// nothing for it), only for roles still hot in data/raw/careers-roles.json, and never a skipped employer.
// Usage: npx tsx scripts/careers/build-employers.ts --roles
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { today, writeJson } from "../pipeline/util";
import { EMPLOYERS, type Employer } from "./employers";

const read = (f: string) => JSON.parse(readFileSync(f, "utf8"));
const fortune = new Set((read("data/raw/fortune-global-500-2026.json").companies as { name: string }[]).map((c) => c.name));
const kaplanEmployers = new Set(read("data/raw/kaplan-degree-enrolment-day-2026-03.json").graduateEmployers.namesEn as string[]);

/** Keys of COMPANY_LISTS in lib/data/careers.ts. */
function listsOf(e: Employer) {
  if (e.fortuneName && !fortune.has(e.fortuneName)) console.warn(`${e.id}: "${e.fortuneName}" is not in the Fortune Global 500 2026 file`);
  if (e.kaplanGraduatesName && !kaplanEmployers.has(e.kaplanGraduatesName)) console.warn(`${e.id}: "${e.kaplanGraduatesName}" is not in the Kaplan graduate-employer list`);
  return [
    e.fortuneName && fortune.has(e.fortuneName) ? "fortune-global-500-2026" : null,
    e.linkedinTopSg2026 ? "linkedin-top-companies-sg-2026" : null,
    e.kaplanGraduatesName && kaplanEmployers.has(e.kaplanGraduatesName) ? "kaplan-graduate-employers" : null,
  ].filter((x): x is string => !!x);
}

function careersMode() {
  const checks = read("data/raw/career-employers.json").checks as { career: string; employer: string; url: string; checkedAt: string; status: string; openings: number }[];
  const rows = checks
    .filter((c) => !EMPLOYERS.find((e) => e.id === c.employer)?.skip)
    .map((c) => {
      const e = EMPLOYERS.find((x) => x.id === c.employer)!;
      return { careerId: c.career, employerId: e.id, company: e.name, lists: listsOf(e), careersUrl: e.careersUrl, searchUrl: c.url, openings: c.openings, status: c.status, retrievedAt: c.checkedAt };
    });

  writeFileSync(
    "data/raw/career-companies.json",
    JSON.stringify(
      {
        builtAt: today(),
        lists: {
          "fortune-global-500-2026": { name: "Fortune Global 500, 2026", url: "https://fortune.com/ranking/global500/" },
          "linkedin-top-companies-sg-2026": { name: "LinkedIn Top Companies 2026: Singapore (published 28 April 2026), as reported by TechNode Global", url: "https://technode.global/2026/04/29/linkedin-names-top-companies-for-career-growth-in-singapore-for-2026/" },
          "kaplan-graduate-employers": { name: "Employers named in Kaplan's 2021/22 graduate employment survey (Degree Enrolment Day deck, p. 13)", url: null },
        },
        // Employers added for --roles only (careers: []) are not part of this file.
        skipped: EMPLOYERS.filter((e) => e.skip && e.careers.length > 0).map((e) => ({ employerId: e.id, company: e.name, reason: e.skip })),
        rows,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`${rows.length} career–employer rows; ${rows.filter((r) => r.openings > 0).length} with Singapore openings`);
}

/** A career_role_employers row (supabase/migrations/20261029110000_careers_industries.sql). */
type RoleEmployerRow = {
  role_id: string;
  employer_id: string;
  company: string;
  company_lists: string[];
  careers_url: string | null;
  search_url: string | null;
  openings: number;
  status: "ok" | "no-listing" | "failed";
  checked_on: string;
};

function rolesMode() {
  const IN = "data/raw/career-role-openings.json";
  if (!existsSync(IN)) {
    console.error(`${IN} is missing: run scripts/careers/check-openings.ts --roles first.`);
    process.exitCode = 1;
    return;
  }
  const checks = read(IN).checks as { role: string; employer: string; url: string; checkedAt: string; status: RoleEmployerRow["status"]; openings: number }[];
  const roles = existsSync("data/raw/careers-roles.json") ? (read("data/raw/careers-roles.json").roles as { id: string; hot?: boolean; mom_needs?: boolean; high_pay?: boolean }[]) : null;
  const hot = roles ? new Set(roles.filter((r) => r.hot ?? (!!r.mom_needs || !!r.high_pay)).map((r) => r.id)) : null;
  if (!hot) console.warn("data/raw/careers-roles.json is missing: rows are not filtered to the current hot roles");

  const dropped = { failed: 0, skipped: 0, notHot: 0, unknown: 0 };
  const rows: RoleEmployerRow[] = [];
  for (const c of checks) {
    const e = EMPLOYERS.find((x) => x.id === c.employer);
    if (!e) dropped.unknown++;
    else if (e.skip) dropped.skipped++;
    else if (hot && !hot.has(c.role)) dropped.notHot++;
    else if (c.status === "failed") dropped.failed++;
    else rows.push({ role_id: c.role, employer_id: e.id, company: e.name, company_lists: listsOf(e), careers_url: e.careersUrl, search_url: c.url, openings: c.openings, status: c.status, checked_on: c.checkedAt });
  }
  rows.sort((a, b) => a.role_id.localeCompare(b.role_id) || b.openings - a.openings || a.employer_id.localeCompare(b.employer_id));
  writeJson("data/raw/career-role-employers.json", { built: today(), rows });
  const withOpenings = new Set(rows.filter((r) => r.openings > 0).map((r) => r.role_id)).size;
  console.log(`${rows.length} role–employer rows for ${new Set(rows.map((r) => r.role_id)).size} roles; ${withOpenings} roles with Singapore openings. Left out: ${dropped.failed} failed checks, ${dropped.skipped} skipped employers, ${dropped.notHot} roles no longer hot, ${dropped.unknown} unknown employers.`);
}

if (process.argv.includes("--roles")) rolesMode();
else careersMode();
