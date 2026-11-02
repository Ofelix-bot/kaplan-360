// Loads the curated raw data (data/raw/*.json) into Supabase and uploads private source documents.
// Run with: npm run data:load   (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local)
//
// Every write is an upsert on a natural id, so the script can be re-run safely.
// Tables whose rows have generated ids (kaplan_facts, pathways) are replaced per source.
//
// --only=careers loads only the /careers industry tables (section 13, data/raw/careers-*.json from
// scripts/careers/build-careers-data.mjs); add --dry-run to print the row counts without writing anything.

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { shownBenefit } from "./benefit-display.mjs";

const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7) ?? null;
const DRY = process.argv.includes("--dry-run");
if (ONLY && ONLY !== "careers") throw new Error(`--only=${ONLY}: only --only=careers is supported`);
if (DRY && ONLY !== "careers") throw new Error("--dry-run is only supported with --only=careers");

try {
  process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));
} catch (e) {
  if (!DRY) throw e;
}
const { NEXT_PUBLIC_SUPABASE_URL: URL_, SUPABASE_SECRET_KEY: KEY } = process.env;
if (!DRY && (!URL_ || !KEY)) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
const db = DRY ? null : createClient(URL_, KEY, { auth: { persistSession: false } });

const raw = (f) => JSON.parse(readFileSync(new URL(`../../data/raw/${f}`, import.meta.url), "utf8"));
const roster = raw("institutions.json");
const kaplan = raw("kaplan-programmes.json");
const deck = raw("kaplan-degree-enrolment-day-2026-03.json");
const employment = raw("employment.json");
const DECK = deck.source.id;

async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict, defaultToNull: false });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`${table}: ${rows.length}`);
}
async function replace(table, column, value, rows) {
  const { error } = await db.from(table).delete().eq(column, value);
  if (error) throw new Error(`${table} delete: ${error.message}`);
  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await db.from(table).insert(rows.slice(i, i + 500), { defaultToNull: false });
    if (e) throw new Error(`${table}: ${e.message}`);
  }
  console.log(`${table} (${value}): ${rows.length}`);
}

if (ONLY === "careers") {
  await loadCareers();
  process.exit(0);
}

// Institution ids by QS name (Kaplan partners and deck universities).
const instByName = new Map(roster.institutions.map((r) => [r.name, r.id]));
const deckUni = {
  "Murdoch University": "Murdoch University",
  "Northumbria University": "Northumbria University at Newcastle",
  "University College Dublin": "University College Dublin",
  "University of Portsmouth": "University of Portsmouth",
};
const instId = (name) => {
  const id = instByName.get(deckUni[name] ?? name);
  if (!id) throw new Error(`No institution for ${name}`);
  return id;
};

// 1. Sources
const sources = [
  { id: DECK, kind: "document", title: deck.source.title, file_path: "kaplan-degree-enrolment-day-2026-03-09-cn.pdf", publisher: "Kaplan Higher Education Academy", retrieved_at: deck.transcribedAt, is_private: true, notes: deck.source.fileNote },
  { id: "kaplan-website", kind: "website", title: kaplan.sources["kaplan-website"].name, url: kaplan.sources["kaplan-website"].url, publisher: "Kaplan Higher Education Academy", retrieved_at: "2026-10-18" },
  { id: "kaplan-partners", kind: "website", title: roster.sources["kaplan-partners"].name, url: roster.sources["kaplan-partners"].url, publisher: "Kaplan Higher Education Academy", retrieved_at: "2026-10-18" },
  { id: "qs-wur-2027", kind: "ranking", title: roster.sources["qs-wur-2027"].name, url: roster.sources["qs-wur-2027"].url, publisher: "QS Quacquarelli Symonds Limited", retrieved_at: roster.sources["qs-wur-2027"].retrievedAt, notes: "Shown unchanged with attribution, non-commercial." },
  { id: "kaggle-wur", kind: "dataset", title: roster.sources["kaggle-wur"].name, url: roster.sources["kaggle-wur"].url, retrieved_at: "2026-10-18", notes: roster.sources["kaggle-wur"].note },
  ...Object.entries(employment.sources).map(([id, s]) => ({
    id, kind: s.kind === "official" ? "survey" : "website", title: s.name, url: s.url ?? null, retrieved_at: employment.retrievedAt, notes: s.note ?? null,
  })),
];
await upsert("sources", sources, "id");

