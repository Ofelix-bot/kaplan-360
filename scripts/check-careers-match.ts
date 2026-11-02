// Checks /careers' match (lib/careers/match.ts), chips (lib/careers/chips.ts) and the answers fields they use
// (lib/plan-storage.ts) on fixed cases: the band rules of Q11/Q20 as the user calibrated them on 2026-10-29
// (High ≥ 50% with a fitting field; Medium 25–49%, or 25% and over with an adjacent field, which is never
// High; Low under 25% or a field that differs), C2 (adjacent = same Kaplan discipline), the entry page's
// best match over all of an industry's roles (Q2: rolesFromIndex, bestMatch),
// C5 (internship and work counts never cover a skill; ticked skill chips do), /profile's electives taken (Q16)
// and the skills ticked on internship and work entries (Q14), with the counts those entries set, the three kinds of gap action
// (an elective of the degree, a receipted certificate, an internship from titles only; never a course), the
// 3 degrees without a module list (field only), the diploma student's pathwayDegreeId, old answers without
// chips, and every chip's label, receipts and wording. Then, with the careers data on disk, the worked example
// Arjun (UCD Finance) in Financial Services and Accountancy, the 3 degrees without modules, and all 56 degrees.
// Data: data/raw/careers-{industries,roles,degree-skills}.json (scripts/careers/build-careers-data.mjs), or
// with --map=<dir> the collector's map.json and map-api.json. Without either, the data cases are skipped.
// Usage: npx tsx scripts/check-careers-match.ts [--map=<dir>] [--verbose]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CHIP_RULE, CHIPS, chipById, knownChips } from "../lib/careers/chips";
import { bandFor, bestBand, bestMatch, fieldFit, MATCH_RULES, matchFor, matchRole, PASS_RECEIPT, rolesFromIndex, studentFromAnswers } from "../lib/careers/match";
import type { DegreeIndustry, DegreeSkill, KaplanDegree, MatchBand, MatchResult, MatchStudent, RoleCardData, RoleKeyIndex, RoleSkill, StudentContext } from "../lib/careers/types";
import { BACHELOR_LEVELS } from "../lib/careers/types";
import { degreeSkillsOf, packDegreeSkills } from "../lib/careers/pack";
import type { MasterOption } from "../lib/careers/types";
import { masterOptionsFor, type MasterSkillsFile } from "../lib/careers/master-options";
import { byMatch, edgeSkills, haveSet, masterCells, pickMasters } from "../lib/careers/masters";
import { coverableSet, keySkillCells, shareWords, uncoveredShare } from "../lib/careers/cells";
import { RECEIPTS } from "../lib/home/receipts";
import { personaById } from "../lib/personas";
import { degreeChoice, EMPTY_ANSWERS, experienceCounts, parsePlan, plannedDegree, type PlanAnswers } from "../lib/plan-storage";

const ROOT = path.resolve(import.meta.dirname, "..");
const VERBOSE = process.argv.includes("--verbose");
const MAP_DIR = process.argv.find((a) => a.startsWith("--map="))?.slice(6) ?? null;
const raw = <T>(f: string): T => JSON.parse(readFileSync(path.join(ROOT, "data/raw", f), "utf8")) as T;

const failures: string[] = [];
let checks = 0;
function check(where: string, ok: boolean, what: string) {
  checks++;
  if (!ok) failures.push(`${where}: ${what}`);
}

/** The hedge words of scripts/check-next-steps.ts (it includes "can" and "about N"). */
const HEDGE = /\b(may|might|could|can|likely|unlikely|probably|perhaps|possibly|usually|typically|generally|tend to|approximately|roughly|(?:about|around) (?:\S*\d|one|two|three|four|five|ten|half))\b/i;
const DATE = /\b(19|20)\d{2}-\d{2}-\d{2}\b|\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (19|20)\d{2}\b/;

// ── Fixtures ──────────────────────────────────────────────────────────────────────────────────────────────

const ARJUN_ID = "ucd-bachelor-of-business-studies-honours-finance-top-up";
const NO_MODULES = [
  "murdoch-bachelor-of-data-analytics-in-data-science",
  "murdoch-bachelor-of-data-analytics-in-fintech-minor-in-information-security-systems",
  "northumbria-bsc-hons-in-psychology-clinical-psychology-top-up",
];

const skill = (s: string, i: number, level = 3): RoleSkill => ({ skill: s, level, key: true, sortOrder: i });
function role(id: string, industryId: string, skills: string[], track = "Track A"): RoleCardData {
  return {
    id,
    industryId,
    title: id,
    short: id,
    track,
    tier: "entry",
    meanProficiency: 2.5,
    variants: [],
    ssocCode: null,
    ssocBasis: null,
    momNeeds: false,
    highPay: false,
    hot: false,
    highPayRule: null,
    searchTerm: null,
    searchScope: null,
    sortOrder: 0,
    redirectFrom: [],
    keySkills: [...skills.map((s, i) => skill(s, i)), { skill: "Not a key skill", level: 2, key: false, sortOrder: 99 }],
    momNeedsFactIds: [],
    momNeedsSol: false,
    wageFactId: null,
    wageMedian: null,
    openings: null,
  };
}
const S8 = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];
const link = (programmeId: string, s: string, module: string, moduleKind: "core" | "elective" = "core", basis: "rule" | "claude" = "rule"): DegreeSkill => ({
  programmeId,
  skill: s,
  module,
  moduleKind,
  basis,
  model: basis === "claude" ? "claude-opus-5-5" : null,
});
function student(over: Partial<MatchStudent> = {}): MatchStudent {
  return {
    programmeId: "deg-a",
    level: "degree",
    discipline: "d1",
    hasModuleData: true,
    degreeSkills: [],
    certificates: [],
    skillChips: [],
    internships: 0,
    workYears: null,
    studentPass: false,
    exemptions: {},
    ...over,
  };
}
const covering = (n: number, pid = "deg-a") => S8.slice(0, n).map((s, i) => link(pid, s, `Core ${i + 1}`));

const deg = (id: string, discipline: string, hasModuleData = true): KaplanDegree => ({
  id,
  name: id,
  university: "U",
  level: "top-up",
  discipline,
  disciplineLabel: discipline,
  studentPass: true,
  hasModuleData,
  url: `https://example.org/${id}`,
});
const DI = (programmeId: string, industryId: string): DegreeIndustry => ({ programmeId, industryId, basis: "Kaplan 360++'s rule: test", sharedSkills: [] });
const CTX: StudentContext = {
  degrees: [deg("deg-a", "d1"), deg("deg-b", "d1"), deg("deg-c", "d2"), deg("deg-x", "d1", false)],
  links: [DI("deg-a", "ind-1"), DI("deg-b", "ind-2"), DI("deg-c", "ind-3"), DI("deg-x", "ind-1")],
  degreeSkills: packDegreeSkills({ "deg-a": covering(8) }),
  exemptions: { "deg-a": { acca: ["BT", "MA", "FA"] } },
  coverableSkills: S8,
};

// ── 1. Bands (Q11, Q20) ──────────────────────────────────────────────────────────────────────────────────

