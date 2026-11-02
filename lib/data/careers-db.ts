import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import certificates from "@/data/raw/certificates.json";
import hotRolesFile from "@/data/raw/careers-hot-roles.json";
import kaplan from "@/data/raw/kaplan-programmes.json";
import masterSkills from "@/data/raw/master-skills.json";
import topups from "@/data/raw/topups.json";
import { masterOptionsFor, type MasterSkillsFile } from "@/lib/careers/master-options";
import { BACHELOR_LEVELS, REGIONS } from "@/lib/careers/types";
import type {
  BachelorLevel,
  DegreeIndustry,
  DegreeSkill,
  FactFigures,
  FactRow,
  Industry,
  IndustryFull,
  IndustryNowStat,
  KaplanDegree,
  MasterOption,
  Region,
  RoleCardData,
  RoleEmployer,
  RoleFactLink,
  RoleFull,
  RoleKeyIndex,
  RoleOpenings,
  RoleSkill,
  StudentContext,
} from "@/lib/careers/types";
import { matchProgrammes, type ProgrammeCard } from "@/lib/data/careers";
import { selectAll, supabase } from "@/lib/supabase";
import { packDegreeSkills } from "@/lib/careers/pack";

// /careers by industry, read from the career_* tables (supabase/migrations/20261029110000_careers_industries.sql,
// loaded by `npm run data:load -- --only=careers`). Every reader is "use cache" for hours under the tag "careers";
// rows come back in snake_case and are mapped onto the camelCase types of lib/careers/types.ts here.
// The 56 degrees, their exemptions and module flags are sliced from data/raw on the server, so topups.json and
// certificates.json never reach a client component whole.

// ── rows ───────────────────────────────────────────────────────────────────────────────────────────────

type IndustryRow = {
  id: string;
  sector: string;
  short: string;
  sf_role_total: number;
  entry_role_count: number;
  mom_industry: string | null;
  mom_basis: string;
  mom_wage_sheet: string | null;
  jobstreet_industries: string[];
  jobstreet_basis: string | null;
  sort_order: number;
};
type DegreeIndustryRow = { programme_id: string; industry_id: string; basis: string; shared_skills: string[] };
type RoleRow = {
  id: string;
  industry_id: string;
  title: string;
  short: string;
  track: string;
  tier: "entry" | "early-career";
  mean_proficiency: number | string;
  variants: string[];
  ssoc_code: string | null;
  ssoc_basis: string | null;
  mom_needs: boolean;
  high_pay: boolean;
  hot: boolean;
  high_pay_rule: string | null;
  search_term: string | null;
  search_scope: string | null;
  sort_order: number;
  redirect_from: string[];
};
type RoleSkillRow = { role_id: string; skill: string; level: number; key: boolean; sort_order: number };
type RoleFactRow = { role_id: string; fact_id: string; use: RoleFactLink["use"]; basis: string | null };
type NowRow = { industry_id: string; region: Region; slot: 1 | 2 | 3 | 4; fact_id: string; label: string };
type DegreeSkillRow = { programme_id: string; skill: string; module: string; module_kind: "core" | "elective"; basis: "rule" | "claude"; model: string | null };
type EmployerRow = {
  role_id: string;
  employer_id: string;
  company: string;
  company_lists: string[];
  careers_url: string | null;
  search_url: string | null;
  openings: number;
  status: RoleEmployer["status"];
  checked_on: string;
};
type FactDbRow = {
  id: string;
  kind: FactRow["kind"];
  industry_id: string | null;
  source_industry: string | null;
  metric: string;
  value: string;
  value_num: number | string | null;
  figures: FactFigures | null;
  unit: string | null;
  period: string | null;
  region: Region;
  region_label: string | null;
  quote: string;
  quote_kind: FactRow["quoteKind"];
  quote_columns: string | null;
  mark: string[];
  source_kind: FactRow["sourceKind"];
  publisher: string;
  title: string;
  published: string | null;
  published_on: string | null;
  url: string;
  alt_url: string | null;
  licence: string | null;
  page: number | null;
  where_ref: string | null;
  sample: string | null;
  note: string | null;
  read_on: string;
  verified_by: FactRow["verifiedBy"];
};