// 2. Disciplines
await upsert("disciplines", Object.entries(kaplan.disciplines).map(([id, label]) => ({ id, label })), "id");

// 3. Institutions
await upsert("institutions", roster.institutions.map((r) => ({
  id: r.id,
  name: r.name,
  country: r.country,
  qs_id: r.qs?.id ?? null,
  qs_rank: r.qs?.rank ?? null,
  qs_rank_value: r.qs?.rankValue ?? null,
  qs_url: r.qs?.url ?? null,
  kaggle_names: r.kaggle?.names ?? [],
  kaggle_sources: r.kaggle?.sources ?? [],
  kaplan_partner: !!r.kaplanPartner,
  student_pass: r.kaplanPartner ? r.kaplanPartner.studentPass : null,
  tier: r.tier,
  source_ids: r.sources,
  updated_at: new Date().toISOString(),
})), "id");

// 4. Kaplan programmes
await upsert("kaplan_programmes", kaplan.programmes.map((p) => ({
  id: p.id,
  name: p.name,
  level: p.level,
  discipline_id: p.discipline,
  awarding_body: p.awardingBody,
  awarding_body_verified: p.awardingBodyVerified,
  institution_id: p.university ? instId(p.university) : null,
  student_pass: p.studentPass,
  mode: p.mode,
  offered_this_intake: p.offeredThisIntake ?? null,
  source_url: p.sourceUrl,
  source_ids: p.sources,
})), "id");

