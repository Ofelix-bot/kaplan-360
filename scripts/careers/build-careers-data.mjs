// Builds the /careers data files that scripts/data/load-supabase.mjs (--only=careers) loads into the
// career_* tables (supabase/migrations/20261029110000_careers_industries.sql). Plan §2.1–§2.5, review B9–B12, D.
//
// Inputs (a folder, default the careers scratchpad's data/): careers-dataset.json (verified facts and roles),
// map.json (Skills Framework roles and module→skill rule links), map-api.json (Claude module→skill links),
// map-industry-api.json when it exists (Claude links to every skill of the roles in each linked industry),
// mom.json (MOM records, for the Job Vacancies 2025 image-table rows that C4 brings back), labour.json, and
// regional.json when it exists (Asia Pacific / Global rows, C3).
// Outputs: data/raw/careers-industries.json, careers-roles.json, careers-degree-skills.json, careers-facts.json,
// careers-now.json, and the cache data/raw/careers-short-titles.json (short titles and "now" labels from Claude).
//
// Rules (every one of them Kaplan 360++'s, labelled where it shows):
// - quote_kind is normalised to the career_facts list: text → sentence, callout → sentence, api-row → table-row,
//   chart-or-table-labels → chart-label (consultancy chart labels are dropped, C4); region is lower case and
//   "Southeast Asia" is stored as asia-pacific with its label kept.
// - Each sector is joined to one of MOM's 14 Occupational Wages industry groups, labelled (review B9).
// - MOM needs = a per-industry Job Vacancies 2025 rank row or the COMPASS Shortage Occupation List. The
//   all-industry top 10 and all-industry narrative ranks are kept as "trend" facts only (review A, Q10).
// - High pay = the role's gross median at or above the 75th percentile of the medians in the industry's wage table.
// - "<Industry> now" slots take only sentence, table-row and xlsx-row facts (C4); fewer than 4 stay fewer.
//
// Usage: node scripts/careers/build-careers-data.mjs [--data=<folder>] [--no-api] [--estimate]
//   --no-api    use the cache only; uncached long titles fall back to their first title, labels are left out
//   --estimate  print the Claude cost estimate and stop

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAW = join(ROOT, "data", "raw");
const argv = process.argv.slice(2);
const DATA = argv.find((a) => a.startsWith("--data="))?.slice(7)
  ?? "C:/Users/12514/AppData/Local/Temp/claude/c--Users-12514-Desktop-kaplan-360--v201/1a070891-5139-4f9f-a8b9-ff6e17dc5dce/scratchpad/careers/data";
const NO_API = argv.includes("--no-api");
const ESTIMATE = argv.includes("--estimate");

const MODEL = "claude-opus-5-5";
const PRICE = { input: 4 / 1e6, output: 20 / 1e6 }; // USD per token, claude-opus-5-5
const CAP_USD = 3;
const MAX = 30;

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const input = (f) => readJson(join(DATA, f));
const dataset = input("careers-dataset.json");
const map = input("map.json");
const mapApi = input("map-api.json");
// Claude links of each degree's modules to the skills of every role in its industries (the user's calibrated
// match rule, 2026-10-29), when the second pass has run.
const mapIndustry = existsSync(join(DATA, "map-industry-api.json")) ? input("map-industry-api.json") : null;
const mom = input("mom.json");
const labour = input("labour.json");
const regional = existsSync(join(DATA, "regional.json")) ? input("regional.json") : null;
const regionalOk = existsSync(join(DATA, "verify-regional-report.json")) ? new Map(input("verify-regional-report.json").filter((x) => x.ok).map((x) => [x.id, x])) : null;
const kaplan = readJson(join(RAW, "kaplan-programmes.json"));
const topups = readJson(join(RAW, "topups.json"));
const oldCareers = readJson(join(RAW, "careers.json")).careers;
const BUILT = dataset.meta.built;

// The 16 static industries (id, short, sortOrder) from lib/careers/industries.ts: one source for the menu and the data.
const INDUSTRIES = [...readFileSync(join(ROOT, "lib", "careers", "industries.ts"), "utf8")
  .matchAll(/\{ id: "([^"]+)", sector: "([^"]+)", short: "([^"]+)", sortOrder: (\d+) \}/g)]
  .map(([, id, sector, short, sortOrder]) => ({ id, sector, short, sortOrder: Number(sortOrder) }));
if (INDUSTRIES.length !== 16) throw new Error(`lib/careers/industries.ts: expected 16 industries, read ${INDUSTRIES.length}`);
const industryBySector = new Map(INDUSTRIES.map((i) => [i.sector, i]));

// ── helpers ────────────────────────────────────────────────────────────────────────────────────────────
const slug = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const lab = (s) => String(s ?? "").toLowerCase().replace(/&/g, "and").replace(/\*/g, "").replace(/\s+/g, " ").trim();
const normTitle = (t) => String(t).toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** The Skills Framework title without its variant: trailing "(…)" and "- Retail/Corporate/…" segments (as in the verify step). */
const baseTitle = (t) => t.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s+-\s+(Retail|Corporate|Private|Investment|Asset|Insurance|Brokers?).*$/, "").trim();
const titlesOf = (t) => t.split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean);
const isoDate = (s) => (/^\d{4}-\d{2}-\d{2}/.test(String(s ?? "")) ? String(s).slice(0, 10) : null);
const firstNumber = (s) => {
  const m = String(s ?? "").match(/-?\d[\d,]*(?:\.\d+)?/);
  return m ? Number(m[0].replace(/,/g, "")) : null;
};
// Newer Skills Framework sectors (Legal Services, sustainability skills) print Basic / Intermediate / Advanced
// instead of levels 1–6. Kaplan 360++'s reading: Basic = 2, Intermediate = 4, Advanced = 6.
const WORD_LEVEL = { basic: 2, intermediate: 4, advanced: 6 };
const levelOf = (l) => {
  const n = typeof l === "number" ? l : WORD_LEVEL[String(l).trim().toLowerCase()] ?? Number(l);
  if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error(`unknown proficiency level "${l}"`);
  return n;
};
const sheetLabel = (sheet) => (sheet === "T4" ? "Table 4" : `Table ${sheet.slice(1)}`);

