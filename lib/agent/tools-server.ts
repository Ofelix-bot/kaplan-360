import "server-only";
import employment from "@/data/raw/employment.json";
import kaplan from "@/data/raw/kaplan-programmes.json";
import type { MatchBand } from "@/lib/admit-model";
import { LEVEL_NAME, standing } from "@/lib/admit-range";
import { getDegreeIndustries, getDegreeSkills, getFacts, getHotRoleIds, getIndustries, getRole, getRolesForIndustry } from "@/lib/data/careers-db";
import { HEADLINE, KAPLAN } from "@/lib/data/employment";
import { getKaplanAwarders } from "@/lib/data/partners";
import { fitOf, getResultsData, MATCH } from "@/lib/data/results";
import { epFloor, needsWorkPass } from "@/lib/ep";
import { admittedGpa } from "@/lib/finder/admitted-gpa";
import { EMPTY_FINDER, finderOf, inScope } from "@/lib/finder/answers";
import { risksFor } from "@/lib/finder/nationality-risk";
import { rowMatch } from "@/lib/finder/row-state";
import { inputFor, waysToStrong, type Way } from "@/lib/finder/what-if";
import { studentRank } from "@/lib/grades";
import type { Locale } from "@/lib/i18n/config";
import { EMPTY_ANSWERS, plannedDegree, type FinderAnswers, type PlanAnswers } from "@/lib/plan-storage";
import type { ResultsData, ResultsProgramme } from "@/lib/results-types";
import type { EpInput, IndustryInput, ProgrammeInput, RoleInput, SearchInput } from "./tools";
import type { PageContext, ServerTool, SourceRef, TraceEntry } from "./types";

// The adviser's six read tools, run on the server at the start of the step after the model chose them. Each wraps the
// site's own code (the finder's filters and match, the admission model, MOM's EP table, the careers database, the
// graduate surveys) and returns compact JSON for the model with the source ids it can cite, plus the line the page's
// trace shows, written here from the result in the page's language. They read; nothing is written.

export type ToolResult = { content: string; trace: Omit<TraceEntry, "id" | "ms" | "status"> };
export type ToolContext = { answers: PlanAnswers; locale: Locale; context: PageContext };

/** One line in the page's language. */
const say = (locale: Locale, en: string, hans: string, hant: string) => (locale === "en" ? en : locale === "zh-hans" ? hans : hant);

const json = (x: object) => JSON.stringify(x);

// ── the answers, as the browser sent them ────────────────────────────────────────────────────────────────

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max = 400) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const strs = (v: unknown, max = 50, len = 400) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.slice(0, len)).slice(0, max) : []);
const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const int = (v: unknown, lo: number, hi: number) => (Number.isInteger(v) ? num(v, lo, hi) : null);
const oneOf = <T extends string>(v: unknown, values: readonly T[]): T | null => (typeof v === "string" && (values as readonly string[]).includes(v) ? (v as T) : null);

/** The saved answers with only the fields the tools read, each held to the values it allows; the rest empty. */
export function cleanAnswers(v: unknown): PlanAnswers {
  const x = obj(v);
  const f = obj(x.finder);
  const finder: FinderAnswers | null = x.finder
    ? {
        ...EMPTY_FINDER,
        background: str(f.background, 60),
        kind: oneOf(f.kind, ["diploma", "bachelor", "honours"] as const),
        gpa: num(f.gpa, 0, 100),
        scale: oneOf(f.scale, ["4.0", "4.2", "4.3", "5.0", "100", "uk"] as const),
        directions: strs(f.directions, 3, 40),
        fee: oneOf(f.fee, ["lt30", "30-50", "50-80", "gt80"] as const),
        regions: strs(f.regions, 10, 20),
      }
    : null;
  return {
    ...EMPTY_ANSWERS,
    level: oneOf(x.level, ["diploma", "degree"] as const),
    programmeId: str(x.programmeId),
    pathwayDegreeId: str(x.pathwayDegreeId),
    graduated: typeof x.graduated === "boolean" ? x.graduated : null,
    graduationMonth: int(x.graduationMonth, 1, 12),
    graduationYear: int(x.graduationYear, 2000, 2100),
    status: oneOf(x.status, ["student-pass", "citizen-pr", "other-pass"] as const),
    sgStatus: oneOf(x.sgStatus, ["citizen", "pr", "student-pass", "other-pass"] as const),
    nationality: typeof x.nationality === "string" && /^[A-Z]{2}$/.test(x.nationality) ? x.nationality : null,
    birthYear: int(x.birthYear, 1940, 2020),
    classification: oneOf(x.classification, ["first", "2:1", "2:2", "third", "unsure"] as const),
    englishTest: oneOf(x.englishTest, ["ielts", "toefl", "pte", "duolingo", "none"] as const),
    englishScore: num(x.englishScore, 0, 340),
    englishTestMonth: int(x.englishTestMonth, 1, 12),
    englishTestYear: int(x.englishTestYear, 2000, 2100),
    averageMark: num(x.averageMark, 0, 100),
    degreeGpa: num(x.degreeGpa, 0, 5),
    gre: int(x.gre, 260, 340),
    gmat: int(x.gmat, 200, 805),
    greGmat: oneOf(x.greGmat, ["have", "none"] as const),
    workExperience: oneOf(x.workExperience, ["have", "none"] as const),
    workYears: num(x.workYears, 0, 50),
    internshipsSame: int(x.internshipsSame, 0, 20),
    internshipsOther: int(x.internshipsOther, 0, 20),
    countries: strs(x.countries, 30, 60),
    intake: oneOf(x.intake, ["jan-mar", "jul-oct", "any"] as const),
    budget: num(x.budget, 0, 10_000_000),
    shortlist: strs(x.shortlist),
    electives: strs(x.electives, 40, 200),
    skillChips: strs(x.skillChips, 60, 100),
    startYear: int(x.startYear, 2000, 2100),
    finder,
  };
}