const INDUSTRY_COLS = "id,sector,short,sf_role_total,entry_role_count,mom_industry,mom_basis,mom_wage_sheet,jobstreet_industries,jobstreet_basis,sort_order";
const ROLE_COLS = "id,industry_id,title,short,track,tier,mean_proficiency,variants,ssoc_code,ssoc_basis,mom_needs,high_pay,hot,high_pay_rule,search_term,search_scope,sort_order,redirect_from";
const FACT_COLS = "id,kind,industry_id,source_industry,metric,value,value_num,figures,unit,period,region,region_label,quote,quote_kind,quote_columns,mark,source_kind,publisher,title,published,published_on,url,alt_url,licence,page,where_ref,sample,note,read_on,verified_by";
const EMPLOYER_COLS = "role_id,employer_id,company,company_lists,careers_url,search_url,openings,status,checked_on";

const num = (v: number | string | null): number | null => (v == null ? null : Number(v));

const toIndustry = (r: IndustryRow): Industry => ({
  id: r.id,
  sector: r.sector,
  short: r.short,
  sortOrder: r.sort_order,
  sfRoleTotal: r.sf_role_total,
  entryRoleCount: r.entry_role_count,
  momIndustry: r.mom_industry,
  momBasis: r.mom_basis,
  momWageSheet: r.mom_wage_sheet,
  jobstreetIndustries: r.jobstreet_industries ?? [],
  jobstreetBasis: r.jobstreet_basis,
});
const toDegreeIndustry = (r: DegreeIndustryRow): DegreeIndustry => ({ programmeId: r.programme_id, industryId: r.industry_id, basis: r.basis, sharedSkills: r.shared_skills ?? [] });
// Every skill SWDA's Skills Framework lists for the role is one the match counts (2026-11-02, the user's choice:
// the dataset's own definition, not our 8 "most shared"); the rows keep the old K2 order, so `key` is true for all.
const toSkill = (r: RoleSkillRow): RoleSkill => ({ skill: r.skill, level: r.level, key: true, sortOrder: r.sort_order });
const toEmployer = (r: EmployerRow): RoleEmployer => ({
  roleId: r.role_id,
  employerId: r.employer_id,
  company: r.company,
  companyLists: r.company_lists ?? [],
  careersUrl: r.careers_url,
  searchUrl: r.search_url,
  openings: r.openings,
  status: r.status,
  checkedOn: r.checked_on,
});
const toFact = (r: FactDbRow): FactRow => ({
  id: r.id,
  kind: r.kind,
  industryId: r.industry_id,
  sourceIndustry: r.source_industry,
  metric: r.metric,
  value: r.value,
  valueNum: num(r.value_num),
  figures: r.figures,
  unit: r.unit,
  period: r.period,
  region: r.region,
  regionLabel: r.region_label,
  quote: r.quote,
  quoteKind: r.quote_kind,
  quoteColumns: r.quote_columns,
  mark: r.mark ?? [],
  sourceKind: r.source_kind,
  publisher: r.publisher,
  title: r.title,
  published: r.published,
  publishedOn: r.published_on,
  url: r.url,
  altUrl: r.alt_url,
  licence: r.licence,
  page: r.page,
  whereRef: r.where_ref,
  sample: r.sample,
  note: r.note,
  readOn: r.read_on,
  verifiedBy: r.verified_by,
});

/** Rows of `table` where `column` is one of `values`, in chunks so the request URL stays short. */
async function selectIn<T>(table: string, columns: string, column: string, values: string[], orderBy: string | string[]): Promise<T[]> {
  const out: T[] = [];
  const unique = [...new Set(values)];
  for (let i = 0; i < unique.length; i += 150) out.push(...(await selectAll<T>(table, columns, { column, values: unique.slice(i, i + 150) }, orderBy)));
  return out;
}

// ── cards ──────────────────────────────────────────────────────────────────────────────────────────────

