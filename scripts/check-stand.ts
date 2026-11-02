// Checks the Competitiveness Index (lib/stand) on the real data: the /results programmes rebuilt from
// data/raw as lib/data/results.ts builds them from Supabase (the same requirement reading, admission range,
// English rules and admitted-case summaries), for four students:
// - Mei: Kaplan business analytics diploma, then the UCD BBS (Honours) Business Analytics top-up, expected
//   GPA 3.3/4.2 (a mid 2:1 on UCD's scale, 3.08–3.67), IELTS 6.5, one internship in her field, two projects;
// - Arjun: the UCD BBS (Honours) Finance top-up, expected GPA 3.2/4.2 (a 2:1 on UCD's scale, UK mark 62),
//   IELTS 6.5, one internship in his field;
// - Lin: Portsmouth psychology top-up, a 2:1 (no mark), IELTS 7.0, one research output, one internship elsewhere;
// - a SIM graduate in economics from the University of London (a 2:1 honours degree), IELTS 6.5, a year of work.
// For each it prints the distribution totals, five programmes in full (one per band and one failed gate),
// the levers and the time a full recompute takes, and asserts: the weights add up to 100; every score and
// index is 0–100; a programme has parts exactly when every gate passes; bands follow 80/65/50; the index is
// its parts and the academic part its points; a programme with only a minimum is read at the minimum + one
// class step; a waiver scores 60 and never less than a score's own points; the four-year rule against UK
// and Irish honours; the awarding-country notes; GMAT on one scale; the grade lever on the student's own
// scale; every private-school degree is tier C; our own wording has no hedging words.
// Exits non-zero on a failure. Usage: npx tsx scripts/check-stand.ts [--quiet]

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import admitCases from "../data/raw/admit-cases.json";
import { admitRange, type AdmitEvidence, type Level } from "../lib/admit-range";
import { fixedName } from "../lib/data/fixes";
import { goodReadings, requirementLevel, requirementWords } from "../lib/grades";
import { makeT } from "../lib/i18n/translate";
import { academicStructured, workYears } from "../lib/pipeline/requirements";
import { PERSONAS } from "../lib/personas";
import { EMPTY_ANSWERS, type PlanAnswers } from "../lib/plan-storage";
import type { EnglishRule, ResultsCases, ResultsData, ResultsProfile, ResultsProgramme, ResultsUniversity, TestStatus } from "../lib/results-types";
import { distribution, levers, prepareAll } from "../lib/stand/aggregate";
import { otherSchoolDegree, standProfile, type StandDegree } from "../lib/stand/profile";
import { RELATED_PAIRS, ieltsEquivalent } from "../lib/stand/rules";
import { bandOf, scorePrepared, WAIVER_SCORE, type Prepared } from "../lib/stand/score";
import { gmatFocus, isGmatFocus } from "../lib/stand/rules";
import { LEVELS, stepUp } from "../lib/admit-range";
import { goalWords } from "../lib/plan-timeline";
import { ukMarkToFour } from "../lib/gpa4";
import { say, type StandProfile, type StandScore } from "../lib/stand/types";

const ROOT = path.resolve(import.meta.dirname, "..");
const raw = <T>(f: string): T => JSON.parse(readFileSync(path.join(ROOT, "data/raw", f), "utf8")) as T;
const quiet = process.argv.includes("--quiet");
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) failures.push(what);
};
const t = makeT({});

// ---------- The /results data, from data/raw ----------

type RawInstitution = { id: string; name: string; country: string | null; tier: number; qs: { rank: string; rankValue: number } | null; kaplanPartner: boolean | null };
type RawProgramme = {
  id: string;
  institutionId: string;
  name: string;
  discipline: string | null;
  acceptsAnyBackground: boolean | null;
  ieltsOverall: number | null;
  toeflTotal: number | null;
  pteOverall: number | null;
  duolingo: number | null;
  gre: TestStatus | null;
  gmat: TestStatus | null;
  academicRequirement: string | null;
  deliveredBy: string | null;
  notes: string[] | null;
  sourceUrl: string;
  lastVerified: string;
};
type EnglishRead = {
  required: "all" | "unless-exempt" | "none";
  exemption: EnglishRule["exemption"];
  ielts: { overall: number } | null;
  toefl: { ibt: number } | null;
  pte: { overall: number } | null;
  duolingo: { score: number } | null;
};
type StoredSpread = { average: number | null; median: number | null; low: number | null; high: number | null } | null;

