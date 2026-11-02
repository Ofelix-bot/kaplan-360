// Loads data/raw/admit-model.json into Supabase (tables from 20261101120000_programme_admit_model.sql).
// Run with: npm run data:load-admit   (add -- --dry-run to print counts only)
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local. Rows are replaced as a whole, so re-runs are safe.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
try { process.loadEnvFile?.(new URL("../../.env.local", import.meta.url)); } catch (e) { if (!DRY) throw e; }
const model = JSON.parse(readFileSync(new URL("../../data/raw/admit-model.json", import.meta.url), "utf8"));
const programmes = new Set(JSON.parse(readFileSync(new URL("../../data/raw/programmes.json", import.meta.url), "utf8")).programmes.map((p) => p.id));

const rows = Object.entries(model.programmes)
  .filter(([id]) => programmes.has(id))
  .map(([id, v]) => ({
    programme_id: id, k: v.k, k_se: v.kSe, theta: v.theta, theta_se: v.thetaSe, s: v.s, c: v.c,
    cluster: v.cluster, bg_factor: v.bgFactor, n_cases: v.n, basis: v.basis, no_case_yet: v.noCaseYet,
    subject_rank_qs: v.subjectRank?.qs ?? null, subject_rank_gras: v.subjectRank?.gras ?? null,
    applications_per_place: v.applicationsPerPlace, experience_class: v.experienceClass,
    floor_level: v.floor ?? null, main_level: v.mainRequirement ?? null, floor_band_factor: v.floorBandFactor ?? null,
    policy_risks: v.policyRisks ?? [], offer_rate: v.offerRate ?? null, offer_rate_from: v.offerRateFrom ?? null,
    official_unit: v.officialUnit ?? null, built_at: model.builtAt,
  }));
const params = { id: "current", params: { method: model.method, fit: model.fit, global: model.global, counts: model.counts }, built_at: model.builtAt };

console.log(`programme_admit_model: ${rows.length} rows (${Object.entries(model.counts).map(([k, n]) => `${k} ${n}`).join(", ")})`);
if (DRY) process.exit(0);

const { NEXT_PUBLIC_SUPABASE_URL: URL_, SUPABASE_SECRET_KEY: KEY } = process.env;
if (!URL_ || !KEY) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
const db = createClient(URL_, KEY, { auth: { persistSession: false } });

{
  const { error } = await db.from("programme_admit_model").delete().neq("programme_id", "");
  if (error) throw new Error(`programme_admit_model delete: ${error.message}`);
}
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db.from("programme_admit_model").insert(rows.slice(i, i + 500), { defaultToNull: false });
  if (error) throw new Error(`programme_admit_model: ${error.message}`);
}
{
  const { error } = await db.from("admit_model_params").upsert([params], { onConflict: "id" });
  if (error) throw new Error(`admit_model_params: ${error.message}`);
}
console.log("loaded.");
