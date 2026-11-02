import "server-only";
import employment from "@/data/raw/employment.json";
import epTable from "@/data/raw/ep-qualifying-salary.json";
import policy from "@/data/raw/policy-risks.json";
import { getRole } from "@/lib/data/careers-db";
import { getResultsData } from "@/lib/data/results";
import { epFloor } from "@/lib/ep";
import type { PlanAnswers } from "@/lib/plan-storage";
import { supabase } from "@/lib/supabase";
import { sourceKey } from "./tools";
import type { SourceRef } from "./types";

// The official quotes behind an adviser's claims, for Make It Fail (lib/agent/audit.ts), collected by each claim's
// SourceRef: a programme's evidence rows in Supabase (programme_evidence: the page's own words, where it was read and
// whether the quote was found verbatim) and the quotes its admitted range was worked out from; a graduate survey's
// record (data/raw/employment.json); MOM's EP table (data/raw/ep-qualifying-salary.json); a role's career facts
// (lib/data/careers-db.ts getFacts, through getRole); a visa rule (data/raw/policy-risks.json). Quotes only, as stored:
// the auditor judges them, nothing here does.

export type Evidence = {
  /** sourceKey of the SourceRef it backs. */
  key: string;
  /** What it is: "programme X, field ielts", "PEI GES 2024/25", … */
  label: string;
  quote: string;
  url: string | null;
  /** When the page was read or the source published (YYYY-MM-DD), when known. */
  date: string | null;
  /** The quote was found verbatim on the page; null when that wasn't checked. */
  verified: boolean | null;
};

/** The evidence field a claim may name, as programme_evidence stores it. */
const FIELD: Record<string, string> = {
  ielts: "ielts",
  english: "ielts",
  toefl: "toefl",
  pte: "pte",
  fee: "tuition",
  fees: "tuition",
  tuition: "tuition",
  duration: "duration",
  months: "duration",
  length: "duration",
  intake: "intakes",
  intakes: "intakes",
  deadline: "intakes",
  start: "intakes",
  academic: "academicRequirement",
  academicrequirement: "academicRequirement",
  gpa: "academicRequirement",
  grade: "academicRequirement",
  requirement: "academicRequirement",
  background: "background",
  gre: "gre",
  gmat: "gmat",
  mode: "studyMode",
  studymode: "studyMode",
  name: "name",
};
const fieldOf = (f: string | undefined) => (f ? (FIELD[f.toLowerCase().replace(/[^a-z]/g, "")] ?? f) : null);

/** Per programme: at most this many evidence rows when the claim names no field. */
const ROWS_PER_PROGRAMME = 8;
const UNNAMED = ["academicRequirement", "ielts", "tuition", "duration", "intakes", "background", "gre", "gmat"];

type EvidenceRow = { programme_id: string; field: string; value: string | null; verbatim_quote: string; source_url: string; quote_verified: boolean; retrieved_at: string };

async function programmeEvidence(refs: SourceRef[]): Promise<Evidence[]> {
  if (!refs.length) return [];
  const ids = [...new Set(refs.map((r) => r.id))];
  const [{ data, error }, results] = await Promise.all([
    supabase().from("programme_evidence").select("programme_id,field,value,verbatim_quote,source_url,quote_verified,retrieved_at").in("programme_id", ids).order("id").limit(600),
    getResultsData(),
  ]);
  if (error) throw new Error(`programme_evidence: ${error.message}`);
  const rows = (data ?? []) as EvidenceRow[];
  const out: Evidence[] = [];
  for (const id of ids) {
    const key = sourceKey({ kind: "programme", id });
    const fields = new Set(refs.filter((r) => r.id === id).map((r) => fieldOf(r.field)));
    const all = fields.has(null);
    const own = rows.filter((r) => r.programme_id === id && (fields.has(r.field) || (all && UNNAMED.includes(r.field))));
    const seen = new Set<string>();
    for (const r of own) {
      if (seen.has(r.verbatim_quote) || (all && out.filter((e) => e.key === key).length >= ROWS_PER_PROGRAMME)) continue;
      seen.add(r.verbatim_quote);
      out.push({ key, label: `programme ${id}, field ${r.field}${r.value ? ` (read as: ${r.value.slice(0, 80)})` : ""}`, quote: r.verbatim_quote.slice(0, 600), url: r.source_url, date: r.retrieved_at, verified: r.quote_verified });
    }
    // The quotes its admitted range was worked out from (lib/admit-range.ts), with the page's own name.
    const p = results.programmes.find((q) => q.id === id);
    if (!p) continue;
    out.push({ key, label: `programme ${id}: its name and university`, quote: `${p.name}, ${results.universities[p.u].name} (${p.campus?.country ?? results.universities[p.u].country})`, url: p.url, date: p.checked, verified: null });
    for (const f of p.range.from) {
      if (f.k === "stated") out.push({ key, label: `programme ${id}: who it admits, in its own words`, quote: f.quote, url: f.url, date: p.checked, verified: null });
      if (f.k === "competitive") out.push({ key, label: `programme ${id}: its wording on competition`, quote: f.quote, url: p.url, date: p.checked, verified: null });
    }
  }
  return out;
}

