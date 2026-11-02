// The /careers data types (plan §2.1, §2.6, §3; build-spec.md). Plain TypeScript with no server-only import,
// so server pages, client components, lib/data/careers-db.ts and the check scripts share one shape.
// Field names are camelCase; lib/data/careers-db.ts maps the Supabase snake_case columns onto them.
// Every figure on the page is a FactRow (a career_facts row with its verbatim quote); every join or count
// of our own carries a basis sentence that starts "Kaplan 360++'s rule / reading / mapping / match / count".

import type { PlanLevel } from "@/lib/plan-storage";

// ── Regions (Q5, Q17, C3) ────────────────────────────────────────────────────────────────────────────────

/** Singapore is the default. A region view uses only that region's own rows, never Singapore's in its place. */
export type Region = "singapore" | "asia-pacific" | "global";
export const REGIONS: readonly Region[] = ["singapore", "asia-pacific", "global"];

// ── Industries (Q23) ─────────────────────────────────────────────────────────────────────────────────────

/** The static entry in lib/careers/industries.ts: what the menu and generateStaticParams need, no DB read. */
export type IndustryMeta = {
  /** Slug, e.g. "financial-services". */
  id: string;
  /** Skills Framework sector name, as published. */
  sector: string;
  /** At most 30 characters: menu, dropdown and chips. */
  short: string;
  sortOrder: number;
};

/** A career_industries row. */
export type Industry = IndustryMeta & {
  /** Roles the Skills Framework lists for the sector. */
  sfRoleTotal: number;
  /** Entry and early-career roles (Kaplan 360++'s rule, map.json rolesBySector[].rule). */
  entryRoleCount: number;
  /** The MOM OWT group joined to the sector (one of the 14 real groups, e.g. "Financial and Insurance Services"). */
  momIndustry: string | null;
  /** "Kaplan 360++'s mapping: …", including when the group is shared with other sectors. */
  momBasis: string;
  /** The OWT Table 4 sheet of that group, e.g. "T4.7". */
  momWageSheet: string | null;
  jobstreetIndustries: string[];
  jobstreetBasis: string | null;
};

/** A career_degree_industries row: one Kaplan degree → one industry, with its basis (Q9). */
export type DegreeIndustry = {
  programmeId: string;
  industryId: string;
  /** "Kaplan 360++'s rule: …" where no official source states the link. */
  basis: string;
  sharedSkills: string[];
};

// ── Kaplan degrees (Q3, Q4) ──────────────────────────────────────────────────────────────────────────────

/** Bachelor levels only: exactly 56 degrees (review B10). Diplomas and the advanced diploma are left out. */
export type BachelorLevel = "bachelor-advanced-standing" | "bachelor-direct-honours" | "top-up";
export const BACHELOR_LEVELS: readonly BachelorLevel[] = ["bachelor-advanced-standing", "bachelor-direct-honours", "top-up"];

/** One of the 56 degrees, as the DegreePicker lists it (from data/raw/kaplan-programmes.json, sliced on the server). */
export type KaplanDegree = {
  id: string;
  name: string;
  /** The awarding university, e.g. "Murdoch University". */
  university: string;
  level: BachelorLevel;
  /** A Kaplan discipline id, e.g. "accounting-finance". */
  discipline: string;
  /** The discipline's label, e.g. "Accounting & finance". */
  disciplineLabel: string;
  studentPass: boolean;
  /** False for the 3 degrees without a module list: they are matched by field only (Q22). */
  hasModuleData: boolean;
  /** The Kaplan programme page (topups.json `url`, else kaplan-programmes.json `sourceUrl`): elective actions link here. */
  url: string | null;
};

// ── Roles (Q10, Q19, Q24) ────────────────────────────────────────────────────────────────────────────────

export type RoleTier = "entry" | "early-career";