/** The answers as the model reads them: only what is set. */
export function answersLine(a: PlanAnswers): string {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a)) {
    if (v === null || (Array.isArray(v) && !v.length) || k === "searches" || k === "goals" || k === "experience" || k === "skillGaps") continue;
    out[k] = v;
  }
  return json(out);
}

// ── shared reads ─────────────────────────────────────────────────────────────────────────────────────────

const KAPLAN_DEGREES = new Map(kaplan.programmes.map((p) => [p.id, p]));

/** The student's degree, the university awarding it and that university's QS rank, as the finder reads them. */
async function awarderOf(a: PlanAnswers, data: ResultsData) {
  const degreeId = plannedDegree(a);
  const university = degreeId ? ((await getKaplanAwarders())[degreeId]?.university ?? null) : null;
  const awarderQs = university ? (data.universities.find((u) => u.name === university)?.qsValue ?? null) : null;
  return { degreeId, university, awarderQs };
}

type Band = MatchBand | "below-minimum" | "no-result" | "not-modelled";

function matchOf(p: ResultsProgramme, data: ResultsData, a: PlanAnswers, who: { university: string | null; awarderQs: number | null }) {
  const input = inputFor(a, who.university, who.awarderQs);
  const fit = p.fit ?? fitOf(p.id);
  const you = studentRank(who.university, a);
  const m = rowMatch({ p: { ...p, fit }, u: data.universities[p.u], c: [], s: you ? standing(p.range, you) : null }, MATCH, input);
  const band: Band = !input ? "no-result" : !m ? "not-modelled" : m.belowMinimum ? "below-minimum" : m.band;
  return { band, rate: m?.rate ?? null, fit, input };
}

const countryOf = (p: ResultsProgramme, data: ResultsData) => p.campus?.country ?? data.universities[p.u].country;
const qsOf = (p: ResultsProgramme, data: ResultsData) => data.universities[p.u].qs?.replace(/^=/, "") ?? null;

// ── search_programmes ────────────────────────────────────────────────────────────────────────────────────

const BAND_ORDER: Record<Band, number> = { strong: 0, range: 1, gap: 2, "not-modelled": 3, "no-result": 3, "below-minimum": 4 };