const momById = new Map();
for (const arr of [mom.vacancyRanks, mom.sol, mom.wages, mom.facts]) for (const r of arr) momById.set(r.id, r);
const labourById = new Map([...labour.facts, ...labour.adSalaries].map((r) => [r.id, r]));

// ── normalising a receipt into a career_facts row ──────────────────────────────────────────────────────
const QUOTE_KINDS = ["sentence", "table-row", "table-text", "table-image", "xlsx-row", "chart-label", "infographic-label"];
function quoteKind(raw, r) {
  const k = String(raw ?? "");
  if (k.includes("table-image")) return "table-image";
  if (k === "text" || k === "callout" || k === "sentence") return "sentence";
  if (k === "api-row" || k === "table-row") return "table-row";
  if (k === "chart-or-table-labels") return "chart-label";
  if (QUOTE_KINDS.includes(k)) return k;
  if (!k) return r.quoteColumns || r.columns ? "table-row" : "sentence"; // labour.json carries no kind: Jobstreet table rows, blog sentences
  throw new Error(`unknown quote kind "${k}" (${r.id})`);
}
function region(raw) {
  const s = lab(raw);
  if (!s || s === "singapore") return { region: "singapore", label: raw ? String(raw) : "Singapore" };
  if (/southeast[- ]asia|asean|asia[- ]pacific|apac|asia/.test(s)) return { region: "asia-pacific", label: /southeast/.test(s) ? "Southeast Asia" : /asean/.test(s) ? "ASEAN" : "Asia Pacific" };
  if (/global|world/.test(s)) return { region: "global", label: "Global" };
  throw new Error(`unknown region "${raw}"`);
}
const OFFICIAL = /ministry|\bmom\b|mrsd|department of statistics|singstat|authority|board|\bedb\b|\bimda\b|\bmas\b|\bmoh\b|minlaw|ecda|data\.gov\.sg|skillsfuture|government|agency/i;
const PLATFORM = /jobstreet|seek|linkedin|indeed|hays|randstad|glassdoor/i;
function sourceKind(source, publisher) {
  if (source === "mom" || source === "macro") return "official";
  if (source === "labour" || PLATFORM.test(publisher)) return "platform";
  if (OFFICIAL.test(publisher) && !/google|temasek|bain|world economic forum|accenture|pwc|deloitte|kpmg|\bey\b/i.test(publisher)) return "official";
  return "report";
}
/** page-image: read from a rendered page (C4); row-rebuilt: an API row or a PDF row rebuilt cell by cell; else the text matched. */
function verifiedBy(kind, check, rawKind) {
  if (["table-image", "chart-label", "infographic-label"].includes(kind)) return "page-image";
  if (rawKind === "api-row" || check?.matched === "cells" || (kind === "table-row" && check?.matched !== "exact")) return "row-rebuilt";
  return "text-match";
}
function whereRef(r) {
  if (r.sheet && r.row) return `Sheet ${r.sheet}, row ${r.row}`;
  const t = String(r.table ?? "");
  const table = t.match(/^(Table\s+[\w.]+)/i)?.[1] ?? (t.match(/^(\d+(?:\.\d+)+)\s/) ? `Table ${t.match(/^(\d+(?:\.\d+)+)/)[1]}` : null);
  const page = r.printedPage ?? r.page;
  return [table, page != null ? `p. ${page}` : null].filter(Boolean).join(", ") || null;
}
/** Words of the quote to highlight: the value as printed, else its numbers, else nothing. */
function markOf(quote, values) {
  const out = [];
  for (const v of values.filter((x) => x != null && x !== "")) {
    const s = String(v);
    if (quote.includes(s)) { out.push(s); continue; }
    for (const m of s.match(/[+-]?\d[\d,]*(?:\.\d+)?%?/g) ?? []) for (const x of [m, m.replace(/%$/, "")]) if (quote.includes(x)) { out.push(x); break; }
  }
  return [...new Set(out)];
}

const facts = new Map();
const factIndustries = new Map(); // fact id → industry ids that use it
function noteFactUse(id, industryId) {
  if (!factIndustries.has(id)) factIndustries.set(id, new Set());
  if (industryId) factIndustries.get(id).add(industryId);
}
/** Adds (once) the fact for receipt `rc` (a dataset receipt or a raw record), with the extra fields given. */
function addFact(rc, extra) {
  if (facts.has(rc.id)) return facts.get(rc.id);
  const raw = momById.get(rc.id) ?? labourById.get(rc.id) ?? {};
  const r = { ...raw, ...rc };
  const rawKind = rc.quoteType ?? raw.receiptType ?? raw.quote_kind ?? raw.quote_type;
  const kind = quoteKind(rawKind, r);
  const reg = region(r.region);
  const quote = String(r.quote ?? "").trim();
  if (!quote) throw new Error(`no quote for ${rc.id}`);
  const row = {
    id: rc.id,
    kind: extra.kind,
    industry_id: null, // set after every use is known
    source_industry: extra.sourceIndustry ?? r.industry ?? null,
    metric: extra.metric,
    value: String(extra.value),
    value_num: extra.valueNum !== undefined ? extra.valueNum : firstNumber(extra.value),
    figures: extra.figures ?? null,
    unit: extra.unit ?? r.unit ?? null,
    period: extra.period ?? r.period ?? null,
    region: reg.region,
    region_label: reg.region !== "singapore" && /[A-Z]/.test(r.region_label ?? "") ? r.region_label : reg.label,
    quote,
    quote_kind: kind,
    quote_columns: r.columns ?? r.quoteColumns ?? null,
    mark: markOf(quote, extra.mark ?? [extra.value]),
    source_kind: sourceKind(rc.source ?? extra.source, r.publisher),
    publisher: r.publisher,
    title: r.title,
    published: r.published ?? null,
    published_on: isoDate(r.published),
    url: r.url,
    alt_url: r.apiUrl ?? r.api_url ?? null,
    licence: r.licence ?? null,
    page: Number.isInteger(r.page) ? r.page : null,
    where_ref: whereRef(r),
    sample: r.sample ?? null,
    note: extra.note ?? r.note ?? r.receiptNote ?? null,
    read_on: isoDate(r.read) ?? BUILT,
    verified_by: verifiedBy(kind, rc.check, rawKind),
  };
  if (!row.url || !row.publisher || !row.title) throw new Error(`incomplete receipt ${rc.id}`);
  facts.set(rc.id, row);
  return row;
}