const institutions = raw<{ institutions: RawInstitution[] }>("institutions.json").institutions;
const tier1 = institutions.filter((i) => i.tier === 1);
const rows = raw<{ programmes: RawProgramme[] }>("programmes.json").programmes.filter((r) => r.discipline && tier1.some((i) => i.id === r.institutionId));
const used = new Set(rows.map((r) => r.institutionId));
const unis = tier1.filter((i) => used.has(i.id));
const index = new Map(unis.map((u, i) => [u.id, i]));
const english = raw<{ programmes: Record<string, EnglishRead>; universities?: Record<string, EnglishRead> }>("english-requirements.json");
const evidence = raw<{ programmes: Record<string, AdmitEvidence> }>("admission-evidence.json").programmes;
const CASES = admitCases.programmes as unknown as Record<string, ResultsCases>;
const profiles = new Map<string, Pick<ResultsProfile, "gre" | "gmat">>();
for (const p of raw<{ profiles: { programmeIds: string[]; gre: StoredSpread; gmat: StoredSpread }[] }>("class-profiles.json").profiles)
  for (const id of p.programmeIds) if (!profiles.has(id) || p.gmat || p.gre) profiles.set(id, { gre: p.gre ? { ...p.gre } : null, gmat: p.gmat ? { ...p.gmat } : null });

const good = goodReadings(rows.filter((r) => r.academicRequirement).map((r) => ({ institution: r.institutionId, text: r.academicRequirement!, country: unis[index.get(r.institutionId)!].country })));
const ASKS_A_DEGREE = /\b(bachelor|undergraduate|degree|honou?rs)\b/i;

function englishOf(id: string, institution: string) {
  const own = english.programmes[id];
  const general = english.universities?.[institution];
  const read = own && own.required !== "none" ? own : general && general.required !== "none" ? general : null;
  if (!read || read.required === "none") return { rule: null, read: null };
  return { rule: { required: read.required, exemption: read.exemption, general: read !== own } as EnglishRule, read };
}

const universities: ResultsUniversity[] = unis.map((u) => ({ name: u.name, zh: null, country: u.country ?? "", qs: u.qs?.rank ?? null, qsValue: u.qs?.rankValue ?? null, partner: !!u.kaplanPartner, good: good.get(u.id) ?? null, subjects: {}, employer: null, compass: null }));
const programmes: ResultsProgramme[] = rows.map((r) => {
  const uni = unis[index.get(r.institutionId)!];
  const text = r.academicRequirement;
  const c = text ? requirementLevel(academicStructured(text), text, uni.country, good.get(r.institutionId)) : null;
  const floor: Level | null = c ? c.floor : text && ASKS_A_DEGREE.test(requirementWords(text)) ? 40 : null;
  const e = englishOf(r.id, r.institutionId);
  const taught = (r.notes ?? []).map((n) => /^Taught at: (.+?) \| (.+)$/.exec(n)).find(Boolean);
  const cases = CASES[r.id] ?? null;
  const prof = profiles.get(r.id);
  return {
    id: r.id,
    u: index.get(r.institutionId)!,
    name: fixedName(r.id, r.name),
    discipline: r.discipline!,
    any: !!r.acceptsAnyBackground,
    ielts: r.ieltsOverall ?? e.read?.ielts?.overall ?? null,
    toefl: r.toeflTotal ?? e.read?.toefl?.ibt ?? null,
    pte: r.pteOverall ?? e.read?.pte?.overall ?? null,
    duolingo: r.duolingo ?? e.read?.duolingo?.score ?? null,
    gre: r.gre?.status ? r.gre : null,
    gmat: r.gmat?.status ? r.gmat : null,
    englishRule: e.rule,
    minClass: c?.rank ?? null,
    minBasis: c?.basis ?? null,
    range: admitRange({ floor, main: c?.main ?? null, evidence: evidence[r.id], qs: uni.qs?.rankValue ?? null, cases: cases?.gpa ? { n: cases.gpa.n, p25: cases.gpa.p25 } : null }),
    work: workYears(text),
    academic: text ? text.slice(0, 280) : null,
    kaplan: r.deliveredBy === "kaplan",
    campus: taught ? { name: taught[1], country: taught[2] } : null,
    profile: prof ? (prof as ResultsProfile) : null,
    cases,
    url: r.sourceUrl,
    checked: r.lastVerified,
  } as unknown as ResultsProgramme;
});
const data: Pick<ResultsData, "programmes" | "universities"> = { programmes, universities };

// ---------- The students ----------

