import "server-only";
import { cacheLife } from "next/cache";
import admitCases from "@/data/raw/admit-cases.json";
import admitModel from "@/data/raw/admit-model.json";
import evidence from "@/data/raw/admission-evidence.json";
import englishRequirements from "@/data/raw/english-requirements.json";
import classProfiles from "@/data/raw/class-profiles.json";
import fx from "@/data/raw/fx-mas.json";
import { programmeZh, universityZh } from "@/lib/data/chinese-names";
import { fixedName } from "@/lib/data/fixes";
import type { FittedGpaGlobal, MatchGlobal, MatchParams } from "@/lib/admit-model";
import { NATIONAL_RISKS } from "@/lib/finder/nationality-risk";
import { admitRange, type AdmitEvidence, type Level } from "@/lib/admit-range";
import { goodReadings, requirementLevel, requirementWords, type GoodReading } from "@/lib/grades";
import { academicStructured, workYears } from "@/lib/pipeline/requirements";
import { selectAll, supabase } from "@/lib/supabase";
import type {
  CompassListing,
  EnglishRule,
  ProfessionalBadge,
  ResultsCases,
  ResultsData,
  ResultsProfile,
  ResultsProgramme,
  StandingSources,
  SubjectStanding,
} from "@/lib/results-types";

// Subject strength and industry recognition per university and discipline, university-wide employer reputation, MOM's
// COMPASS top-tier listing and Singapore professional recognition per programme, from the tables loaded by
// scripts/data/load-finder-standing.mjs (20261102120000_finder_standing.sql).
type StandingRow = {
  institution_id: string;
  discipline_id: string;
  qs_rank: string | null;
  qs_rank_value: number | null;
  qs_subject: string | null;
  gras_rank: string | null;
  gras_rank_value: number | null;
  employer_score: number | null;
  employer_rank: string | null;
  employer_subject: string | null;
};
type BadgeRow = ProfessionalBadge & { programme_id: string };
type SourcesRow = {
  subjects: { qs: { title: string; url: string }; gras: { title: string; url: string } };
  employer: { title: string; url: string; retrievedAt: string };
  compass: { title: string; url: string; effective: string };
  badges: StandingSources["badges"];
};

function standingOf(r: StandingRow): SubjectStanding {
  const s: SubjectStanding = {};
  if (r.qs_rank && r.qs_rank_value !== null) s.qs = { rank: r.qs_rank, v: r.qs_rank_value, subject: r.qs_subject ?? "" };
  if (r.gras_rank && r.gras_rank_value !== null) s.gras = { rank: r.gras_rank, v: r.gras_rank_value };
  if (r.employer_score !== null) s.employer = { score: Number(r.employer_score), rank: r.employer_rank, subject: r.employer_subject ?? "" };
  return s;
}

/** Admitted students per programme from the agency case library (scripts/pipeline/compass-build.ts). */
const CASES = admitCases.programmes as unknown as Record<string, ResultsCases>;

type EnglishRead = {
  required: "all" | "unless-exempt" | "none";
  exemption: { countries: string[]; quote: string; url: string } | null;
  ielts: { overall: number } | null;
  toefl: { ibt: number } | null;
  pte: { overall: number } | null;
  duolingo: { score: number } | null;
};
const ENGLISH = englishRequirements as unknown as { programmes: Record<string, EnglishRead>; universities?: Record<string, EnglishRead> };
/** The English rule from the programme's own pages, or its university's general page when they state none (scripts/pipeline/english-programme.ts). */
function englishOf(id: string, institution: string): { rule: EnglishRule | null; read: EnglishRead | null } {
  const own = ENGLISH.programmes[id];
  const general = ENGLISH.universities?.[institution];
  const read = own && own.required !== "none" ? own : general && general.required !== "none" ? general : null;
  if (!read || read.required === "none") return { rule: null, read: null };
  return { rule: { required: read.required, exemption: read.exemption, general: read !== own }, read };
}

