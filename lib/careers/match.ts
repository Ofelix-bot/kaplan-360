import { needsWorkPass } from "@/lib/ep";
import { msg } from "@/lib/i18n/translate";
import { plannedDegree, type PlanAnswers } from "@/lib/plan-storage";
import { chipById, chipsOf, knownChips } from "./chips";
import { degreeSkillsOf } from "./pack";
import type {
  Cover,
  CoverSource,
  DegreeSkill,
  FieldFit,
  Gap,
  GapAction,
  GapActionKind,
  MatchBand,
  MatchResult,
  MatchRoleInput,
  MatchStudent,
  RoleKey,
  RoleKeyIndex,
  StudentContext,
} from "./types";

// How a student matches a role (plan §3.2; decisions Q11, Q20, Q22, Q27, C2, C5). Pure functions, no React:
// the client components, the role and industry pages and scripts/check-careers-match.ts share them.
//
// - m = the role's key skills. n = those covered by the degree's CORE modules (rule ∪ claude links), the
//   electives the student has taken (/profile, Q16: the same links), the certificate chips held, the skill
//   chips ticked, and the Skills Framework skills ticked on an internship or work entry (/profile, Q14).
//   Internship and work counts never cover a skill (C5): only the skills ticked on an entry do.
// - Field: "fit" when the degree links to the industry; "adjacent" when another degree of the same Kaplan
//   discipline does (C2, Kaplan 360++'s rule); else "none".
// - Band: High = fit and n/m ≥ 50%. Medium = 25–49% with a fitting field, or 25% and over with an adjacent
//   field (an adjacent field is never High). Low = under 25%, or a field that differs; a field that differs is
//   always Low. Never a probability: always "n of m". The user set these graduate-level thresholds on
//   2026-10-29 (a degree alone covers 2–4 of a role's 8 key skills); they replaced the first 70% / 40%. The
//   same day an adjacent field went from Medium at any coverage to banded by its coverage, capped at Medium.
// - The 3 degrees without a module list: fit or adjacent → Medium, else Low (`fieldOnly`).
// - Each missing key skill gets its gap actions: an elective of the student's own degree linked to it, a
//   certificate we hold receipts for that covers it, and one internship per role in the role's track, named
//   from the track and skill TITLES only (the Skills Framework's terms bar reusing its descriptions). No
//   SkillsFuture course: MySkillsFuture's robots.txt and terms refuse it, so "course" stays empty.

/** Our own rules behind a match, as receipt sentences (lib/receipts/model.ts fromRule). */
export const MATCH_RULES = {
  /** rule:band */
  band: msg("Kaplan 360++'s rule, over every skill SWDA's Skills Framework lists for the role: High = your field fits and you cover half or more of them; Medium = a quarter to under half, or a quarter or more in an adjacent field; Low = under a quarter, or a field that differs. Set for new graduates."),
  /** rule:count:match */
  count: msg("Kaplan 360++'s count: n = the role's key skills your core modules, electives taken, certificates and ticked skills cover; after = n plus the skills the listed electives and certificates add."),
  /** rule:adjacent (C2) */
  adjacent: msg("Kaplan 360++'s rule: an adjacent field = another Kaplan degree in your discipline leads to this industry."),
  /** rule:reading:<programmeId> */
  reading: msg("Kaplan 360++'s reading: each module is linked to the Skills Framework skills it teaches or practises in part, from its title."),
  /** rule:field-only */
  fieldOnly: msg("Kaplan 360++'s rule: with no module list for the degree, the match rests on the field alone: fit or adjacent = Medium, else Low."),
  /** rule:internship */
  internship: msg("Kaplan 360++'s rule: the internship step names the role's Skills Framework track and the key skills you miss, by title only."),
  /** rule:count:uncovered — the entry page's headline; {u} of {m} key-skill places over {r} roles. */
  uncovered: msg("Kaplan 360++'s count: {u} of the {m} key skills across all {r} roles are ones no core module of a Kaplan degree covers, by the module links of the match."),
  /** rule:count:gap — the hot roles' gap panel. */
  gap: msg("Kaplan 360++'s count: now = the role's key skills you cover; after Kaplan courses = plus the missing ones an elective of your degree covers; outside your courses = the rest, which no module of your degree covers. By the module links of the match."),
};

