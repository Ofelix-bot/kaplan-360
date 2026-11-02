// Checks the /careers data and copy before `npm run data:load -- --only=careers` (plan §8, review D).
// Run: npx tsx scripts/check-careers.ts [--strict]
//   --strict  also fail on checks that wait for another builder (the Services menu, next.config redirects)
//
// Data: the 16 industry slugs match lib/careers/industries.ts (and the menu); each of the 56 degrees links to 1–3
// industries; role ids are unique; every hot role has its basis and at least one fact; every fact's mark is in its
// quote; enums match the migration's check lists; labels and short titles are at most 30 characters; "now" slots
// use only sentence, table-row and xlsx-row facts (C4); all 10 old career slugs redirect to a role that exists.
// Copy: content/draft/careers.ts has no hedging word and no literal date. Match: fixed cases for Arjun and the
// 3 degrees without a module list (lib/careers/match.ts).

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { careers as draft } from "../content/draft/careers";
import { INDUSTRIES } from "../lib/careers/industries";
import { fieldFit, matchRole } from "../lib/careers/match";
import { BACHELOR_LEVELS, type BachelorLevel, type DegreeIndustry, type DegreeSkill, type KaplanDegree, type MatchStudent, type RoleCardData, type StudentContext } from "../lib/careers/types";
import { packDegreeSkills } from "../lib/careers/pack";

const ROOT = path.join(import.meta.dirname, "..");
const STRICT = process.argv.includes("--strict");
const read = <T>(f: string): T => JSON.parse(readFileSync(path.join(ROOT, f), "utf8")) as T;
const MAX = 30;

const problems: string[] = [];
const pending: string[] = [];
const check = (ok: unknown, message: string) => {
  if (!ok) problems.push(message);
};
const wait = (ok: unknown, message: string) => {
  if (!ok) (STRICT ? problems : pending).push(message);
};

// ── files ──────────────────────────────────────────────────────────────────────────────────────────────

type IndustryRow = { id: string; sector: string; short: string; mom_industry: string | null; mom_basis: string; mom_wage_sheet: string | null; sort_order: number };
type DegreeIndustryRow = { programme_id: string; industry_id: string; basis: string; shared_skills: string[] };
type RoleRow = {
  id: string; industry_id: string; title: string; short: string; track: string; tier: string; mean_proficiency: number; variants: string[];
  ssoc_code: string | null; ssoc_basis: string | null; mom_needs: boolean; high_pay: boolean; high_pay_rule: string | null;
  search_term: string | null; search_scope: string | null; sort_order: number; redirect_from: string[];
};
type RoleSkillRow = { role_id: string; skill: string; level: number; key: boolean; sort_order: number };
type RoleFactRow = { role_id: string; fact_id: string; use: string; basis: string | null };
type FactRowRaw = {
  id: string; kind: string; industry_id: string | null; source_industry: string | null; value: string; region: string; quote: string; quote_kind: string;
  mark: string[]; source_kind: string; publisher: string; title: string; url: string; read_on: string; published_on: string | null; verified_by: string;
  figures: { median?: number | null } | null; value_num: number | null;
};
type NowRow = { industry_id: string; region: string; slot: number; fact_id: string; label: string };
type DegreeSkillRow = { programme_id: string; skill: string; module: string; module_kind: "core" | "elective"; basis: "rule" | "claude"; model: string | null };

const files = ["careers-industries.json", "careers-roles.json", "careers-degree-skills.json", "careers-facts.json", "careers-now.json", "careers-short-titles.json", "careers-hot-roles.json"];
for (const f of files) if (!existsSync(path.join(ROOT, "data/raw", f))) throw new Error(`data/raw/${f} is missing: run node scripts/careers/build-careers-data.mjs`);
const ind = read<{ industries: IndustryRow[]; degreeIndustries: DegreeIndustryRow[] }>("data/raw/careers-industries.json");
const rl = read<{ roles: RoleRow[]; roleSkills: RoleSkillRow[]; roleFacts: RoleFactRow[]; redirects: Record<string, string | null> }>("data/raw/careers-roles.json");
const ds = read<{ rows: DegreeSkillRow[] }>("data/raw/careers-degree-skills.json");
const fa = read<{ facts: FactRowRaw[] }>("data/raw/careers-facts.json");
const now = read<{ rows: NowRow[] }>("data/raw/careers-now.json");
const hotFile = read<{ ids: string[] }>("data/raw/careers-hot-roles.json");
const kaplan = read<{ disciplines: Record<string, string>; programmes: { id: string; name: string; level: string; discipline: string; university: string | null; awardingBody: string; studentPass: boolean; sourceUrl: string | null }[] }>("data/raw/kaplan-programmes.json");
const oldCareers = read<{ careers: { id: string }[] }>("data/raw/careers.json").careers;