// 5. Facts from the deck
const facts = [];
const fact = (f) => facts.push({ source_id: DECK, status: "current", display: true, ...f });
const EXPIRED = { status: "expired", display: false, valid_to: "2026-03-30" };
fact({ page: 15, kind: "student-pass", label: "Partner universities open to Student's Pass holders", value: deck.partnersForStudentPass.universities, verbatim_quote: deck.partnersForStudentPass.verbatimQuote });
for (const r of deck.entryRequirements.items) fact({ page: 53, kind: "entry-requirement", label: r.requirement, verbatim_quote: r.verbatimQuote });
for (const u of deck.universities) {
  const institution_id = instId(u.university);
  const add = (f) => fact({ institution_id, ...f });
  if (u.intake) add({ page: u.intake.page, kind: "intake", label: "Intake", value: { date: u.intake.date }, verbatim_quote: u.intake.verbatimQuote, valid_from: "2026-01-01" });
  for (const i of u.intakes ? [u.intakes].flat() : []) {
    add({ page: i.page ?? u.pages[1], kind: "intake", label: `Intake${i.programmes ? `: ${i.programmes}` : ""}`, value: { dates: i.dates ?? [i.date] }, verbatim_quote: i.verbatimQuote });
    if (i.deadline) add({ page: u.pages[1], kind: "deadline", label: `Application deadline${i.programmes ? `: ${i.programmes}` : ""}`, value: { date: i.deadline }, verbatim_quote: i.deadlineQuote, ...EXPIRED });
  }
  if (u.applicationDeadline) add({ page: u.applicationDeadline.page, kind: "deadline", label: "Application deadline", value: { date: u.applicationDeadline.date }, verbatim_quote: u.applicationDeadline.verbatimQuote, ...EXPIRED });
  if (u.duration) add({ page: u.duration.page, kind: "duration", label: "Duration", value: u.duration, verbatim_quote: u.duration.verbatimQuote });
  if (u.feeWaiver) add({ page: u.feeWaiver.page, kind: "fee-waiver", label: `Tuition fee waiver S$${u.feeWaiver.amount}`, value: { amount: u.feeWaiver.amount, currency: u.feeWaiver.currency }, verbatim_quote: u.feeWaiver.verbatimQuote, ...EXPIRED });
  for (const row of u.fees2026?.rows ?? []) {
    const flagged = !!u.fees2026.flag;
    add({
      page: u.fees2026.page, kind: "fee", label: `2026 fees: ${row.programme}`,
      value: { currency: u.fees2026.currency, ...row }, valid_from: "2026-01-01", valid_to: "2026-12-31",
      ...(flagged ? { flag: `${u.fees2026.flag} (totals as printed)` } : {}),
    });
  }
  if (u.textbooks) add({ page: u.textbooks.page, kind: "textbooks", label: `Textbooks: about S$${u.textbooks.perModule} per module`, value: u.textbooks, verbatim_quote: u.textbooks.verbatimQuote ?? null });
  if (u.bridging?.feePerUnit) {
    add({ page: 90, kind: "bridging", label: "Bridging unit fee", value: u.bridging.feePerUnit, verbatim_quote: u.bridging.feePerUnit.verbatimQuote });
    add({ page: 90, kind: "bridging", label: "2026 bridging fees waived (paid upfront, deducted from the last instalment)", verbatim_quote: u.bridging.waiver2026, valid_from: "2026-01-01", valid_to: "2026-12-31" });
    for (const t of u.bridging.types) add({ page: 89, kind: "bridging", label: t.split(":")[0], verbatim_quote: t });
    add({ page: 89, kind: "bridging", label: "Bridging schedule", verbatim_quote: u.bridging.schedule });
    add({ page: 90, kind: "bridging", label: "Units per trimester", verbatim_quote: u.bridging.load });
    add({ page: 18, kind: "bridging", label: "Diploma exemptions may affect eligibility", verbatim_quote: u.bridging.exemptionCaveat.verbatimQuote });
    add({ page: 26, kind: "bridging", label: "Non-computing diplomas need a bridging unit for IT degrees (no May intake)", verbatim_quote: u.bridging.itNote.verbatimQuote });
    add({ page: 26, kind: "note", label: "Laptop required for Murdoch IT programmes", verbatim_quote: u.bridging.laptopNote.verbatimQuote });
  } else if (u.bridging) {
    add({ page: u.bridging.page, kind: "bridging", label: "Bridging may be required (S$545 per unit)", verbatim_quote: u.bridging.verbatimQuote, status: "flagged", display: false, flag: u.bridging.flag });
  }
  if (u.visaNote) add({ page: u.visaNote.page, kind: "student-pass", label: "Visa timing may cause missed classes after online study", verbatim_quote: u.visaNote.verbatimQuote });
  if (u.residentFaculty) add({ page: u.residentFaculty.page, kind: "note", label: "UCD resident faculty at Kaplan", verbatim_quote: u.residentFaculty.verbatimQuote });
  if (u.accreditationNote) add({ page: u.accreditationNote.page, kind: "note", label: "ACCA / CPA exemptions (accounting double majors)", verbatim_quote: u.accreditationNote.verbatimQuote });
}
const s = deck.kaplanGraduateSurvey;
for (const f of s.figures) fact({ page: s.page, kind: "graduate-survey", label: `${f.value} ${f.claim}`, value: { ...f, survey: s.survey, respondents: s.respondents }, verbatim_quote: f.claim, display: false, flag: s.comparability });
for (const f of deck.institutionFacts.items) fact({ page: deck.institutionFacts.page, kind: "institution", label: f.claim, verbatim_quote: f.verbatimQuote });
fact({ page: deck.graduateEmployers.page, kind: "employer", label: "Employers of Kaplan graduates (2021/22 survey)", value: deck.graduateEmployers.names, verbatim_quote: deck.graduateEmployers.source });
fact({ page: 84, kind: "scholarship", label: "Kaplan scholarship: S$10,000 / 7,500 / 5,000 for the top 3", value: { awards: deck.scholarship.awards, currency: "SGD", criteria: deck.scholarship.criteria }, verbatim_quote: deck.scholarship.use });
for (const r of deck.refundPolicy.withdrawalRefund) fact({ page: 69, kind: "refund", label: `${r.refund} refund: notice ${r.when}`, value: r });
fact({ page: 70, kind: "refund", label: "7-working-day cooling-off period", verbatim_quote: deck.refundPolicy.coolingOff });
for (const q of deck.studentPass.items) fact({ page: 73, kind: "student-pass", label: q.slice(0, 40), verbatim_quote: q });
for (const r of deck.reportingAndOrientation.rows) fact({ page: 71, kind: "orientation", institution_id: instId(r.university), label: "Reporting day and orientation", value: r });
await replace("kaplan_facts", "source_id", DECK, facts);