// ── industries ─────────────────────────────────────────────────────────────────────────────────────────
// MOM's 14 Occupational Wages 2025 groups (sheets T4.1–T4.14), as printed.
const GROUPS = Object.values(dataset.meta.wageThresholds).filter((w) => w.sheet !== "T4");
const groupByLab = new Map(GROUPS.map((g) => [lab(g.industry), g]));
function momGroup(labels) {
  for (const l of labels) {
    const inner = l.match(/\(([^)]+)\)\s*$/)?.[1] ?? l;
    const g = groupByLab.get(lab(inner)) ?? groupByLab.get(lab(inner).replace("public admin and", "public administration and"));
    if (g) return g;
  }
  return null;
}
const groupOf = new Map(dataset.industries.map((ind) => [ind.slug, momGroup(ind.momMapping.momIndustryLabels)]));
const industriesRows = [];
const degreeIndustries = [];
for (const ind of dataset.industries) {
  const meta = industryBySector.get(ind.sector);
  if (!meta || meta.id !== ind.slug) throw new Error(`sector ${ind.sector} (${ind.slug}) is not in lib/careers/industries.ts`);
  const group = groupOf.get(ind.slug);
  if (!group) throw new Error(`no MOM group for ${ind.sector}`);
  const sharing = dataset.industries.filter((o) => o.slug !== ind.slug && groupOf.get(o.slug) === group).map((o) => o.sector);
  const wt = ind.momMapping.wageTable;
  const momBasis = [
    `Kaplan 360++'s mapping: no official source links Skills Framework sectors to MOM industries. ${ind.sector} uses MOM's ${group.industry} figures${sharing.length ? `, a group it shares with ${sharing.join(", ")}` : ""}.`,
    wt.sheet === group.sheet ? `Pay comes from Occupational Wages ${sheetLabel(wt.sheet)}.` : `Pay is compared within ${wt.industry} (Occupational Wages ${sheetLabel(wt.sheet)}).`,
    wt.note ?? "",
  ].filter(Boolean).join(" ");
  const js = ind.momMapping.jobstreetIndustries;
  const rs = map.rolesBySector[ind.sector];
  industriesRows.push({
    id: meta.id,
    sector: ind.sector,
    short: meta.short,
    sf_role_total: rs.sectorRoleTotal,
    entry_role_count: 0, // folded role count, set below
    mom_industry: group.industry,
    mom_basis: momBasis,
    mom_wage_sheet: wt.sheet,
    jobstreet_industries: js,
    jobstreet_basis: js.length ? `Kaplan 360++'s mapping: Jobstreet's ${js.join(" and ")} ${js.length > 1 ? "industries" : "industry"}.` : null,
    sort_order: meta.sortOrder,
  });
  for (const l of ind.links) degreeIndustries.push({ programme_id: l.programmeId, industry_id: meta.id, basis: l.basis, shared_skills: l.sharedSkills ?? [] });
}
industriesRows.sort((a, b) => a.sort_order - b.sort_order);

// Industry facts (up to 8 per industry, chosen by the verify step). Consultancy chart labels stay out (C4).
const industryFacts = new Map(); // industry id → fact ids in the dataset's order
for (const ind of dataset.industries) {
  const ids = [];
  for (const f of ind.facts) {
    const rc = f.receipt;
    if (rc.quoteType === "chart-or-table-labels" && rc.source === "consult") continue;
    addFact(rc, { kind: "stat", metric: f.metric, value: f.value, unit: f.unit, period: f.period, sourceIndustry: f.industryAsPrinted });
    noteFactUse(rc.id, ind.slug);
    ids.push(rc.id);
  }
  industryFacts.set(ind.slug, ids);
}

// ── roles ──────────────────────────────────────────────────────────────────────────────────────────────
const thresholds = dataset.meta.wageThresholds;
const isAllIndustries = (s) => lab(s) === "all industries";
const PER_INDUSTRY_JV = /^(Job Vacancies 2025 narrative|Job Vacancies by Industry)/;
const ENTRY_LIST = /^Entry-level PMET/;
// Job Vacancies 2025 Table 3 rows (an image in the PDF, C4) → SSOC codes, as in the verify step's crosswalk.
const S3322 = ["33221", "33222", "33223", "33224", "33225"];
const S2512 = ["25121", "25122", "25123", "25124", "25125"];
const S2141 = ["21411", "21412", "21413", "21414", "21415"];
const T3_SSOC = {
  "mom-jv25-t3-pmet-1": ["23300", "24240"], "mom-jv25-t3-pmet-2": S3322, "mom-jv25-t3-pmet-3": S2512, "mom-jv25-t3-pmet-5": ["21521"],
  "mom-jv25-t3-pmet-6": ["21421"], "mom-jv25-t3-pmet-7": S2141, "mom-jv25-t3-pmet-8": ["24111"], "mom-jv25-t3-pmet-9": ["25111"],
  "mom-jv25-t3-pmet-10": ["24121"],
};
const imageRows = mom.vacancyRanks.filter((v) => v.receiptType === "table-image" && /^Top 10 (PMET|Non-PMET) job vacancies/.test(v.list));
for (const v of imageRows) {
  addFact({ ...v, source: "mom", quoteType: "table-image" }, {
    kind: "vacancy-rank", metric: `${v.list}: rank`, value: String(v.rank), valueNum: v.rank, mark: [v.occupation],
    figures: { rank: v.rank, rank2024: v.rank2024 ?? null, vacancies: null }, unit: "rank", period: "2025",
    note: v.receiptNote ?? null,
  });
  noteFactUse(v.id, null);
}

