// For each career, checks the candidate employers' official careers sites for current openings in
// Singapore. The search page is loaded in the browser (politely, robots.txt honoured); Claude (Haiku)
// lists the postings on it that are in Singapore and fit the career, and each title must appear on
// the page verbatim to count. Only counts are kept for the site (no posting text is republished).
// Writes data/raw/career-employers.json.
// Usage: npx tsx scripts/careers/check-openings.ts [--only=google,dbs] [--probe]
//
// --roles mode (the /careers hot roles, Q26): jobs are employer × the hot roles of the employer's
// `industries` (data/raw/careers-roles.json: hot = mom_needs or high_pay; search_term / search_scope per
// role). Each search page is fetched once per run and shared by every role with that search term; one
// Claude call per role, same model, forced tool and verbatim-title rule as above. Keys already checked
// (status ok / no-listing) are skipped unless --refresh. Writes data/raw/career-role-openings.json after
// every check, so a stopped run resumes where it left off.
// Usage: npx tsx scripts/careers/check-openings.ts --roles [--only=dbs,ey] [--budget=2] [--limit=N] [--refresh]
//        npx tsx scripts/careers/check-openings.ts --roles --probe [--only=pwc] [--term=analyst]
// --budget=<USD> (default 2): the run does not start when its estimate exceeds the budget, and stops
// before any call that could take the spend past it (worst case reserved per call in flight).

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { closeBrowser } from "../pipeline/browser";
import { politeFetch, routeThroughBrowser } from "../pipeline/http";
import { pageText } from "../pipeline/extract-lib";
import { args, keepRunning, pool, readJson, today, writeJson } from "../pipeline/util";
import { EMPLOYERS, ROLE_SCOPE, SEARCH_TERMS, type Employer } from "./employers";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

const OUT = "data/raw/career-employers.json";
const ROLES_IN = "data/raw/careers-roles.json";
const INDUSTRIES_IN = "data/raw/careers-industries.json";
const ROLES_OUT = "data/raw/career-role-openings.json";
const MODEL = "claude-haiku-5-5";
const MAX_TOKENS = 1500;
const PAGE_CHARS = 24_000;
/** claude-haiku-5-5, US$ per million tokens (prompts up to 100K tokens; ours stay under 10K). */
const PRICE = { input: 0.1, output: 0.5 };
/** Pre-run estimate per call (plan §2.7): page text up to 24,000 characters plus the prompt, and output incl. thinking. */
const EST = { input: 6_500, output: 1_200 };

type Check = { career: string; employer: string; url: string; checkedAt: string; status: "ok" | "no-listing" | "failed"; openings: number; titles: string[]; detail?: string };

/** One row of data/raw/career-role-openings.json. Titles are kept for checking only; the site shows counts. */
export type RoleCheck = {
  role: string;
  industry: string;
  employer: string;
  term: string;
  url: string;
  checkedAt: string;
  status: "ok" | "no-listing" | "failed";
  openings: number;
  titles: string[];
  /** Titles Claude returned that are not on the page as written (not counted). */
  dropped?: number;
  detail?: string;
};

export type RoleOpeningsFile = { note: string; model: string; spentUsd: number; checks: RoleCheck[] };

/** The fields of a careers-roles.json role row (career_roles, snake_case) this script reads. */
type RoleRow = { id: string; industry_id: string; title: string; short?: string; hot?: boolean; mom_needs?: boolean; high_pay?: boolean; search_term?: string | null; search_scope?: string | null };

const TOOL: Anthropic.Tool = {
  name: "report_postings",
  description: "Report the job postings listed on this careers search page.",
  input_schema: {
    type: "object",
    properties: {
      isJobListing: { type: "boolean", description: "true if the page text lists job postings (search results), false for an error, empty or unrelated page" },
      postings: {
        type: "array",
        description: "Postings located in Singapore whose job fits the career. Copy each title exactly as written on the page.",
        items: { type: "object", properties: { title: { type: "string" }, location: { type: "string" } }, required: ["title"] },
      },
    },
    required: ["isJobListing", "postings"],
  },
};

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** `--name=value` from the command line (util.args() reads only only/limit). */
const opt = (name: string) => process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const usd = (inTok: number, outTok: number) => (inTok * PRICE.input + outTok * PRICE.output) / 1_000_000;

function makeClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  return key ? new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined }) : null;
}

type Postings = { isJobListing: boolean; postings: { title: string; location?: string }[] };

/** The postings Claude reports, with every title checked against the page as written. */
function verbatim(data: Postings, lines: string[]) {
  const pageSquashed = squash(lines.join(" "));
  const titles = [...new Set(data.postings.map((p) => p.title.trim()).filter((t) => t && pageSquashed.includes(squash(t))))];
  return { titles, dropped: data.postings.length - titles.length };
}