/** Badges' facts, key skills, wage and openings for each role; hot first (both badges, then one), then sort_order. */
async function cardsFor(roles: RoleRow[]): Promise<RoleCardData[]> {
  if (!roles.length) return [];
  const ids = roles.map((r) => r.id);
  const [skills, links, employers] = await Promise.all([
    selectIn<RoleSkillRow>("career_role_skills", "role_id,skill,level,key,sort_order", "role_id", ids, ["role_id", "skill"]),
    selectIn<RoleFactRow>("career_role_facts", "role_id,fact_id,use,basis", "role_id", ids, ["role_id", "fact_id", "use"]),
    selectIn<EmployerRow>("career_role_employers", EMPLOYER_COLS, "role_id", ids, ["role_id", "employer_id"]),
  ]);
  const wageIds = links.filter((l) => l.use === "wage").map((l) => l.fact_id);
  const wages = new Map((await selectIn<FactDbRow>("career_facts", "id,value_num,figures", "id", wageIds, "id")).map((f) => [f.id, f]));
  const cards = roles.map((r): RoleCardData => {
    const own = links.filter((l) => l.role_id === r.id);
    const needs = own.filter((l) => l.use === "mom-needs-jv" || l.use === "mom-needs-sol");
    const wage = own.find((l) => l.use === "wage");
    const w = wage ? wages.get(wage.fact_id) : undefined;
    const emp = employers.filter((e) => e.role_id === r.id);
    const openings: RoleOpenings | null = emp.length
      ? { total: emp.reduce((n, e) => n + e.openings, 0), employers: emp.length, checkedOn: emp.map((e) => e.checked_on).sort().at(-1)! }
      : null;
    return {
      id: r.id,
      industryId: r.industry_id,
      title: r.title,
      short: r.short,
      track: r.track,
      tier: r.tier,
      meanProficiency: Number(r.mean_proficiency),
      variants: r.variants ?? [],
      ssocCode: r.ssoc_code,
      ssocBasis: r.ssoc_basis,
      momNeeds: r.mom_needs,
      highPay: r.high_pay,
      hot: r.hot,
      highPayRule: r.high_pay_rule,
      searchTerm: r.search_term,
      searchScope: r.search_scope,
      sortOrder: r.sort_order,
      redirectFrom: r.redirect_from ?? [],
      keySkills: skills.filter((s) => s.role_id === r.id).sort((a, b) => a.sort_order - b.sort_order).map(toSkill),
      momNeedsFactIds: needs.map((l) => l.fact_id),
      momNeedsSol: needs.some((l) => l.use === "mom-needs-sol"),
      wageFactId: wage?.fact_id ?? null,
      wageMedian: w ? (w.figures?.median ?? num(w.value_num)) : null,
      openings,
    };
  });
  const rank = (c: RoleCardData) => (c.momNeeds && c.highPay ? 0 : c.hot ? 1 : 2);
  return cards.sort((a, b) => rank(a) - rank(b) || a.sortOrder - b.sortOrder);
}

// ── readers ────────────────────────────────────────────────────────────────────────────────────────────

/** The 16 industries, by sortOrder. */
export async function getIndustries(): Promise<Industry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  const rows = await selectAll<IndustryRow>("career_industries", INDUSTRY_COLS, undefined, "id");
  return rows.map(toIndustry).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** One industry with its degree links and its "now" stats per region (0–4 each, never filled in). */
export async function getIndustry(id: string): Promise<IndustryFull | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  const { data, error } = await supabase().from("career_industries").select(INDUSTRY_COLS).eq("id", id).maybeSingle<IndustryRow>();
  if (error) throw new Error(`career_industries: ${error.message}`);
  if (!data) return null;
  const [links, now] = await Promise.all([
    selectAll<DegreeIndustryRow>("career_degree_industries", "programme_id,industry_id,basis,shared_skills", { column: "industry_id", values: [id] }, ["programme_id"]),
    selectAll<NowRow>("career_industry_now", "industry_id,region,slot,fact_id,label", { column: "industry_id", values: [id] }, ["region", "slot"]),
  ]);
  const facts = new Map((await getFacts(now.map((n) => n.fact_id))).map((f) => [f.id, f]));
  const byRegion = Object.fromEntries(REGIONS.map((r) => [r, [] as IndustryNowStat[]])) as Record<Region, IndustryNowStat[]>;
  for (const n of [...now].sort((a, b) => a.slot - b.slot)) {
    const fact = facts.get(n.fact_id);
    if (fact) byRegion[n.region].push({ industryId: n.industry_id, region: n.region, slot: n.slot, factId: n.fact_id, label: n.label, fact });
  }
  return { ...toIndustry(data), degreeLinks: links.map(toDegreeIndustry), now: byRegion };
}