function vacancyFact(item) {
  const raw = momById.get(item.receipt.id) ?? {};
  const ordinal = item.receipt.quote.match(/\b\d+(?:st|nd|rd|th)\b/)?.[0];
  const vacancies = raw.vacancies ?? item.vacancies ?? null;
  const entry = ENTRY_LIST.test(item.list);
  return addFact(item.receipt, {
    kind: entry ? "entry-vacancy" : "vacancy-rank",
    metric: `${item.list}: ${item.occupationAsPrinted}`,
    value: vacancies ?? ordinal ?? (item.rank != null ? String(item.rank) : item.occupationAsPrinted),
    valueNum: vacancies != null ? firstNumber(vacancies) : item.rank,
    mark: [vacancies, ordinal, ...item.occupationAsPrinted.split(/;\s*/).flatMap((o) => [o, o.toLowerCase()])].filter(Boolean),
    figures: { rank: item.rank ?? null, rank2024: raw.rank2024 ?? null, vacancies: vacancies != null ? firstNumber(vacancies) : null },
    unit: raw.unit ?? (vacancies != null ? "job vacancies" : "rank"),
    period: raw.period ?? "2025",
    note: raw.rankScope ?? raw.receiptNote ?? null,
  });
}

const allRoles = [];
const roleSkills = [];
const roleFacts = [];
const slugCount = new Map();
const pending = []; // roles of every industry, before ids are final
for (const ind of dataset.industries) {
  const sector = ind.sector;
  const industryId = ind.slug;
  const sfRoles = map.rolesBySector[sector].roles;
  const dsByTitle = new Map(ind.roles.map((r) => [r.role, r]));
  const groups = new Map();
  for (const r of sfRoles) {
    const b = baseTitle(r.role);
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b).push(r);
  }
  for (const [base, members] of groups) {
    const rep = members.find((m) => m.role === base) ?? members[0];
    const ds = members.map((m) => dsByTitle.get(m.role)).filter(Boolean);
    const dsRep = dsByTitle.get(rep.role);
    if (!dsRep) throw new Error(`role ${rep.role} missing from the dataset (${sector})`);
    const variants = members.map((m) => m.role.slice(base.length).trim()).filter(Boolean);
    pending.push({ industryId, sector, base, rep, ds, dsRep, variants, order: pending.length });
    const s = slug(base);
    slugCount.set(s, (slugCount.get(s) ?? new Set()).add(industryId));
  }
}

// Temporary ids; the final slugs are set once the short titles are known (see "final role ids").
for (const p of pending) p.id = `tmp-${p.order}`;

// Key skills, K2 (the user's choice, Q17): a role's 8 key skills are the 8 of its skills that the most
// roles of the same industry also list (counted once per role, titles compared without case or spacing), ties
// broken by the higher Skills Framework level, then the skill's place in the role's own list (the map's key
// skills first, then its technical skills). They replaced the map's "rarest 8", which no degree could reach.
const KEY_COUNT = 8;
const skillKey = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const skillsOfRep = (rep) => {
  const seen = new Set();
  return [...rep.keySkills, ...rep.technicalSkills].filter((s) => (seen.has(s.skill) ? false : (seen.add(s.skill), true)));
};
const industryShare = new Map();
for (const p of pending) for (const k of new Set(skillsOfRep(p.rep).map((s) => skillKey(s.skill)))) {
  const id = `${p.industryId}|${k}`;
  industryShare.set(id, (industryShare.get(id) ?? 0) + 1);
}
/** The role's skills with the K2 key skills first (most shared first), then the rest in their own order. */
function k2Order(p) {
  const own = skillsOfRep(p.rep).map((s, i) => ({ s, i, share: industryShare.get(`${p.industryId}|${skillKey(s.skill)}`), level: levelOf(s.level) }));
  const key = [...own].sort((a, b) => b.share - a.share || b.level - a.level || a.i - b.i).slice(0, KEY_COUNT);
  const keyIds = new Set(key.map((x) => x.i));
  return [...key.map((x) => ({ ...x.s, key: true })), ...own.filter((x) => !keyIds.has(x.i)).map((x) => ({ ...x.s, key: false }))];
}