async function careersMode() {
  const a = args();
  const careers = JSON.parse(readFileSync("data/raw/careers.json", "utf8")).careers as { id: string; title: string }[];
  const titleOf = new Map(careers.map((c) => [c.id, c.title]));
  // Employers added for --roles only (careers: []) take no part here.
  const employers = EMPLOYERS.filter((e) => !e.skip && e.careers.length > 0 && (!a.only || a.only.includes(e.id)));
  routeThroughBrowser(employers.map((e) => new URL(e.search("x")).origin));
  const client = makeClient();
  const prev = readJson<{ checks: Check[] }>(OUT, { checks: [] });
  const checks = new Map(prev.checks.map((c) => [`${c.employer}|${c.career}`, c]));
  const jobs = employers.flatMap((e) => (a.flag("probe") ? [e.careers[0]] : e.careers).map((career) => ({ e, career })));
  console.log(`${jobs.length} searches on ${employers.length} employers' careers sites…`);

  // One employer at a time per host (http.ts paces requests); several employers in parallel.
  const byEmployer = Object.values(Object.groupBy(jobs, (j) => j.e.id)) as (typeof jobs)[];
  await pool(byEmployer, 6, async (list) => {
    for (const { e, career } of list) {
      const url = e.search(SEARCH_TERMS[career]);
      const res = await politeFetch(url).catch((err: Error) => ({ ok: false as const, reason: "network" as const, detail: err.message }));
      const base = { career, employer: e.id, url, checkedAt: today() };
      if (!res.ok) {
        checks.set(`${e.id}|${career}`, { ...base, status: "failed", openings: 0, titles: [], detail: `${res.reason} ${res.detail}` });
        console.log(`${e.id.padEnd(20)} ${career.padEnd(32)} failed: ${res.reason} ${res.detail.slice(0, 80)}`);
        continue;
      }
      const page = pageText({ url, html: res.body.toString("utf8") });
      const text = page.lines.join("\n").slice(0, PAGE_CHARS);
      if (a.flag("probe") || !client) {
        const sg = page.lines.filter((l) => /singapore/i.test(l)).length;
        console.log(`${e.id.padEnd(20)} ${career.padEnd(32)} ${page.lines.length} lines, ${sg} mention Singapore | ${page.lines.slice(0, 60).join(" · ").slice(0, 220)}`);
        continue;
      }
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [
          {
            role: "user",
            content: `Careers search page of ${e.name}, searched for "${SEARCH_TERMS[career]}" in Singapore. Career: ${titleOf.get(career)}.\nList only postings located in Singapore whose job is this career. Counts: ${ROLE_SCOPE[career]} Seniority levels count; jobs that merely mention the keyword do not. If the page shows no posting locations, include only postings the page lists under a Singapore filter or heading. Copy titles exactly.\n\nPage text:\n${text}`,
          },
        ],
      });
      const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      const data = (call?.input ?? { isJobListing: false, postings: [] }) as Postings;
      // A title counts only when it is on the page as written.
      const { titles } = verbatim(data, page.lines);
      checks.set(`${e.id}|${career}`, { ...base, status: data.isJobListing ? "ok" : "no-listing", openings: titles.length, titles });
      console.log(`${e.id.padEnd(20)} ${career.padEnd(32)} ${data.isJobListing ? `${titles.length} openings (${data.postings.length - titles.length} dropped)` : "no job listing on the page"}`);
      writeJson(OUT, { note: "Openings in Singapore on each employer's own careers site, by career. Titles are kept for checking only; the site shows employer names and counts.", checks: [...checks.values()] });
    }
  });
  await closeBrowser();
}

type RoleJob = { e: Employer; role: RoleRow; term: string; url: string; key: string };

const roleKey = (employer: string, role: string) => `${employer}|${role}`;

const isHot = (r: RoleRow) => r.hot ?? (!!r.mom_needs || !!r.high_pay);

function rolePrompt(e: Employer, role: RoleRow, sector: string, term: string, text: string) {
  const scope = role.search_scope?.trim() || `the role "${role.title}" and roles doing the same work under another title.`;
  const where = e.singaporeOnly
    ? `Every posting on this site is in Singapore (${e.singaporeOnly}), so a posting needs no location shown.`
    : "If the page shows no posting locations, include only postings the page lists under a Singapore filter or heading.";
  return `Careers search page of ${e.name}, searched for "${term}" in Singapore. Role: ${role.title} (Skills Framework, ${sector} sector).\nList only postings located in Singapore whose job is this role. Counts: ${scope} Seniority levels count; jobs that merely mention the keyword do not. ${where} Copy titles exactly.\n\nPage text:\n${text}`;
}