/** Every degree → industry link (56 degrees × 1–3). */
export async function getDegreeIndustries(): Promise<DegreeIndustry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  const rows = await selectAll<DegreeIndustryRow>("career_degree_industries", "programme_id,industry_id,basis,shared_skills", undefined, ["programme_id", "industry_id"]);
  return rows.map(toDegreeIndustry);
}

/** Every entry and early-career role of the industry, hot first. */
export async function getRolesForIndustry(id: string): Promise<RoleCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  const roles = await selectAll<RoleRow>("career_roles", ROLE_COLS, { column: "industry_id", values: [id] }, "id");
  return cardsFor(roles);
}

/** Every role of every industry with its key skills only, compactly (RoleKeyIndex): the entry page's counts and best match. */
export async function getRoleKeys(): Promise<RoleKeyIndex> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  const [roles, skills] = await Promise.all([
    selectAll<Pick<RoleRow, "id" | "industry_id" | "short" | "track" | "hot" | "sort_order">>("career_roles", "id,industry_id,short,track,hot,sort_order", undefined, "id"),
    selectAll<RoleSkillRow>("career_role_skills", "role_id,skill,level,key,sort_order", undefined, ["role_id", "skill"]),
  ]);
  const titles: string[] = [];
  const at = new Map<string, number>();
  const keys = new Map<string, [number, number][]>();
  for (const s of [...skills].sort((a, b) => a.sort_order - b.sort_order)) {
    let i = at.get(s.skill);
    if (i === undefined) at.set(s.skill, (i = titles.push(s.skill) - 1));
    const own = keys.get(s.role_id) ?? [];
    own.push([i, s.level]);
    keys.set(s.role_id, own);
  }
  return {
    skills: titles,
    roles: [...roles]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({ id: r.id, industryId: r.industry_id, short: r.short, track: r.track, hot: r.hot, sortOrder: r.sort_order, keys: keys.get(r.id) ?? [] })),
  };
}

/** One role with its industry, every skill, every linked fact (resolved) and the employers checked. */
export async function getRole(id: string): Promise<RoleFull | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  const db = supabase();
  const { data: role, error } = await db.from("career_roles").select(ROLE_COLS).eq("id", id).maybeSingle<RoleRow>();
  if (error) throw new Error(`career_roles: ${error.message}`);
  if (!role) return null;
  const [[card], industry, skills, links, employers] = await Promise.all([
    cardsFor([role]),
    db.from("career_industries").select(INDUSTRY_COLS).eq("id", role.industry_id).single<IndustryRow>(),
    selectAll<RoleSkillRow>("career_role_skills", "role_id,skill,level,key,sort_order", { column: "role_id", values: [id] }, "skill"),
    selectAll<RoleFactRow>("career_role_facts", "role_id,fact_id,use,basis", { column: "role_id", values: [id] }, ["fact_id", "use"]),
    selectAll<EmployerRow>("career_role_employers", EMPLOYER_COLS, { column: "role_id", values: [id] }, "employer_id"),
  ]);
  if (industry.error) throw new Error(`career_industries: ${industry.error.message}`);
  const facts = new Map((await getFacts(links.map((l) => l.fact_id))).map((f) => [f.id, f]));
  return {
    ...card,
    industry: toIndustry(industry.data),
    skills: skills.sort((a, b) => a.sort_order - b.sort_order).map(toSkill),
    facts: links.flatMap((l) => {
      const fact = facts.get(l.fact_id);
      return fact ? [{ factId: l.fact_id, use: l.use, basis: l.basis, fact }] : [];
    }),
    employers: employers.map(toEmployer).sort((a, b) => b.openings - a.openings || a.company.localeCompare(b.company)),
  };
}

/**
 * The hot role ids, for generateStaticParams. Never empty (Cache Components fails a build on []): when the table
 * is empty or not there yet, the ids come from data/raw/careers-hot-roles.json, the same build's output.
 */
export async function getHotRoleIds(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  try {
    const rows = await selectAll<{ id: string }>("career_roles", "id", { column: "hot", values: [true] }, "id");
    if (rows.length) return rows.map((r) => r.id);
  } catch {
    // table not loaded yet: fall through to the file
  }
  return hotRolesFile.ids.length ? hotRolesFile.ids : ["software-engineer"];
}