type Quoted<T> = { value: T; quote: string } | null;
type Shares = Quoted<{ name: string; pct: number | null }[]>;
type Spread = { average: number | null; median: number | null; low: number | null; high: number | null; quote: string } | null;
/** As scripts/pipeline/profile-ai.ts writes it. */
type StoredProfile = {
  programmeIds: string[];
  intake: Quoted<string>;
  classSize: Quoted<number>;
  internationalPct: Quoted<number>;
  womenPct: Quoted<number>;
  nationalities: Quoted<number>;
  regions: Shares;
  undergradRegions: Shares;
  undergradInstitutionsCount: Quoted<number>;
  undergradInstitutions: Shares;
  majors: Shares;
  gpa: (NonNullable<Spread> & { scale: number | null; label: string | null }) | null;
  gmat: Spread;
  gre: Spread;
  workYears: Quoted<number>;
  withWorkPct: Quoted<number>;
  age: Spread;
  url: string;
  checked: string;
};
const shares = (f: Shares | undefined) => f?.value ?? [];
const spread = (f: Spread | undefined) => (f ? { average: f.average, median: f.median, low: f.low, high: f.high } : null);

/** Each programme's official class profile (scripts/pipeline/profile-ai.ts): the one stating the most figures. */
const PROFILES: Map<string, ResultsProfile> = (() => {
  const filled = (p: StoredProfile) => Object.values(p).filter((v) => v !== null && typeof v === "object").length;
  const best = new Map<string, StoredProfile>();
  for (const p of classProfiles.profiles as unknown as StoredProfile[])
    for (const id of p.programmeIds) if (!best.has(id) || filled(p) > filled(best.get(id)!)) best.set(id, p);
  return new Map(
    [...best].map(([id, p]) => [
      id,
      {
        intake: p.intake?.value ?? null,
        classSize: p.classSize?.value ?? null,
        internationalPct: p.internationalPct?.value ?? null,
        womenPct: p.womenPct?.value ?? null,
        nationalities: p.nationalities?.value ?? null,
        age: spread(p.age),
        workYears: p.workYears?.value ?? null,
        withWorkPct: p.withWorkPct?.value ?? null,
        gpa: p.gpa ? { ...spread(p.gpa)!, scale: p.gpa.scale ?? null, label: p.gpa.label ?? null } : null,
        gmat: spread(p.gmat),
        gre: spread(p.gre),
        undergradInstitutionsCount: p.undergradInstitutionsCount?.value ?? null,
        undergradInstitutions: shares(p.undergradInstitutions),
        undergradRegions: shares(p.undergradRegions),
        regions: shares(p.regions),
        majors: shares(p.majors),
        url: p.url,
        checked: p.checked,
      },
    ]),
  );
})();

// The data behind /results, built once per deploy (and hourly) from Supabase and sent to the browser
// as one static file: the student's answers are matched against it in the browser and never leave it.
// Fees are converted to S$ with MAS end-of-month rates, as an approximation shown as such.

type Row = {
  id: string;
  institution_id: string;
  name: string;
  discipline_id: string | null;
  accepts_any_background: boolean | null;
  duration_months: number | null;
  intakes: string[] | null;
  tuition_amount: number | null;
  tuition_currency: string | null;
  tuition_basis: string | null;
  tuition_international: boolean;
  ielts_overall: number | null;
  toefl_total: number | null;
  pte_overall: number | null;
  duolingo: number | null;
  gre_status: string | null;
  gre_min: number | null;
  gmat_status: string | null;
  gmat_min: number | null;
  academic_requirement: string | null;
  study_mode: string | null;
  teaching_language: string | null;
  delivered_by: string | null;
  extraction_notes: string[] | null;
  source_url: string;
  last_verified: string;
};
type Institution = {
  id: string;
  name: string;
  country: string | null;
  qs_rank: string | null;
  qs_rank_value: number | null;
  kaplan_partner: boolean;
  qs_employer_score: number | null;
  qs_employer_rank: string | null;
  compass_group: "A" | "B" | null;
  compass_faculties: Extract<CompassListing, { group: "B" }>["faculties"] | null;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Months named in the page's intake text ("September, January", "Start date: September 2027"), as a 12-bit mask. */
function intakeMask(texts: string[] | null): number {
  let mask = 0;
  for (const t of texts ?? []) {
    for (const m of t.toLowerCase().matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g)) mask |= 1 << MONTHS.indexOf(m[1]);
  }
  return mask;
}