type KaplanRow = { id: string; name: string; university: string | null; discipline: string };
const kaplan = raw<{ programmes: KaplanRow[] }>("kaplan-programmes.json").programmes;
const countryOf = (name: string | null) => institutions.find((i) => i.name === name)?.country ?? null;
const kaplanDegree = (id: string | null): StandDegree | null => {
  const k = kaplan.find((p) => p.id === id);
  return k ? { name: k.name, university: k.university, country: countryOf(k.university), discipline: k.discipline } : null;
};
const day = new Date(2026, 9, 26);
const persona = (id: string) => PERSONAS.find((p) => p.id === id)!.answers(day);
const sim: PlanAnswers = {
  ...EMPTY_ANSWERS,
  level: "degree",
  school: "sim",
  schoolDiscipline: "accounting-finance",
  schoolAwarder: "University of London",
  schoolAwarderCountry: "United Kingdom",
  schoolHonours: true,
  classification: "2:1",
  englishTest: "ielts",
  englishScore: 6.5,
  workYears: 1,
};
const students: { name: string; profile: StandProfile }[] = [
  { name: "Mei (UCD top-up, GPA 3.3/4.2)", profile: standProfile({ ...persona("mei"), degreeGpa: 3.3, internshipsSame: 1, projects: 2 }, kaplanDegree(persona("mei").pathwayDegreeId)) },
  { name: "Arjun (UCD finance top-up, GPA 3.2/4.2)", profile: standProfile({ ...persona("arjun"), internshipsSame: 1 }, kaplanDegree(persona("arjun").programmeId)) },
  { name: "Lin (Portsmouth psychology, 2:1)", profile: standProfile({ ...persona("lin"), research: 1, internshipsOther: 1 }, kaplanDegree(persona("lin").programmeId)) },
  { name: "SIM-UOL economics (2:1)", profile: standProfile(sim, { name: "BSc (Hons) Economics", university: "University of London", country: "United Kingdom", discipline: "accounting-finance", honours: true }) },
];

// ---------- Checks and output ----------

const all = prepareAll(data);
const out = (s: string) => !quiet && console.log(s);
const ms = (f: () => void) => {
  const t0 = performance.now();
  f();
  return performance.now() - t0;
};

function verify(who: string, r: StandScore) {
  const failed = r.gates.some((g) => g.state === "fail");
  const missing = r.gates.some((g) => g.state === "missing");
  check(r.state === (failed ? "not-eligible" : missing ? "missing" : "scored"), `${who} ${r.id}: state ${r.state} against its gates`);
  check((r.state === "scored") === (r.parts !== null && r.index !== null && r.band !== null), `${who} ${r.id}: parts without every gate passing, or the reverse`);
  if (!r.parts) return;
  const parts = Object.values(r.parts);
  check(parts.reduce((s, p) => s + p.weight, 0) === 100, `${who} ${r.id}: weights add up to ${parts.reduce((s, p) => s + p.weight, 0)}`);
  for (const [k, p] of Object.entries(r.parts)) check(p.score >= 0 && p.score <= 100 && Number.isInteger(p.score), `${who} ${r.id}: ${k} scores ${p.score}`);
  check(Number.isInteger(r.index) && r.index! >= 0 && r.index! <= 100, `${who} ${r.id}: index ${r.index}`);
  check(r.band === bandOf(r.index!), `${who} ${r.id}: band ${r.band} for ${r.index}`);
  const sum = Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0) / 100);
  check(sum === r.index, `${who} ${r.id}: index ${r.index}, parts give ${sum}`);
}

function show(r: StandScore) {
  const x = all.find((y) => y.p.id === r.id)!;
  out(`    ${x.u.name} · ${x.p.name} [${x.country}, ${x.p.discipline}]`);
  out(`      ${r.state === "scored" ? `index ${r.index} ${r.band}` : r.state} · ${say(t, r.basis)}`);
  for (const g of r.gates) if (g.state !== "pass" || r.state === "scored") out(`      gate ${g.key}: ${g.state} — ${say(t, g.reason)} (${say(t, g.basis)})`);
  if (r.parts)
    for (const [k, p] of Object.entries(r.parts)) {
      out(`      ${k} ${p.score} × ${p.weight}% — ${say(t, p.basis)}`);
      for (const d of p.detail) out(`        · ${say(t, d)}`);
    }
}

check([79, 80, 64, 65, 49, 50].map(bandOf).join() === "match,safe,reach,match,far,reach", "band thresholds");