/** programmeId → its module → skill links (rule and claude). */
export async function getDegreeSkills(): Promise<Record<string, DegreeSkill[]>> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  const rows = await selectAll<DegreeSkillRow>("career_degree_skills", "programme_id,skill,module,module_kind,basis,model", undefined, ["programme_id", "skill", "module", "basis"]);
  const out: Record<string, DegreeSkill[]> = {};
  for (const r of rows) (out[r.programme_id] ??= []).push({ programmeId: r.programme_id, skill: r.skill, module: r.module, moduleKind: r.module_kind, basis: r.basis, model: r.model });
  return out;
}

/** The career_facts rows with these ids (for receipts), in the order asked. */
export async function getFacts(ids: string[]): Promise<FactRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  if (!ids.length) return [];
  const rows = new Map((await selectIn<FactDbRow>("career_facts", FACT_COLS, "id", ids, "id")).map((r) => [r.id, toFact(r)]));
  return [...new Set(ids)].flatMap((id) => (rows.has(id) ? [rows.get(id)!] : []));
}

/**
 * A master's helps toward an industry's roles when it is in one of the industry's disciplines and its own name says
 * so (Kaplan 360++'s rule, shown on the role page as the method).
 */
export const INDUSTRY_MATCH: Record<string, { disciplines: string[]; words: RegExp; label: string }> = {
  "infocomm-technology": { disciplines: ["it", "ai-data"], words: /comput|software|information (?:technology|systems)|\bit\b|cyber|security|\bdata\b|artificial intelligence|\bai\b|machine learning/i, label: "computing, software, information technology, cyber security, data, AI" },
  "financial-services": { disciplines: ["accounting-finance", "business", "ai-data"], words: /financ|fintech|banking|investment|actuarial|wealth|risk/i, label: "finance, fintech, banking, investment, actuarial, wealth, risk" },
  media: { disciplines: ["communication", "marketing"], words: /media|communication|journalism|marketing|public relations|broadcast|film|digital/i, label: "media, communication, journalism, marketing, public relations" },
  "wholesale-trade": { disciplines: ["business", "marketing"], words: /supply chain|logistic|international business|trade|procurement|marketing|sales/i, label: "supply chain, logistics, international business, trade, marketing" },
  retail: { disciplines: ["business", "marketing"], words: /retail|marketing|brand|e-?commerce|consumer|digital/i, label: "retail, marketing, brand, e-commerce, consumer" },
  "human-resource": { disciplines: ["business", "psychology-counselling"], words: /human resource|\bhr\b|people|organi[sz]ational|talent|workforce|industrial relations/i, label: "human resources, people, organisational psychology, talent" },
  accountancy: { disciplines: ["accounting-finance"], words: /accounting|accountancy|audit|tax|professional accounting/i, label: "accounting, audit, tax" },
  "social-service": { disciplines: ["psychology-counselling"], words: /social work|counsel|psycholog|community|mental health|social/i, label: "social work, counselling, psychology, mental health" },
  logistics: { disciplines: ["business"], words: /supply chain|logistic|operations|procurement|transport|shipping|maritime/i, label: "supply chain, logistics, operations, procurement, shipping" },
  "early-childhood": { disciplines: ["education"], words: /early childhood|education|teaching|child/i, label: "early childhood, education, teaching" },
  "hotel-and-accommodation-services": { disciplines: ["hospitality-tourism", "business"], words: /hospitality|hotel|tourism|event/i, label: "hospitality, hotel, tourism, events" },
  tourism: { disciplines: ["hospitality-tourism"], words: /tourism|hospitality|event|travel/i, label: "tourism, hospitality, events, travel" },
  "built-environment": { disciplines: ["construction"], words: /construction|built environment|project management|quantity|property|real estate|facilit|architect|civil/i, label: "construction, built environment, project management, property" },
  healthcare: { disciplines: ["healthcare-nursing"], words: /nurs|health|clinical/i, label: "nursing, health, clinical" },
  "intellectual-property": { disciplines: ["law-criminology", "business"], words: /intellectual property|\bip\b|technology law|innovation|\blaw\b/i, label: "intellectual property, technology law, innovation, law" },
  "legal-services": { disciplines: ["law-criminology"], words: /\blaw\b|legal|\bllm\b|juris/i, label: "law, legal" },
};