async function searchProgrammes(x: SearchInput, c: ToolContext): Promise<ToolResult> {
  const data = await getResultsData();
  const a = c.answers;
  const who = await awarderOf(a, data);
  const saved = finderOf(a);
  const f: FinderAnswers = { ...saved, directions: x.directions ?? saved.directions, fee: x.fee ?? saved.fee, regions: x.regions ?? saved.regions };
  const keyword = x.keyword?.toLowerCase();
  const you = studentRank(who.university, a);
  const ielts = a.englishTest === "ielts" ? a.englishScore : null;
  const rows = [];
  let total = 0;
  for (const p of data.programmes) {
    const country = countryOf(p, data);
    const u = data.universities[p.u];
    if (!inScope(p, country, f)) continue;
    if (x.maxMonths && p.months && p.months > x.maxMonths) continue;
    if (x.qsMax && (u.qsValue === null || u.qsValue > x.qsMax)) continue;
    if (keyword && !p.name.toLowerCase().includes(keyword)) continue;
    if (x.kaplanOnly && !p.kaplan) continue;
    // The finder leaves out a programme whose minimum the result is under.
    if (you && standing(p.range, you) === "below") continue;
    total++;
    const m = matchOf(p, data, a, who);
    const flags = [
      ...risksFor(p.risks, a.nationality).map((r) => r.id),
      ...(p.mode === "part-time" && a.status !== "citizen-pr" && a.status !== "other-pass" ? ["part-time-only"] : []),
      ...(p.work !== null && (a.workYears ?? 0) < p.work ? [`needs-${p.work}-years-work`] : []),
      ...(ielts !== null && p.ielts !== null && ielts < p.ielts ? ["ielts-below-minimum"] : []),
      ...(p.gre?.status === "required" || p.gmat?.status === "required" ? ["gre-or-gmat-required"] : []),
    ];
    rows.push({ p, u, country, m, flags });
  }
  rows.sort((r, s) => BAND_ORDER[r.m.band] - BAND_ORDER[s.m.band] || (s.m.rate ?? 0) - (r.m.rate ?? 0) || (r.u.qsValue ?? 9999) - (s.u.qsValue ?? 9999));
  const top = rows.slice(0, 10);
  const sources: SourceRef[] = top.map((r) => ({ kind: "programme", id: r.p.id }));
  const content = json({
    filters: { regions: f.regions, directions: f.directions, fee: f.fee, keyword: x.keyword ?? null, maxMonths: x.maxMonths ?? null, qsMax: x.qsMax ?? null, kaplanOnly: !!x.kaplanOnly },
    matching: total,
    rows: top.map((r) => ({
      id: r.p.id,
      programme: r.p.name,
      university: r.u.name,
      country: r.country,
      qs: qsOf(r.p, data),
      months: r.p.months,
      // The page states the fee per year or per course; the yearly figure is worked out from a course fee.
      feeYearSgd: r.p.feeSgd,
      feeAsStated: r.p.fee ? `${r.p.fee.currency ?? ""} ${r.p.fee.amount} ${r.p.feeBasis === "course" ? "for the whole course" : r.p.feeBasis === "year" ? "a year" : ""}`.trim() : null,
      ielts: r.p.ielts,
      match: r.m.band,
      flags: r.flags,
      kaplan: r.p.kaplan,
    })),
    sources,
  });
  const best = top[0];
  const where = f.regions.length ? f.regions.join(", ") : say(c.locale, "anywhere", "不限地区", "不限地區");
  return {
    content,
    trace: {
      tool: "search_programmes",
      lane: "education",
      summary: best
        ? say(
            c.locale,
            `Searched master's (${where}): ${total} fit, best is ${best.p.name} at ${best.u.name}.`,
            `检索硕士项目（${where}）：${total} 个符合，最匹配的是 ${best.u.name} 的 ${best.p.name}。`,
            `檢索碩士課程（${where}）：${total} 個符合，最匹配的是 ${best.u.name} 的 ${best.p.name}。`,
          )
        : say(c.locale, `Searched master's (${where}): none fit these filters.`, `检索硕士项目（${where}）：没有符合这些条件的。`, `檢索碩士課程（${where}）：沒有符合這些條件的。`),
      sources: sources.length,
    },
  };
}

// ── admit_rate ───────────────────────────────────────────────────────────────────────────────────────────

const lever = (w: Way) => ({
  change: w.key,
  ...(w.result !== undefined ? { result: w.result } : {}),
  ...(w.work !== undefined ? { workYears: w.work } : {}),
  ...(w.internships !== undefined ? { internshipsInField: w.internships } : {}),
  ...(w.ielts !== undefined ? { ielts: w.ielts } : {}),
  ...(w.gre !== undefined ? { gre: w.gre } : {}),
  ...(w.gmat !== undefined ? { gmat: w.gmat } : {}),
});