// 6. Pathways (Murdoch direct entry, "NO BRIDGING!")
const fromId = {
  "Diploma in Information Technology": "kaplan-diploma-in-information-technology",
  "Diploma in Mass Communication": "kaplan-diploma-in-mass-communication",
  "Diploma in Business Management (Finance and Banking)": "kaplan-diploma-in-finance-and-banking", // renamed on the website
};
const murdoch = instId("Murdoch University");
const pathways = deck.murdochDirectEntry.pathways.flatMap((p) =>
  p.degrees.map((d) => ({
    from_label: p.diploma, from_programme_id: fromId[p.diploma] ?? null, to_degree: d, to_institution_id: murdoch,
    bridging_required: false, trending: p.trending.includes(d), source_id: DECK, page: p.page,
  })),
);
await replace("pathways", "source_id", DECK, pathways);

// 7. Employment records
await upsert("employment_records", employment.records.map((r) => ({
  id: r.id, region: r.region, group_id: r.group, institution: r.institution ?? null, cohort: r.cohort ?? "none", metric: r.metric ?? "no-official-data", // sg-pei-diploma: a deliberate "no data" record
  values: r.values ?? { value: r.value, unit: r.unit ?? null, windowMonths: r.windowMonths ?? null },
  source_id: r.source, verbatim_quote: r.verbatimQuote ?? null, show_on_page: r.showOnPage ?? true,
})), "id");