/** A career_roles row. */
export type Role = {
  /** Slug; "-<industry>" is appended only when a title repeats across sectors. */
  id: string;
  industryId: string;
  /** Skills Framework title, as published. */
  title: string;
  /** At most 30 characters. */
  short: string;
  track: string;
  tier: RoleTier;
  meanProficiency: number;
  /** "(Corporate Banking)", "(Insurance)", … folded into this role. */
  variants: string[];
  /** The MOM occupation joined to the role. */
  ssocCode: string | null;
  /** "Kaplan 360++'s match: …" unless the title is the same; null when there is no join. */
  ssocBasis: string | null;
  /** Per-industry JV 2025 rank or the COMPASS Shortage Occupation List (review A, B: never the all-industry top 10). */
  momNeeds: boolean;
  /** Median in the top 25% of the industry's OWT 2025 sheet (Kaplan 360++'s rule). */
  highPay: boolean;
  /** momNeeds || highPay. */
  hot: boolean;
  /** "Kaplan 360++'s rule: …" when highPay, else null. */
  highPayRule: string | null;
  /** For the openings check (scripts/careers/check-openings.ts --roles). */
  searchTerm: string | null;
  searchScope: string | null;
  sortOrder: number;
  /** Old /careers/<slug> ids that 308 here (next.config.ts). */
  redirectFrom: string[];
};

/** A career_role_skills row. `key` marks the m skills of "n of m". */
export type RoleSkill = {
  skill: string;
  /** Skills Framework proficiency level, 1–6. */
  level: number;
  key: boolean;
  sortOrder: number;
};

/** How a fact backs a role (career_role_facts.use). */
export type RoleFactUse = "mom-needs-jv" | "mom-needs-sol" | "wage" | "ad-salary" | "entry-vacancy" | "trend";

/** A career_role_facts row. */
export type RoleFactLink = {
  factId: string;
  use: RoleFactUse;
  /** "Kaplan 360++'s match: …" for wage and ad-salary joins; null when the title is the same. */
  basis: string | null;
};

/** Openings on employers' own careers sites, only where checked (Q26). */
export type RoleOpenings = {
  /** Sum of openings over the checked employers. */
  total: number;
  /** Employers checked for the role. */
  employers: number;
  /** ISO date of the latest check (career_role_employers.checked_on). */
  checkedOn: string;
};

/** A career_role_employers row. */
export type RoleEmployer = {
  roleId: string;
  employerId: string;
  company: string;
  /** Keys of COMPANY_LISTS in lib/data/careers.ts. */
  companyLists: string[];
  careersUrl: string | null;
  searchUrl: string | null;
  openings: number;
  status: "ok" | "no-listing" | "failed";
  checkedOn: string;
};

/** What a hot-role card needs: the role, its key skills, the facts behind its badges, and openings. */
export type RoleCardData = Role & {
  keySkills: RoleSkill[];
  /** career_facts ids behind the MOM needs badge (JV rank rows and/or the SOL row). */
  momNeedsFactIds: string[];
  /** True when the badge rests on the SOL: the badge reads "MOM needs: EP list". */
  momNeedsSol: boolean;
  /** The OWT row behind the High pay badge and the sort by pay. */
  wageFactId: string | null;
  wageMedian: number | null;
  openings: RoleOpenings | null;
};

/** What matchRole reads of a role: its industry, its track (the internship step) and its key skills. */
export type MatchRoleInput = Pick<RoleCardData, "industryId" | "track" | "keySkills">;

/** A role as the entry page's best match reads it (Q2): no badges, facts or openings. */
export type RoleKey = Pick<RoleCardData, "id" | "industryId" | "short" | "track" | "hot" | "sortOrder" | "keySkills">;

/**
 * Every role's key skills, as the entry page receives them (lib/data/careers-db getRoleKeys): each skill title
 * once in `skills`, and per role its key skills as [index into skills, level] pairs in sort order.
 * lib/careers/match rolesFromIndex turns it back into RoleKey[]. About a third of the size of RoleKey[].
 */