for (const p of pending) {
  const { industryId, dsRep, ds, rep } = p;
  const occ = dsRep.mom.occupation;
  const wages = dsRep.wages;
  const ind = dataset.industries.find((i) => i.slug === industryId);
  const th = thresholds[ind.momMapping.wageTable.sheet];
  const highPay = !!wages && Number.isFinite(wages.median) && wages.median >= th.p75OfMedians;

  // facts behind the role
  const links = new Map();
  const link = (factId, use, basis) => links.set(`${factId}|${use}`, { role_id: p.id, fact_id: factId, use, basis: basis ?? null });
  let jv = false;
  let sol = false;
  for (const d of ds) {
    for (const item of d.mom.vacancyRank.items) {
      const f = vacancyFact(item);
      const ssocTxt = occ ? `SSOC ${occ.ssoc} (${occ.title})` : "this role's SSOC";
      if (ENTRY_LIST.test(item.list)) { link(f.id, "entry-vacancy", `Kaplan 360++'s match: MOM lists "${item.occupationAsPrinted}"; this role sits in ${ssocTxt}.`); noteFactUse(f.id, industryId); continue; }
      if (PER_INDUSTRY_JV.test(item.list) && !isAllIndustries(item.industry)) {
        jv = true;
        link(f.id, "mom-needs-jv", `Kaplan 360++'s match: MOM ranks "${item.occupationAsPrinted}" in ${item.industry}; this role sits in ${ssocTxt}.`);
        noteFactUse(f.id, industryId);
      } else {
        link(f.id, "trend", `Kaplan 360++'s match: MOM ranks "${item.occupationAsPrinted}" across all industries; this role sits in ${ssocTxt}.`);
        noteFactUse(f.id, null);
      }
    }
    const s = d.mom.sol.item;
    if (s) {
      sol = true;
      addFact(s.receipt, { kind: "sol", metric: "COMPASS Shortage Occupation List", value: s.occupation, valueNum: null, mark: [s.occupation], unit: null, period: `From ${s.appliesFrom}`, note: s.label, sourceIndustry: s.sector });
      noteFactUse(s.receipt.id, null);
      link(s.receipt.id, "mom-needs-sol", s.join === "exact" ? `MOM lists ${s.matchedBy} for ${s.occupation}. ${s.label}.` : `Kaplan 360++'s match: ${s.matchedBy}. ${s.label}.`);
    }
  }
  if (occ) for (const [fid, codes] of Object.entries(T3_SSOC)) if (codes.includes(occ.ssoc)) {
    const v = momById.get(fid);
    link(fid, "trend", `Kaplan 360++'s match: MOM ranks "${v.occupation}" across all industries; this role sits in SSOC ${occ.ssoc} (${occ.title}).`);
  }
  if (wages) {
    const w = addFact(wages.receipt, {
      kind: "wage", metric: `Gross monthly wage: ${wages.occupation}`, value: String(wages.median), valueNum: wages.median,
      mark: [String(wages.median)], figures: { p25: wages.p25, median: wages.median, p75: wages.p75 }, unit: wages.unit, period: wages.period,
      sourceIndustry: wages.industry,
    });
    noteFactUse(w.id, wages.scope === "industry" ? industryId : null);
    const basis = [occ && occ.join !== "exact title" ? occ.basis : null, wages.scope.startsWith("all industries (") ? `No row in ${sheetLabel(ind.momMapping.wageTable.sheet)}; the All Industries row is shown.` : null].filter(Boolean).join(" ");
    link(w.id, "wage", basis || null);
  }
  const js = dsRep.jobstreet;
  if (js) {
    const a = addFact(js.receipt, {
      kind: "ad-salary", metric: `Advertised monthly salary: ${js.role}`, value: `${js.low.toLocaleString("en-US")}–${js.high.toLocaleString("en-US")}`,
      valueNum: js.low, mark: [js.low.toLocaleString("en-US"), js.high.toLocaleString("en-US")], figures: { low: js.low, high: js.high },
      unit: js.unit, period: js.period, note: js.note, sourceIndustry: js.industry,
    });
    noteFactUse(a.id, null);
    link(a.id, "ad-salary", js.join === "exact" ? null : `Kaplan 360++'s match: Jobstreet's "${js.role}" in ${js.industry}.`);
  }

  const titles = titlesOf(p.base);
  allRoles.push({
    id: p.id,
    industry_id: industryId,
    title: p.base,
    short: p.base.length <= MAX ? p.base : null, // filled from the short-title cache below
    track: rep.track,
    tier: rep.tier,
    mean_proficiency: rep.meanProficiency,
    variants: p.variants,
    ssoc_code: occ?.ssoc ?? null,
    ssoc_basis: occ?.basis ?? null,
    mom_needs: jv || sol,
    high_pay: highPay,
    high_pay_rule: highPay ? `Kaplan 360++'s rule: gross median at or above the 75th percentile of the ${th.occupations} occupation medians in MOM Occupational Wages ${sheetLabel(th.sheet)} (${th.industry}).` : null,
    search_term: titles[titles.length - 1].toLowerCase(),
    search_scope: `${titles.join(", ")} roles of any seniority in ${p.sector}, located in Singapore.`,
    sort_order: 0,
    redirect_from: [],
    _order: p.order,
  });
  k2Order(p).forEach((s, i) => roleSkills.push({ role_id: p.id, skill: s.skill, level: levelOf(s.level), key: s.key, sort_order: i + 1 }));
  roleFacts.push(...links.values());
}
// Sort: both badges, then one, then the map's order.
for (const ind of industriesRows) {
  const rs = allRoles.filter((r) => r.industry_id === ind.id);
  rs.sort((a, b) => (+(b.mom_needs && b.high_pay) - +(a.mom_needs && a.high_pay)) || (+(b.mom_needs || b.high_pay) - +(a.mom_needs || a.high_pay)) || a._order - b._order);
  rs.forEach((r, i) => { r.sort_order = i + 1; });
  ind.entry_role_count = rs.length;
}

// Fact industry: the one industry that uses it, else cross-industry (null).
for (const [id, set] of factIndustries) {
  const f = facts.get(id);
  if (f) f.industry_id = set.size === 1 ? [...set][0] : null;
}

// ── regional rows (C3, Q17): only the region's own rows, never Singapore's in their place ──────────────
const regionalFacts = [];
if (regional) {
  const rows = Array.isArray(regional) ? regional : regional.facts ?? regional.rows ?? [];
  const consultLabels = new Map();
  for (const ind of dataset.industries) for (const l of [ind.sector, ind.slug, ...ind.momMapping.consultIndustries]) consultLabels.set(lab(l), ind.slug);
  for (const r of rows) {
    if (!r.id || !r.quote || !r.value) continue;
    const verified = regionalOk ? regionalOk.get(r.id) : { level: r.check?.matched };
    if (!verified) continue; // only rows whose quote passed the regional verify step
    const kind = quoteKind(r.quote_kind ?? r.quoteType ?? r.quote_type, r);
    if (kind === "chart-label" && !/government|ministry/i.test(r.publisher ?? "")) continue; // consultancy chart labels stay out (C4)
    const industryId = [r.industryId, r.industry_id, ...(r.industries ?? []), r.industry].map((x) => x && (industryBySector.get(x)?.id ?? consultLabels.get(lab(x)))).find(Boolean) ?? null;
    const f = addFact({ ...r, quoteType: kind, source: r.source ?? "consult", check: { matched: verified.level } }, { kind: "stat", metric: r.metric, value: r.value, unit: r.unit, period: r.period, sourceIndustry: r.industry === "cross-industry" ? null : r.industry ?? null });
    f.industry_id = industryId;
    regionalFacts.push(f);
  }
}