type EmploymentRecord = { id: string; cohort?: string; source?: string; verbatimQuote?: string };
const SURVEYS = employment.sources as Record<string, { name: string; url: string; published?: string }>;
const RECORDS = new Map((employment.records as EmploymentRecord[]).map((r) => [r.id, r]));

function employmentEvidence(refs: SourceRef[]): Evidence[] {
  return refs.flatMap((r) => {
    const rec = RECORDS.get(r.id);
    if (!rec?.verbatimQuote) return [];
    const src = rec.source ? SURVEYS[rec.source] : undefined;
    return [{ key: sourceKey(r), label: `${src?.name ?? "graduate survey"}, cohort ${rec.cohort ?? "?"}`, quote: rec.verbatimQuote, url: src?.url ?? null, date: src?.published ?? employment.retrievedAt, verified: null }];
  });
}

/** MOM's quote, and the table's row for the student's age as copied from the page (four figures: two sectors, two schedules). */
function epEvidence(refs: SourceRef[], a: PlanAnswers): Evidence[] {
  if (!refs.length) return [];
  const key = sourceKey({ kind: "ep", id: "ep" });
  const g = epFloor(a, false);
  const age = g.age ?? 23;
  const i = age - 23;
  const row = `Age ${age}${age === 23 ? " or below" : age === 45 ? " and above" : ""}: other sectors S$${epTable.general.current[i]} (applications before 1 Jan 2027), S$${epTable.general.from2027[i]} (from 1 Jan 2027); financial services S$${epTable.financial.current[i]} and S$${epTable.financial.from2027[i]}.`;
  return [
    { key, label: "MOM, EP qualifying salary", quote: epTable.quote, url: epTable.url, date: epTable.read, verified: null },
    { key, label: "MOM's EP qualifying salary by age table, as copied", quote: row, url: epTable.url, date: epTable.read, verified: null },
  ];
}

async function careerEvidence(refs: SourceRef[]): Promise<Evidence[]> {
  const roles = await Promise.all([...new Set(refs.map((r) => r.id))].map(async (id) => ({ id, role: await getRole(id) })));
  return roles.flatMap(({ id, role }) => {
    if (!role) return [];
    const key = sourceKey({ kind: "career", id });
    const facts = role.facts.slice(0, 4).map((f) => ({ key, label: `${role.title}: ${f.fact.metric} (${f.fact.publisher})`, quote: f.fact.quote.slice(0, 600), url: f.fact.url, date: f.fact.publishedOn, verified: null }));
    const skills = { key, label: `${role.title}: the skills the Skills Framework lists`, quote: role.skills.map((s) => `${s.skill} (level ${s.level})`).join("; "), url: null, date: null, verified: null };
    return [...facts, skills];
  });
}

type Rule = { id: string; rule: string; effect?: string; sources: string[] };

function policyEvidence(refs: SourceRef[]): Evidence[] {
  return refs.flatMap((r) => {
    const rule = (policy.rules as Rule[]).find((x) => x.id === r.id);
    return rule ? [{ key: sourceKey(r), label: `visa rule ${rule.id}`, quote: `${rule.rule}${rule.effect ? ` ${rule.effect}` : ""}`.slice(0, 800), url: rule.sources[0] ?? null, date: policy.checked, verified: null }] : [];
  });
}

/** Every quote behind these sources, in the order of their kinds. A source with nothing behind it simply has no evidence. */
export async function collectEvidence(refs: SourceRef[], answers: PlanAnswers): Promise<Evidence[]> {
  const of = (k: SourceRef["kind"]) => refs.filter((r) => r.kind === k);
  const [programmes, careers] = await Promise.all([programmeEvidence(of("programme")), careerEvidence(of("career"))]);
  return [...programmes, ...employmentEvidence(of("employment")), ...epEvidence(of("ep"), answers), ...careers, ...policyEvidence(of("policy"))];
}