export type RoleKeyIndex = {
  skills: string[];
  roles: { id: string; industryId: string; short: string; track: string; hot: boolean; sortOrder: number; keys: [number, number][] }[];
};

/** The role page: every skill, every linked fact (resolved), and the employers checked. */
export type RoleFull = RoleCardData & {
  industry: Industry;
  skills: RoleSkill[];
  facts: (RoleFactLink & { fact: FactRow })[];
  employers: RoleEmployer[];
};

// ── Facts (career_facts) ─────────────────────────────────────────────────────────────────────────────────

export type FactKind = "stat" | "wage" | "ad-salary" | "vacancy-rank" | "sol" | "entry-vacancy";

/**
 * How the quote was taken from its page. Normalised by build-careers-data.mjs (review B11):
 * "text" → "sentence", "api-row" → "table-row", "callout" → "sentence", "chart-or-table-labels" → "chart-label".
 */
export type QuoteKind = "sentence" | "table-row" | "table-text" | "table-image" | "xlsx-row" | "chart-label" | "infographic-label";

/** How the quote was checked: text compared, a table row rebuilt cell by cell, or read from the page image (C4). */
export type VerifiedBy = "text-match" | "row-rebuilt" | "page-image";

/** Who published it: decides the receipt's kind ("official" | "report" | "platform"). */
export type FactSourceKind = "official" | "report" | "platform";

/** The parsed numbers, by kind: wage {p25, median, p75}; ad-salary {low, high}; vacancy-rank {rank, rank2024, vacancies}. */
export type FactFigures = {
  p25?: number | null;
  median?: number | null;
  p75?: number | null;
  low?: number | null;
  high?: number | null;
  rank?: number | null;
  rank2024?: number | null;
  vacancies?: number | null;
};

/** A career_facts row: one receipted figure, with its verbatim quote. */
export type FactRow = {
  /** The collector's id, e.g. "mom-owt25-t4-7-24121", "consult-acn-001", "lab-jsad-191". */
  id: string;
  kind: FactKind;
  /** Null = cross-industry. */
  industryId: string | null;
  /** The publisher's own industry label. */
  sourceIndustry: string | null;
  metric: string;
  /** As printed, e.g. "3,260" or "S$8,060". */
  value: string;
  valueNum: number | null;
  figures: FactFigures | null;
  unit: string | null;
  period: string | null;
  region: Region;
  /** As printed: "Southeast Asia", "Global", "Singapore". */
  regionLabel: string | null;
  quote: string;
  quoteKind: QuoteKind;
  /** The table's column heads, " | " separated, for table and xlsx rows. */
  quoteColumns: string | null;
  /** Words in the quote to highlight (the value). Each is found in `quote` (scripts/check-careers.ts). */
  mark: string[];
  sourceKind: FactSourceKind;
  publisher: string;
  title: string;
  /** As printed. */
  published: string | null;
  /** ISO date, when one can be read from `published`. */
  publishedOn: string | null;
  url: string;
  /** The data.gov.sg row (Singapore Open Data Licence), where one exists. */
  altUrl: string | null;
  licence: string | null;
  page: number | null;
  /** "Table 3, p. 26" | "Sheet T4.6, row 41". */
  whereRef: string | null;
  sample: string | null;
  note: string | null;
  /** ISO date. */
  readOn: string;
  verifiedBy: VerifiedBy;
};

// ── "<Industry> now" (Q12, Q17, C3, C4) ──────────────────────────────────────────────────────────────────

/** A career_industry_now row. Only sentence, table-row and xlsx-row facts fill a slot (C4). */
export type IndustryNowSlot = {
  industryId: string;
  region: Region;
  slot: 1 | 2 | 3 | 4;
  factId: string;
  /** At most 30 characters, one line, sentence case. */
  label: string;
};