{
  const r = role("r8", "ind-1", S8);
  const cases: { name: string; n: number; fit: "fit" | "adjacent" | "none"; band: MatchBand }[] = [
    { name: "fit 8/8", n: 8, fit: "fit", band: "high" },
    { name: "fit 5/8 (62.5%)", n: 5, fit: "fit", band: "high" },
    { name: "fit 4/8 (50%)", n: 4, fit: "fit", band: "high" },
    { name: "fit 3/8 (37.5%)", n: 3, fit: "fit", band: "medium" },
    { name: "fit 2/8 (25%)", n: 2, fit: "fit", band: "medium" },
    { name: "fit 1/8 (12.5%)", n: 1, fit: "fit", band: "low" },
    { name: "fit 0/8", n: 0, fit: "fit", band: "low" },
    { name: "adjacent 8/8 (never High)", n: 8, fit: "adjacent", band: "medium" },
    { name: "adjacent 4/8 (50%)", n: 4, fit: "adjacent", band: "medium" },
    { name: "adjacent 2/8 (25%)", n: 2, fit: "adjacent", band: "medium" },
    { name: "adjacent 1/8 (12.5%)", n: 1, fit: "adjacent", band: "low" },
    { name: "adjacent 0/8", n: 0, fit: "adjacent", band: "low" },
    { name: "none 8/8", n: 8, fit: "none", band: "low" },
  ];
  for (const c of cases) {
    const res = matchRole(student({ degreeSkills: covering(c.n) }), r, c.fit);
    check(`band ${c.name}`, res.band === c.band, `band ${res.band}, expected ${c.band}`);
    check(`band ${c.name}`, res.n === c.n && res.m === 8, `n of m is ${res.n} of ${res.m}, expected ${c.n} of 8 (the non-key skill must not count)`);
    check(`band ${c.name}`, !res.fieldOnly, "fieldOnly set for a degree with modules");
  }
  // 5 of 10 is exactly 50%: High. 1 of 4 is exactly 25%: Medium. 24 of 100 is under 25%: Low.
  check("band 5/10", bandFor(5, 10, "fit", false) === "high", "50% is not High");
  check("band 1/4", bandFor(1, 4, "fit", false) === "medium", "25% is not Medium");
  check("band 24/100", bandFor(24, 100, "fit", false) === "low", "24% is not Low");
  check("band 0/0", bandFor(0, 0, "fit", false) === "low", "a role with no key skill is not Low");
  check("bestBand", bestBand([]) === null, "no results gives a band");
  check("bestBand", bestBand([{ band: "low" }, { band: "high" }, { band: "medium" }] as MatchResult[]) === "high", "best band is not High");
}

// ── 2. Field fit (C2) ────────────────────────────────────────────────────────────────────────────────────

check("fieldFit fit", fieldFit("deg-a", "ind-1", CTX) === "fit", "deg-a → ind-1 is not fit");
check("fieldFit adjacent", fieldFit("deg-a", "ind-2", CTX) === "adjacent", "deg-b (same discipline) → ind-2 does not make deg-a adjacent");
check("fieldFit none", fieldFit("deg-a", "ind-3", CTX) === "none", "a degree of another discipline makes deg-a adjacent");
check("fieldFit no degree", fieldFit(null, "ind-1", CTX) === "none", "no degree is not none");

// ── 2b. Best match over all of an industry's roles (Q2) ─────────────────────────────────────────────────

{
  // Skills 0–7 are S1–S8; 8–11 are skills the student lacks. The student covers S1–S4.
  const key = (ids: number[]): [number, number][] => ids.map((i) => [i, 3]);
  const index: RoleKeyIndex = {
    skills: [...S8, "X1", "X2", "X3", "X4"],
    roles: [
      { id: "none-hot", industryId: "ind-1", short: "None", track: "T", hot: true, sortOrder: 1, keys: key([8, 9, 10, 11]) },
      { id: "half-hot", industryId: "ind-1", short: "Half", track: "T", hot: true, sortOrder: 2, keys: key([0, 1, 8, 9]) },
      // Listed after the role it ties with, so only the sort order (not the array order) can make "most" win.
      { id: "most-later", industryId: "ind-1", short: "Most later", track: "T", hot: false, sortOrder: 4, keys: key([0, 1, 2, 9]) },
      { id: "most", industryId: "ind-1", short: "Most", track: "T", hot: false, sortOrder: 3, keys: key([0, 1, 2, 8]) },
    ],
  };
  const roles = rolesFromIndex(index);
  const mostRole = roles.find((r) => r.id === "most");
  check("rolesFromIndex", roles.length === 4 && mostRole?.keySkills.map((k) => k.skill).join() === "S1,S2,S3,X1", `key skills spelled back as ${mostRole?.keySkills.map((k) => k.skill).join()}`);
  check("rolesFromIndex", roles.every((r) => r.keySkills.every((k, i) => k.key && k.level === 3 && k.sortOrder === i)), "a key skill lost its key flag, level or order");
  const s = student({ degreeSkills: covering(4) });
  const best = bestMatch(s, roles, CTX);
  check("bestMatch", best?.role.id === "most" && best.result.band === "high" && best.result.n === 3, `best is ${best?.role.id} ${best?.result.band} ${best?.result.n}/${best?.result.m}, expected most high 3/4 (the larger share beats a hot role; the earlier role wins a tie)`);
  const tie = bestMatch(s, roles.filter((r) => r.id === "half-hot" || r.id === "none-hot").concat({ ...roles[1], id: "half-cold", hot: false, sortOrder: 0 }), CTX);
  check("bestMatch", tie?.role.id === "half-hot", `on the same band and share a hot role does not win (${tie?.role.id})`);
  check("bestMatch", bestMatch(student({ programmeId: null }), roles, CTX) === null && bestMatch(s, [], CTX) === null, "no degree, or no role, gives a best match");
  const adjacent = bestMatch(s, roles.map((r) => ({ ...r, industryId: "ind-2" })), CTX);
  check("bestMatch", adjacent?.result.band === "medium" && adjacent.result.fit === "adjacent", `an adjacent industry's best is ${adjacent?.result.band}, expected Medium at most`);
}
check("fieldFit unknown", fieldFit("nope", "ind-1", CTX) === "none", "an unknown degree is not none");

// ── 2c. Key-skill cells and the entry page's share (plan E) ─────────────────────────────────────────────

{
  // The student covers S1, S2; some Kaplan degree's core covers S1–S5; S6–S8 no degree covers.
  const r = role("rcells", "ind-1", S8);
  const res = matchRole(student({ degreeSkills: covering(2) }), r, "fit");
  const cells = keySkillCells(r.keySkills, res, coverableSet(["s1", "S2 ", ...S8.slice(2, 5)]));
  check("cells", cells.map((c) => `${c.skill}:${c.state}`).join() === "S1:have,S2:have,S3:add,S4:add,S5:add,S6:none,S7:none,S8:none", `cells are ${cells.map((c) => `${c.skill}:${c.state}`).join()}`);
  check("cells", keySkillCells(r.keySkills, null, coverableSet(S8)).every((c) => c.state === "add"), "with no degree a cell is \"have\"");
  const index: RoleKeyIndex = { skills: ["A", "B", "C"], roles: [{ id: "x", industryId: "i", short: "x", track: "t", hot: false, sortOrder: 1, keys: [[0, 3], [1, 3], [2, 3]] }] };
  const share = uncoveredShare(index, coverableSet(["a", "b"]));
  check("share", share.uncovered === 1 && share.places === 3 && share.roles === 1, `uncovered ${share.uncovered} of ${share.places} over ${share.roles}`);
  for (const [p, w] of [[0.315, "About a third"], [0.25, "About a quarter"], [0.45, "Almost half"], [0.1, "About a tenth"], [0.02, "Few"], [0.8, "Most"]] as const)
    check("shareWords", shareWords(p) === w, `${p} reads "${shareWords(p)}", expected "${w}"`);
}

// ── 3. What covers a skill (Q22, C5)─────────────────────────────────────────────────────────────────────