for (const { name, profile } of students) {
  check(profile.tier === "C", `${name}: tier ${profile.tier}, not C`);
  const results = all.map((x) => scorePrepared(profile, x));
  results.forEach((r) => verify(name, r));
  const time = Math.min(...[0, 1, 2].map(() => ms(() => distribution(profile, data))));
  const d = distribution(profile, data);
  let lv: ReturnType<typeof levers> = [];
  const leverTime = ms(() => (lv = levers(profile, data)));
  check(time < 150, `${name}: a full recompute took ${time.toFixed(0)} ms`);
  check(d.total === all.length && Object.values(d.counts).reduce((a, b) => a + b, 0) === d.total, `${name}: distribution counts don't add up`);

  out(`\n== ${name}: ${profile.awarder?.name ?? "?"} (${profile.awarder?.country ?? "?"}), ${profile.degreeKind}, ${profile.discipline}, ${profile.grade ? `UK mark ${profile.grade.low}–${profile.grade.high} (${profile.grade.basis})` : "no grade"}, tier ${profile.tier}`);
  out(`  ${d.total} programmes: ${Object.entries(d.counts).map(([k, v]) => `${k} ${v}`).join(", ")} · ${d.cells.length} field × country cells`);
  out(`  full recompute ${time.toFixed(1)} ms; six levers ${leverTime.toFixed(0)} ms`);
  // Gate failures by gate (a programme counts under each gate it fails).
  const byGate: Record<string, number> = {};
  for (const r of results) for (const g of r.gates) if (g.state === "fail") byGate[g.key] = (byGate[g.key] ?? 0) + 1;
  const byMissing: Record<string, number> = {};
  for (const r of results) for (const g of r.gates) if (g.state === "missing") byMissing[g.key] = (byMissing[g.key] ?? 0) + 1;
  const degreeBy: Record<string, number> = {};
  for (const r of results)
    if (r.gates[0].state === "fail") {
      const rule = all.find((x) => x.p.id === r.id)!.degreeRule!;
      const k = rule.source === "university" ? rule.university! : `programme text (${rule.rule})`;
      degreeBy[k] = (degreeBy[k] ?? 0) + 1;
    }
  out(`  failed gates: ${JSON.stringify(byGate)} · missing: ${JSON.stringify(byMissing)}${Object.keys(degreeBy).length ? ` · degree type by source: ${JSON.stringify(degreeBy)}` : ""}`);
  // One programme per band (the student's own field first, else any), and one failed gate.
  const own = (r: StandScore) => all.find((x) => x.p.id === r.id)!.p.discipline === profile.discipline;
  for (const band of ["safe", "match", "reach", "far"] as const) {
    const r = results.find((r) => r.band === band && own(r)) ?? results.find((r) => r.band === band);
    if (r) show(r);
    else out(`    (no ${band} programme)`);
  }
  const fail = results.find((r) => r.state === "not-eligible" && own(r) && r.gates.filter((g) => g.state === "fail").length === 1) ?? results.find((r) => r.state === "not-eligible");
  if (fail) show(fail);
  out("  levers:");
  for (const l of lv)
    out(`    ${l.key}${l.sameAs ? ` (same as ${l.sameAs})` : ""}: ${say(t, l.label)} — ${l.applicable ? `${l.up} up a band, ${l.eligible} newly eligible; ${l.moves.slice(0, 3).map((mv) => `${mv.from} → ${mv.to} ${mv.n}`).join(", ")}` : "not applicable"}`);
}

// A waiver scores 60: a student with no test, a programme that waives English for a UK degree and asks for no GRE/GMAT.
{
  const lin = students[2].profile;
  const noTest: StandProfile = { ...lin, english: { test: "none" } };
  const waived = all.map((x) => scorePrepared(noTest, x)).filter((r) => r.state === "scored" && r.gates.find((g) => g.key === "english")!.reason.key === "Waived for a degree taught in English");
  check(waived.length > 0, "no programme waives English for Lin's Portsmouth degree");
  for (const r of waived) if (r.parts!.tests.detail.length === 1) check(r.parts!.tests.score === WAIVER_SCORE, `${r.id}: waiver scores ${r.parts!.tests.score}`);
  out(`\nwaiver: ${waived.length} programmes waive English for Lin's degree with no test; the tests part is ${WAIVER_SCORE} on each without GRE/GMAT`);
}