/** A slot with its fact resolved: what Stat renders. Missing slots are left out, never filled in. */
export type IndustryNowStat = IndustryNowSlot & { fact: FactRow };

/** The industry page's data. `now` holds 0–4 stats per region; a region with 0 is disabled in RegionToggle. */
export type IndustryFull = Industry & {
  degreeLinks: DegreeIndustry[];
  now: Record<Region, IndustryNowStat[]>;
};

// ── Degree skills (Q22) ──────────────────────────────────────────────────────────────────────────────────

/** A career_degree_skills row. basis "rule" = map.json; "claude" = map-api.json (Kaplan 360++'s reading). */
export type DegreeSkill = {
  programmeId: string;
  skill: string;
  module: string;
  moduleKind: "core" | "elective";
  basis: "rule" | "claude";
  /** "claude-opus-5-5" for basis "claude", else null. */
  model: string | null;
};

/** Every degree's DegreeSkill links, each title once: rows[programmeId] = [skill index, module index, flags, …]. */
export type PackedDegreeSkills = {
  skills: string[];
  modules: string[];
  /** The model behind the "claude" links. */
  model: string | null;
  rows: Record<string, number[]>;
};

// ── Master's options (plan §F) ───────────────────────────────────────────────────────────────────────────

/**
 * A master's that adds at least one of a role's key skills (lib/data/careers-db.ts getRoleMasterOptions, from
 * data/raw/master-skills.json). Every skill list holds the role's key skills only. `core` already includes the
 * page's outcome skills and the "unknown" modules counted as core; `elective` lists only skills the core lacks.
 */
export type MasterOption = {
  id: string;
  name: string;
  university: string;
  country: string | null;
  qsRank: number | null;
  /** The programme's official page. */
  url: string;
  core: string[];
  elective: { skill: string; modules: string[] }[];
  /** The page's own words on how many electives a student takes, or null. */
  electiveRule: string | null;
};

// ── The student's chips (Q21, C5) ────────────────────────────────────────────────────────────────────────

export type ChipKind = "certificate" | "skill";

/** A selectable chip in lib/careers/chips.ts. Stored by id in PlanAnswers.certificates / PlanAnswers.skillChips. */
export type Chip = {
  id: string;
  /** msg() string, at most 30 characters. */
  label: string;
  kind: ChipKind;
  /** Skills Framework skill titles the chip covers. */
  skills: string[];
  /** Receipt registry ids (lib/home/receipts.ts) behind the certificate itself. */
  receipts: string[];
  /** Certificates only: the body's key in data/raw/certificates.json ("acca", "cfa", "cpa-australia", "isca"), else null. */
  body: string | null;
  /** "Kaplan 360++'s mapping: …": why the chip covers those skills. */
  basis: string;
};

// ── Match (Q11, Q20, C2, C5) ─────────────────────────────────────────────────────────────────────────────

export type MatchBand = "high" | "medium" | "low";

/** fit: the degree links to the industry. adjacent: another degree of the same Kaplan discipline does (C2). */
export type FieldFit = "fit" | "adjacent" | "none";

/** What covers one key skill. Work and internship counts never appear here (C5). */
export type CoverSource =
  | { kind: "module"; module: string; moduleKind: "core" | "elective"; basis: "rule" | "claude" }
  | { kind: "certificate"; chipId: string }
  | { kind: "skill-chip"; chipId: string }
  /** A Skills Framework skill ticked on one of the student's internship or work entries (/profile, Q14). */
  | { kind: "experience" };

export type Cover = { skill: string; level: number; via: CoverSource[] };

/** The four kinds of Q27. "course" (SkillsFuture) stays off: MySkillsFuture's robots.txt and terms refuse it (plan §2.8). */
export type GapActionKind = "elective" | "certificate" | "internship" | "course";