/**
 * Tuition a year in S$, and how it was read: a fee stated per year; a whole-course fee divided by the
 * years; or a fee with no basis on a course of a year or less (taken as that year's fee). Anything
 * else can't be compared with a budget and stays null.
 */
function feePerYear(r: Row): { sgd: number | null; basis: ResultsProgramme["feeBasis"] } {
  if (!r.tuition_international || !r.tuition_amount || !r.tuition_currency) return { sgd: null, basis: null };
  const rate = sgdRate(r.tuition_currency);
  if (!rate) return { sgd: null, basis: null };
  const basis = (r.tuition_basis ?? "").toLowerCase();
  const years = r.duration_months ? Math.max(1, r.duration_months / 12) : null;
  if (/year|annum|annual/.test(basis)) return { sgd: Math.round(r.tuition_amount * rate), basis: "year" };
  if (/full|total|course|programme|program/.test(basis) && years) return { sgd: Math.round((r.tuition_amount * rate) / years), basis: "course" };
  if (!basis && r.duration_months && r.duration_months <= 12) return { sgd: Math.round(r.tuition_amount * rate), basis: "one-year" };
  return { sgd: null, basis: null };
}

/** Who each programme admits beyond its minimum, from its own pages (scripts/pipeline/admit-evidence.ts). */
const EVIDENCE = (evidence as unknown as { programmes: Record<string, AdmitEvidence> }).programmes;

// The admission model (scripts/admit-model/run.py): each programme's curve, ceiling and test weights, and the global
// tier shifts and private-institution offset, as the match rate needs them (lib/admit-model.ts).
type ModelProgramme = {
  k: number; theta: number; s: number; c: number; bgFactor: number; cluster: "elite" | "taught"; floor: number | null; floorBandFactor: number | null;
  experienceClass: MatchParams["exp"]; policyRisks?: { id: string }[]; greWeight?: number; gmatWeight?: number; ieltsBase?: number | null; p25?: number; iqr?: number; basis?: string; thetaSe?: number;
};
const MODEL = admitModel as unknown as {
  global: { tierShift: MatchGlobal["tierShift"]; privateDelta: { mu: number; sd: number }; cShareCurve: FittedGpaGlobal["cShare"]; fittedGpa: Omit<FittedGpaGlobal, "cShare"> };
  programmes: Record<string, ModelProgramme>;
};
export const MATCH: MatchGlobal = { tierShift: MODEL.global.tierShift, delta: MODEL.global.privateDelta.mu, deltaSd: Math.round(MODEL.global.privateDelta.sd * 1000) / 1000 };
const FITTED_GPA: FittedGpaGlobal = { cShare: { a: MODEL.global.cShareCurve.a, b: MODEL.global.cShareCurve.b, center: MODEL.global.cShareCurve.center }, ...MODEL.global.fittedGpa };
const r3 = (x: number) => Math.round(x * 1000) / 1000;
export function fitOf(id: string): MatchParams | null {
  const m = MODEL.programmes[id];
  if (!m) return null;
  return {
    k: r3(m.k), theta: r3(m.theta), s: r3(m.s), c: r3(m.c), bg: r3(m.bgFactor), elite: m.cluster === "elite",
    floor: m.floor, fbf: m.floorBandFactor, exp: m.experienceClass, greW: m.greWeight ?? 0, gmatW: m.gmatWeight ?? 0, ieltsBase: m.ieltsBase ?? null,
    ...(m.p25 !== undefined && m.iqr !== undefined ? { p25: r3(m.p25), iqr: r3(m.iqr) } : {}),
    ...(m.basis !== "predicted" && m.thetaSe !== undefined ? { thetaSe: r3(m.thetaSe) } : {}),
  };
}
/** The programme's rules that depend on the student's nationality (lib/finder/nationality-risk.ts), when it has any. */
function nationalRisks(id: string): Pick<ResultsProgramme, "risks"> {
  const risks = (MODEL.programmes[id]?.policyRisks ?? []).map((r) => r.id).filter((r) => NATIONAL_RISKS.includes(r));
  return risks.length ? { risks } : {};
}
/** A requirement that asks for a degree but names no class or grade: any class will do. */
const ASKS_A_DEGREE = /\b(bachelor|undergraduate|degree|honou?rs)\b/i;