/** Receipt ids of the rules above. */
export const RULE_IDS = {
  band: "rule:band",
  count: "rule:count:match",
  adjacent: "rule:adjacent",
  reading: (programmeId: string) => `rule:reading:${programmeId}`,
  fieldOnly: "rule:field-only",
  internship: "rule:internship",
  uncovered: "rule:count:uncovered",
  gap: "rule:count:gap",
} as const;

/** The registry receipt shown on a Student's Pass holder's internship step. */
export const PASS_RECEIPT = "mom-pass-expires";

/** The Skills Framework Dataset: where the track and skill titles come from. */
export const SF_DATASET_URL = "https://file.go.gov.sg/jobsandskills-skillsfuture-skills-framework-dataset.xlsx";

// Over every skill SWDA lists for the role, with the moderately lenient module links (2026-11-02, the user's pick
// after comparing 35/15, 50/25 and 50/20 on all 2,278 degree × role pairs).
const HIGH = 0.5;
const MEDIUM = 0.25;
/** Missing key skills named on the internship step. */
const INTERNSHIP_SKILLS = 3;

/** Skill titles compared without case or spacing differences. */
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** The field fit of a degree with an industry (C2). No degree → "none". */
export function fieldFit(programmeId: string | null, industryId: string, ctx: Pick<StudentContext, "links" | "degrees">): FieldFit {
  if (!programmeId) return "none";
  if (ctx.links.some((l) => l.programmeId === programmeId && l.industryId === industryId)) return "fit";
  const discipline = ctx.degrees.find((d) => d.id === programmeId)?.discipline;
  if (!discipline) return "none";
  const same = new Set(ctx.degrees.filter((d) => d.discipline === discipline && d.id !== programmeId).map((d) => d.id));
  return ctx.links.some((l) => l.industryId === industryId && same.has(l.programmeId)) ? "adjacent" : "none";
}

/** The band for n of m and a field fit (Q11, Q20); an adjacent field stops at Medium. */
export function bandFor(n: number, m: number, fit: FieldFit, fieldOnly: boolean): MatchBand {
  if (fit === "none") return "low";
  if (fieldOnly) return "medium";
  const ratio = m > 0 ? n / m : 0;
  if (fit === "fit" && ratio >= HIGH) return "high";
  return ratio >= MEDIUM ? "medium" : "low";
}

const EMPTY_ACTIONS = (): Record<GapActionKind, GapAction[]> => ({ elective: [], certificate: [], internship: [], course: [] });