async function admitRate(x: ProgrammeInput, c: ToolContext): Promise<ToolResult> {
  const data = await getResultsData();
  const p = data.programmes.find((q) => q.id === x.programmeId);
  if (!p) throw new ToolError(`No programme with id ${x.programmeId}: use an id from search_programmes.`);
  const who = await awarderOf(c.answers, data);
  const m = matchOf(p, data, c.answers, who);
  const gpa = admittedGpa(m.fit, p.cases, data.fittedGpa, data.match.tierShift);
  const ways = m.fit && m.input && m.band !== "strong" ? waysToStrong({ fit: m.fit, g: MATCH, university: who.university, awarderQs: who.awarderQs }, c.answers).slice(0, 2) : [];
  const quotes = p.range.from.flatMap((f) =>
    f.k === "stated" ? [{ quote: f.quote, url: f.url }] : f.k === "competitive" ? [{ quote: f.quote, url: p.url }] : f.k === "stats" ? [{ quote: `${f.applications} applications for ${f.places} places${f.year ? ` (${f.year})` : ""}`, url: f.url }] : [],
  );
  const sources: SourceRef[] = [{ kind: "programme", id: p.id, field: "academicRequirement" }];
  const u = data.universities[p.u];
  const content = json({
    id: p.id,
    programme: p.name,
    university: u.name,
    match: m.band,
    minimum: p.range.floor !== null ? LEVEL_NAME[p.range.floor] : null,
    admittedUsually: LEVEL_NAME[p.range.usual],
    basis: p.range.basis,
    admittedGpa4: gpa ? { p25: gpa.p25, median: gpa.median, p75: gpa.p75, fitted: gpa.fitted, reported: gpa.n } : null,
    toStrong: ways.map(lever),
    requirement: p.academic,
    ielts: p.ielts,
    officialQuotes: quotes,
    url: p.url,
    checked: p.checked,
    sources,
  });
  const band = say(
    c.locale,
    { strong: "a strong position", range: "within the admitted range", gap: "below the admitted range", "below-minimum": "below the stated minimum", "no-result": "no result given yet", "not-modelled": "not in the model" }[m.band],
    { strong: "优势位置", range: "在录取区间内", gap: "低于录取区间", "below-minimum": "低于最低要求", "no-result": "尚未填写成绩", "not-modelled": "模型未覆盖" }[m.band],
    { strong: "優勢位置", range: "在錄取區間內", gap: "低於錄取區間", "below-minimum": "低於最低要求", "no-result": "尚未填寫成績", "not-modelled": "模型未覆蓋" }[m.band],
  );
  return {
    content,
    trace: {
      tool: "admit_rate",
      lane: "education",
      summary: say(c.locale, `${p.name} at ${u.name}: ${band}.`, `${u.name} 的 ${p.name}：${band}。`, `${u.name} 的 ${p.name}：${band}。`),
      sources: quotes.length,
    },
  };
}

// ── ep_check ─────────────────────────────────────────────────────────────────────────────────────────────

async function epCheck(x: EpInput, c: ToolContext): Promise<ToolResult> {
  const a = c.answers;
  if (!needsWorkPass(a)) {
    return {
      content: json({ needsWorkPass: false, why: "Singapore citizen or permanent resident", sources: [] }),
      trace: { tool: "ep_check", lane: "career", summary: say(c.locale, "Work pass: not needed for a citizen or PR.", "工作准证：公民或永久居民不需要。", "工作準證：公民或永久居民不需要。"), sources: 0 },
    };
  }
  const degree = KAPLAN_DEGREES.get(plannedDegree(a) ?? "");
  const financial = x.sector ? x.sector === "financial" : degree?.discipline === "accounting-finance";
  const floor = epFloor(a, financial);
  const sources: SourceRef[] = [{ kind: "ep", id: "ep" }];
  const content = json({
    needsWorkPass: true,
    pass: "Employment Pass",
    minimumMonthlySalarySgd: floor.value,
    // A student graduating near 1 Jan 2027 may apply under either schedule: both figures, each with its schedule.
    fromJan2027MinimumMonthlySalarySgd: epFloor({ ...a, graduationYear: 2027, graduationMonth: 1 }, financial).value,
    age: floor.age ?? "23 or below (birth year or graduation not given)",
    sector: floor.sector,
    schedule: floor.schedule === "current" ? "applications before 1 Jan 2027" : "applications from 1 Jan 2027",
    receipt: "ep-age",
    sources,
  });
  const s = floor.value.toLocaleString("en");
  return {
    content,
    trace: {
      tool: "ep_check",
      lane: "career",
      summary: say(c.locale, `Employment Pass: at least S$${s} a month for this age and sector.`, `就业准证：按年龄和行业，月薪至少 S$${s}。`, `就業準證：按年齡和行業，月薪至少 S$${s}。`),
      sources: 1,
    },
  };
}

// ── hot_roles ────────────────────────────────────────────────────────────────────────────────────────────