// 8. Postgraduate programmes from the pipeline (data/raw/programmes.json), with evidence and matches
const progFile = new URL("../../data/raw/programmes.json", import.meta.url);
if (existsSync(progFile)) {
  const pg = JSON.parse(readFileSync(progFile, "utf8"));
  await upsert("programmes", pg.programmes.map((p) => ({
    id: p.id,
    institution_id: p.institutionId,
    name: p.name,
    degree_type: p.degreeType,
    discipline_id: p.discipline,
    accepts_any_background: p.acceptsAnyBackground,
    duration_months: p.durationMonths,
    intakes: p.intakes ? [p.intakes] : null,
    tuition_amount: p.tuition?.amount ?? null,
    tuition_currency: p.tuition?.currency ?? null,
    tuition_basis: p.tuition?.basis ?? null,
    tuition_international: !!p.tuition?.international,
    ielts_overall: p.ieltsOverall,
    toefl_total: p.toeflTotal ?? null,
    pte_overall: p.pteOverall ?? null,
    duolingo: p.duolingo ?? null,
    gre_status: p.gre?.status ?? null,
    gre_min: p.gre?.min ?? null,
    gmat_status: p.gmat?.status ?? null,
    gmat_min: p.gmat?.min ?? null,
    academic_requirement: p.academicRequirement,
    study_mode: p.studyMode ?? null,
    teaching_language: p.teachingLanguage ?? null,
    delivered_by: p.deliveredBy ?? null,
    source_url: p.sourceUrl,
    last_verified: p.lastVerified,
    verification: p.verification,
    needs_review: p.needsReview,
    extraction_notes: p.notes,
  })), "id");
  // Evidence and matches are replaced for the programmes in this file.
  const ids = pg.programmes.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    for (const t of ["programme_evidence", "programme_matches"]) {
      const { error } = await db.from(t).delete().in("programme_id", chunk);
      if (error) throw new Error(`${t} delete: ${error.message}`);
    }
  }
  const evidence = pg.programmes.flatMap((p) => p.evidence.map((e) => ({
    programme_id: p.id, field: e.field, value: e.value, verbatim_quote: e.quote, source_url: e.url,
    extracted_by: e.extractedBy, quote_verified: e.quoteVerified, retrieved_at: p.lastVerified,
  })));
  for (let i = 0; i < evidence.length; i += 500) {
    const { error } = await db.from("programme_evidence").insert(evidence.slice(i, i + 500), { defaultToNull: false });
    if (error) throw new Error(`programme_evidence: ${error.message}`);
  }
  console.log(`programme_evidence: ${evidence.length}`);
  // Programmes a rebuild no longer produces (renamed or merged pages) are removed: those of the universities in this
  // file, and any whose page is in it under another university (Kaplan's master's, now listed under the awarding
  // university). Evidence, matches and steps go with them (on delete cascade).
  const keep = new Set(ids);
  const insts = new Set(pg.programmes.map((p) => p.institutionId));
  const urls = new Set(pg.programmes.map((p) => p.sourceUrl));
  const loaded = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("programmes").select("id,institution_id,source_url").order("id").range(from, from + 999);
    if (error) throw new Error(`programmes select: ${error.message}`);
    loaded.push(...data);
    if (data.length < 1000) break;
  }
  const stale = loaded.filter((r) => !keep.has(r.id) && (insts.has(r.institution_id) || urls.has(r.source_url)));
  for (let i = 0; i < stale.length; i += 200) {
    const { error } = await db.from("programmes").delete().in("id", stale.slice(i, i + 200).map((r) => r.id));
    if (error) throw new Error(`programmes delete: ${error.message}`);
  }
  const by = stale.reduce((m, r) => ((m[r.institution_id] = (m[r.institution_id] ?? 0) + 1), m), {});
  console.log(`programmes: removed ${stale.length} stale (${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(", ")})`);
  await upsert("programme_matches", pg.matches.map((m) => ({
    programme_id: m.programmeId, kaplan_programme_id: m.kaplanProgrammeId, match_type: m.matchType,
    via_degree: false, reason: m.reason, evidence_quote: m.evidenceQuote,
  })), "programme_id,kaplan_programme_id");
}

// 8b. "How should I prepare?" steps drafted at build time (data/raw/programme-prepare.json,
// scripts/pipeline/prepare-ai.ts), for programmes that are loaded.
const prepareFile = new URL("../../data/raw/programme-prepare.json", import.meta.url);
if (existsSync(prepareFile) && existsSync(progFile)) {
  const loaded = new Set(JSON.parse(readFileSync(progFile, "utf8")).programmes.map((p) => p.id));
  const items = Object.entries(JSON.parse(readFileSync(prepareFile, "utf8")).items).filter(([id, v]) => loaded.has(id) && v.steps.length);
  await upsert("programme_prepare", items.map(([id, v]) => ({ programme_id: id, steps: v.steps, model: v.model, built_at: v.builtAt })), "programme_id");
}