/** How one student matches one role, given the field fit (fieldFit). */
export function matchRole(student: MatchStudent, role: MatchRoleInput, fit: FieldFit): MatchResult {
  const keys = role.keySkills.filter((s) => s.key).sort((a, b) => a.sortOrder - b.sortOrder);
  const fieldOnly = !student.hasModuleData;
  const links: DegreeSkill[] = fieldOnly ? [] : student.degreeSkills;
  const certs = knownChips(student.certificates).map(chipById).filter((c) => c?.kind === "certificate");
  const ticks = knownChips(student.skillChips).map(chipById).filter((c) => c?.kind === "skill");
  const taken = new Set(student.electives ?? []);
  const used = new Set((student.experienceSkills ?? []).map(norm));

  const covered: Cover[] = [];
  const gaps: { skill: string; level: number }[] = [];
  for (const k of keys) {
    const key = norm(k.skill);
    const via: CoverSource[] = [];
    for (const l of links) {
      if (norm(l.skill) !== key) continue;
      if (l.moduleKind === "core" || taken.has(l.module)) via.push({ kind: "module", module: l.module, moduleKind: l.moduleKind, basis: l.basis });
    }
    for (const c of certs) if (c && c.skills.some((s) => norm(s) === key)) via.push({ kind: "certificate", chipId: c.id });
    for (const c of ticks) if (c && c.skills.some((s) => norm(s) === key)) via.push({ kind: "skill-chip", chipId: c.id });
    if (used.has(key)) via.push({ kind: "experience" });
    if (via.length) covered.push({ skill: k.skill, level: k.level, via: dedupeVia(via) });
    else gaps.push({ skill: k.skill, level: k.level });
  }

  const actions = EMPTY_ACTIONS();
  const missing: Gap[] = [];
  const closable = new Set<string>();
  if (gaps.length) {
    const held = new Set(certs.map((c) => c!.id));
    // (1) Electives of the student's own degree, one action per module, with every missing skill it covers.
    const electives = new Map<string, Extract<GapAction, { kind: "elective" }>>();
    // (2) Certificates we hold receipts for, not held yet, one action per chip.
    const certificates = new Map<string, Extract<GapAction, { kind: "certificate" }>>();
    for (const g of gaps) {
      const key = norm(g.skill);
      for (const l of links) {
        if (l.moduleKind !== "elective" || taken.has(l.module) || norm(l.skill) !== key) continue;
        const a = electives.get(l.module) ?? { kind: "elective" as const, module: l.module, programmeId: student.programmeId ?? l.programmeId, skills: [], url: null, basis: l.basis };
        if (!a.skills.includes(g.skill)) a.skills.push(g.skill);
        // A module linked by both the keyword rule and by Claude: the rule is the stronger basis.
        if (l.basis === "rule") a.basis = "rule";
        electives.set(l.module, a);
        closable.add(g.skill);
      }
      for (const c of chipsOf("certificate")) {
        if (held.has(c.id) || !c.skills.some((s) => norm(s) === key)) continue;
        const a = certificates.get(c.id) ?? { kind: "certificate" as const, chipId: c.id, skills: [], receipts: c.receipts, exemptions: c.body ? (student.exemptions[c.body] ?? []) : [] };
        if (!a.skills.includes(g.skill)) a.skills.push(g.skill);
        certificates.set(c.id, a);
        closable.add(g.skill);
      }
    }
    // (3) One internship in the role's track, named from titles only.
    const internship: Extract<GapAction, { kind: "internship" }> = {
      kind: "internship",
      track: role.track,
      skills: gaps.slice(0, INTERNSHIP_SKILLS).map((g) => g.skill),
      studentPass: student.studentPass,
      local: student.local,
      receipts: student.studentPass ? [PASS_RECEIPT] : [],
      internships: student.internships,
    };
    // Electives that close the most gaps first; certificates the same, then the chip order.
    actions.elective = [...electives.values()].sort((a, b) => b.skills.length - a.skills.length);
    actions.certificate = [...certificates.values()].sort((a, b) => b.skills.length - a.skills.length);
    actions.internship = [internship];
    for (const g of gaps) {
      const forSkill: GapAction[] = [
        ...actions.elective.filter((a) => a.kind === "elective" && a.skills.includes(g.skill)),
        ...actions.certificate.filter((a) => a.kind === "certificate" && a.skills.includes(g.skill)),
        internship,
      ];
      missing.push({ skill: g.skill, level: g.level, actions: forSkill });
    }
  }

  const n = covered.length;
  const m = keys.length;
  return {
    band: bandFor(n, m, fit, fieldOnly),
    n,
    m,
    fit,
    covered,
    missing,
    actions,
    nAfter: n + closable.size,
    fieldOnly,
  };
}

/** One entry per module or chip (a module linked by rule and by Claude shows once, rule first). */
function dedupeVia(via: CoverSource[]): CoverSource[] {
  const seen = new Map<string, CoverSource>();
  for (const v of via) {
    const id = v.kind === "module" ? `m:${v.module}` : v.kind === "experience" ? "experience" : `${v.kind}:${v.chipId}`;
    const had = seen.get(id);
    if (!had || (v.kind === "module" && had.kind === "module" && v.basis === "rule")) seen.set(id, v);
  }
  return [...seen.values()];
}

const RANK: Record<MatchBand, number> = { high: 3, medium: 2, low: 1 };