{
  const r = role("r4", "ind-1", ["Alpha", "Beta", "Gamma", "Delta"], "Data and AI");
  const links = [
    link("deg-a", "Alpha", "Core A"),
    link("deg-a", "alpha ", "Core A", "core", "claude"), // the same module by Claude, case and space differ
    link("deg-a", "Beta", "Elective B", "elective"),
    link("deg-a", "Gamma", "Elective B", "elective", "claude"),
  ];
  const res = matchRole(student({ degreeSkills: links, internships: 5, workYears: 3 }), r, "fit");
  check("cover core", res.n === 1 && res.covered[0]?.skill === "Alpha", `n is ${res.n}: only the core module covers`);
  check("cover dedupe", res.covered[0]?.via.length === 1 && res.covered[0].via[0].kind === "module" && res.covered[0].via[0].basis === "rule", "a module linked by rule and Claude shows twice, or not as rule");
  check("C5 counts", res.n === 1, "internships or work years covered a skill");
  check("elective action", res.actions.elective.length === 1 && res.actions.elective[0].kind === "elective" && res.actions.elective[0].skills.join() === "Beta,Gamma", "Elective B is not one action covering Beta and Gamma");
  check("elective basis", res.actions.elective[0]?.kind === "elective" && res.actions.elective[0].basis === "rule", "an elective linked by rule and Claude keeps the Claude basis");
  check("nAfter", res.nAfter === 3, `nAfter is ${res.nAfter}, expected 3 (Alpha + Beta, Gamma by the elective)`);
  const intern = res.actions.internship[0];
  check("internship", res.actions.internship.length === 1 && intern?.kind === "internship", "not exactly one internship action");
  if (intern?.kind === "internship") {
    check("internship titles", intern.track === "Data and AI" && intern.skills.every((s) => ["Beta", "Gamma", "Delta"].includes(s)), "the internship is not the role's track and missing skill titles");
    check("internship count", intern.internships === 5, "the internship action does not carry the student's internships");
    check("internship pass", intern.receipts.length === 0 && !intern.studentPass, "a non-Student's Pass student gets the pass receipt");
  }
  check("no course", res.actions.course.length === 0, "a SkillsFuture course action appeared");
  check("gaps", res.missing.map((g) => g.skill).join() === "Beta,Gamma,Delta", "missing skills are not Beta, Gamma, Delta in order");
  check("gap actions", res.missing.every((g) => g.actions.some((a) => a.kind === "internship")), "a gap has no internship action");
  const sp = matchRole(student({ degreeSkills: links, studentPass: true }), r, "fit").actions.internship[0];
  check("internship pass", sp?.kind === "internship" && sp.studentPass && sp.receipts.includes(PASS_RECEIPT), "a Student's Pass holder does not get mom-pass-expires");
  check("pass receipt exists", !!RECEIPTS[PASS_RECEIPT], `${PASS_RECEIPT} is not in the receipt registry`);
  const none = matchRole(student({ degreeSkills: [link("deg-a", "Alpha", "A"), link("deg-a", "Beta", "B"), link("deg-a", "Gamma", "C"), link("deg-a", "Delta", "D")] }), r, "fit");
  check("no gap", none.missing.length === 0 && none.actions.internship.length === 0 && none.nAfter === 4, "a student covering every key skill still gets gap actions");
}

// ── 4. Chips (Q21, C5) ───────────────────────────────────────────────────────────────────────────────────