// ── industries ─────────────────────────────────────────────────────────────────────────────────────────

const ids = ind.industries.map((i) => i.id);
check(ind.industries.length === 16, `16 industries expected, found ${ind.industries.length}`);
check(JSON.stringify([...ids].sort()) === JSON.stringify(INDUSTRIES.map((i) => i.id).sort()), `industry ids differ from lib/careers/industries.ts: ${ids.join(", ")}`);
for (const i of ind.industries) {
  const meta = INDUSTRIES.find((m) => m.id === i.id);
  check(meta && meta.sector === i.sector && meta.short === i.short && meta.sortOrder === i.sort_order, `${i.id}: sector, short or sortOrder differ from lib/careers/industries.ts`);
  check(i.short.length <= MAX, `${i.id}: short "${i.short}" is over ${MAX} characters`);
  check(i.mom_basis.startsWith("Kaplan 360++'s mapping"), `${i.id}: mom_basis is not labelled "Kaplan 360++'s mapping"`);
  check(i.mom_industry, `${i.id}: no MOM industry group`);
}
for (const m of INDUSTRIES) check(m.short.length <= MAX, `lib/careers/industries.ts ${m.id}: short over ${MAX} characters`);
const header = readFileSync(path.join(ROOT, "components/SiteHeader.tsx"), "utf8");
wait(/lib\/careers\/industries/.test(header) || INDUSTRIES.every((i) => header.includes(i.id)), "Services menu (components/SiteHeader.tsx, K8): does not list the 16 industries from lib/careers/industries.ts yet");

// ── degrees ────────────────────────────────────────────────────────────────────────────────────────────