async function rolesMode() {
  const a = args();
  const probe = a.flag("probe");
  const budgetArg = opt("budget");
  const budget = budgetArg === undefined ? 2 : Number(budgetArg);
  if (!Number.isFinite(budget) || budget < 0) throw new Error(`--budget must be a number of US dollars, got "${budgetArg}"`);
  const probeTerm = opt("term");

  const employers = EMPLOYERS.filter((e) => !e.skip && e.industries.length > 0 && (!a.only || a.only.includes(e.id)));
  if (a.only) for (const id of a.only) if (!employers.some((e) => e.id === id)) console.warn(`${id}: not an employer, skipped, or without industries`);

  const rolesFile = readJson<{ roles: RoleRow[] } | null>(ROLES_IN, null);
  if (!rolesFile && !(probe && probeTerm)) {
    console.error(`${ROLES_IN} is missing: run scripts/careers/build-careers-data.mjs first (or --probe --term=<keyword> to look at page shapes).`);
    process.exitCode = 1;
    return;
  }
  const sectorOf = new Map(readJson<{ industries: { id: string; sector: string }[] }>(INDUSTRIES_IN, { industries: [] }).industries.map((i) => [i.id, i.sector]));
  const hot = (rolesFile?.roles ?? []).filter(isHot);
  const noTerm = hot.filter((r) => !r.search_term?.trim());
  if (noTerm.length) console.warn(`${noTerm.length} hot roles have no search_term and are not searched: ${noTerm.slice(0, 8).map((r) => r.id).join(", ")}${noTerm.length > 8 ? ", …" : ""}`);
  const searchable = hot.filter((r) => r.search_term?.trim());

  const prev = readJson<RoleOpeningsFile>(ROLES_OUT, { note: "", model: MODEL, spentUsd: 0, checks: [] });
  const checks = new Map(prev.checks.map((c) => [roleKey(c.employer, c.role), c]));
  const done = (key: string) => !a.refresh && (checks.get(key)?.status ?? "failed") !== "failed";

  const all: RoleJob[] = employers.flatMap((e) =>
    searchable
      .filter((r) => e.industries.includes(r.industry_id))
      .map((role) => {
        const term = role.search_term!.trim();
        return { e, role, term, url: e.search(term), key: roleKey(e.id, role.id) };
      }),
  );

  // Coverage: which industries have hot roles and which employers search them.
  const industries = [...new Set(hot.map((r) => r.industry_id))].sort();
  for (const ind of industries) {
    const roles = searchable.filter((r) => r.industry_id === ind).length;
    const emps = employers.filter((e) => e.industries.includes(ind)).map((e) => e.id);
    console.log(`${ind.padEnd(34)} ${String(roles).padStart(3)} hot roles searchable · employers: ${emps.length ? emps.join(", ") : "none (no openings shown)"}`);
  }

  if (probe) {
    // One page per employer, no Claude call: confirms the page shape.
    routeThroughBrowser(employers.map((e) => new URL(e.search("x")).origin));
    const targets = employers.map((e) => {
      const j = all.find((x) => x.e.id === e.id);
      const term = probeTerm ?? j?.term ?? null;
      return term ? { e, term, url: e.search(term) } : null;
    }).filter((x): x is { e: Employer; term: string; url: string } => !!x);
    console.log(`probe: ${targets.length} pages, no Claude calls`);
    await pool(targets, 6, async ({ e, term, url }) => {
      const res = await politeFetch(url).catch((err: Error) => ({ ok: false as const, reason: "network" as const, detail: err.message }));
      if (!res.ok) return void console.log(`${e.id.padEnd(20)} "${term}" failed: ${res.reason} ${res.detail.slice(0, 120)}`);
      const page = pageText({ url, html: res.body.toString("utf8") });
      const sg = page.lines.filter((l) => /singapore/i.test(l)).length;
      console.log(`${e.id.padEnd(20)} "${term}" ${page.lines.length} lines, ${sg} mention Singapore | ${page.lines.slice(0, 80).join(" · ").slice(0, 600)}`);
    });
    await closeBrowser();
    return;
  }

  let pending = all.filter((j) => !done(j.key));
  if (a.limit !== null) pending = pending.slice(0, a.limit);
  const pages = new Set(pending.map((j) => j.url)).size;
  const estimate = pending.length * usd(EST.input, EST.output);
  console.log(`${all.length} employer × role jobs; ${all.length - all.filter((j) => !done(j.key)).length} already checked; ${pending.length} to run on ${pages} search pages.`);
  console.log(`Estimate: ${pending.length} calls × (${EST.input} in + ${EST.output} out) on ${MODEL} ≈ US$${estimate.toFixed(3)}; budget US$${budget.toFixed(2)}; spent on earlier runs US$${(prev.spentUsd ?? 0).toFixed(3)}.`);
  if (!pending.length) return;
  if (estimate > budget) {
    console.error(`The estimate is over the budget: nothing was run. Raise --budget or narrow with --only / --limit.`);
    process.exitCode = 1;
    return;
  }
  const client = makeClient();
  if (!client) {
    console.error("ANTHROPIC_API_KEY is not set: nothing was run.");
    process.exitCode = 1;
    return;
  }

  routeThroughBrowser([...new Set(pending.map((j) => new URL(j.url).origin))]);
  let spent = 0;
  let reserved = 0;
  let stopped = false;
  let calls = 0;
  const save = () =>
    writeJson(ROLES_OUT, {
      note: "Openings in Singapore on each employer's own careers site, by /careers hot role. Titles are kept for checking only; the site shows employer names and counts.",
      model: MODEL,
      spentUsd: Math.round(((prev.spentUsd ?? 0) + spent) * 1e6) / 1e6,
      checks: [...checks.values()],
    } satisfies RoleOpeningsFile);

  // One employer at a time per host (http.ts paces requests); several employers in parallel.
  const byEmployer = Object.values(Object.groupBy(pending, (j) => j.e.id)) as RoleJob[][];
  await pool(byEmployer, 6, async (list) => {
    const byUrl = Object.values(Object.groupBy(list, (j) => j.url)) as RoleJob[][];
    for (const group of byUrl) {
      if (stopped) return;
      const { e, term, url } = group[0];
      const res = await politeFetch(url).catch((err: Error) => ({ ok: false as const, reason: "network" as const, detail: err.message }));
      if (!res.ok) {
        for (const j of group) checks.set(j.key, { role: j.role.id, industry: j.role.industry_id, employer: e.id, term, url, checkedAt: today(), status: "failed", openings: 0, titles: [], detail: `${res.reason} ${res.detail}` });
        console.log(`${e.id.padEnd(20)} "${term}" failed: ${res.reason} ${res.detail.slice(0, 80)}`);
        save();
        continue;
      }
      const page = pageText({ url, html: res.body.toString("utf8") });
      const text = page.lines.join("\n").slice(0, PAGE_CHARS);
      for (const j of group) {
        const prompt = rolePrompt(e, j.role, sectorOf.get(j.role.industry_id) ?? j.role.industry_id, term, text);
        // Worst case for this call: ~3 characters per input token (plus the tool), and the full max_tokens.
        const worst = usd(Math.ceil((prompt.length + 1_200) / 3), MAX_TOKENS);
        if (stopped || spent + reserved + worst > budget) {
          if (!stopped) console.warn(`Budget reached (spent US$${spent.toFixed(3)} + in flight US$${reserved.toFixed(3)} of US$${budget.toFixed(2)}): stopping; rerun to resume.`);
          stopped = true;
          return;
        }
        reserved += worst;
        let msg: Anthropic.Message;
        try {
          msg = await client.messages.create({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            tools: [TOOL],
            tool_choice: { type: "tool", name: TOOL.name },
            messages: [{ role: "user", content: prompt }],
          });
        } catch (err) {
          reserved -= worst;
          const detail = err instanceof Anthropic.APIError ? `api ${err.status ?? ""} ${err.message}` : `error ${(err as Error).message}`;
          checks.set(j.key, { role: j.role.id, industry: j.role.industry_id, employer: e.id, term, url, checkedAt: today(), status: "failed", openings: 0, titles: [], detail });
          console.log(`${e.id.padEnd(20)} ${j.role.id.slice(0, 40).padEnd(40)} failed: ${detail.slice(0, 80)}`);
          save();
          continue;
        }
        reserved -= worst;
        spent += usd(msg.usage.input_tokens + (msg.usage.cache_creation_input_tokens ?? 0) + (msg.usage.cache_read_input_tokens ?? 0), msg.usage.output_tokens);
        calls++;
        const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
        const data = (call?.input ?? { isJobListing: false, postings: [] }) as Postings;
        // A title counts only when it is on the page as written.
        const { titles, dropped } = verbatim(data, page.lines);
        checks.set(j.key, { role: j.role.id, industry: j.role.industry_id, employer: e.id, term, url, checkedAt: today(), status: data.isJobListing ? "ok" : "no-listing", openings: titles.length, titles, ...(dropped ? { dropped } : {}) });
        console.log(`${e.id.padEnd(20)} ${j.role.id.slice(0, 40).padEnd(40)} ${data.isJobListing ? `${titles.length} openings (${dropped} dropped)` : "no job listing on the page"}`);
        save();
      }
    }
  });
  await closeBrowser();
  console.log(`${calls} Claude calls, US$${spent.toFixed(4)} this run${stopped ? " (stopped at the budget)" : ""}.`);
}

keepRunning();
if (process.argv.includes("--roles")) rolesMode();
else careersMode();