/** The best band among results, or null when there is none. */
export function bestBand(results: readonly MatchResult[]): MatchBand | null {
  let best: MatchBand | null = null;
  for (const r of results) if (!best || RANK[r.band] > RANK[best]) best = r.band;
  return best;
}

/** Sort key: High first, then more key skills covered. */
export const bandRank = (b: MatchBand | null): number => (b ? RANK[b] : 0);

/** The roles of a RoleKeyIndex (lib/data/careers-db getRoleKeys), with their key skills spelled out again. */
export function rolesFromIndex(index: RoleKeyIndex): RoleKey[] {
  return index.roles.map(({ keys, ...r }) => ({
    ...r,
    keySkills: keys.map(([skill, level], i) => ({ skill: index.skills[skill], level, key: true, sortOrder: i })),
  }));
}

const share = (r: MatchResult) => (r.m > 0 ? r.n / r.m : 0);

/**
 * The role the student matches best among `roles` (Q2, 2026-10-29: the entry page's industry cards): the
 * highest band, then the larger share of key skills covered, then a hot role, then the data's order.
 * Null with no degree picked, or no role.
 */
export function bestMatch<R extends RoleKey>(student: MatchStudent, roles: readonly R[], ctx: Pick<StudentContext, "links" | "degrees">): { role: R; result: MatchResult } | null {
  let best: { role: R; result: MatchResult } | null = null;
  for (const role of roles) {
    const result = matchFor(student, role, ctx);
    if (!result) return null;
    const diff = best
      ? RANK[result.band] - RANK[best.result.band] || share(result) - share(best.result) || Number(role.hot) - Number(best.role.hot) || best.role.sortOrder - role.sortOrder
      : 1;
    if (diff > 0) best = { role, result };
  }
  return best;
}

/** The student as matchRole sees them, from the shared answers and the server-sliced context. */
export function studentFromAnswers(answers: PlanAnswers, ctx: StudentContext): MatchStudent {
  const id = plannedDegree(answers);
  const degree = id ? (ctx.degrees.find((d) => d.id === id) ?? null) : null;
  const programmeId = degree?.id ?? null;
  const degreeSkills = programmeId ? degreeSkillsOf(ctx, programmeId) : [];
  // Electives of this degree only: ones ticked under another degree stay in the answers but count for nothing here.
  const ownElectives = new Set(degreeSkills.filter((l) => l.moduleKind === "elective").map((l) => l.module));
  const electives = [...new Set(answers.electives ?? [])].filter((m) => ownElectives.has(m));
  const experienceSkills = [...new Set((answers.experience ?? []).flatMap((e) => e.skills))];
  return {
    programmeId,
    level: answers.level,
    discipline: degree?.discipline ?? null,
    hasModuleData: degree?.hasModuleData ?? false,
    degreeSkills,
    certificates: knownChips(answers.certificates).filter((c) => chipById(c)?.kind === "certificate"),
    skillChips: knownChips(answers.skillChips).filter((c) => chipById(c)?.kind === "skill"),
    electives,
    experienceSkills,
    internships: (answers.internshipsSame ?? 0) + (answers.internshipsOther ?? 0),
    workYears: answers.workYears,
    studentPass: answers.status === "student-pass",
    local: !needsWorkPass(answers),
    exemptions: programmeId ? (ctx.exemptions[programmeId] ?? {}) : {},
  };
}

/** The match for a role, or null when the student has no degree picked (the page shows "Pick a degree…"). */
export function matchFor(student: MatchStudent, role: MatchRoleInput, ctx: Pick<StudentContext, "links" | "degrees">): MatchResult | null {
  if (!student.programmeId) return null;
  const result = matchRole(student, role, fieldFit(student.programmeId, role.industryId, ctx));
  // Elective steps link to the degree's own Kaplan page (the actions are fresh objects: safe to fill in).
  const url = ctx.degrees.find((d) => d.id === student.programmeId)?.url ?? null;
  for (const a of result.actions.elective) if (a.kind === "elective") a.url = url;
  return result;
}