// A waiver never lowers the tests part: Lin with IELTS 8 scores at least 60 on every waived programme, and more where her score is worth more.
{
  const strong: StandProfile = { ...students[2].profile, english: { test: "ielts", score: 8 } };
  const waived = all.map((x) => scorePrepared(strong, x)).filter((r) => r.state === "scored" && r.gates.find((g) => g.key === "english")!.reason.key === "Waived for a degree taught in English");
  for (const r of waived) check(r.parts!.tests.score >= WAIVER_SCORE, `${r.id}: waiver with IELTS 8 scores ${r.parts!.tests.score}`);
  check(waived.some((r) => r.parts!.tests.score > WAIVER_SCORE), "IELTS 8 never scores above the waiver's 60");
  // The score's own points where it has some: 60 + 40 per band over the programme's IELTS minimum, at most 100, never below 60.
  for (const score of [8, 7, 5])
    for (const x of all) {
      const r = scorePrepared({ ...students[2].profile, english: { test: "ielts", score } }, x);
      if (r.state !== "scored" || r.gates[2].reason.key !== "Waived for a degree taught in English" || r.parts!.tests.detail.length !== 1 || x.englishIelts.ielts === undefined) continue;
      const margin = Math.round((score - x.englishIelts.ielts) * 10) / 10;
      const want = Math.round(margin < 0 ? WAIVER_SCORE : Math.max(WAIVER_SCORE, Math.min(100, WAIVER_SCORE + 40 * margin)));
      check(r.parts!.tests.score === want, `${x.p.id}: waiver with IELTS ${score} scores ${r.parts!.tests.score}, want ${want}`);
    }
  out(`waiver with IELTS 8: ${waived.length} programmes, tests part ${Math.min(...waived.map((r) => r.parts!.tests.score))}–${Math.max(...waived.map((r) => r.parts!.tests.score))}`);
}

// English against the programme's own minimum for the student's test: the raw score decides (TOEFL 99 against
// 100, PTE 63 against 65 fail, though the concordance reads each pair as one IELTS band).
{
  const base: StandProfile = { ...students[3].profile, awarder: { name: "University of London", country: null } };
  for (const [test, need, below] of [["toefl", 100, 99], ["pte", 65, 63], ["toefl", 92, 90]] as const) {
    const gate = (score: number, x: (typeof all)[number]) => scorePrepared({ ...base, english: { test, score } }, x).gates.find((g) => g.key === "english")!;
    const english = (score: number) => (x: (typeof all)[number]) => gate(score, x).state;
    // Waivers aside: the score is what is compared.
    const asking = all.filter((x) => x.p[test] === need && english(need)(x) === "pass" && gate(need, x).reason.key !== "Waived for a degree taught in English");
    check(asking.length > 0, `no programme asks for ${test} ${need}`);
    const passing = asking.filter((x) => english(below)(x) !== "fail");
    check(passing.length === 0, `${test} ${below} passes ${passing.length} programmes asking ${need}: ${passing.slice(0, 3).map((x) => x.p.id).join(", ")}`);
    out(`${test} ${below} against ${need}: not eligible on all ${asking.length} programmes asking ${need}`);
  }
}

// Degree type: a degree marked not honours fails an honours rule; one whose honours isn't stated reads Missing there;
// a three-year UK honours degree never passes a four-year rule silently.
{
  const sim = students[3].profile;
  const gate = (s: StandProfile, x: (typeof all)[number]) => scorePrepared(s, x).gates[0];
  const honoursOnly = all.filter((x) => x.degreeRule?.rule === "honours");
  const fourYear = all.filter((x) => x.degreeRule?.rule === "four-year");
  check(honoursOnly.length > 0 && fourYear.length > 0, "no honours-only or four-year programmes");
  check(honoursOnly.every((x) => gate({ ...sim, degreeKind: "ordinary" }, x).state === "fail"), "a non-honours degree passes an honours rule");
  check(honoursOnly.every((x) => gate({ ...sim, degreeKind: "other" }, x).state === "missing"), "a degree with honours not stated is not Missing on an honours rule");
  // A UK or Irish honours degree counts as a four-year bachelor's (Kaplan 360++'s rule), with the university's words kept on the gate.
  const HONOURS_FOUR = "Asks for a four-year bachelor’s; an honours degree from {country} counts as one: Kaplan 360++’s rule";
  for (const who of [sim, students[1].profile]) {
    check(who.degreeKind === "honours" && ["United Kingdom", "Ireland"].includes(who.awarder?.country ?? ""), `${who.awarder?.name}: not a UK or Irish honours degree`);
    for (const x of fourYear) {
      const g = gate(who, x);
      check(g.state === "pass" && g.reason.key === HONOURS_FOUR && !!g.quote?.text && !!g.quote.url, `${x.p.id}: a ${who.awarder?.country} honours degree reads ${g.state} (${g.reason.key}) on a four-year rule`);
    }
  }
  // Without honours, still Missing.
  check(fourYear.every((x) => gate({ ...sim, degreeKind: "ordinary" }, x).state === "missing" && gate({ ...sim, degreeKind: "other" }, x).state === "missing"), "a UK degree without honours does not read Missing on a four-year rule");
  check(fourYear.every((x) => gate({ ...sim, awarder: { name: "University at Buffalo", country: "United States" }, degreeKind: "other" }, x).state === "pass"), "a US bachelor's fails a four-year rule");
  check(standProfile({ ...EMPTY_ANSWERS, level: "degree", school: "sim", schoolAwarder: "University of London", schoolAwarderCountry: "United Kingdom", schoolHonours: false }, otherSchoolDegree({ ...EMPTY_ANSWERS, schoolAwarder: "University of London", schoolAwarderCountry: "United Kingdom", schoolHonours: false })).degreeKind === "ordinary", "honours unticked for a UK awarder is not read as ordinary");
  out(`degree type: ${honoursOnly.length} honours-only programmes, ${fourYear.length} four-year-only; UK and Irish honours pass all ${fourYear.length} four-year rules`);
}