/** Master's for a role (by its industry's INDUSTRY_MATCH): the first 6, and how many there are. */
export async function getRoleProgrammes(roleId: string): Promise<{ programmes: ProgrammeCard[]; total: number }> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  const { data, error } = await supabase().from("career_roles").select("industry_id").eq("id", roleId).maybeSingle<{ industry_id: string }>();
  if (error) throw new Error(`career_roles: ${error.message}`);
  const match = data ? INDUSTRY_MATCH[data.industry_id] : undefined;
  if (!match) return { programmes: [], total: 0 };
  const all = await matchProgrammes(match.disciplines, match.words);
  return { programmes: all.slice(0, 6), total: all.length };
}

/**
 * Master's for a role: every master's in its industry's INDUSTRY_MATCH disciplines that adds at least one of the
 * role's key skills, lists cut to those skills (lib/careers/master-options.ts). From data/raw/master-skills.json.
 */
export async function getRoleMasterOptions(roleId: string): Promise<MasterOption[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  const role = await getRole(roleId);
  const match = role ? INDUSTRY_MATCH[role.industryId] : undefined;
  if (!role || !match) return [];
  return masterOptionsFor(masterSkills as unknown as MasterSkillsFile, match.disciplines, role.keySkills.map((s) => s.skill));
}

// ── the student's side (sliced from data/raw on the server) ────────────────────────────────────────────

type TopupRaw = { kaplanId: string | null; url: string | null; coreModules: string[] | null; electiveModules: string[] | null };
type CertificateEntry = { status?: string; exempt?: string[] };

const BACHELOR = new Set<string>(BACHELOR_LEVELS);
const topupByKaplan = new Map((topups.programmes as unknown as TopupRaw[]).filter((p) => p.kaplanId).map((p) => [p.kaplanId!, p]));
const DEGREES: KaplanDegree[] = kaplan.programmes
  .filter((p) => BACHELOR.has(p.level))
  .map((p) => {
    const t = topupByKaplan.get(p.id);
    return {
      id: p.id,
      name: p.name,
      university: p.university ?? p.awardingBody,
      level: p.level as BachelorLevel,
      discipline: p.discipline,
      disciplineLabel: (kaplan.disciplines as Record<string, string>)[p.discipline] ?? p.discipline,
      studentPass: !!p.studentPass,
      hasModuleData: !!t && ((t.coreModules?.length ?? 0) > 0 || (t.electiveModules?.length ?? 0) > 0),
      url: t?.url ?? p.sourceUrl ?? null,
    };
  });

/** The 56 Kaplan bachelor's degrees (Q3, Q4), for the DegreePicker. */
export function getKaplanDegrees(): KaplanDegree[] {
  return DEGREES;
}

/** Exempted exam codes per body for each degree (data/raw/certificates.json, status "exempt" only). */
function exemptions(): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  const programmes = certificates.programmes as unknown as Record<string, Record<string, CertificateEntry | unknown>>;
  for (const d of DEGREES) {
    const entry = programmes[d.id];
    if (!entry) continue;
    for (const [body, v] of Object.entries(entry)) {
      const c = v as CertificateEntry | null;
      if (c && typeof c === "object" && c.status === "exempt" && Array.isArray(c.exempt) && c.exempt.length) (out[d.id] ??= {})[body] = c.exempt;
    }
  }
  return out;
}

/** What every client part of /careers needs to build a MatchStudent. */
export async function getStudentContext(): Promise<StudentContext> {
  "use cache";
  cacheLife("hours");
  cacheTag("careers");
  const [links, degreeSkills, roleKeys] = await Promise.all([getDegreeIndustries(), getDegreeSkills(), getRoleKeys()]);
  return { degrees: DEGREES, links, degreeSkills: packDegreeSkills(degreeSkills), exemptions: exemptions(), coverableSkills: coverableSkills(roleKeys, degreeSkills) };
}

/** Skill titles compared without case or spacing differences (as lib/careers/match.ts does). */
const normSkill = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** The key skills that some Kaplan degree's core modules cover (StudentContext.coverableSkills). */
function coverableSkills(index: RoleKeyIndex, degreeSkills: Record<string, DegreeSkill[]>): string[] {
  const core = new Set<string>();
  for (const rows of Object.values(degreeSkills)) for (const r of rows) if (r.moduleKind === "core") core.add(normSkill(r.skill));
  return index.skills.filter((s) => core.has(normSkill(s)));
}