async function hotRoles(x: IndustryInput, c: ToolContext): Promise<ToolResult> {
  const degreeId = plannedDegree(c.answers);
  const industries = x.industryId ? [x.industryId] : degreeId ? (await getDegreeIndustries()).filter((d) => d.programmeId === degreeId).map((d) => d.industryId) : [];
  if (!industries.length) {
    const all = await getIndustries();
    throw new ToolError(`No degree on file: name an industryId. Industries: ${all.map((i) => `${i.id} (${i.short})`).join(", ")}.`);
  }
  const [lists, hot] = await Promise.all([Promise.all(industries.map((id) => getRolesForIndustry(id))), getHotRoleIds()]);
  if (lists.every((l) => !l.length)) throw new ToolError(`No roles for ${industries.join(", ")}: check the industryId.`);
  const hotSet = new Set(hot);
  const roles = lists.flat().filter((r) => r.hot || hotSet.has(r.id));
  const picked = (roles.length ? roles : lists.flat()).slice(0, 6);
  const facts = new Map((await getFacts(picked.flatMap((r) => (r.wageFactId ? [r.wageFactId] : [])))).map((f) => [f.id, f]));
  const sources: SourceRef[] = picked.map((r) => ({ kind: "career", id: r.id }));
  const content = json({
    industries,
    roles: picked.map((r) => {
      const w = r.wageFactId ? facts.get(r.wageFactId) : undefined;
      return {
        id: r.id,
        title: r.title,
        industryId: r.industryId,
        momNeeds: r.momNeeds,
        highPay: r.highPay,
        wage: w ? { factId: w.id, metric: w.metric, value: w.value, period: w.period, publisher: w.publisher } : null,
        keySkills: r.keySkills.slice(0, 5).map((s) => ({ skill: s.skill, level: s.level })),
      };
    }),
    sources,
  });
  const names = picked.slice(0, 3).map((r) => r.short).join(", ");
  return {
    content,
    trace: {
      tool: "hot_roles",
      lane: "career",
      summary: say(c.locale, `${picked.length} in-demand roles, e.g. ${names}.`, `${picked.length} 个热门岗位，例如 ${names}。`, `${picked.length} 個熱門職位，例如 ${names}。`),
      sources: facts.size,
    },
  };
}

// ── skill_gap ────────────────────────────────────────────────────────────────────────────────────────────

async function skillGap(x: RoleInput, c: ToolContext): Promise<ToolResult> {
  const degreeId = plannedDegree(c.answers);
  if (!degreeId) throw new ToolError("No degree on file: the gap needs the student's Kaplan degree. Ask for it, or leave the gap out.");
  const [role, degreeSkills] = await Promise.all([getRole(x.roleId), getDegreeSkills()]);
  if (!role) throw new ToolError(`No role with id ${x.roleId}: use an id from hot_roles.`);
  const taken = new Set(c.answers.electives);
  const covered = new Map<string, string>();
  const elective = new Map<string, string>();
  for (const s of degreeSkills[degreeId] ?? []) {
    if (s.moduleKind === "core" || taken.has(s.module)) covered.set(s.skill, s.module);
    else if (!elective.has(s.skill)) elective.set(s.skill, s.module);
  }
  const skills = [...role.skills].sort((p, q) => Number(q.key) - Number(p.key) || p.sortOrder - q.sortOrder).slice(0, 12);
  const has = skills.filter((s) => covered.has(s.skill));
  const missing = skills.filter((s) => !covered.has(s.skill));
  const sources: SourceRef[] = [{ kind: "career", id: role.id }];
  const content = json({
    role: { id: role.id, title: role.title },
    degree: KAPLAN_DEGREES.get(degreeId)?.name ?? degreeId,
    covered: has.map((s) => ({ skill: s.skill, level: s.level, key: s.key, module: covered.get(s.skill) })),
    missing: missing.map((s) => ({ skill: s.skill, level: s.level, key: s.key, fix: elective.has(s.skill) ? "degree" : "outside", elective: elective.get(s.skill) ?? null })),
    sources,
  });
  return {
    content,
    trace: {
      tool: "skill_gap",
      lane: "career",
      summary: say(
        c.locale,
        `${role.short}: your degree covers ${has.length} of ${skills.length} skills; ${missing.length} to close.`,
        `${role.short}：你的学位覆盖 ${skills.length} 项技能中的 ${has.length} 项，还差 ${missing.length} 项。`,
        `${role.short}：你的學位覆蓋 ${skills.length} 項技能中的 ${has.length} 項，還差 ${missing.length} 項。`,
      ),
      sources: 1,
    },
  };
}