const bachelor = kaplan.programmes.filter((p) => (BACHELOR_LEVELS as readonly string[]).includes(p.level));
const programmeIds = new Set(kaplan.programmes.map((p) => p.id));
check(bachelor.length === 56, `56 bachelor's degrees expected, found ${bachelor.length}`);
for (const d of bachelor) {
  const n = ind.degreeIndustries.filter((l) => l.programme_id === d.id).length;
  check(n >= 1 && n <= 3, `${d.id}: links to ${n} industries (1–3 expected)`);
}
for (const l of ind.degreeIndustries) {
  check(programmeIds.has(l.programme_id), `degree link: unknown programme ${l.programme_id}`);
  check(ids.includes(l.industry_id), `degree link: unknown industry ${l.industry_id}`);
  check(/^Kaplan 360\+\+'s rule/.test(l.basis), `degree link ${l.programme_id} → ${l.industry_id}: basis is not labelled "Kaplan 360++'s rule"`);
}
const seenLink = new Set<string>();
for (const l of ind.degreeIndustries) {
  const k = `${l.programme_id}|${l.industry_id}`;
  check(!seenLink.has(k), `degree link repeated: ${k}`);
  seenLink.add(k);
}
for (const r of ds.rows) {
  check(programmeIds.has(r.programme_id), `degree skill: unknown programme ${r.programme_id}`);
  check(r.basis === "rule" ? r.model === null : !!r.model, `degree skill ${r.programme_id} / ${r.module}: model does not fit basis ${r.basis}`);
}
const dsKeys = new Set(ds.rows.map((r) => `${r.programme_id}|${r.skill}|${r.module}|${r.basis}`));
check(dsKeys.size === ds.rows.length, "career_degree_skills: repeated primary key");

// ── facts ──────────────────────────────────────────────────────────────────────────────────────────────

const KINDS = ["stat", "wage", "ad-salary", "vacancy-rank", "sol", "entry-vacancy"];
const QUOTE_KINDS = ["sentence", "table-row", "table-text", "table-image", "xlsx-row", "chart-label", "infographic-label"];
const IMAGE_KINDS = ["table-image", "chart-label", "infographic-label"];
const REGIONS = ["singapore", "asia-pacific", "global"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const factById = new Map(fa.facts.map((f) => [f.id, f]));
check(factById.size === fa.facts.length, "career_facts: repeated id");
for (const f of fa.facts) {
  check(KINDS.includes(f.kind), `${f.id}: kind "${f.kind}"`);
  check(QUOTE_KINDS.includes(f.quote_kind), `${f.id}: quote_kind "${f.quote_kind}" is not in the migration's list`);
  check(REGIONS.includes(f.region), `${f.id}: region "${f.region}"`);
  check(["official", "report", "platform"].includes(f.source_kind), `${f.id}: source_kind "${f.source_kind}"`);
  check(["text-match", "row-rebuilt", "page-image"].includes(f.verified_by), `${f.id}: verified_by "${f.verified_by}"`);
  check(!IMAGE_KINDS.includes(f.quote_kind) || f.verified_by === "page-image", `${f.id}: ${f.quote_kind} must be verified_by page-image (C4)`);
  check(!(f.source_kind === "report" && f.quote_kind === "chart-label"), `${f.id}: a consultancy chart label (C4: not used)`);
  check(f.quote.trim() && f.url && f.publisher && f.title, `${f.id}: quote, url, publisher or title missing`);
  check(ISO.test(f.read_on), `${f.id}: read_on "${f.read_on}" is not an ISO date`);
  check(f.published_on === null || ISO.test(f.published_on), `${f.id}: published_on "${f.published_on}"`);
  check(f.value && f.value !== "null" && f.value !== "undefined", `${f.id}: no value`);
  check(f.industry_id === null || ids.includes(f.industry_id), `${f.id}: unknown industry ${f.industry_id}`);
  for (const m of f.mark) check(f.quote.includes(m), `${f.id}: mark "${m}" is not in the quote`);
}
for (const id of ["mom-jv25-t3-pmet-1", "mom-jv25-t4-nonpmet-1"]) {
  const f = factById.get(id);
  check(f && f.quote_kind === "table-image" && f.verified_by === "page-image", `${id}: the Job Vacancies 2025 image-table rows are back as table-image / page-image (C4)`);
}

// ── roles ──────────────────────────────────────────────────────────────────────────────────────────────

const roleIds = new Set<string>();
for (const r of rl.roles) {
  check(!roleIds.has(r.id), `role id repeated: ${r.id}`);
  roleIds.add(r.id);
  check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.id), `role id "${r.id}" is not a slug`);
  check(ids.includes(r.industry_id), `${r.id}: unknown industry ${r.industry_id}`);
  check(r.short && r.short.length <= MAX, `${r.id}: short "${r.short}" is empty or over ${MAX} characters`);
  check(["entry", "early-career"].includes(r.tier), `${r.id}: tier "${r.tier}"`);
  check(Number.isFinite(r.mean_proficiency) && r.mean_proficiency < 10, `${r.id}: mean_proficiency ${r.mean_proficiency}`);
  check(!("hot" in r), `${r.id}: hot is a generated column and is not loaded`);
}
for (const ind16 of ids) {
  const shorts = rl.roles.filter((r) => r.industry_id === ind16).map((r) => r.short);
  const dup = shorts.filter((s, i) => shorts.indexOf(s) !== i);
  check(!dup.length, `${ind16}: the same short title twice: ${[...new Set(dup)].join(", ")}`);
}
for (const s of rl.roleSkills) {
  check(roleIds.has(s.role_id), `role skill: unknown role ${s.role_id}`);
  check(Number.isInteger(s.level) && s.level >= 1 && s.level <= 6, `${s.role_id} / ${s.skill}: level ${s.level}`);
}
for (const r of rl.roles) {
  const key = rl.roleSkills.filter((s) => s.role_id === r.id && s.key).length;
  check(key >= 1 && key <= 8, `${r.id}: ${key} key skills (1–8 expected)`);
}
const USES = ["mom-needs-jv", "mom-needs-sol", "wage", "ad-salary", "entry-vacancy", "trend"];
for (const l of rl.roleFacts) {
  check(roleIds.has(l.role_id), `role fact: unknown role ${l.role_id}`);
  check(factById.has(l.fact_id), `role fact: unknown fact ${l.fact_id}`);
  check(USES.includes(l.use), `role fact ${l.role_id} / ${l.fact_id}: use "${l.use}"`);
  const f = factById.get(l.fact_id);
  if (f && l.use === "mom-needs-jv") check(f.kind === "vacancy-rank" && f.source_industry && !/^all industries$/i.test(f.source_industry), `${l.role_id}: MOM needs rests on ${l.fact_id}, which is not a per-industry JV rank (review A)`);
  if (f && l.use === "mom-needs-sol") check(f.kind === "sol", `${l.role_id}: ${l.fact_id} is not an SOL row`);
  if (f && l.use === "wage") check(f.kind === "wage", `${l.role_id}: ${l.fact_id} is not a wage row`);
}
const hot = rl.roles.filter((r) => r.mom_needs || r.high_pay);
check(hot.length >= 1, "no hot role: generateStaticParams for /careers/roles needs at least 1");
check(JSON.stringify([...hotFile.ids].sort()) === JSON.stringify(hot.map((r) => r.id).sort()), "data/raw/careers-hot-roles.json differs from the hot roles in careers-roles.json");
for (const r of hot) {
  const links = rl.roleFacts.filter((l) => l.role_id === r.id);
  check(links.length >= 1, `${r.id}: hot without a fact`);
  if (r.mom_needs) check(links.some((l) => l.use === "mom-needs-jv" || l.use === "mom-needs-sol"), `${r.id}: MOM needs without a JV rank or SOL fact`);
  if (r.high_pay) {
    check(r.high_pay_rule?.startsWith("Kaplan 360++'s rule"), `${r.id}: high pay without "Kaplan 360++'s rule"`);
    check(links.some((l) => l.use === "wage"), `${r.id}: high pay without a wage fact`);
  }
  check(r.search_term && r.search_scope, `${r.id}: hot role without search_term / search_scope (openings check)`);
}
for (const r of rl.roles) if (!r.high_pay) check(r.high_pay_rule === null, `${r.id}: high_pay_rule set on a role without high pay`);