/**
 * The academic requirement as a UK class (lib/grades.ts), with the wording it was read from ("GPA 3.0/4",
 * "good degree"), and as steps on the UK scale: the lowest route in (`floor`) and the main requirement.
 */
function req(r: Row, country: string | null, good: GoodReading | undefined): Pick<ResultsProgramme, "minClass" | "minBasis"> & { floor: Level | null; main: Level | null } {
  const text = r.academic_requirement;
  if (!text) return { minClass: null, minBasis: null, floor: null, main: null };
  const c = requirementLevel(academicStructured(text), text, country, good);
  if (!c) return { minClass: null, minBasis: null, floor: ASKS_A_DEGREE.test(requirementWords(text)) ? 40 : null, main: null };
  return { minClass: c.rank, minBasis: c.basis, floor: c.floor, main: c.main };
}

/** Where it is taught away from the home campus, from the build's note "Taught at: Kaplan Singapore | Singapore" (scripts/pipeline/build.ts). */
function campusOf(notes: string[] | null): ResultsProgramme["campus"] {
  const m = (notes ?? []).map((n) => /^Taught at: (.+?) \| (.+)$/.exec(n)).find(Boolean);
  return m ? { name: m[1], country: m[2] } : null;
}

/** S$ per unit. MAS publishes no pataca rate: the pataca is pegged to the Hong Kong dollar at MOP 1.03 = HK$1 (Monetary Authority of Macao), so it is derived from the HKD rate. */
function sgdRate(currency: string | null): number | null {
  if (!currency) return null;
  const rates = fx.rates as Record<string, number>;
  if (currency === "MOP") return rates.HKD ? rates.HKD / 1.03 : null;
  return rates[currency] ?? null;
}