// ── "<Industry> now": up to 4 slots per region from sentence / table-row / xlsx-row facts (C4) ──────────
const NOW_KINDS = new Set(["sentence", "table-row", "xlsx-row"]);
const isVacancy = (f) => /vacanc/i.test(f.metric);
const isRate = (f) => /rate/i.test(f.metric);
function pickNow(cands) {
  const out = [];
  const take = (pred) => { const f = cands.find((x) => !out.includes(x) && pred(x) && !out.some((o) => o.metric === x.metric)); if (f) out.push(f); };
  take((f) => isVacancy(f) && !isRate(f));
  take((f) => isVacancy(f) && isRate(f));
  take((f) => !isVacancy(f));
  take((f) => !isVacancy(f));
  while (out.length < 4) { const n = out.length; take(() => true); if (out.length === n) break; }
  return out.slice(0, 4);
}
const nowPicks = [];
for (const ind of industriesRows) {
  const sg = industryFacts.get(ind.id).map((id) => facts.get(id)).filter((f) => f && NOW_KINDS.has(f.quote_kind) && f.region === "singapore");
  nowPicks.push(...pickNow(sg).map((f, i) => ({ industry_id: ind.id, region: "singapore", slot: i + 1, fact: f })));
  for (const reg of ["asia-pacific", "global"]) {
    const rf = regionalFacts.filter((f) => f.industry_id === ind.id && f.region === reg && NOW_KINDS.has(f.quote_kind));
    nowPicks.push(...pickNow(rf).map((f, i) => ({ industry_id: ind.id, region: reg, slot: i + 1, fact: f })));
  }
}

// ── short titles and labels (Claude, cached) ───────────────────────────────────────────────────────────
const cacheFile = join(RAW, "careers-short-titles.json");
const cache = existsSync(cacheFile) ? readJson(cacheFile) : { model: MODEL, items: {}, labels: {} };
cache.items ??= {};
cache.labels ??= {};
const okShort = (s) => typeof s === "string" && s.trim().length > 0 && s.trim().length <= MAX;
/** A short title never abbreviates a word ("Asst", "Exec", "Eng"): it drops words instead. */
const ABBREV = /\b(Asst|Assoc|Exec|Eng|Ops|Infra|Mgmt|Mgr|Dev|Svc|Mktg)\b\.?/;
const okTitle = (s) => okShort(s) && !ABBREV.test(s);
/** The short title a role would show now (its own title, or the cache), for the "different within a sector" rule. */
const shownShort = (r) => r.short ?? (okTitle(cache.items[r.title]) ? cache.items[r.title] : null);
const clash = (r) => allRoles.some((o) => o !== r && o.industry_id === r.industry_id && shownShort(o) && shownShort(o) === shownShort(r));
const needTitles = allRoles.filter((r) => !r.short && (!okTitle(cache.items[r.title]) || clash(r)));
const takenIn = (r) => allRoles.filter((o) => o.industry_id === r.industry_id && o !== r && !needTitles.includes(o) && shownShort(o)).map(shownShort);
const labelFacts = [...new Map(nowPicks.map((p) => [p.fact.id, p.fact])).values()].filter((f) => !okShort(cache.labels[f.id]));

const SYSTEM = [
  "You write short labels for a Singapore careers site for fresh university graduates.",
  `Every label is at most ${MAX} characters, counting spaces. Sentence case or the title's own capitals. No abbreviations a student would not know (HR, IT, ICT, KYC, AML, PR are fine). No hedging words, no years, quarters or months.`,
  "Use only words and facts from the input. Answer by calling the tool once.",
].join("\n");
const TITLE_TOOL = {
  name: "report_short_titles",
  description: "Report a short title for every Skills Framework job role title given.",
  strict: true,
  input_schema: {
    type: "object",
    properties: { items: { type: "array", items: { type: "object", properties: { title: { type: "string", description: "The title exactly as given." }, short: { type: "string", description: `At most ${MAX} characters.` } }, required: ["title", "short"], additionalProperties: false } } },
    required: ["items"],
    additionalProperties: false,
  },
};
const LABEL_TOOL = {
  name: "report_labels",
  description: "Report a one-line label for every figure given, to sit under the big number.",
  strict: true,
  input_schema: {
    type: "object",
    properties: { labels: { type: "array", items: { type: "object", properties: { id: { type: "string", description: "The figure's id exactly as given." }, label: { type: "string", description: `At most ${MAX} characters.` } }, required: ["id", "label"], additionalProperties: false } } },
    required: ["labels"],
    additionalProperties: false,
  },
};
const titleJobs = [];
for (let i = 0; i < needTitles.length; i += 40) titleJobs.push(needTitles.slice(i, i + 40));
const titlePrompt = (batch) => [
  `Shorten each job role title for a card heading: every short title has ${MAX} characters or fewer, counting spaces. Never abbreviate a word (no "Asst", "Exec", "Eng", "Ops"): drop words instead, such as Associate, Assistant or Executive, or a qualifier after the core job name. ` + "A title that lists several roles with \" / \" becomes the one an entry-level graduate is hired as (the most junior or most common). Keep the role's own words; do not invent a new job name.",
  "",
  ...batch.map((r) => `- ${r.title}  [${r.title.length} characters; sector: ${industriesRows.find((i) => i.id === r.industry_id).sector}; track: ${r.track}; already used in this sector, so not allowed: ${takenIn(r).join(" | ") || "-"}]`),
  "",
  "Two titles of the same sector in this list never get the same short title.",
].join("\n");
const labelPrompt = (batch) => [
  "Write the label that sits under each big number on an industry page. It names what the number counts, with its unit when the number alone would mislead (\"4.4\" with unit \"thousand job vacancies\" becomes \"Job vacancies, thousands\"). One line, no period, no dates.",
  "",
  ...batch.map((f) => `- id: ${f.id}\n  number: ${f.value}\n  unit: ${f.unit ?? "-"}\n  metric: ${f.metric}\n  industry as printed: ${f.source_industry ?? "-"}\n  quote: ${f.quote.slice(0, 400)}`),
].join("\n");
const est = [...titleJobs.map(titlePrompt), ...(labelFacts.length ? [labelPrompt(labelFacts)] : [])]
  .reduce((usd, p) => usd + ((SYSTEM.length + p.length) / 3.5) * PRICE.input + 2500 * PRICE.output, 0);
