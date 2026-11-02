// A lenient module → skill pass (2026-11-02, the user's choice): the match counts every skill SWDA's Skills
// Framework lists for a role, and the strict links left most of them uncovered. Claude links each Kaplan
// degree's modules (core and elective) to the SWDA skills of every role in the degree's industries (linked, and
// adjacent: linked to another degree of its discipline) when the module teaches or practises a real part of the
// skill (moderately lenient: groundwork alone does not count; at most PER_MODULE skills a module). Only module and skill names that exist are kept. Existing links stay; the pass only
// adds. Writes data/pipeline/careers/lenient-links.json (one entry per degree × industry, resumable);
// --merge adds them to data/raw/careers-degree-skills.json as basis "claude".
// Usage: npx tsx --env-file=.env.local scripts/careers/link-lenient.ts [--only=id,id] [--merge] [--dry]

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "data/pipeline/careers/lenient-links.json");
const DS_FILE = path.join(ROOT, "data/raw/careers-degree-skills.json");
const MODEL = "claude-opus-5-5";
const PRICE = { input: 5 / 1e6, output: 25 / 1e6 }; // USD per token, an upper estimate
const CAP_USD = 8;

type DsRow = { programme_id: string; skill: string; module: string; module_kind: "core" | "elective"; basis: "rule" | "claude"; model: string | null };
type Entry = { programme_id: string; industry_id: string; links: { module: string; skills: string[] }[]; usage: { input: number; output: number } };

const argv = process.argv.slice(2);
const only = argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? null;
const read = <T,>(f: string): T => JSON.parse(readFileSync(path.join(ROOT, f), "utf8")) as T;
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

async function db<T>(table: string, select: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase URL and public key are needed in .env.local");
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${url}/rest/v1/${table}?select=${select}&offset=${from}&limit=1000`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status}`);
    const page = (await r.json()) as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const TOOL: Anthropic.Tool = {
  name: "links",
  description: "Every module that touches a skill, with the skills it touches.",
  input_schema: {
    type: "object",
    properties: {
      links: {
        type: "array",
        items: {
          type: "object",
          properties: { module: { type: "string" }, skills: { type: "array", items: { type: "string" } } },
          required: ["module", "skills"],
          additionalProperties: false,
        },
      },
    },
    required: ["links"],
    additionalProperties: false,
  },
};

/** At most this many skills per module, the most relevant first (moderately lenient, the user's pick on 2026-11-02). */
const PER_MODULE = 8;

const SYSTEM = `You link university modules to Skills Framework (Singapore, SWDA) skills, moderately leniently.
Link a module to a skill when the module actually teaches or practises a real part of that skill: partial coverage counts, but the module must do some of the skill itself. Background knowledge, general groundwork or skills merely touched along the way do NOT count.
Examples that count: Corporate Finance → Budgeting; Business Analytics → Data Collection and Analysis; Managing People at Work → People and Performance Management.
Examples that do not: Digital Business → Business Process Re-engineering (only mentioned); Introduction to Finance → Personal Finance Advisory (different practice); Statistics → Data Engineering.
Give each module at most ${PER_MODULE} skills, the most relevant first; a module may have fewer or none.
Use module names and skill names exactly as given; never invent either. Answer only by calling the links tool once, covering every module.`;