// The awarding country's reading (Imperial, KCL, Cambridge): a note only where it differs, never changing the gate.
{
  const gate = (s: StandProfile, x: Prepared) => scorePrepared(s, x).gates[0];
  const rows = all.filter((x) => x.degreeRule?.source === "university");
  check(rows.length > 0, "no programme under a university-wide degree-type rule");
  const murdoch: StandProfile = { ...students[1].profile, awarder: { name: "Murdoch University", country: "Australia" }, degreeKind: "pass-3y" };
  const auHonours: StandProfile = { ...murdoch, degreeKind: "honours" };
  for (const x of rows) {
    const r = x.degreeRule!;
    for (const who of [murdoch, auHonours, students[0].profile, students[1].profile, students[2].profile, students[3].profile]) {
      const g = gate(who, x);
      const row = r.byAwardingCountry?.find((c) => c.country === who.awarder?.country);
      const k = who.degreeKind;
      const byCountry = !row || k === null ? null : row.rule === "any" || k === "honours" ? "pass" : k === "other" ? "missing" : "fail";
      check(!!g.note === (byCountry !== null && byCountry !== g.state), `${x.p.id} (${who.awarder?.name}, ${k}): note ${!!g.note}, country reading ${byCountry}, gate ${g.state}`);
      if (g.note) check(!!g.note.quote?.url && g.note.quote.url === row!.url, `${x.p.id}: note without the university's words`);
    }
    // The gate itself keeps the Singapore reading: a three-year Australian pass degree fails every university rule.
    check(gate(murdoch, x).state === "fail", `${x.p.id}: a three-year Australian pass degree reads ${gate(murdoch, x).state} on ${r.university}'s Singapore row`);
  }
  const notes = (s: StandProfile) => rows.filter((x) => gate(s, x).note).length;
  out(`awarding-country notes: Mei ${notes(students[0].profile)}, Arjun ${notes(students[1].profile)}, Lin ${notes(students[2].profile)}, a Murdoch pass degree ${notes(murdoch)}, an Australian honours degree ${notes(auHonours)} (of ${rows.length} programmes under a university row)`);
}

// A programme that publishes only a minimum: admitted level = the minimum + one class step (Kaplan 360++'s rule); others keep their anchors.
{
  const step = (l: number) => (l < 70 ? stepUp(l as (typeof LEVELS)[number], 1) : l + 5);
  let ruled = 0;
  let unstated = 0;
  let anchored = 0;
  for (const x of all) {
    const a = x.academic;
    const floor = x.p.range.floor ?? 40;
    if (a.kind === "cases") {
      check(a.n >= 5 && a.points[a.points.length - 1][1] === 100, `${x.p.id}: tier-C points without 5 admits`);
      continue;
    }
    const usual = Math.max(x.p.range.usual, floor);
    // Only a stated minimum is stepped from: a programme that states none keeps the old anchors.
    const rule = x.p.range.basis === "minimum" && x.p.range.floor !== null;
    check(a.rule === rule, `${x.p.id}: rule ${a.rule} on basis ${x.p.range.basis}, floor ${x.p.range.floor}`);
    if (x.p.range.floor === null) {
      unstated++;
      check(!a.rule, `${x.p.id}: no minimum stated, but ruled`);
      // A "minimum" with none stated is read as any class: the old anchors. Other bases keep their own level (checked below).
      if (x.p.range.basis === "minimum") {
        anchored++;
        check(JSON.stringify(a.points) === JSON.stringify([[40, 60], [50, 80], [60, 100]]), `${x.p.id}: no minimum stated, but not on the old anchors`);
      }
    }
    const admitted = rule ? step(usual) : usual;
    const want = admitted > floor ? [[floor, 30], [admitted, 60], [step(admitted), 80], [step(step(admitted)), 100]] : [[floor, 60], [step(admitted), 80], [step(step(admitted)), 100]];
    check(JSON.stringify(a.points) === JSON.stringify(want), `${x.p.id}: points ${JSON.stringify(a.points)}, want ${JSON.stringify(want)}`);
    check(x.competition.indexLevel?.mark === admitted && x.competition.indexLevel.rule === rule, `${x.p.id}: competition's index level`);
    if (rule) ruled++;
  }
  out(`admitted level by Kaplan 360++’s rule (the minimum + one class step) on ${ruled} programmes; ${unstated} with no minimum stated, none ruled; ${anchored} of them with basis “minimum” on the old anchors`);
}