console.log(`Claude: ${needTitles.length} titles in ${titleJobs.length} calls, ${labelFacts.length} labels; estimated US$${est.toFixed(2)} (cap US$${CAP_USD})`);
if (ESTIMATE) process.exit(0);

let spent = 0;
if (!NO_API && (titleJobs.length || labelFacts.length)) {
  process.loadEnvFile?.(join(ROOT, ".env.local"));
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set in the project's .env.local (or run with --no-api)");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic({ apiKey: key, maxRetries: 6, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const call = async (tool, user) => {
    if (spent >= CAP_USD) throw new Error(`cap of US$${CAP_USD} reached`);
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      tools: [tool],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: user }],
    });
    spent += (res.usage?.input_tokens ?? 0) * PRICE.input + (res.usage?.output_tokens ?? 0) * PRICE.output;
    if (res.stop_reason === "refusal") throw new Error(`refusal ${res.stop_details?.category ?? ""}`);
    const use = res.content.find((b) => b.type === "tool_use" && b.name === tool.name);
    if (!use) throw new Error(`no tool call (stop_reason ${res.stop_reason})`);
    cache.model = res.model ?? MODEL;
    return typeof use.input === "string" ? JSON.parse(use.input) : use.input;
  };
  const jobs = [
    ...titleJobs.map((batch) => async () => {
      const out = await call(TITLE_TOOL, titlePrompt(batch));
      const want = new Set(batch.map((r) => r.title));
      for (const it of out.items ?? []) if (want.has(it.title) && okTitle(it.short)) cache.items[it.title] = it.short.trim();
    }),
    ...(labelFacts.length ? [async () => {
      const out = await call(LABEL_TOOL, labelPrompt(labelFacts));
      const want = new Set(labelFacts.map((f) => f.id));
      for (const it of out.labels ?? []) if (want.has(it.id) && okShort(it.label)) cache.labels[it.id] = it.label.trim().replace(/\.$/, "");
    }] : []),
  ];
  const results = await Promise.allSettled(jobs.map((j) => j()));
  for (const r of results) if (r.status === "rejected") console.warn(`Claude call failed: ${r.reason?.message ?? r.reason}`);
  writeFileSync(cacheFile, JSON.stringify({ model: cache.model, items: Object.fromEntries(Object.entries(cache.items).sort()), labels: Object.fromEntries(Object.entries(cache.labels).sort()) }, null, 1) + "\n");
  console.log(`Claude: spent US$${spent.toFixed(4)} (cap US$${CAP_USD}) → data/raw/careers-short-titles.json`);
}

// Short titles: the cache, else the role's own shortest title that fits (labelled nowhere: it is the SF's own words).
const fallbackShort = (t) => titlesOf(t).filter((x) => x.length <= MAX).sort((a, b) => a.length - b.length)[0] ?? null;
const unshort = [];
for (const r of allRoles) {
  if (r.short) continue;
  r.short = okTitle(cache.items[r.title]) ? cache.items[r.title] : fallbackShort(r.title);
  if (!r.short) unshort.push(r.title);
}
if (unshort.length) throw new Error(`no short title of ${MAX} characters or fewer for: ${unshort.join("; ")}`);
for (const ind of industriesRows) {
  const rs = allRoles.filter((r) => r.industry_id === ind.id);
  const dup = rs.filter((r) => rs.some((o) => o !== r && o.short === r.short)).map((r) => `${r.short} (${r.title})`);
  if (dup.length) console.warn(`${ind.id}: the same short title twice: ${dup.join("; ")}`);
}

// ── final role ids: the title's slug, or the short title's slug when the title is very long; "-<industry>"
// only when a title repeats across sectors ─────────────────────────────────────────────────────────────
const usedIds = new Set();
const idOf = new Map();
for (const r of [...allRoles].sort((a, b) => a._order - b._order)) {
  const full = slug(r.title);
  let id = full.length > 60 ? slug(r.short) : full;
  if (slugCount.get(full).size > 1) id = `${id}-${r.industry_id}`;
  if (usedIds.has(id)) id = `${id}-${r.industry_id}`;
  for (let n = 2; usedIds.has(id); n++) id = `${id.replace(/-\d+$/, "")}-${n}`;
  usedIds.add(id);
  idOf.set(r.id, id);
}
for (const r of allRoles) r.id = idOf.get(r.id);
for (const s of roleSkills) s.role_id = idOf.get(s.role_id);
for (const l of roleFacts) l.role_id = idOf.get(l.role_id);

const nowRows = [];
for (const ind of industriesRows) for (const reg of ["singapore", "asia-pacific", "global"]) {
  const picks = nowPicks.filter((p) => p.industry_id === ind.id && p.region === reg && okShort(cache.labels[p.fact.id]));
  picks.forEach((p, i) => nowRows.push({ industry_id: ind.id, region: reg, slot: i + 1, fact_id: p.fact.id, label: cache.labels[p.fact.id] }));
}

