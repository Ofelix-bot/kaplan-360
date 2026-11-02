// Loads the finder's subject strength, industry recognition and badges into Supabase (tables and columns from
// 20261102120000_finder_standing.sql): data/raw/subject-strength.json (scripts/admit-model/subject_strength.py),
// qs-employer-2027.json (import-qs-employer.mjs), compass-top-tier.json (compass-top-tier.py) and
// professional-badges.json (professional-badges.mjs).
// Run with: npm run data:load-standing   (add -- --dry-run to print counts only)
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local. The two tables are replaced as a whole and the
// four institution columns rewritten (other columns untouched), so re-runs are safe. Ids missing from the database
// are skipped and listed.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
try { process.loadEnvFile?.(new URL("../../.env.local", import.meta.url)); } catch (e) { if (!DRY) throw e; }
const raw = (f) => JSON.parse(readFileSync(new URL(`../../data/raw/${f}`, import.meta.url), "utf8"));
const subjects = raw("subject-strength.json");
const employer = raw("qs-employer-2027.json");
const compass = raw("compass-top-tier.json");
const badges = raw("professional-badges.json");

const standing = Object.entries(subjects.institutions).flatMap(([institution_id, ds]) =>
  Object.entries(ds).map(([discipline_id, s]) => ({
    institution_id, discipline_id,
    qs_rank: s.qs?.rank ?? null, qs_rank_value: s.qs?.v ?? null, qs_subject: s.qs?.subject ?? null,
    gras_rank: s.gras?.rank ?? null, gras_rank_value: s.gras?.v ?? null,
    employer_score: s.employer?.score ?? null, employer_rank: s.employer?.rank ?? null, employer_subject: s.employer?.subject ?? null,
  })),
);
const badgeRows = Object.entries(badges.programmes).flatMap(([programme_id, list]) =>
  list.map((b) => ({ programme_id, kind: b.kind, body: b.body, note: b.note, url: b.url })),
);
const instIds = new Set([...Object.keys(employer.universities), ...Object.keys(compass.institutions)]);
const instRow = (id) => {
  const e = employer.universities[id];
  const c = compass.institutions[id];
  return {
    qs_employer_score: e?.score ?? null, qs_employer_rank: e?.rank ?? null,
    compass_group: c?.group ?? null, compass_faculties: c?.group === "B" ? c.faculties : null,
  };
};
const sources = {
  id: "current",
  sources: {
    subjects: subjects.sources,
    employer: { title: employer.dataset, url: employer.source, dataFile: employer.dataFile, retrievedAt: employer.retrievedAt, licence: employer.licence },
    compass: compass.source,
    badges: { checked: badges.checked, rules: badges.rules },
  },
  built_at: new Date().toLocaleDateString("sv-SE"),
};

console.log(`institution_subject_standing: ${standing.length} rows; programme_badges: ${badgeRows.length}; institutions to update: ${instIds.size}`);
if (DRY) process.exit(0);

const { NEXT_PUBLIC_SUPABASE_URL: URL_, SUPABASE_SECRET_KEY: KEY } = process.env;
if (!URL_ || !KEY) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
const db = createClient(URL_, KEY, { auth: { persistSession: false } });

async function ids(table) {
  const out = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("id").order("id").range(from, from + 999);
    if (error) throw new Error(`${table} select: ${error.message}`);
    data.forEach((r) => out.add(r.id));
    if (data.length < 1000) return out;
  }
}
async function replace(table, key, rows) {
  const { error } = await db.from(table).delete().neq(key, "");
  if (error) throw new Error(`${table} delete: ${error.message}`);
  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await db.from(table).insert(rows.slice(i, i + 500), { defaultToNull: false });
    if (e) throw new Error(`${table}: ${e.message}`);
  }
  console.log(`${table}: ${rows.length}`);
}
const skipped = (what, list) => list.length && console.log(`${what} not in the database, skipped (${list.length}): ${list.slice(0, 20).join(", ")}${list.length > 20 ? " …" : ""}`);

const inDb = await ids("institutions");
const progDb = await ids("programmes");
skipped("institutions (standing)", [...new Set(standing.filter((r) => !inDb.has(r.institution_id)).map((r) => r.institution_id))]);
skipped("programmes (badges)", badgeRows.filter((r) => !progDb.has(r.programme_id)).map((r) => r.programme_id));
await replace("institution_subject_standing", "institution_id", standing.filter((r) => inDb.has(r.institution_id)));
await replace("programme_badges", "programme_id", badgeRows.filter((r) => progDb.has(r.programme_id)));

// The four columns: cleared where set, then written for every university with a figure or a listing.
{
  const cleared = { qs_employer_score: null, qs_employer_rank: null, compass_group: null, compass_faculties: null };
  const { error } = await db.from("institutions").update(cleared).or("qs_employer_score.not.is.null,compass_group.not.is.null");
  if (error) throw new Error(`institutions clear: ${error.message}`);
}
const todo = [...instIds].filter((id) => inDb.has(id));
skipped("institutions (employer/COMPASS)", [...instIds].filter((id) => !inDb.has(id)));
for (let i = 0; i < todo.length; i += 25) {
  const results = await Promise.all(todo.slice(i, i + 25).map((id) => db.from("institutions").update(instRow(id)).eq("id", id)));
  const bad = results.find((r) => r.error);
  if (bad) throw new Error(`institutions update: ${bad.error.message}`);
}
console.log(`institutions: ${todo.length} updated`);

{
  const { error } = await db.from("finder_standing_sources").upsert(sources, { onConflict: "id" });
  if (error) throw new Error(`finder_standing_sources: ${error.message}`);
}
console.log("finder_standing_sources: 1");