export type GapAction =
  | {
      kind: "elective";
      /** An elective of the student's own degree they have not counted yet. */
      module: string;
      programmeId: string;
      /** The key skills it covers. */
      skills: string[];
      /** The Kaplan programme page. */
      url: string | null;
      basis: "rule" | "claude";
    }
  | {
      kind: "certificate";
      chipId: string;
      skills: string[];
      /** Receipt registry ids. */
      receipts: string[];
      /** Exemptions this degree gets toward it (data/raw/certificates.json), e.g. ["BT", "MA", "FA"]. */
      exemptions: string[];
    }
  | {
      kind: "internship";
      /** The Skills Framework track (a title only, never a description: SF terms). */
      track: string;
      skills: string[];
      /** Student's Pass holders also see the mom-pass-expires receipt. */
      studentPass: boolean;
      /** A citizen or permanent resident: no work pass needed (said in place of the pass line). */
      local?: boolean;
      receipts: string[];
      /** Internships the student already counts (answers.internshipsSame + internshipsOther). */
      internships: number;
    }
  | { kind: "course"; skills: string[] };

/** A key skill the student does not cover, with the actions that would cover it. */
export type Gap = { skill: string; level: number; actions: GapAction[] };

export type MatchResult = {
  band: MatchBand;
  /** Key skills covered. */
  n: number;
  /** The role's key skills. Always shown as "{n} of {m} key skills", never as a probability. */
  m: number;
  fit: FieldFit;
  covered: Cover[];
  missing: Gap[];
  /** Every action, deduplicated, grouped by kind ("course" is always empty today). */
  actions: Record<GapActionKind, GapAction[]>;
  /** n′: key skills covered once every listed elective and certificate action is done (Kaplan 360++'s count). */
  nAfter: number;
  /** True for the 3 degrees without a module list: n counts chips only (Q22). */
  fieldOnly: boolean;
};

/** The student as matchRole sees them: built from PlanAnswers plus the degree's own data, on the client. */
export type MatchStudent = {
  /** plannedDegree(answers): the degree, or a diploma student's next degree. Null = no degree picked. */
  programmeId: string | null;
  level: PlanLevel | null;
  discipline: string | null;
  hasModuleData: boolean;
  /** This degree's module → skill links (rule and claude). */
  degreeSkills: DegreeSkill[];
  /** Chip ids from PlanAnswers.certificates and PlanAnswers.skillChips (unknown ids already dropped). */
  certificates: string[];
  skillChips: string[];
  /** /profile (Q14, Q16): elective modules of this degree already taken, and the Skills Framework skills ticked on
   * internship and work entries. Both count as covered. Optional: students built without /profile have none. */
  electives?: string[];
  experienceSkills?: string[];
  /** Counts from the answers. They trigger the internship action only (C5). */
  internships: number;
  workYears: number | null;
  studentPass: boolean;
  /** A citizen or permanent resident (lib/ep.ts needsWorkPass). */
  local?: boolean;
  /** This degree's exemptions per body (data/raw/certificates.json), e.g. { acca: ["BT", "MA", "FA"] }. */
  exemptions: Record<string, string[]>;
};

/**
 * What every client part of /careers needs to build a MatchStudent, sliced on the server
 * (lib/data/careers-db.ts getStudentContext) so topups.json and certificates.json never reach the client whole.
 */
export type StudentContext = {
  /** The 56 bachelor degrees. */
  degrees: KaplanDegree[];
  /** Every degree → industry link. */
  links: DegreeIndustry[];
  /** programmeId → its module → skill links (rule and claude), packed (lib/careers/pack.ts degreeSkillsOf reads one degree). */
  degreeSkills: PackedDegreeSkills;
  /** programmeId → body → exempted exam codes. */
  exemptions: Record<string, Record<string, string[]>>;
  /**
   * The key skills (over every role, as the roles spell them) that at least one Kaplan degree's CORE modules cover,
   * by the same module → skill links matchRole uses. A key skill outside it: no Kaplan degree covers it.
   */
  coverableSkills: string[];
};