// The academic part from its points, for every scored programme of every student.
{
  const along = (pts: number[][], v: number) => {
    if (v <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) return pts[i - 1][1] + ((v - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])) * (pts[i][1] - pts[i - 1][1]);
    return pts[pts.length - 1][1];
  };
  for (const { name, profile } of students)
    for (const x of all) {
      const r = scorePrepared(profile, x);
      if (!r.parts) continue;
      const v = x.academic.kind === "cases" ? ukMarkToFour(profile.grade!.low) : profile.grade!.low;
      check(r.parts.academic.score === Math.round(along(x.academic.points, v)), `${name} ${x.p.id}: academic ${r.parts.academic.score} against its points`);
    }
}

// Every private-school degree is tier C, whatever the awarder: Monash (QS 31) and UCD (QS 100) included.
for (const id of ["monash-bachelor-of-education-in-early-childhood-top-up", "ucd-bachelor-of-business-studies-honours-finance-top-up", "bcu-ba-hons-business-administration-top-up"])
  check(standProfile({ ...EMPTY_ANSWERS, level: "degree", programmeId: id }, kaplanDegree(id)).tier === "C", `${id}: not tier C`);

// GMAT on one scale: the last digit says the edition (5 Focus, 0 10th Edition), GMAC's table converts a 10th Edition score.
{
  check(isGmatFocus(645) && isGmatFocus(805) && !isGmatFocus(700) && !isGmatFocus(800), "GMAT edition by last digit");
  check(gmatFocus(700) === 650 && gmatFocus(800) === 805 && gmatFocus(200) === 230 && gmatFocus(655) === 655 && gmatFocus(705) === 705, `GMAT concordance: 700 → ${gmatFocus(700)}, 800 → ${gmatFocus(800)}, 200 → ${gmatFocus(200)}`);
  check(gmatFocus(705) > gmatFocus(700) && gmatFocus(695) > gmatFocus(690), "GMAT conversion order");
  const x = all[0];
  const asking = (min: number): Prepared => ({ ...x, p: { ...x.p, gmat: { status: "required", min } as TestStatus } });
  const tests = (gmat: number, min: number) => scorePrepared({ ...students[3].profile, gmat }, asking(min)).gates.find((g) => g.key === "tests")!;
  // 10th Edition 600 reads as Focus 560 (555 and 565): Focus 565 meets it, 555 does not.
  check(tests(565, 600).state === "pass" && tests(555, 600).state === "fail", "a Focus Edition score against a 10th Edition minimum");
  // 10th Edition 700 reads as 650, 690 as 640, against a Focus Edition 645.
  check(tests(700, 645).state === "pass" && tests(690, 645).state === "fail", "a 10th Edition score against a Focus Edition minimum");
  check(tests(565, 600).basis.key.startsWith("GMAT compared on the Focus Edition scale"), "a mixed GMAT comparison does not say how it compares");
  out(`GMAT: 10th Edition 700 reads as Focus ${gmatFocus(700)}, 600 as ${gmatFocus(600)}`);
}