{
  const acca = chipById("acca-applied-knowledge")!;
  const py = chipById("python")!;
  const r = role("rc", "ind-1", [acca.skills[0], py.skills[0], "Zeta"]);
  const plain = matchRole(student(), r, "fit");
  check("cert action", plain.actions.certificate.some((a) => a.kind === "certificate" && a.chipId === acca.id), "an ACCA action is missing for an ACCA skill");
  const certAction = plain.actions.certificate.find((a) => a.kind === "certificate" && a.chipId === acca.id);
  check("cert exemptions", certAction?.kind === "certificate" && certAction.exemptions.length === 0, "exemptions shown for a degree without any");
  check("skill chip not an action", !plain.actions.certificate.some((a) => a.kind === "certificate" && a.chipId === py.id), "a skill chip appears as a certificate action");
  check("nAfter certs", plain.nAfter === 1, `nAfter is ${plain.nAfter}: certificates add the ACCA skill only`);
  const withEx = matchRole(student({ exemptions: { acca: ["BT", "MA", "FA"] } }), r, "fit").actions.certificate.find((a) => a.kind === "certificate" && a.chipId === acca.id);
  check("cert exemptions", withEx?.kind === "certificate" && withEx.exemptions.join() === "BT,MA,FA", "the degree's ACCA exemptions are not on the action");
  const held = matchRole(student({ certificates: [acca.id], skillChips: [py.id] }), r, "fit");
  check("chips cover", held.n === 2, `n is ${held.n}: a held certificate and a ticked skill must each cover`);
  check("chips via", held.covered.some((c) => c.via.some((v) => v.kind === "certificate")) && held.covered.some((c) => c.via.some((v) => v.kind === "skill-chip")), "covers do not say certificate / skill chip");
  check("held cert", !held.actions.certificate.some((a) => a.kind === "certificate" && a.chipId === acca.id), "a held certificate is still offered");
  check("wrong kind", matchRole(student({ certificates: [py.id], skillChips: [acca.id] }), r, "fit").n === 0, "a chip stored under the wrong kind covered a skill");

  const ids = new Set<string>();
  for (const c of CHIPS) {
    check(`chip ${c.id}`, !ids.has(c.id), "duplicate id");
    ids.add(c.id);
    check(`chip ${c.id}`, c.label.length <= 30, `label "${c.label}" is over 30 characters`);
    check(`chip ${c.id}`, c.skills.length > 0, "covers no skill");
    check(`chip ${c.id}`, c.basis.startsWith("Kaplan 360++'s mapping: "), "basis is not labelled Kaplan 360++'s mapping");
    check(`chip ${c.id}`, c.kind === "certificate" ? c.receipts.length > 0 : c.receipts.length === 0 && c.body === null, "certificates need receipts; skill chips have none");
    for (const id of c.receipts) check(`chip ${c.id}`, !!RECEIPTS[id], `receipt ${id} is not in the registry`);
    for (const s of [c.label, c.basis]) {
      check(`chip ${c.id}`, !HEDGE.test(s), `hedging word in "${s}"`);
      check(`chip ${c.id}`, !DATE.test(s), `literal date in "${s}"`);
    }
  }
  for (const [k, s] of Object.entries({ ...MATCH_RULES, chips: CHIP_RULE })) {
    check(`rule ${k}`, /^Kaplan 360\+\+'s (rule|reading|mapping|count): /.test(s), "is not labelled as our own rule");
    check(`rule ${k}`, !HEDGE.test(s), `hedging word in "${s}"`);
    check(`rule ${k}`, !DATE.test(s), `literal date in "${s}"`);
  }
  check("knownChips", knownChips(["python", "gone", "python", "aws-ccp"]).join() === "python,aws-ccp", "unknown ids or repeats are kept");
  check("knownChips", knownChips(undefined).length === 0 && knownChips("x" as unknown as string[]).length === 0, "a missing or broken field is not []");
}

// ── 5. The 3 degrees without modules (Q22) ───────────────────────────────────────────────────────────────

{
  const r = role("rf", "ind-1", S8);
  const fieldOnly = student({ programmeId: "deg-x", hasModuleData: false, degreeSkills: covering(8, "deg-x") });
  for (const [fit, band] of [["fit", "medium"], ["adjacent", "medium"], ["none", "low"]] as const) {
    const res = matchRole(fieldOnly, r, fit);
    check(`field only ${fit}`, res.band === band && res.fieldOnly, `band ${res.band} (fieldOnly ${res.fieldOnly}), expected ${band}`);
    check(`field only ${fit}`, res.n === 0, "module links counted for a degree without a module list");
  }
  const chipsOnly = matchRole({ ...fieldOnly, skillChips: ["python"] }, role("rp", "ind-1", ["Programming and Coding", "Other"]), "fit");
  check("field only chips", chipsOnly.n === 1 && chipsOnly.band === "medium", "chips do not count for a degree without modules, or the band moved off Medium");
}

// ── 6. Answers (C1, review A, backward compatibility) ────────────────────────────────────────────────────

{
  check("empty answers", Array.isArray(EMPTY_ANSWERS.certificates) && EMPTY_ANSWERS.certificates.length === 0 && EMPTY_ANSWERS.skillChips.length === 0, "EMPTY_ANSWERS has no empty chip lists");
  const old = { ...EMPTY_ANSWERS } as Partial<PlanAnswers>;
  delete old.certificates;
  delete old.skillChips;
  const parsed = parsePlan(`local:${JSON.stringify({ answers: old, savedAt: 0 })}`);
  check("old answers", !!parsed && parsed.answers.certificates.length === 0 && parsed.answers.skillChips.length === 0, "answers saved before the chips do not read as []");
  const broken = parsePlan(`local:${JSON.stringify({ answers: { ...EMPTY_ANSWERS, certificates: null, skillChips: "python" }, savedAt: 0 })}`);
  check("broken answers", !!broken && Array.isArray(broken.answers.certificates) && Array.isArray(broken.answers.skillChips), "broken chip fields are not repaired to []");

  const diploma: PlanAnswers = { ...EMPTY_ANSWERS, level: "diploma", programmeId: "kaplan-diploma-in-business-analytics" };
  const dp = degreeChoice(diploma, "deg-a");
  check("diploma pick", dp.pathwayDegreeId === "deg-a" && dp.programmeId === undefined && dp.level === undefined, "a diploma student's pick is not their pathwayDegreeId");
  check("diploma plan", plannedDegree({ ...diploma, ...dp }) === "deg-a", "the diploma student's planned degree is not the pick");
  const fresh = degreeChoice(EMPTY_ANSWERS, "deg-a");
  check("first pick", fresh.programmeId === "deg-a" && fresh.level === "degree", "a first pick does not set level degree");
  const deg2 = degreeChoice({ ...EMPTY_ANSWERS, level: "degree", programmeId: "deg-b" }, "deg-a");
  check("change pick", deg2.programmeId === "deg-a" && deg2.level === undefined, "changing the degree touches the level");

  const s = studentFromAnswers({ ...diploma, ...dp, certificates: ["acca-applied-knowledge", "gone", "python"], skillChips: ["python", "aws-ccp"], internshipsSame: 1, internshipsOther: 2, status: "student-pass" }, CTX);
  check("student", s.programmeId === "deg-a" && s.discipline === "d1" && s.hasModuleData && s.degreeSkills.length === 8, "the diploma student is not matched on their next degree");
  check("student chips", s.certificates.join() === "acca-applied-knowledge" && s.skillChips.join() === "python", "chips are not filtered by kind and known id");
  check("student counts", s.internships === 3 && s.studentPass, "internships or Student's Pass not read");
  check("student exemptions", s.exemptions.acca?.join() === "BT,MA,FA", "the degree's exemptions are not read");
  const nobody = studentFromAnswers(EMPTY_ANSWERS, CTX);
  check("no degree", nobody.programmeId === null && matchFor(nobody, role("r", "ind-1", S8), CTX) === null, "a student with no degree gets a match");
  const unlisted = studentFromAnswers({ ...EMPTY_ANSWERS, level: "degree", programmeId: "not-listed" }, CTX);
  check("unlisted degree", unlisted.programmeId === null, "a degree outside the 56 is matched");
  const m = matchFor(studentFromAnswers({ ...EMPTY_ANSWERS, level: "degree", programmeId: "deg-a" }, CTX), role("r", "ind-1", [...S8.slice(0, 7), "Extra"]), {
    ...CTX,
    degrees: CTX.degrees,
  });
  check("matchFor", m?.fit === "fit" && m.band === "high" && m.n === 7, `matchFor gives ${m?.band} ${m?.n}`);
}

// ── 6b. /profile: electives taken (Q16) and skills ticked on internships and work (Q14) ──────────────────

{
  const r = role("rprof", "ind-1", ["S1", "S2", "S3", "S4"]);
  const links = [link("deg-a", "S1", "Core 1"), link("deg-a", "S2", "Elective A", "elective"), link("deg-a", "S2", "Elective A", "elective", "claude"), link("deg-a", "S3", "Elective B", "elective")];
  const base = student({ degreeSkills: links });
  const before = matchRole(base, r, "fit");
  check("electives before", before.n === 1 && before.actions.elective.length === 2, `n ${before.n}, ${before.actions.elective.length} elective actions: an elective not taken covers nothing and is an action`);
  const taken = matchRole(student({ degreeSkills: links, electives: ["Elective A"] }), r, "fit");
  const s2 = taken.covered.find((c) => c.skill === "S2");
  check("elective taken", taken.n === 2 && s2?.via.length === 1 && s2.via[0].kind === "module" && s2.via[0].moduleKind === "elective" && s2.via[0].basis === "rule", "a taken elective does not cover its skill once, as an elective with the rule basis");
  check("elective taken action", !taken.actions.elective.some((a) => a.kind === "elective" && a.module === "Elective A") && taken.actions.elective.some((a) => a.kind === "elective" && a.module === "Elective B"), "a taken elective is still offered, or the other one is not");
  check("elective taken nAfter", taken.nAfter === 3, `nAfter is ${taken.nAfter}: the core, the taken elective and the one offered`);
  const other = matchRole(student({ degreeSkills: links, electives: ["Not this degree's"] }), r, "fit");
  check("elective unknown", other.n === 1, "an elective outside the degree's links covered a skill");

  const used = matchRole(student({ degreeSkills: links, experienceSkills: ["  s3", "S4", "S4"] }), r, "fit");
  check("experience covers", used.n === 3 && used.covered.filter((c) => c.via.some((v) => v.kind === "experience")).length === 2, `n ${used.n}: skills ticked on entries (any case or spacing) must each cover once`);
  check("experience via once", used.covered.every((c) => c.via.filter((v) => v.kind === "experience").length <= 1), "a skill ticked on two entries shows twice");
  check("experience band", used.band === "high", `band ${used.band}: 3 of 4 with a fitting field is High`);
  const fieldOnly = matchRole(student({ programmeId: "deg-x", hasModuleData: false, degreeSkills: links, electives: ["Elective A"], experienceSkills: ["S4"] }), r, "fit");
  check("experience field only", fieldOnly.n === 1 && fieldOnly.covered[0]?.skill === "S4" && fieldOnly.band === "medium", "a degree without modules: ticked skills count, electives do not, band stays Medium");

  const ctx: StudentContext = { ...CTX, degreeSkills: packDegreeSkills({ "deg-a": links }) };
  const answers: PlanAnswers = {
    ...EMPTY_ANSWERS,
    level: "degree",
    programmeId: "deg-a",
    electives: ["Elective A", "Elective A", "Core 1", "Gone"],
    experience: [
      { id: "e1", kind: "internship-field", months: 3, skills: ["S3", "S4"] },
      { id: "e2", kind: "work", months: 12, skills: ["S4"] },
    ],
  };
  const s = studentFromAnswers(answers, ctx);
  check("student electives", s.electives?.join() === "Elective A", `electives read as ${s.electives?.join()}: only the degree's own electives, once`);
  check("student experience", s.experienceSkills?.join() === "S3,S4", `experience skills read as ${s.experienceSkills?.join()}`);
  const m = matchFor(s, r, ctx);
  check("student match", m?.n === 4 && m.band === "high", `matchFor gives ${m?.band} ${m?.n}: core, taken elective and two ticked skills cover all 4`);
  check("old student", studentFromAnswers({ ...EMPTY_ANSWERS, level: "degree", programmeId: "deg-a", electives: undefined, experience: undefined } as unknown as PlanAnswers, ctx).electives?.length === 0, "answers without /profile's fields break the student");

  // The counts follow the entries; counts set elsewhere show as entries without months or skills.
  check("counts", JSON.stringify(experienceCounts(answers.experience)) === JSON.stringify({ internshipsSame: 1, internshipsOther: 0, workYears: 1 }), `counts ${JSON.stringify(experienceCounts(answers.experience))}`);
  check("counts rounding", experienceCounts([{ id: "w", kind: "work", months: 3, skills: [] }]).workYears === 0.3, "3 months of work are not 0.3 years");
  const read = (a: Partial<PlanAnswers>) => parsePlan(`local:${JSON.stringify({ answers: { ...EMPTY_ANSWERS, ...a }, savedAt: 0 })}`)!.answers;
  const old = { ...EMPTY_ANSWERS } as Partial<PlanAnswers>;
  delete old.electives;
  delete old.experience;
  const fresh = parsePlan(`local:${JSON.stringify({ answers: { ...old, internshipsSame: 2, internshipsOther: 1, workYears: 1.5 }, savedAt: 0 })}`)!.answers;
  check("old answers profile", fresh.electives.length === 0 && fresh.experience.length === 4, `answers saved before /profile read as ${fresh.experience.length} entries`);
  check("old answers counts", JSON.stringify(experienceCounts(fresh.experience)) === JSON.stringify({ internshipsSame: 2, internshipsOther: 1, workYears: 1.5 }), `the entries from the counts give ${JSON.stringify(experienceCounts(fresh.experience))}`);
  check("old answers stable", JSON.stringify(read({ internshipsSame: 1 }).experience) === JSON.stringify(read({ internshipsSame: 1 }).experience), "the entries from the counts change between reads");
  const consistent = read({ experience: [{ id: "w", kind: "work", months: 3, skills: [] }], workYears: 0.3 });
  check("consistent answers", consistent.experience.length === 1, `${consistent.experience.length} entries: rounding alone added one`);
  const more = read({ experience: [{ id: "w", kind: "work", months: 13, skills: ["S1"] }], workYears: 2 });
  check("counts set elsewhere", more.experience.length === 2 && experienceCounts(more.experience).workYears === 2, "a year of work added elsewhere is not an entry");
  const broken = read({ experience: [null, { id: "x", kind: "nope" }, { id: "y", kind: "work", months: -3, skills: "S1" }] as unknown as PlanAnswers["experience"] });
  check("broken entries", broken.experience.length === 1 && broken.experience[0].months === null && broken.experience[0].skills.length === 0, "broken entries are not dropped or repaired");
}

// ── 7. Real data: Arjun, the 3 degrees without modules, all 56 ───────────────────────────────────────────

type Rows = { ctx: StudentContext; roles: RoleCardData[]; source: string } | null;

function kaplanDegrees(hasModules: (id: string) => boolean): KaplanDegree[] {
  const k = raw<{ disciplines: Record<string, string>; programmes: { id: string; name: string; level: string; discipline: string; university: string; studentPass: boolean; sourceUrl?: string }[] }>("kaplan-programmes.json");
  const topups = raw<{ programmes: { provider: string; kaplanId?: string; url?: string }[] }>("topups.json").programmes.filter((p) => p.provider === "kaplan");
  const urlOf = new Map(topups.map((p) => [p.kaplanId, p.url]));
  return k.programmes
    .filter((p) => (BACHELOR_LEVELS as readonly string[]).includes(p.level))
    .map((p) => ({
      id: p.id,
      name: p.name,
      university: p.university,
      level: p.level as KaplanDegree["level"],
      discipline: p.discipline,
      disciplineLabel: k.disciplines[p.discipline] ?? p.discipline,
      studentPass: p.studentPass,
      hasModuleData: hasModules(p.id),
      url: urlOf.get(p.id) ?? p.sourceUrl ?? null,
    }));
}

function exemptions(): StudentContext["exemptions"] {
  const c = raw<{ programmes: Record<string, Record<string, { status: string; exempt?: string[] }>> }>("certificates.json");
  const out: StudentContext["exemptions"] = {};
  for (const [pid, bodies] of Object.entries(c.programmes))
    for (const [body, v] of Object.entries(bodies)) if (v.status === "exempt" && v.exempt?.length) (out[pid] ??= {})[body] = v.exempt;
  return out;
}

function group<T>(rows: T[], key: (r: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const r of rows) (out[key(r)] ??= []).push(r);
  return out;
}

/** StudentContext.coverableSkills as lib/data/careers-db builds it: the key skills some degree's core modules cover. */
function coverableOf(roles: RoleCardData[], degreeSkills: Record<string, DegreeSkill[]>): string[] {
  const n = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  const core = new Set(Object.values(degreeSkills).flatMap((rows) => rows.filter((r) => r.moduleKind === "core").map((r) => n(r.skill))));
  return [...new Set(roles.flatMap((r) => r.keySkills.filter((k) => k.key).map((k) => k.skill)))].filter((s) => core.has(n(s)));
}

function fromBuilt(): Rows {
  const need = ["careers-industries.json", "careers-roles.json", "careers-degree-skills.json"];
  if (!need.every((f) => existsSync(path.join(ROOT, "data/raw", f)))) return null;
  type DI = { programme_id: string; industry_id: string; basis: string; shared_skills: string[] };
  type RoleRow = { id: string; industry_id: string; title: string; short: string; track: string; tier: "entry" | "early-career"; mean_proficiency: number; mom_needs: boolean; high_pay: boolean; sort_order: number };
  type SkillRow = { role_id: string; skill: string; level: number; key: boolean; sort_order: number };
  type DS = { programme_id: string; skill: string; module: string; module_kind: "core" | "elective"; basis: "rule" | "claude"; model: string | null };
  const ind = raw<{ degreeIndustries: DI[] }>("careers-industries.json");
  const rl = raw<{ roles: RoleRow[]; roleSkills: SkillRow[] }>("careers-roles.json");
  const ds = raw<{ rows: DS[] }>("careers-degree-skills.json");
  const degreeSkills = group(
    ds.rows.map((r) => ({ programmeId: r.programme_id, skill: r.skill, module: r.module, moduleKind: r.module_kind, basis: r.basis, model: r.model })),
    (r) => r.programmeId,
  );
  const skillsOf = group(rl.roleSkills, (s) => s.role_id);
  const roles = rl.roles.map((r) => ({
    ...role(r.id, r.industry_id, [], r.track),
    title: r.title,
    short: r.short,
    tier: r.tier,
    momNeeds: r.mom_needs,
    highPay: r.high_pay,
    hot: r.mom_needs || r.high_pay,
    // The real order: bestMatch breaks a tie on it, as the entry page does.
    sortOrder: r.sort_order,
    keySkills: (skillsOf[r.id] ?? []).filter((s) => s.key).map((s) => ({ skill: s.skill, level: s.level, key: true, sortOrder: s.sort_order })),
  }));
  const links = ind.degreeIndustries.map((l) => ({ programmeId: l.programme_id, industryId: l.industry_id, basis: l.basis, sharedSkills: l.shared_skills }));
  return { ctx: { degrees: kaplanDegrees((id) => (degreeSkills[id]?.length ?? 0) > 0), links, degreeSkills: packDegreeSkills(degreeSkills), exemptions: exemptions(), coverableSkills: coverableOf(roles, degreeSkills) }, roles, source: "data/raw/careers-*.json" };
}

function fromMap(dir: string): Rows {
  const mapFile = path.resolve(dir, "map.json");
  if (!existsSync(mapFile)) return null;
  type MapDeg = { programmeId: string; hasModuleData: boolean; modules: { name: string; kind: "core" | "elective" }[]; skills: { skill: string; fromModules: string[] }[] };
  type MapRole = { role: string; track: string; tier: "entry" | "early-career"; keySkills: { skill: string; level: number }[] };
  const map = JSON.parse(readFileSync(mapFile, "utf8")) as {
    industries: { slug: string; links: { programmeId: string; basis: string; sharedSkills: string[] }[] }[];
    rolesBySector: Record<string, { slug: string; roles: MapRole[] }>;
    degreeSkills: MapDeg[];
  };
  const apiFile = path.resolve(dir, "map-api.json");
  const api = existsSync(apiFile) ? (JSON.parse(readFileSync(apiFile, "utf8")) as { results: { programmeId: string; links: { module: string; skills: string[] }[] }[] }) : { results: [] };
  const kindOf = new Map(map.degreeSkills.flatMap((d) => d.modules.map((m) => [`${d.programmeId}|${m.name}`, m.kind] as const)));
  const rows: DegreeSkill[] = [];
  for (const d of map.degreeSkills) for (const s of d.skills) for (const mod of s.fromModules) rows.push(link(d.programmeId, s.skill, mod, kindOf.get(`${d.programmeId}|${mod}`) ?? "core", "rule"));
  for (const r of api.results) for (const l of r.links) for (const s of l.skills) rows.push(link(r.programmeId, s, l.module, kindOf.get(`${r.programmeId}|${l.module}`) ?? "core", "claude"));
  const degreeSkills = group(rows, (r) => r.programmeId);
  const roles: RoleCardData[] = [];
  for (const sector of Object.values(map.rolesBySector))
    sector.roles.forEach((r, i) => {
      const x = role(`${sector.slug}:${r.role}`, sector.slug, [], r.track);
      roles.push({ ...x, title: r.role, short: r.role.slice(0, 30), tier: r.tier, sortOrder: i, keySkills: r.keySkills.map((k, j) => ({ skill: k.skill, level: k.level, key: true, sortOrder: j })) });
    });
  const links = map.industries.flatMap((i) => i.links.map((l) => ({ programmeId: l.programmeId, industryId: i.slug, basis: l.basis, sharedSkills: l.sharedSkills })));
  const hasModules = new Map(map.degreeSkills.map((d) => [d.programmeId, d.hasModuleData]));
  return { ctx: { degrees: kaplanDegrees((id) => hasModules.get(id) ?? false), links, degreeSkills: packDegreeSkills(degreeSkills), exemptions: exemptions(), coverableSkills: coverableOf(roles, degreeSkills) }, roles, source: `${dir} (map.json, map-api.json)` };
}

const data = fromBuilt() ?? (MAP_DIR ? fromMap(MAP_DIR) : null);
const summary: string[] = [];

if (!data) {
  summary.push("Data cases skipped: no data/raw/careers-*.json yet; pass --map=<dir with map.json and map-api.json>.");
} else {
  const { ctx, roles } = data;

  // The packed links unpack to exactly the rows they were packed from (lib/careers/pack.ts).
  const unpacked = Object.keys(ctx.degreeSkills.rows).flatMap((id) => degreeSkillsOf(ctx, id));
  const repacked = packDegreeSkills(Object.fromEntries(Object.keys(ctx.degreeSkills.rows).map((id) => [id, degreeSkillsOf(ctx, id)])));
  check("pack", JSON.stringify(repacked) === JSON.stringify(ctx.degreeSkills) && unpacked.every((l) => l.skill && l.module), "packed degree skills do not round-trip");
  const byIndustry = group(roles, (r) => r.industryId);
  const dist = (rs: MatchResult[]) => ["high", "medium", "low"].map((b) => `${b} ${rs.filter((r) => r.band === b).length}`).join(", ");

  check("data", ctx.degrees.length === 56, `${ctx.degrees.length} bachelor's degrees, expected 56`);
  check("data", ctx.degrees.filter((d) => !d.hasModuleData).map((d) => d.id).sort().join() === [...NO_MODULES].sort().join(), `degrees without modules: ${ctx.degrees.filter((d) => !d.hasModuleData).map((d) => d.id).join(", ")}`);

  // Every chip covers a key skill of at least one role (otherwise the chip never counts). With K2 key skills
  // (the 8 most shared in the industry) a chip's narrower skills drop out of the key sets, so the check is per
  // chip; the skills that are no role's key skill are listed with --verbose.
  // AWS Cloud Practitioner is kept (Q15) though no role's K2 key set holds a cloud skill: it still names the
  // Skills Framework cloud skills a role asks for, and remapping it to an unrelated key skill would overstate it.
  const NO_KEY_SKILL_OK = new Set(["aws-ccp"]);
  const keySet = new Set(roles.flatMap((r) => r.keySkills.map((k) => k.skill.toLowerCase())));
  for (const c of CHIPS) {
    const off = c.skills.filter((s) => !keySet.has(s.toLowerCase()));
    if (NO_KEY_SKILL_OK.has(c.id)) continue;
    check(`chip ${c.id}`, off.length < c.skills.length, `none of its skills (${c.skills.join(", ")}) is a role's key skill`);
    if (VERBOSE && off.length) console.log(`  chip ${c.id}: no role's key skill: ${off.join(", ")}`);
  }

  // K2 (Q17), built data only: each role's key skills are the min(8, all) of its skills that the most roles of
  // its industry list, first in its skill order; no skill left out is listed by more roles than a key skill.
  if (data.source.startsWith("data/raw")) {
    const rl = raw<{ roles: { id: string; industry_id: string }[]; roleSkills: { role_id: string; skill: string; level: number; key: boolean; sort_order: number }[] }>("careers-roles.json");
    const n = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const own = group(rl.roleSkills, (s) => s.role_id);
    const industryOf = new Map(rl.roles.map((r) => [r.id, r.industry_id]));
    const sharedBy = new Map<string, number>();
    for (const r of rl.roles) for (const s of new Set((own[r.id] ?? []).map((x) => n(x.skill)))) sharedBy.set(`${r.industry_id}|${s}`, (sharedBy.get(`${r.industry_id}|${s}`) ?? 0) + 1);
    for (const r of rl.roles) {
      const ss = [...(own[r.id] ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      const keys = ss.filter((s) => s.key);
      const share = (s: { skill: string }) => sharedBy.get(`${industryOf.get(r.id)}|${n(s.skill)}`) ?? 0;
      const ok =
        keys.length === Math.min(8, ss.length) &&
        ss.slice(0, keys.length).every((s) => s.key) &&
        Math.min(...keys.map(share)) >= Math.max(0, ...ss.filter((s) => !s.key).map(share));
      check(`K2 ${r.id}`, ok, "its key skills are not the most shared of its industry, or not first in its order");
    }
    // The entry page's headline (GapShare): the share of key-skill places no Kaplan degree's core modules cover.
    const index: RoleKeyIndex = {
      skills: [...new Set(rl.roleSkills.filter((s) => s.key).map((s) => s.skill))],
      roles: [],
    };
    const at = new Map(index.skills.map((s, i) => [s, i]));
    index.roles = rl.roles.map((r) => ({ id: r.id, industryId: r.industry_id, short: r.id, track: "", hot: false, sortOrder: 0, keys: (own[r.id] ?? []).filter((s) => s.key).map((s): [number, number] => [at.get(s.skill)!, s.level]) }));
    const g = uncoveredShare(index, coverableSet(ctx.coverableSkills));
    check("headline", shareWords(g.share) === "About a third", `the headline reads "${shareWords(g.share)}" (${g.uncovered} of ${g.places})`);
    summary.push(`Headline: ${g.uncovered} of ${g.places} key-skill places over ${g.roles} roles (${(100 * g.share).toFixed(1)}%) no Kaplan core covers: "${shareWords(g.share)}".`);
  }

  // Arjun, the worked example (lib/personas.ts), as the page sees him.
  const persona = personaById("arjun")!;
  const arjun = studentFromAnswers(persona.answers(new Date("2026-10-29T00:00:00")), ctx);
  check("Arjun", arjun.programmeId === ARJUN_ID && arjun.hasModuleData && arjun.degreeSkills.length > 0, "Arjun's UCD Finance degree or its module links did not load");
  check("Arjun", arjun.studentPass && arjun.exemptions.acca?.join() === "BT,MA,FA", "Arjun's Student's Pass or his ACCA exemptions (BT, MA, FA) did not load");
  for (const ind of ["financial-services", "accountancy"]) {
    const rs = (byIndustry[ind] ?? []).map((r) => matchFor(arjun, r, ctx)!);
    check(`Arjun ${ind}`, rs.length > 0, "no roles");
    check(`Arjun ${ind}`, rs.every((r) => r.fit === "fit" && !r.fieldOnly), "his field does not fit");
    check(`Arjun ${ind}`, rs.every((r) => r.band === bandFor(r.n, r.m, "fit", false)), "a band breaks the rule");
    check(`Arjun ${ind}`, rs.some((r) => r.n > 0), "none of his modules covers a key skill");
    check(`Arjun ${ind}`, rs.every((r) => r.n <= r.nAfter && r.nAfter <= r.m), "n ≤ n′ ≤ m fails");
    check(`Arjun ${ind}`, rs.every((r) => r.actions.course.length === 0), "a course action appeared");
    check(`Arjun ${ind}`, rs.every((r) => !r.missing.length || r.actions.internship.some((a) => a.kind === "internship" && a.receipts.includes(PASS_RECEIPT))), "his internship step lacks the Student's Pass receipt");
    const acca = rs.flatMap((r) => r.actions.certificate).find((a) => a.kind === "certificate" && a.chipId.startsWith("acca-"));
    if (acca?.kind === "certificate") check(`Arjun ${ind}`, acca.exemptions.join() === "BT,MA,FA", "the ACCA step lacks his exemptions");
    const best = [...rs].sort((a, b) => b.n / Math.max(b.m, 1) - a.n / Math.max(a.m, 1))[0];
    summary.push(`Arjun in ${ind}: ${rs.length} roles: ${dist(rs)}; best ${best?.band} ${best?.n} of ${best?.m}.`);
    if (VERBOSE) for (const [i, r] of rs.entries()) console.log(`  ${(byIndustry[ind] ?? [])[i].title}: ${r.band} ${r.n}/${r.m} → ${r.nAfter}`);
  }
  // The entry page's map cards (Q2): his best match over ALL of each linked industry's roles, hot or not.
  for (const l of ctx.links.filter((x) => x.programmeId === ARJUN_ID)) {
    const pool = (byIndustry[l.industryId] ?? []).map((r) => ({ ...r, hot: r.momNeeds || r.highPay }));
    const best = bestMatch(arjun, pool, ctx);
    const hotBest = bestMatch(arjun, pool.filter((r) => r.hot), ctx);
    check(`Arjun card ${l.industryId}`, !!best && (!hotBest || bandFor(best.result.n, best.result.m, "fit", false) === best.result.band), "no best match, or its band breaks the rule");
    if (best && hotBest) check(`Arjun card ${l.industryId}`, ["low", "medium", "high"].indexOf(best.result.band) >= ["low", "medium", "high"].indexOf(hotBest.result.band), "the best over all roles is below the best hot role");
    summary.push(`Arjun's card ${l.industryId}: Best match ${best?.result.band}, ${best?.role.short} ${best?.result.n} of ${best?.result.m}${best?.role.hot ? " (hot)" : ""}; best hot role ${hotBest?.result.band ?? "none"}.`);
  }
  // The role each card names with K2 key skills (Q17), with its n of m (ties broken by sort order).
  // Built data only: --map mode names roles "<sector>:<title>". The pool is also reversed, so the sort order,
  // not the file's order, has to pick the role.
  if (data.source.startsWith("data/raw")) for (const [ind, roleId, band, n, m] of [
    ["financial-services", "product-marketing-executive", "high", 5, 8],
    ["accountancy", "m-and-a-associate", "medium", 3, 8],
  ] as const) {
    if (!ctx.links.some((x) => x.programmeId === ARJUN_ID && x.industryId === ind)) continue;
    const got = bestMatch(arjun, [...(byIndustry[ind] ?? [])].reverse().map((r) => ({ ...r, hot: r.momNeeds || r.highPay })), ctx);
    check(`Arjun card ${ind}`, got?.role.id === roleId && got.result.band === band && got.result.n === n && got.result.m === m, `names ${got?.role.id} ${got?.result.band} ${got?.result.n} of ${got?.result.m}, expected ${roleId} ${band} ${n} of ${m}`);
  }
  // An industry his degree does not reach: never High; an adjacent one banded by coverage up to Medium, another Low.
  for (const [ind, rs0] of Object.entries(byIndustry)) {
    const fit = fieldFit(ARJUN_ID, ind, ctx);
    if (fit === "fit") continue;
    const rs = rs0.map((r) => matchFor(arjun, r, ctx)!);
    const want = (r: MatchResult) => (fit === "adjacent" && r.m > 0 && r.n / r.m >= 0.25 ? "medium" : "low");
    check(`Arjun ${ind}`, rs.every((r) => r.band === want(r)), `a ${fit} field gives ${dist(rs)}`);
    if (fit === "adjacent") summary.push(`Arjun in ${ind} (adjacent): ${rs.length} roles: ${dist(rs)}.`);
  }

  // The 3 degrees without modules: field only.
  for (const id of NO_MODULES) {
    const s = studentFromAnswers({ ...EMPTY_ANSWERS, level: "degree", programmeId: id }, ctx);
    check(id, s.programmeId === id && !s.hasModuleData, "not found, or has module data");
    const counts: string[] = [];
    for (const [ind, rs0] of Object.entries(byIndustry)) {
      const fit = fieldFit(id, ind, ctx);
      const rs = rs0.map((r) => matchFor(s, r, ctx)!);
      check(`${id} ${ind}`, rs.every((r) => r.fieldOnly && r.n === 0 && r.band === (fit === "none" ? "low" : "medium")), `${fit}: ${dist(rs)}`);
      if (fit !== "none") counts.push(`${ind} ${fit}`);
    }
    summary.push(`${id}: Medium in ${counts.join(", ") || "none"}; Low elsewhere.`);
  }

  // All 56 degrees in every industry: the rules hold everywhere.
  let n = 0;
  const bands = { high: 0, medium: 0, low: 0 };
  for (const d of ctx.degrees) {
    const s = studentFromAnswers({ ...EMPTY_ANSWERS, level: "degree", programmeId: d.id }, ctx);
    check(d.id, ctx.links.some((l) => l.programmeId === d.id), "links to no industry");
    for (const r of roles) {
      const res = matchFor(s, r, ctx)!;
      n++;
      bands[res.band]++;
      const ok =
        res.m === r.keySkills.filter((k) => k.key).length &&
        res.n === res.covered.length &&
        res.n + res.missing.length === res.m &&
        res.n <= res.nAfter &&
        res.nAfter <= res.m &&
        res.band === bandFor(res.n, res.m, res.fit, res.fieldOnly) &&
        res.actions.course.length === 0 &&
        res.actions.internship.length === (res.missing.length ? 1 : 0) &&
        res.covered.every((c) => c.via.every((v) => v.kind !== "module" || v.moduleKind === "core"));
      if (!ok) check(`${d.id} × ${r.id}`, false, "the match breaks an invariant");
    }
  }
  summary.push(`All 56 degrees × ${roles.length} roles = ${n} matches: high ${bands.high}, medium ${bands.medium}, low ${bands.low} (${data.source}).`);
}

// ── 8. Master's on the role page (plan F, Q36–Q38: lib/careers/masters.ts) ─────────────────────────────────

{
  const r = role("rm", "ind-1", S8);
  // The student has S1 and S2; S6–S8 are edge skills (no Kaplan degree's core covers them).
  const have2 = matchRole(student({ degreeSkills: covering(2) }), r, "fit");
  const coverable = S8.slice(0, 5);
  const opt = (id: string, core: string[], qsRank: number | null, elective: MasterOption["elective"] = [], university = `U-${id}`): MasterOption => ({
    id,
    name: `MSc ${id}`,
    university,
    country: null,
    qsRank,
    url: `https://example.org/${id}`,
    core,
    elective,
    electiveRule: null,
  });
  const A = opt("a", ["S3", "S4", "S5"], 10);
  const B = opt("b", ["S6"], 50, [{ skill: "S3", modules: ["Elective X"] }]);
  const C = opt("c", ["S6", "S7"], 300);
  const D = opt("d", ["S3", "S4", "S5"], 5);
  const E = opt("e", [], 1);
  const F = opt("f", ["S1"], 2);
  const ids = (ps: { option: MasterOption }[]) => ps.map((p) => p.option.id).join();
  const pick = (options: MasterOption[], result: MatchResult | null = have2) => pickMasters({ keySkills: S8, result, coverable, options });

  check("masters edge", edgeSkills(S8, coverable).join() === "S6,S7,S8", "the edge skills are not the key skills outside coverableSkills");
  const p1 = pick([A, B, C, D, E, F, D]);
  check("masters order", ids(p1) === "c,d,a", `picks ${ids(p1)}, expected c (most edge), then d, a (band after, n after, then QS)`);
  check("masters order", p1[0].edge && !p1[1].edge && !p1[2].edge, "only slot 1 is the edge pick");
  check("masters adds nothing", !p1.some((p) => p.option.id === "e" || p.option.id === "f"), "a master's that adds nothing is listed");
  check("masters duplicates", new Set(p1.map((p) => p.option.id)).size === p1.length, "a programme is listed twice");
  const dupName = pick([C, { ...D, id: "d2" }, D, A]);
  check("masters duplicates", ids(dupName) === "c,d2,a" || ids(dupName) === "c,d,a", `the same university and name listed twice: ${ids(dupName)}`);
  check("masters after", p1[0].nAfter === 4 && p1[0].bandAfter === "high" && p1[0].edgeAdds.join() === "S6,S7", `c: ${p1[0].nAfter} ${p1[0].bandAfter} edge ${p1[0].edgeAdds.join()}`);
  check("masters after", p1[1].nAfter === 5 && p1[1].coreAdds.join() === "S3,S4,S5" && !p1[1].electiveAdds.length, `d: ${p1[1].nAfter}, core ${p1[1].coreAdds.join()}`);
  // Slot 1 ties on edge skills: the better band after, then more key skills after.
  const C2 = opt("c2", ["S6", "S7", "S3"], 400);
  check("masters edge tie", pick([C, C2, A])[0].option.id === "c2", "an edge tie is not broken by n after");
  // No master's adds an edge skill: all three go by match, none is tagged.
  const noEdge = pick([A, D, opt("g", ["S3"], 1)]);
  check("masters no edge", ids(noEdge) === "d,a,g" && noEdge.every((p) => !p.edge), `picks ${ids(noEdge)}`);
  // Ties on band and n after: more core adds first (an elective-only add ranks lower), then QS.
  const H = opt("h", ["S3"], 1, [{ skill: "S4", modules: ["Elective Y"] }]);
  const I = opt("i", ["S3", "S4"], 900);
  check("masters core first", ids(pick([H, I])) === "i,h", `order ${ids(pick([H, I]))}`);
  // Never partner-first: QS breaks the last tie; the name after it.
  check("masters QS", ids(pick([opt("q2", ["S3"], 200), opt("q1", ["S3"], 100), opt("qn", ["S3"], null)])) === "q1,q2,qn", "QS (unranked last) does not break the tie");
  check("masters name", byMatch(pick([opt("x", ["S3"], 7, [], "Same")])[0], pick([{ ...opt("y", ["S3"], 7, [], "Same"), name: "AAA" }])[0]) > 0, "the name does not break the last tie");
  // Electives: only skills the core does not add, the fewest modules that add them all.
  const G = opt("g2", ["S3"], 20, [
    { skill: "S4", modules: ["Module One", "Module Two"] },
    { skill: "S5", modules: ["Module Two"] },
  ]);
  const g = pick([G])[0];
  check("masters electives", g.coreAdds.join() === "S3" && g.electiveAdds.join() === "S4,S5" && g.electives.join() === "Module Two" && g.nAfter === 5, `core ${g.coreAdds} electives ${g.electiveAdds} via ${g.electives}`);
  // The bar: have / master / master-edge / missing, in the role's order.
  check("masters cells", masterCells(p1[0], S8, haveSet(have2)).join() === "have,have,missing,missing,missing,edge,edge,missing", masterCells(p1[0], S8, haveSet(have2)).join());
  // No degree picked: ranked against an empty "have", banded by the same rule.
  const none = pick([A, B, C, D], null);
  check("masters no degree", ids(none) === "c,d,a" && none.every((p) => p.nAfter === p.coreAdds.length + p.electiveAdds.length && p.bandAfter === bandFor(p.nAfter, 8, "fit", false)), `picks ${ids(none)}`);
  check("masters band", pick([opt("one", ["S3"], 1)], null)[0].bandAfter === "low" && pick([opt("two", ["S3", "S4"], 1)], null)[0].bandAfter === "medium", "the band after breaks the rule");
  check("masters empty", pick([E, F]).length === 0, "master's that add nothing give a pick");

  // Real data: every role of Arjun's industries, with the master's file the role page reads.
  const msFile = path.join(ROOT, "data/raw/master-skills.json");
  if (data && existsSync(msFile) && data.source.startsWith("data/raw")) {
    const file = JSON.parse(readFileSync(msFile, "utf8")) as MasterSkillsFile;
    // INDUSTRY_MATCH's disciplines, read from lib/data/careers-db.ts (the module itself needs Next and Supabase).
    const disciplinesOf = Object.fromEntries(
      [...readFileSync(path.join(ROOT, "lib/data/careers-db.ts"), "utf8").matchAll(/^\s*"?([a-z-]+)"?: \{ disciplines: \[([^\]]*)\]/gm)].map((m) => [m[1], [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1])]),
    );
    const core = new Set(Object.keys(data.ctx.degreeSkills.rows).flatMap((id) => degreeSkillsOf(data.ctx, id).filter((x) => x.moduleKind === "core").map((x) => x.skill.toLowerCase())));
    const arjun = studentFromAnswers(personaById("arjun")!.answers(new Date("2026-10-29T00:00:00")), data.ctx);
    let roles = 0;
    let full = 0;
    let edged = 0;
    for (const ro of data.roles.filter((x) => data.ctx.links.some((l) => l.programmeId === ARJUN_ID && l.industryId === x.industryId))) {
      const keys = ro.keySkills.filter((k) => k.key).sort((a, b) => a.sortOrder - b.sortOrder).map((k) => k.skill);
      const options = masterOptionsFor(file, disciplinesOf[ro.industryId] ?? [], keys);
      const result = matchFor(arjun, ro, data.ctx);
      const coverableReal = keys.filter((k) => core.has(k.toLowerCase()));
      const ps = pickMasters({ keySkills: keys, result, coverable: coverableReal, options });
      roles++;
      if (ps.length === 3) full++;
      if (ps[0]?.edge) edged++;
      const have = haveSet(result);
      const ok =
        ps.length <= 3 &&
        new Set(ps.map((p) => p.option.id)).size === ps.length &&
        ps.every((p) => p.nAfter <= p.m && p.bandAfter === bandFor(p.nAfter, p.m, "fit", false) && [...p.coreAdds, ...p.electiveAdds].every((s) => !have.has(s.toLowerCase()))) &&
        ps.slice(ps[0]?.edge ? 1 : 0).every((p, i, xs) => i === 0 || byMatch(xs[i - 1], p) <= 0) &&
        (!ps[0]?.edge || ps.every((p) => p.edgeAdds.length <= ps[0].edgeAdds.length));
      if (!ok) check(`masters ${ro.id}`, false, `the picks break an invariant: ${ids(ps)}`);
    }
    summary.push(`Master's for Arjun: ${roles} roles in his industries; ${full} with 3 picks; ${edged} with an edge pick first.`);
  }
}

for (const s of summary) console.log(s);
if (failures.length) {
  console.error(`\n${failures.length} failure(s) of ${checks} checks:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`\nAll ${checks} checks passed.`);