// ── "<Industry> now" ───────────────────────────────────────────────────────────────────────────────────

const slotKeys = new Set<string>();
for (const n of now.rows) {
  const k = `${n.industry_id}|${n.region}|${n.slot}`;
  check(!slotKeys.has(k), `now slot repeated: ${k}`);
  slotKeys.add(k);
  check(ids.includes(n.industry_id), `now: unknown industry ${n.industry_id}`);
  check(REGIONS.includes(n.region), `now: region ${n.region}`);
  check(n.slot >= 1 && n.slot <= 4, `now ${k}: slot ${n.slot}`);
  check(n.label && n.label.length <= MAX, `now ${k}: label "${n.label}" is empty or over ${MAX} characters`);
  const f = factById.get(n.fact_id);
  check(f, `now ${k}: unknown fact ${n.fact_id}`);
  if (f) {
    check(["sentence", "table-row", "xlsx-row"].includes(f.quote_kind), `now ${k}: ${f.id} is ${f.quote_kind} (C4: sentence, table-row or xlsx-row only)`);
    check(f.region === n.region, `now ${k}: ${f.id} is a ${f.region} fact (a region view uses only its own rows)`);
  }
}
for (const i of ids) for (const reg of REGIONS) {
  const slots = now.rows.filter((n) => n.industry_id === i && n.region === reg).map((n) => n.slot).sort();
  check(slots.every((s, j) => s === j + 1), `now ${i} / ${reg}: slots ${slots.join(",")} are not 1..n`);
}
check(now.rows.filter((n) => n.region === "singapore").length >= 16, "fewer than one Singapore stat per industry");

// ── old /careers/<slug> → new role (Q24) ───────────────────────────────────────────────────────────────