// 9. Careers: MOM median wages by SSOC occupation (data/raw/careers.json, npm run data:mom)
const careersFile = new URL("../../data/raw/careers.json", import.meta.url);
if (existsSync(careersFile)) {
  const cf = JSON.parse(readFileSync(careersFile, "utf8"));
  await upsert("sources", cf.sources.map((s) => ({
    id: s.id, kind: s.referencePeriod ? "survey" : "dataset", title: s.title, url: s.url, publisher: s.publisher, retrieved_at: s.retrievedAt,
    notes: [s.referencePeriod, s.notes, s.licence && `Licence: ${s.licence}`, s.attribution, s.modifications && `Changes: ${s.modifications}`, s.fileUrl && `File: ${s.fileUrl}`].filter(Boolean).join(" "),
  })), "id");
  await upsert("careers", cf.careers.map((c) => ({
    id: c.id, title: c.title, discipline_ids: c.disciplines,
    summary: c.onet?.occupations[0]?.description ?? null, summary_source_id: c.onet ? c.onet.sourceId : null,
    median_salary: c.medianGrossWage, median_salary_source_id: c.sourceId, sort_order: c.sortOrder,
  })), "id");
  for (const c of cf.careers) {
    // Skills Framework: titles and proficiency levels only (see scripts/data/import-skills-framework.mjs).
    const sfw = (c.skills ?? []).map((s, i) => ({
      career_id: c.id, requirement: s.title, kind: s.kind, proficiency_level: Number(s.proficiencyLevel) || null,
      framework_job_role: `${c.frameworkRole.sector} · ${c.frameworkRole.jobRole}`, source_id: c.frameworkRole.sourceId, sort_order: i + 1,
    }));
    const onetSkills = (c.onet?.skills ?? []).map((s, i) => ({
      career_id: c.id, requirement: s.title, kind: "skill", importance: s.importance, rating_level: s.level,
      occupation_code: c.onet.skillsFrom, source_id: c.onet.sourceId, sort_order: i + 1,
    }));
    const onetSoftware = (c.onet?.software ?? []).map((s, i) => ({
      career_id: c.id, requirement: s.name, kind: "software", in_demand: s.inDemand,
      occupation_code: c.onet.occupations[0].code, source_id: c.onet.sourceId, sort_order: i + 1,
    }));
    await replace("career_requirements", "career_id", c.id, [...sfw, ...onetSkills, ...onetSoftware]);
  }
  await upsert("career_occupations", cf.careers.flatMap((c) => c.occupations.map((o, i) => ({
    career_id: c.id, ssoc_code: o.ssoc, occupation: o.occupation, median_basic_wage: o.basicMedian, median_gross_wage: o.grossMedian,
    reference_period: cf.sources.find((s) => s.id === c.sourceId).referencePeriod, source_id: c.sourceId, sort_order: i + 1,
  }))), "career_id,ssoc_code");
}

// 10. Employers with Singapore openings per career (npx tsx scripts/careers/build-employers.ts)
const companiesFile = new URL("../../data/raw/career-companies.json", import.meta.url);
if (existsSync(companiesFile)) {
  const cc = JSON.parse(readFileSync(companiesFile, "utf8"));
  for (const careerId of new Set(cc.rows.map((r) => r.careerId))) {
    await replace("career_companies", "career_id", careerId, cc.rows.filter((r) => r.careerId === careerId).map((r) => ({
      career_id: r.careerId, company: r.company, employer_id: r.employerId, company_lists: r.lists, careers_url: r.careersUrl,
      search_url: r.searchUrl, openings: r.openings, status: r.status, retrieved_at: r.retrievedAt,
    })));
  }
}

// 11. Benefits from official university pages (npx tsx scripts/benefits/collect.ts, then checklists.ts)
const benefitsFile = new URL("../../data/raw/benefits.json", import.meta.url);
if (existsSync(benefitsFile)) {
  const bf = JSON.parse(readFileSync(benefitsFile, "utf8"));
  const { error } = await db.from("benefits").delete().neq("id", "");
  if (error) throw new Error(`benefits delete: ${error.message}`);
  await upsert("benefits", bf.items.map((b) => ({
    id: b.id, institution_id: b.institutionId, kind: b.kind, title: b.title, value: b.value, amount: b.amount, currency: b.currency, percent: b.percent,
    for_international: b.forInternational, postgraduate_taught: b.postgraduateTaught, automatic: b.automatic, intake: b.intake,
    deadline: b.deadline, event_date: b.eventDate, format: b.format, disciplines: b.disciplines, eligibility: b.eligibility,
    quotes: b.quotes, source_url: b.url, retrieved_at: b.retrievedAt, checklist: b.checklist ?? null, checklist_model: b.checklistModel ?? null,
    display: shownBenefit(b),
  })), "id");
}