// The grade lever on the student's own scale: Arjun's GPA a tenth at a time, Lin's class to the next. The step is
// the smallest that moves a programme: the step below it moves none.
{
  const arjun = students[1].profile;
  const g = levers(arjun, data).find((l) => l.key === "grade")!;
  check(g.label.key === "GPA {from} → {to}" && g.label.vars?.from === 3.2 && g.target?.unit === "gpa" && g.target.scale === 4.2, `Arjun's grade lever: ${say(t, g.label)}`);
  check(g.up + g.eligible > 0, "Arjun's grade lever moves nothing");
  const to = g.target!.value;
  const RANK: Record<string, number> = { "not-eligible": 0, missing: 0, far: 1, reach: 2, match: 3, safe: 4 };
  const outcome = (s: StandProfile, x: Prepared) => {
    const r = scorePrepared(s, x);
    return RANK[r.state === "scored" ? r.band! : r.state];
  };
  const base = all.map((x) => outcome(arjun, x));
  for (let v = Math.round((3.2 + 0.1) * 100) / 100; v < to; v = Math.round((v + 0.1) * 100) / 100) {
    const at = standProfile({ ...persona("arjun"), internshipsSame: 1, degreeGpa: v }, kaplanDegree(persona("arjun").programmeId));
    check(!all.some((x, i) => outcome(at, x) > base[i]), `GPA ${v}, below the lever's ${to}, already moves a programme`);
  }
  const lin = levers(students[2].profile, data).find((l) => l.key === "grade")!;
  check(lin.label.key === "Classification {from} → {to}" && lin.target?.unit === "class" && lin.target.value === 70, `Lin's grade lever: ${say(t, lin.label)}`);
  const head = goalWords({ id: "x", lever: "grade", target: to, unit: "gpa", scale: 4.2, by: "2026-12-01", rule: "graduation", start: 2027 * 12 + 8, up: 1 }, "2026-10-26", t, "en").head;
  check(head.startsWith(`Reach GPA ${to}/4.2 by`), `the GPA goal reads "${head}"`);
  const first = goalWords({ id: "x", lever: "grade", target: 70, unit: "class", scale: null, by: "2026-12-01", rule: "graduation", start: 2027 * 12 + 8, up: 1 }, "2026-10-26", t, "en").head;
  check(first.startsWith("Reach a First by"), `the class goal reads "${first}"`);
  out(`grade lever: Arjun ${say(t, g.label)} (${g.up} up, ${g.eligible} open), Lin ${say(t, lin.label)} (${lin.up} up, ${lin.eligible} open); goal "${head}"`);
}

// Concordances: the tables' own rows.
check(ieltsEquivalent("toefl", 100) === 7 && ieltsEquivalent("toefl", 94) === 6.5 && ieltsEquivalent("toefl", 5) === 7 && ieltsEquivalent("toefl", 114) === 9, "TOEFL concordance");
check(ieltsEquivalent("pte", 58) === 6.5 && ieltsEquivalent("pte", 63) === 7 && ieltsEquivalent("pte", 62) === 6.5 && ieltsEquivalent("pte", 20) === 4, "PTE concordance");
// Related pairs: known disciplines, no pair twice.
const FIELDS = Object.keys(raw<{ disciplines: Record<string, string> }>("kaplan-programmes.json").disciplines);
check(RELATED_PAIRS.every((p) => FIELDS.includes(p.a) && FIELDS.includes(p.b) && p.a !== p.b), "a related pair names an unknown field");
check(new Set(RELATED_PAIRS.map((p) => [p.a, p.b].sort().join("|"))).size === RELATED_PAIRS.length, "a related pair is listed twice");

// Our own wording: no hedging words in lib/stand's messages, the related-field reasons, or their translations.
const HEDGE_EN = /\b(may|might|could|likely|unlikely|probably|perhaps|possibly|usually|typically|generally|tend to|approximately|roughly|(?:about|around) (?:\S*\d|one|two|three|four|five|ten|half))\b/i;
const HEDGE_ZH = /可能|或许|也许|大概|应该会|一般来说|通常|可以考虑|不妨/;
const keys: string[] = [];
for (const f of readdirSync(path.join(ROOT, "lib/stand"))) {
  const src = readFileSync(path.join(ROOT, "lib/stand", f), "utf8");
  for (const mm of src.matchAll(/\b(?:tr|msg)\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.push(mm[1]);
}
keys.push(...RELATED_PAIRS.map((p) => p.reason));
for (const k of keys) check(!HEDGE_EN.test(k), `hedging word in "${k}"`);
const zh = JSON.parse(readFileSync(path.join(ROOT, "scripts/i18n/zh-hans/14-stand.json"), "utf8")) as Record<string, string>;
for (const k of keys) {
  check(k in zh, `no translation for "${k}"`);
  if (zh[k]) check(!HEDGE_ZH.test(zh[k]), `hedging word in the translation of "${k}"`);
}
out(`\n${keys.length} messages checked for hedging words and translations`);

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n${[...new Set(failures)].slice(0, 60).join("\n")}`);
  process.exit(1);
}
console.log("\ncheck-stand: all checks passed");