// ── outcomes_figures ─────────────────────────────────────────────────────────────────────────────────────

type EmploymentRecord = { id: string; cohort?: string; verbatimQuote?: string; value?: number; unit?: string; windowMonths?: number };
const RECORDS = new Map((employment.records as EmploymentRecord[]).map((r) => [r.id, r]));

/** The /outcomes figures with what each measures; only records that carry their official quote. */
const FIGURES: { id: string; what: string; value: number | Record<string, number> }[] = [
  { id: "sg-kaplan-2024-25", what: "Kaplan Higher Education Academy degree graduates, PEI Graduate Employment Survey 2024/25, about 6 months after graduation: % of respondents in the labour force, and median gross monthly salary (S$, full-time permanent)", value: { secured: KAPLAN.latest.secured, currentlyEmployed: KAPLAN.latest.currentlyEmployed, fullTimePermanent: KAPLAN.latest.fullTimePermanent, medianSalary: KAPLAN.latest.medianSalary, responseRate: KAPLAN.latest.responseRate, respondents: KAPLAN.latest.respondents } },
  { id: "sg-kaplan-2023-24", what: "Kaplan, PEI GES 2023/24: % employed", value: KAPLAN.trend[1].kaplan },
  { id: "sg-kaplan-2022-23", what: "Kaplan, PEI GES 2022/23: % employed", value: KAPLAN.trend[0].kaplan },
  { id: "sg-pei-2024-25-secured", what: "All private (PEI) degree graduates 2024/25: % secured employment", value: KAPLAN.compare.pei },
  { id: "sg-au-2025-secured", what: "Public (autonomous) university graduates 2025: % secured employment", value: KAPLAN.compare.au },
  { id: "sg-pei-2024-25-salary", what: "Private (PEI) degree graduates 2024/25: median gross monthly salary, S$, full-time permanent", value: HEADLINE.pei.value },
  { id: "sg-au-2025-salary", what: "Public university graduates 2025: median gross monthly salary, S$ (private 2024/25 vs public 2025: different surveys and years)", value: HEADLINE.au.value },
  { id: "ie-hdeg-2024-employed", what: "Ireland, honours bachelor's class of 2024: % in employment 9 months after graduation", value: 74.9 },
  { id: "ie-pgt-2024-employed", what: "Ireland, taught master's class of 2024: % in employment 9 months after graduation", value: 86.6 },
  { id: "au-ug-2025-salary", what: "Australia, domestic undergraduates 2025: median full-time salary, A$ a year", value: 77000 },
  { id: "au-pgc-2025-salary", what: "Australia, domestic postgraduate coursework 2025: median full-time salary, A$ a year (older, more often already in work)", value: 104700 },
];

async function outcomesFigures(_x: Record<string, never>, c: ToolContext): Promise<ToolResult> {
  const figures = FIGURES.filter((f) => RECORDS.get(f.id)?.verbatimQuote).map((f) => ({ ...f, survey: RECORDS.get(f.id)!.cohort ?? null }));
  const sources: SourceRef[] = figures.map((f) => ({ kind: "employment", id: f.id }));
  const k = KAPLAN.latest;
  return {
    content: json({ figures, sources }),
    trace: {
      tool: "outcomes_figures",
      lane: "career",
      summary: say(
        c.locale,
        `Graduate surveys: Kaplan ${k.cohort}, ${k.secured}% secured work, median S$${k.medianSalary.toLocaleString("en")} a month.`,
        `毕业生调查：Kaplan ${k.cohort}，${k.secured}% 已就业，月薪中位数 S$${k.medianSalary.toLocaleString("en")}。`,
        `畢業生調查：Kaplan ${k.cohort}，${k.secured}% 已就業，月薪中位數 S$${k.medianSalary.toLocaleString("en")}。`,
      ),
      sources: figures.length,
    },
  };
}

// ── dispatch ─────────────────────────────────────────────────────────────────────────────────────────────

/** A tool that could not answer for a reason the model can act on (an unknown id, a missing degree). */
export class ToolError extends Error {}

export const SERVER_RUN: Record<ServerTool, (input: never, c: ToolContext) => Promise<ToolResult>> = {
  search_programmes: searchProgrammes,
  admit_rate: admitRate,
  ep_check: epCheck,
  hot_roles: hotRoles,
  skill_gap: skillGap,
  outcomes_figures: outcomesFigures,
};