check(oldCareers.length === 10, `10 old careers expected, found ${oldCareers.length}`);
for (const c of oldCareers) {
  const to = rl.redirects[c.id];
  check(to, `old career ${c.id}: no redirect target`);
  if (to?.startsWith("roles/")) check(roleIds.has(to.slice(6)), `old career ${c.id}: target ${to} does not exist`);
  else if (to?.startsWith("industries/")) check(ids.includes(to.slice(11)), `old career ${c.id}: target ${to} does not exist`);
  else if (to) check(false, `old career ${c.id}: target "${to}" is not roles/… or industries/…`);
}
const nextConfig = readFileSync(path.join(ROOT, "next.config.ts"), "utf8");
for (const c of oldCareers) {
  const to = rl.redirects[c.id];
  const line = nextConfig.split("\n").find((l) => l.includes(`"${c.id}"`) && /roles\/|industries\//.test(l));
  wait(line, `next.config.ts (K8): no redirect for /careers/${c.id} yet (target ${to})`);
  if (line && to) {
    const target = line.match(/"((?:roles|industries)\/[a-z0-9-]+)"/)?.[1];
    check(target && (target.startsWith("roles/") ? roleIds.has(target.slice(6)) : ids.includes(target.slice(11))), `next.config.ts: /careers/${c.id} → ${target}, which does not exist`);
  }
}

// ── draft copy (content/draft/careers.ts) ──────────────────────────────────────────────────────────────

const HEDGE = /\b(may|might|could|can|likely|unlikely|probably|perhaps|possibly|usually|typically|generally|tend to|approximately|roughly|(?:about|around) (?:\S*\d|one|two|three|four|five|ten|half))\b/i;
const DATE = /\b(19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{1,2}\b|\b\d{1,2} (?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i;
/** Labels: no sentence punctuation. Measured without their {vars}. */
const isLabel = (s: string) => !/[.?!]\s|[.?!]$/.test(s);
function strings(v: unknown, where: string, out: { where: string; s: string }[] = []) {
  if (typeof v === "string") out.push({ where, s: v });
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${where}[${i}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) strings(x, `${where}.${k}`, out);
  return out;
}
for (const { where, s } of strings(draft, "careers")) {
  check(!HEDGE.test(s), `${where}: hedging word in "${s}"`);
  check(!DATE.test(s), `${where}: literal date in "${s}"`);
  if (isLabel(s) && !where.includes(".leads.")) check(s.replace(/\{\w+\}/g, "").length <= MAX, `${where}: label "${s}" is over ${MAX} characters`);
}
for (const r of [...ind.industries, ...rl.roles]) {
  const own = [("mom_basis" in r ? r.mom_basis : ""), ("high_pay_rule" in r ? r.high_pay_rule ?? "" : "")].join(" ");
  check(!HEDGE.test(own.replace(/Kaplan 360\+\+'s/g, "")), `${r.id}: hedging word in our own basis text`);
}

// ── matchRole fixtures (lib/careers/match.ts) ──────────────────────────────────────────────────────────

const topups = read<{ programmes: { kaplanId: string | null; coreModules: string[] | null; electiveModules: string[] | null; url: string | null }[] }>("data/raw/topups.json");
const withModules = new Set(topups.programmes.filter((p) => p.kaplanId && ((p.coreModules?.length ?? 0) + (p.electiveModules?.length ?? 0)) > 0).map((p) => p.kaplanId!));
const degrees: KaplanDegree[] = bachelor.map((p) => ({
  id: p.id, name: p.name, university: p.university ?? p.awardingBody, level: p.level as BachelorLevel, discipline: p.discipline,
  disciplineLabel: kaplan.disciplines[p.discipline] ?? p.discipline, studentPass: p.studentPass, hasModuleData: withModules.has(p.id), url: p.sourceUrl,
}));
const links: DegreeIndustry[] = ind.degreeIndustries.map((l) => ({ programmeId: l.programme_id, industryId: l.industry_id, basis: l.basis, sharedSkills: l.shared_skills }));
const degreeSkills: Record<string, DegreeSkill[]> = {};
for (const r of ds.rows) (degreeSkills[r.programme_id] ??= []).push({ programmeId: r.programme_id, skill: r.skill, module: r.module, moduleKind: r.module_kind, basis: r.basis, model: r.model });
const ctx: StudentContext = { degrees, links, degreeSkills: packDegreeSkills(degreeSkills), exemptions: {}, coverableSkills: [] };
const card = (r: RoleRow): RoleCardData => {
  const own = rl.roleFacts.filter((l) => l.role_id === r.id);
  const wage = own.find((l) => l.use === "wage");
  return {
    id: r.id, industryId: r.industry_id, title: r.title, short: r.short, track: r.track, tier: r.tier as RoleCardData["tier"], meanProficiency: r.mean_proficiency,
    variants: r.variants, ssocCode: r.ssoc_code, ssocBasis: r.ssoc_basis, momNeeds: r.mom_needs, highPay: r.high_pay, hot: r.mom_needs || r.high_pay,
    highPayRule: r.high_pay_rule, searchTerm: r.search_term, searchScope: r.search_scope, sortOrder: r.sort_order, redirectFrom: r.redirect_from,
    keySkills: rl.roleSkills.filter((s) => s.role_id === r.id && s.key).map((s) => ({ skill: s.skill, level: s.level, key: s.key, sortOrder: s.sort_order })),
    momNeedsFactIds: own.filter((l) => l.use.startsWith("mom-needs")).map((l) => l.fact_id), momNeedsSol: own.some((l) => l.use === "mom-needs-sol"),
    wageFactId: wage?.fact_id ?? null, wageMedian: wage ? factById.get(wage.fact_id)?.figures?.median ?? null : null, openings: null,
  };
};
const studentFor = (programmeId: string): MatchStudent => {
  const d = degrees.find((x) => x.id === programmeId)!;
  return {
    programmeId, level: "degree", discipline: d.discipline, hasModuleData: d.hasModuleData, degreeSkills: degreeSkills[programmeId] ?? [],
    certificates: [], skillChips: [], internships: 0, workYears: null, studentPass: d.studentPass, exemptions: {},
  };
};
const ARJUN = "ucd-bachelor-of-business-studies-honours-finance-top-up";
check(degrees.some((d) => d.id === ARJUN), `Arjun's degree ${ARJUN} is not among the 56`);
if (degrees.some((d) => d.id === ARJUN)) {
  const arjun = studentFor(ARJUN);
  for (const industryId of ["financial-services", "accountancy"]) {
    const fit = fieldFit(ARJUN, industryId, ctx);
    check(fit === "fit", `Arjun → ${industryId}: field ${fit} (fit expected: his degree links there)`);
    const results = rl.roles.filter((r) => r.industry_id === industryId).map((r) => matchRole(arjun, card(r), fit));
    check(results.length > 0, `Arjun → ${industryId}: no roles`);
    for (const m of results) {
      check(m.n >= 0 && m.n <= m.m && m.m >= 1, `Arjun → ${industryId}: n ${m.n} of m ${m.m}`);
      check(m.nAfter >= m.n && m.nAfter <= m.m, `Arjun → ${industryId}: nAfter ${m.nAfter} outside n..m`);
      check(!m.fieldOnly, `Arjun → ${industryId}: fieldOnly set although his degree has modules`);
      const share = m.n / m.m;
      // The graduate-level thresholds the user set on 2026-10-29 (lib/careers/match.ts).
      const want = share >= 0.5 ? "high" : share >= 0.25 ? "medium" : "low";
      check(m.band === want, `Arjun → ${industryId}: band ${m.band} for ${m.n} of ${m.m} (${want} expected)`);
      check(m.actions.course.length === 0, `Arjun → ${industryId}: a SkillsFuture course action (plan §2.8: none)`);
    }
    console.log(`Arjun → ${industryId}: ${["high", "medium", "low"].map((b) => `${b} ${results.filter((m) => m.band === b).length}`).join(", ")} of ${results.length} roles`);
  }
  const ict = rl.roles.find((r) => r.industry_id === "infocomm-technology" && r.mom_needs);
  if (ict) {
    const fit = fieldFit(ARJUN, "infocomm-technology", ctx);
    check(fit !== "fit", `Arjun → infocomm-technology: field ${fit} (his degree does not link there)`);
    if (fit === "none") check(matchRole(arjun, card(ict), fit).band === "low", "a field that does not fit is always Low");
  }
}
const noModules = degrees.filter((d) => !d.hasModuleData);
check(noModules.length === 3, `3 degrees without a module list expected, found ${noModules.length}: ${noModules.map((d) => d.id).join(", ")}`);
for (const d of noModules) {
  const own = links.filter((l) => l.programmeId === d.id).map((l) => l.industryId);
  const role = rl.roles.find((r) => own.includes(r.industry_id));
  if (!role) { check(false, `${d.id}: no role in its industries`); continue; }
  const m = matchRole(studentFor(d.id), card(role), fieldFit(d.id, role.industry_id, ctx));
  check(m.fieldOnly && m.band === "medium", `${d.id} → ${role.id}: no module data, fitting field → Medium and fieldOnly (got ${m.band}, fieldOnly ${m.fieldOnly})`);
}

// ── report ─────────────────────────────────────────────────────────────────────────────────────────────

console.log(`industries ${ind.industries.length}, degree links ${ind.degreeIndustries.length}, roles ${rl.roles.length} (hot ${hot.length}), facts ${fa.facts.length}, now slots ${now.rows.length}`);
for (const p of pending) console.log(`PENDING ${p}`);
if (problems.length) {
  for (const p of problems) console.error(`FAIL ${p}`);
  console.error(`${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`check-careers: OK${pending.length ? ` (${pending.length} pending on other builders; --strict fails on them)` : ""}`);