export async function getResultsData(): Promise<ResultsData> {
  "use cache";
  cacheLife("hours");
  const [rows, institutions] = await Promise.all([
    selectAll<Row>(
      "programmes",
      "id,institution_id,name,discipline_id,accepts_any_background,duration_months,intakes,tuition_amount,tuition_currency,tuition_basis,tuition_international,ielts_overall,toefl_total,pte_overall,duolingo,gre_status,gre_min,gmat_status,gmat_min,academic_requirement,study_mode,teaching_language,delivered_by,extraction_notes,source_url,last_verified",
    ),
    selectAll<Institution>("institutions", "id,name,country,qs_rank,qs_rank_value,kaplan_partner,qs_employer_score,qs_employer_rank,compass_group,compass_faculties", { column: "tier", values: [1] }),
  ]);
  const [standingRows, badgeRows, sourcesRow] = await Promise.all([
    selectAll<StandingRow>("institution_subject_standing", "*", undefined, ["institution_id", "discipline_id"]),
    selectAll<BadgeRow>("programme_badges", "programme_id,kind,body,note,url", undefined, ["programme_id", "kind", "body"]),
    supabase().from("finder_standing_sources").select("sources").eq("id", "current").maybeSingle(),
  ]);
  if (sourcesRow.error) throw new Error(`finder_standing_sources: ${sourcesRow.error.message}`);
  const subjects = new Map<string, Record<string, SubjectStanding>>();
  for (const r of standingRows) subjects.set(r.institution_id, { ...subjects.get(r.institution_id), [r.discipline_id]: standingOf(r) });
  const badges = new Map<string, ProfessionalBadge[]>();
  for (const { programme_id, ...b } of badgeRows) badges.set(programme_id, [...(badges.get(programme_id) ?? []), b]);
  const src = sourcesRow.data?.sources as SourcesRow | undefined;
  const standing: StandingSources = {
    qs: src?.subjects.qs ?? { title: "QS World University Rankings by Subject 2026", url: "https://www.topuniversities.com/subject-rankings" },
    gras: src?.subjects.gras ?? { title: "ShanghaiRanking GRAS 2025", url: "https://www.shanghairanking.com/rankings/gras/2025" },
    employer: src ? { title: src.employer.title, url: src.employer.url, retrievedAt: src.employer.retrievedAt } : { title: "QS World University Rankings 2027", url: "", retrievedAt: "" },
    compass: src?.compass ? { title: src.compass.title, url: src.compass.url, effective: src.compass.effective } : null,
    badges: src?.badges ?? null,
  };
  const used = new Set(rows.map((r) => r.institution_id));
  const unis = institutions.filter((i) => used.has(i.id));
  const index = new Map(unis.map((u, i) => [u.id, i]));
  const disciplines = new Map<string, Set<string>>();
  for (const r of rows) if (r.discipline_id) disciplines.set(r.institution_id, (disciplines.get(r.institution_id) ?? new Set()).add(r.discipline_id));
  // "A good degree" as each university reads it, from all of its requirements.
  const good = goodReadings(
    rows.filter((r) => r.academic_requirement && index.has(r.institution_id)).map((r) => ({ institution: r.institution_id, text: r.academic_requirement!, country: unis[index.get(r.institution_id)!].country })),
  );

  const programmes: ResultsProgramme[] = rows
    .filter((r) => index.has(r.institution_id) && r.discipline_id)
    .map((r) => {
      const fee = feePerYear(r);
      const uni = unis[index.get(r.institution_id)!];
      const { floor, main, ...min } = req(r, uni.country, good.get(r.institution_id));
      const english = englishOf(r.id, r.institution_id);
      return {
        id: r.id,
        u: index.get(r.institution_id)!,
        name: fixedName(r.id, r.name),
        zh: programmeZh(r.id),
        discipline: r.discipline_id!,
        any: !!r.accepts_any_background,
        months: r.duration_months,
        intake: intakeMask(r.intakes),
        intakeText: r.intakes?.find((t) => t && !/^(null|undefined|n\/a)$/i.test(t.trim())) ?? null,
        fee: r.tuition_international && r.tuition_amount ? { amount: r.tuition_amount, currency: r.tuition_currency, basis: r.tuition_basis } : null,
        feeSgd: fee.sgd,
        feeBasis: fee.basis,
        // Minimums missing from the record come from the English pages read later (the programme's, else its university's).
        ielts: r.ielts_overall ?? english.read?.ielts?.overall ?? null,
        englishUniversityWide: (r.extraction_notes ?? []).some((n) => /university-wide minimum/i.test(n)) || (r.ielts_overall === null && !!english.rule?.general),
        toefl: r.toefl_total ?? english.read?.toefl?.ibt ?? null,
        pte: r.pte_overall ?? english.read?.pte?.overall ?? null,
        duolingo: r.duolingo ?? english.read?.duolingo?.score ?? null,
        gre: r.gre_status ? { status: r.gre_status as "required", min: r.gre_min } : null,
        gmat: r.gmat_status ? { status: r.gmat_status as "required", min: r.gmat_min } : null,
        englishRule: english.rule,
        ...min,
        range: admitRange({ floor, main, evidence: EVIDENCE[r.id], qs: uni.qs_rank_value, cases: CASES[r.id]?.gpa ? { n: CASES[r.id].gpa!.n, p25: CASES[r.id].gpa!.p25 } : null }),
        work: workYears(r.academic_requirement),
        academic: r.academic_requirement ? r.academic_requirement.slice(0, 280) : null,
        mode: (r.study_mode as ResultsProgramme["mode"]) ?? null,
        // One extraction stored the text "null".
        language: r.teaching_language && r.teaching_language !== "null" ? r.teaching_language : null,
        kaplan: r.delivered_by === "kaplan",
        campus: campusOf(r.extraction_notes),
        profile: PROFILES.get(r.id) ?? null,
        cases: CASES[r.id] ?? null,
        fit: fitOf(r.id),
        ...nationalRisks(r.id),
        badges: badges.get(r.id) ?? null,
        url: r.source_url,
        checked: r.last_verified,
      };
    });

  return {
    builtAt: new Date().toISOString().slice(0, 10),
    fx: { period: fx.period, source: fx.source, publisher: fx.publisher },
    cases: { sources: admitCases.sources as NonNullable<ResultsData["cases"]>["sources"], checked: admitCases.checked },
    universities: unis.map((u) => ({
      name: u.name,
      zh: universityZh(u.id),
      country: u.country ?? "",
      qs: u.qs_rank,
      qsValue: u.qs_rank_value,
      partner: u.kaplan_partner,
      good: good.get(u.id) ?? null,
      // Only the disciplines it has programmes in, to keep the payload small.
      subjects: Object.fromEntries([...(disciplines.get(u.id) ?? [])].flatMap((d) => (subjects.get(u.id)?.[d] ? [[d, subjects.get(u.id)![d]]] : []))),
      employer: u.qs_employer_score !== null ? { score: Number(u.qs_employer_score), rank: u.qs_employer_rank } : null,
      compass: u.compass_group === "A" ? { group: "A" } : u.compass_group === "B" ? { group: "B", faculties: u.compass_faculties ?? [] } : null,
    })),
    programmes,
    match: MATCH,
    fittedGpa: FITTED_GPA,
    standing,
  };
}