// 12. Private documents
const pdf = new URL("../../data/sources/kaplan-degree-enrolment-day-2026-03-09-cn.pdf", import.meta.url);
if (existsSync(pdf)) {
  const { error } = await db.storage.from("source-documents").upload("kaplan-degree-enrolment-day-2026-03-09-cn.pdf", readFileSync(pdf), { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`storage: ${error.message}`);
  console.log("storage: uploaded the Degree Enrolment Day deck to source-documents (private)");
}

// 13. Careers by industry (npm run data:load -- --only=careers [--dry-run]): data/raw/careers-*.json from
// scripts/careers/build-careers-data.mjs, and data/raw/career-role-employers.json when the openings check has run.
// Order: rows that point at facts are cleared first, parents are upserted, children replaced, and rows a rebuild
// no longer produces are removed, so a re-run leaves exactly the files' contents.
async function loadCareers() {
  const files = ["careers-industries.json", "careers-roles.json", "careers-degree-skills.json", "careers-facts.json", "careers-now.json"];
  for (const f of files) if (!existsSync(new URL(`../../data/raw/${f}`, import.meta.url))) throw new Error(`data/raw/${f} is missing: run node scripts/careers/build-careers-data.mjs`);
  const ind = raw("careers-industries.json");
  const rl = raw("careers-roles.json");
  const ds = raw("careers-degree-skills.json");
  const fa = raw("careers-facts.json");
  const now = raw("careers-now.json");
  const roleIds = new Set(rl.roles.map((r) => r.id));
  const employersFile = new URL("../../data/raw/career-role-employers.json", import.meta.url);
  const employers = existsSync(employersFile) ? raw("career-role-employers.json").rows.filter((r) => roleIds.has(r.role_id)) : null;
  const roles = rl.roles.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "hot"))); // hot is a generated column

  const counts = {
    career_industries: ind.industries.length,
    career_degree_industries: ind.degreeIndustries.length,
    career_roles: roles.length,
    career_role_skills: rl.roleSkills.length,
    career_degree_skills: ds.rows.length,
    career_facts: fa.facts.length,
    career_role_facts: rl.roleFacts.length,
    career_industry_now: now.rows.length,
    career_role_employers: employers ? employers.length : "skipped (no data/raw/career-role-employers.json)",
  };
  for (const [t, n] of Object.entries(counts)) console.log(`${DRY ? "[dry run] " : ""}${t}: ${n}`);
  if (DRY) {
    console.log(`[dry run] built ${ind.built}; nothing was written`);
    return;
  }

  const clear = async (table, column) => {
    const { error } = await db.from(table).delete().neq(column, "");
    if (error) throw new Error(`${table} delete: ${error.message}`);
  };
  const insert = async (table, rows) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from(table).insert(rows.slice(i, i + 500), { defaultToNull: false });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    console.log(`${table}: ${rows.length}`);
  };
  const prune = async (table, keep) => {
    const ids = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select("id").order("id").range(from, from + 999);
      if (error) throw new Error(`${table} select: ${error.message}`);
      ids.push(...data.map((r) => r.id));
      if (data.length < 1000) break;
    }
    const stale = ids.filter((id) => !keep.has(id));
    for (let i = 0; i < stale.length; i += 200) {
      const { error } = await db.from(table).delete().in("id", stale.slice(i, i + 200));
      if (error) throw new Error(`${table} delete: ${error.message}`);
    }
    if (stale.length) console.log(`${table}: removed ${stale.length} stale`);
  };

  await clear("career_industry_now", "industry_id");
  await clear("career_role_facts", "role_id");
  await upsert("career_industries", ind.industries, "id");
  await clear("career_degree_industries", "programme_id");
  await insert("career_degree_industries", ind.degreeIndustries);
  await upsert("career_roles", roles, "id");
  await prune("career_roles", roleIds);
  await clear("career_role_skills", "role_id");
  await insert("career_role_skills", rl.roleSkills);
  await clear("career_degree_skills", "programme_id");
  await insert("career_degree_skills", ds.rows);
  await upsert("career_facts", fa.facts, "id");
  await prune("career_facts", new Set(fa.facts.map((f) => f.id)));
  await insert("career_role_facts", rl.roleFacts);
  await insert("career_industry_now", now.rows);
  if (employers) {
    await clear("career_role_employers", "role_id");
    await insert("career_role_employers", employers);
  }
  await prune("career_industries", new Set(ind.industries.map((i) => i.id)));
}