async function main() {
  const topupsRaw = read<unknown>("data/raw/topups.json");
  const topups = (Array.isArray(topupsRaw) ? topupsRaw : ((topupsRaw as { programmes?: unknown[] }).programmes ?? Object.values(topupsRaw as object))) as { id: string; kaplanId?: string; coreModules?: string[]; electiveModules?: string[] }[];
  const kaplan = read<{ programmes: { id: string; discipline: string }[] }>("data/raw/kaplan-programmes.json");
  const ds = read<{ built: string; rows: DsRow[] }>("data/raw/careers-degree-skills.json");
  const degreeIds = [...new Set(ds.rows.map((r) => r.programme_id))];
  const disc = new Map(kaplan.programmes.map((p) => [p.id, p.discipline]));

  const [links, roles, skills] = await Promise.all([
    db<{ programme_id: string; industry_id: string }>("career_degree_industries", "programme_id,industry_id"),
    db<{ id: string; industry_id: string }>("career_roles", "id,industry_id"),
    db<{ role_id: string; skill: string }>("career_role_skills", "role_id,skill"),
  ]);
  const industryOfRole = new Map(roles.map((r) => [r.id, r.industry_id]));
  const skillsOf = new Map<string, Set<string>>();
  for (const s of skills) {
    const ind = industryOfRole.get(s.role_id);
    if (ind) (skillsOf.get(ind) ?? skillsOf.set(ind, new Set()).get(ind)!).add(s.skill);
  }
  const degreeDisc = (id: string) => disc.get(id) ?? disc.get(topups.find((t) => t.id === id)?.kaplanId ?? "") ?? null;
  const industriesOf = (id: string) => {
    const d = degreeDisc(id);
    const peers = new Set(degreeIds.filter((x) => x !== id && d && degreeDisc(x) === d));
    return [...new Set(links.filter((l) => l.programme_id === id || peers.has(l.programme_id)).map((l) => l.industry_id))].sort();
  };

  if (argv.includes("--merge")) return merge(ds);

  const done: Entry[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")).entries : [];
  const key = (e: { programme_id: string; industry_id: string }) => `${e.programme_id}|${e.industry_id}`;
  const have = new Set(done.map(key));
  const jobs = degreeIds
    .filter((id) => !only || only.includes(id))
    .flatMap((id) => industriesOf(id).map((industry_id) => ({ programme_id: id, industry_id })))
    .filter((j) => !have.has(key(j)) && (skillsOf.get(j.industry_id)?.size ?? 0) > 0);
  console.log(`${jobs.length} degree × industry pairs to read (${done.length} done before).`);
  if (argv.includes("--dry")) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  let spent = done.reduce((s, e) => s + e.usage.input * PRICE.input + e.usage.output * PRICE.output, 0);
  const save = () => {
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify({ model: MODEL, built: new Date().toISOString().slice(0, 10), entries: done }, null, 1));
  };

  for (const j of jobs) {
    if (spent > CAP_USD) {
      console.log(`Stopped at the US$${CAP_USD} cap.`);
      break;
    }
    const t = topups.find((x) => x.id === j.programme_id)!;
    const modules = [...(t.coreModules ?? []), ...(t.electiveModules ?? [])];
    const skillList = [...skillsOf.get(j.industry_id)!].sort();
    const content = `Modules:\n${modules.map((m) => `- ${m}`).join("\n")}\n\nSkills:\n${skillList.map((s) => `- ${s}`).join("\n")}`;
    try {
      const msg = await client.messages.create({ model: MODEL, max_tokens: 16000, system: SYSTEM, tools: [TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content }] });
      const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      if (!call) throw new Error(`no tool call (stop: ${msg.stop_reason})`);
      // The list sometimes comes back as JSON text rather than an array.
      let got: unknown = (call.input as { links?: unknown }).links;
      if (typeof got === "string") got = JSON.parse(got);
      const raw = (Array.isArray(got) ? got : []) as { module: string; skills: string[] }[];
      const modOk = new Map(modules.map((m) => [norm(m), m]));
      const skillOk = new Map(skillList.map((s) => [norm(s), s]));
      const kept = raw
        .map((l) => ({ module: modOk.get(norm(l.module ?? "")), skills: (l.skills ?? []).map((s) => skillOk.get(norm(s))).filter((s): s is string => !!s) }))
        .map((l) => ({ ...l, skills: l.skills.slice(0, PER_MODULE) }))
        .filter((l): l is { module: string; skills: string[] } => !!l.module && l.skills.length > 0);
      const usage = { input: msg.usage.input_tokens, output: msg.usage.output_tokens };
      spent += usage.input * PRICE.input + usage.output * PRICE.output;
      done.push({ ...j, links: kept, usage });
      save();
      console.log(`${j.programme_id} × ${j.industry_id}: ${kept.reduce((n, l) => n + l.skills.length, 0)} links · US$${spent.toFixed(2)}`);
    } catch (e) {
      console.log(`${j.programme_id} × ${j.industry_id}: failed (${(e as Error).message}); left for the next run`);
    }
  }
}

/** Adds the lenient links to careers-degree-skills.json (basis "claude"), keeping every existing row. */
function merge(ds: { built: string; rows: DsRow[] }) {
  const { entries, model } = JSON.parse(readFileSync(OUT, "utf8")) as { entries: Entry[]; model: string };
  const topupsRaw = read<unknown>("data/raw/topups.json");
  const topups = (Array.isArray(topupsRaw) ? topupsRaw : ((topupsRaw as { programmes?: unknown[] }).programmes ?? Object.values(topupsRaw as object))) as { id: string; coreModules?: string[] }[];
  const seen = new Set(ds.rows.map((r) => `${r.programme_id}|${norm(r.skill)}|${norm(r.module)}`));
  let added = 0;
  for (const e of entries) {
    const core = new Set((topups.find((t) => t.id === e.programme_id)?.coreModules ?? []).map(norm));
    for (const l of e.links)
      for (const skill of l.skills) {
        const k = `${e.programme_id}|${norm(skill)}|${norm(l.module)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        ds.rows.push({ programme_id: e.programme_id, skill, module: l.module, module_kind: core.has(norm(l.module)) ? "core" : "elective", basis: "claude", model });
        added++;
      }
  }
  writeFileSync(DS_FILE, JSON.stringify(ds, null, 1));
  console.log(`Added ${added} links; ${ds.rows.length} in all.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