/** "Before applying" steps for one discipline's programmes (Claude-drafted at build time from official quotes). */
export async function getPrepareSteps(discipline: string): Promise<Record<string, string[]>> {
  "use cache";
  cacheLife("hours");
  // Joined to programmes and filtered by its field: a list of ids would make the URL too long.
  const rows = await selectAll<{ programme_id: string; steps: string[] }>(
    "programme_prepare",
    "programme_id,steps,programmes!inner(discipline_id)",
    { column: "programmes.discipline_id", values: [discipline] },
    "programme_id",
  );
  return Object.fromEntries(rows.map((r) => [r.programme_id, r.steps]));
}

/**
 * The homepage's programme count (tile 5): the programmes /results lists (a tier-1 university, a
 * discipline), counted by the database rather than by reading every row, and the newest date one of
 * their pages was checked (YYYY-MM-DD). Throws when the database can't be read; the caller decides.
 */
export async function getProgrammeCount(): Promise<{ n: number; checked: string | null }> {
  "use cache";
  cacheLife("hours");
  const db = supabase();
  const [counted, newest] = await Promise.all([
    db.from("programmes").select("id,institutions!inner(tier)", { count: "exact", head: true }).eq("institutions.tier", 1).not("discipline_id", "is", null),
    db
      .from("programmes")
      .select("last_verified,institutions!inner(tier)")
      .eq("institutions.tier", 1)
      .not("discipline_id", "is", null)
      .not("last_verified", "is", null)
      .order("last_verified", { ascending: false })
      .limit(1),
  ]);
  if (counted.error) throw new Error(`programmes count: ${counted.error.message}`);
  if (newest.error) throw new Error(`programmes last_verified: ${newest.error.message}`);
  const last = (newest.data?.[0] as { last_verified?: string | null } | undefined)?.last_verified;
  return { n: counted.count ?? 0, checked: last ? last.slice(0, 10) : null };
}