// ── old /careers/<slug> → the nearest new role (Q24): same SF title, then same sector and track, then the industry ──
const words = (t) => new Set(normTitle(t).split(" ").filter((w) => w.length > 2 && !["and", "the", "assistant", "associate", "executive", "manager", "senior", "junior"].includes(w)));
const redirects = {};
for (const c of oldCareers) {
  const fr = c.frameworkRole;
  const want = titlesOf(fr.jobRole).map(normTitle);
  const sameSector = (r) => industriesRows.find((i) => i.id === r.industry_id).sector === fr.sector;
  const titleHit = (r) => titlesOf(r.title).some((t) => want.includes(normTitle(t)));
  let target = allRoles.find((r) => sameSector(r) && titleHit(r)) ?? allRoles.find(titleHit);
  const ww = new Set(titlesOf(fr.jobRole).flatMap((t) => [...words(t)]));
  const overlap = (r) => [...words(r.title)].filter((w) => ww.has(w)).length;
  const best = (pool) => pool.sort((a, b) => overlap(b) - overlap(a) || +(b.mom_needs || b.high_pay) - +(a.mom_needs || a.high_pay) || a._order - b._order)[0];
  if (!target) target = best(allRoles.filter((r) => sameSector(r) && r.track === fr.track));
  // A sector outside the 16 (e.g. Trade Associations and Chambers): the role sharing the most title words.
  if (!target && !industryBySector.has(fr.sector)) target = best(allRoles.filter((r) => overlap(r) > 0));
  const industry = industryBySector.get(fr.sector);
  redirects[c.id] = target ? `roles/${target.id}` : industry ? `industries/${industry.id}` : null;
  if (target) target.redirect_from.push(c.id);
}

// ── write ──────────────────────────────────────────────────────────────────────────────────────────────
const keep = new Set([...roleFacts.map((l) => l.fact_id), ...nowRows.map((n) => n.fact_id), ...[...industryFacts.values()].flat(), ...imageRows.map((v) => v.id), ...regionalFacts.map((f) => f.id)]);
const factRows = [...facts.values()].filter((f) => keep.has(f.id)).sort((a, b) => a.id.localeCompare(b.id));
const roles = allRoles.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "_order"))).sort((a, b) => a.industry_id.localeCompare(b.industry_id) || a.sort_order - b.sort_order);

// degree skills: rule links (map.json) and Claude links (map-api.json), each with its module and module kind
const topupByKaplan = new Map(topups.programmes.filter((p) => p.kaplanId).map((p) => [p.kaplanId, p]));
const degreeSkills = new Map();
const addSkill = (row) => degreeSkills.set(`${row.programme_id}|${row.skill}|${row.module}|${row.basis}`, row);
const kindOf = (d, mod) => {
  const m = d.modules.find((x) => x.name === mod);
  if (m) return m.kind === "elective" ? "elective" : "core";
  const t = topupByKaplan.get(d.programmeId);
  return t?.electiveModules?.includes(mod) ? "elective" : "core";
};
const byProgramme = new Map(map.degreeSkills.map((d) => [d.programmeId, d]));
for (const d of map.degreeSkills) for (const s of d.skills) for (const mod of s.fromModules) addSkill({ programme_id: d.programmeId, skill: s.skill, module: mod, module_kind: kindOf(d, mod), basis: "rule", model: null });
for (const r of mapApi.results) {
  const d = byProgramme.get(r.programmeId);
  if (!d) throw new Error(`map-api.json: unknown programme ${r.programmeId}`);
  for (const l of r.links) for (const skill of l.skills) addSkill({ programme_id: r.programmeId, skill, module: l.module, module_kind: kindOf(d, l.module), basis: "claude", model: r.model ?? mapApi.meta.model });
}
for (const r of mapIndustry?.results ?? []) {
  const d = byProgramme.get(r.programme_id);
  if (!d) throw new Error(`map-industry-api.json: unknown programme ${r.programme_id}`);
  for (const l of r.links) for (const skill of l.skills) addSkill({ programme_id: r.programme_id, skill, module: l.module, module_kind: kindOf(d, l.module), basis: "claude", model: r.model ?? mapIndustry.meta.model });
}

const bachelor = new Set(kaplan.programmes.filter((p) => ["bachelor-advanced-standing", "bachelor-direct-honours", "top-up"].includes(p.level)).map((p) => p.id));
const linked = new Set(degreeIndustries.map((l) => l.programme_id));
const missing = [...bachelor].filter((id) => !linked.has(id));
if (missing.length) throw new Error(`degrees with no industry: ${missing.join(", ")}`);

const out = (f, v) => writeFileSync(join(RAW, f), JSON.stringify(v, null, 1) + "\n");
out("careers-industries.json", { built: BUILT, industries: industriesRows, degreeIndustries });
out("careers-roles.json", { built: BUILT, roles, roleSkills, roleFacts, redirects });
out("careers-degree-skills.json", { built: BUILT, rows: [...degreeSkills.values()] });
out("careers-facts.json", { built: BUILT, facts: factRows });
out("careers-now.json", { built: BUILT, rows: nowRows });
// For generateStaticParams when the table is empty or not there yet (lib/data/careers-db.ts getHotRoleIds).
out("careers-hot-roles.json", { built: BUILT, ids: roles.filter((r) => r.mom_needs || r.high_pay).map((r) => r.id) });

const hot = roles.filter((r) => r.mom_needs || r.high_pay);
console.log([
  `industries ${industriesRows.length}, degree links ${degreeIndustries.length} (${linked.size} degrees)`,
  `roles ${roles.length} (hot ${hot.length}: MOM needs ${roles.filter((r) => r.mom_needs).length}, high pay ${roles.filter((r) => r.high_pay).length}), role skills ${roleSkills.length}, role facts ${roleFacts.length}`,
  `degree skills ${degreeSkills.size}, facts ${factRows.length} (image-table rows ${imageRows.length}, regional ${regionalFacts.length}${regional ? "" : ": no regional.json yet"})`,
  `now slots ${nowRows.length} (singapore ${nowRows.filter((n) => n.region === "singapore").length}, asia-pacific ${nowRows.filter((n) => n.region === "asia-pacific").length}, global ${nowRows.filter((n) => n.region === "global").length})`,
  `redirects: ${Object.entries(redirects).map(([k, v]) => `${k} → ${v}`).join("; ")}`,
].join("\n"));
