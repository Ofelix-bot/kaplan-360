// Class profiles, step 3: Claude (Haiku) reads each profile page and reports, per programme it
// profiles, the figures the page states about the admitted class: size, nationalities and regions,
// undergraduate schools and majors, GPA, GMAT/GRE, work experience, age, gender. Every figure comes
// with the quote it was read from; a quote that is not on the page, or that doesn't contain the
// figure, is dropped. Programmes are matched to data/raw/programmes.json by name within the
// university. Writes data/pipeline/profiles/ai.json (cache) and data/raw/class-profiles.json.
// Usage: npx tsx scripts/pipeline/profile-ai.ts [--only=<university ids>] [--refresh]

import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import path from "node:path";
import { AI_MODEL, FETCH_LOG_FILE, OUTPUT_FILE, ROOT } from "./config";
import type { FetchEntry } from "./fetch";
import { nameMatch, namedByAcronym, pageLines, PROFILE_AI_FILE, PROFILE_ANCHOR, PROFILE_FIGURE, PROFILE_SOURCES_FILE, squash, type ProfilePage } from "./profile-lib";
import { args, keepRunning, pool, readJson, today, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

export const CLASS_PROFILES_FILE = path.join(ROOT, "data", "raw", "class-profiles.json");

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const num = { type: "number" };
const quoted = (value: Record<string, unknown>) => nullable({ type: "object", properties: { value, quote: { type: "string" } }, required: ["value", "quote"], additionalProperties: false });
const named = { type: "array", items: { type: "object", properties: { name: { type: "string" }, pct: nullable(num) }, required: ["name", "pct"], additionalProperties: false } };
const range = (extra: Record<string, unknown> = {}) => {
  const properties = { average: nullable(num), median: nullable(num), low: nullable(num), high: nullable(num), ...extra, quote: { type: "string" } };
  return nullable({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
};

const PROFILE_PROPS = {
  programme: nullable({ type: "string" }),
  scope: { type: "string", enum: ["programme", "school"] },
  intake: quoted({ type: "string" }),
  classSize: quoted(num),
  internationalPct: quoted(num),
  womenPct: quoted(num),
  nationalities: quoted(num),
  regions: quoted(named),
  undergradRegions: quoted(named),
  undergradInstitutionsCount: quoted(num),
  undergradInstitutions: quoted(named),
  majors: quoted(named),
  gpa: range({ scale: nullable(num), label: nullable({ type: "string" }) }),
  gmat: range(),
  gre: range(),
  workYears: quoted(num),
  withWorkPct: quoted(num),
  age: range(),
};

const TOOL: Anthropic.Tool = {
  name: "report_class_profiles",
  description: "Report the class profiles the text gives, one per programme. An empty list when it gives none.",
  // Not strict: the schema has more nullable fields than strict mode allows. verify() checks every value instead.
  input_schema: {
    type: "object",
    properties: { profiles: { type: "array", items: { type: "object", properties: PROFILE_PROPS, required: Object.keys(PROFILE_PROPS), additionalProperties: false } } },
    required: ["profiles"],
    additionalProperties: false,
  },
};

const SYSTEM = `You read text from one official university web page or PDF. Report its class profiles: figures that describe the students enrolled in, or admitted to, a taught master's programme (a class, cohort or intake), often under "Class profile", "Class of 2026", "Our students" or "Cohort".

For each programme the text profiles, give each figure exactly as the text states it, with "quote": a short excerpt copied character for character from the text that contains the figure and its label.

Rules:
- Only what the text states. Do not compute, convert, round or infer. Null for anything not stated.
- Percentages as numbers (64% → 64). A GPA with its scale when the text gives one (3.53/4 → average 3.53, scale 4); "label" for what a GPA range is ("middle 80%", "range").
- regions: students' nationalities or home countries and regions, with a share when given. undergradRegions: where students took their first degree ("first degree from Chinese Mainland 44%"), with a share when given. undergradInstitutions: universities or colleges named as where students studied before, with a share when given; undergradInstitutionsCount: how many such institutions are represented (not countries). majors: undergraduate subjects or backgrounds, with a share when given. A share stated in words ("nearly half") goes into the name.
- intake: the year or class the figures describe ("Class of 2026", "2024/25 intake"), when stated.
- scope "school" when the figures describe several programmes or all of a school's master's students together; programme is then the school or group as named.
- Not class profiles: entry requirements (a minimum GPA, IELTS or GMAT), graduation rules, module class sizes, intake targets or quotas, university-wide figures ("students from 120 countries"), employment outcomes, faculty, and stories of individual students (a name, a country and "Class of 2025" is not a profile).`;

type Quoted<T> = { value: T; quote: string } | null;
type Named = { name: string; pct: number | null }[];
type Range = { average: number | null; median: number | null; low: number | null; high: number | null; quote: string } | null;
type RawProfile = {
  programme: string | null;
  scope: "programme" | "school";
  intake: Quoted<string>;
  classSize: Quoted<number>;
  internationalPct: Quoted<number>;
  womenPct: Quoted<number>;
  nationalities: Quoted<number>;
  regions: Quoted<Named>;
  undergradRegions: Quoted<Named>;
  undergradInstitutionsCount: Quoted<number>;
  undergradInstitutions: Quoted<Named>;
  majors: Quoted<Named>;
  gpa: (Range & { scale: number | null; label: string | null }) | null;
  gmat: Range;
  gre: Range;
  workYears: Quoted<number>;
  withWorkPct: Quoted<number>;
  age: Range;
};

export type ClassProfile = Omit<RawProfile, "programme"> & {
  institutionId: string;
  programmeIds: string[];
  /** The programme or group as the page names it. */
  programmeName: string | null;
  url: string;
  checked: string;
};

type Cached = { url: string; extractedAt: string; profiles: RawProfile[]; dropped: string[]; usage: { input: number; output: number } };

const numbersIn = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, "")));

/** The figure is in its quote (64 in "64% female"; 3.53 in "average GPA of 3.53"). */
const inQuote = (v: number, quote: string) => numbersIn(quote).some((n) => Math.abs(n - v) < 1e-9);

/** Keeps only what the page supports: quotes found on the page, figures found in their quotes, names found in theirs. */
function verify(p: RawProfile, page: string, dropped: string[]): RawProfile {
  const onPage = (q: string) => q.trim().length >= 3 && page.includes(squash(q));
  const out = { ...p };
  for (const k of ["intake", "classSize", "internationalPct", "womenPct", "nationalities", "undergradInstitutionsCount", "workYears", "withWorkPct"] as const) {
    const f = p[k] as Quoted<number | string>;
    if (!f) continue;
    const ok =
      onPage(f.quote) &&
      (typeof f.value === "string" ? squash(f.quote).includes(squash(f.value)) || /20\d\d/.test(f.value) : inQuote(f.value, f.quote)) &&
      // A count of countries ("Countries of 1st Degree Institution 7") is not a count of institutions.
      !(k === "undergradInstitutionsCount" && /countr|region|nationalit/i.test(f.quote));
    if (!ok) {
      dropped.push(`${k}: ${JSON.stringify(f).slice(0, 160)}`);
      (out as Record<string, unknown>)[k] = null;
    }
  }
  for (const k of ["regions", "undergradRegions", "undergradInstitutions", "majors"] as const) {
    const f = p[k];
    if (!f) continue;
    if (!onPage(f.quote)) {
      dropped.push(`${k}: quote not on page`);
      out[k] = null;
      continue;
    }
    // Each name must be on the page; a share must be in the quote.
    const kept = f.value.filter((x) => page.includes(squash(x.name.replace(/\s*\(.*\)$/, ""))) && (x.pct === null || inQuote(x.pct, f.quote) || page.includes(`${x.pct}%`)));
    if (kept.length < f.value.length) dropped.push(`${k}: ${f.value.length - kept.length} names not on the page`);
    out[k] = kept.length ? { value: kept, quote: f.quote } : null;
  }
  for (const k of ["gpa", "gmat", "gre", "age"] as const) {
    const f = p[k];
    if (!f) continue;
    const values = [f.average, f.median, f.low, f.high].filter((v): v is number => v !== null);
    if (!onPage(f.quote) || !values.length || !values.every((v) => inQuote(v, f.quote))) {
      dropped.push(`${k}: ${JSON.stringify(f).slice(0, 160)}`);
      out[k] = null;
    }
  }
  return out;
}

const FIGURES = ["classSize", "internationalPct", "womenPct", "nationalities", "regions", "undergradRegions", "undergradInstitutionsCount", "undergradInstitutions", "majors", "gpa", "gmat", "gre", "workYears", "withWorkPct", "age"] as const;
const hasFigures = (p: RawProfile) => FIGURES.some((k) => p[k] !== null);

/** The lines to send: the profile part of an inline page (from its heading), or a profile page's lines near its figures. */
function excerpt(lines: string[], page: ProfilePage, maxChars = 14_000): string {
  if (page.anchor) {
    const at = Math.max(0, lines.indexOf(page.anchor));
    return lines.slice(Math.max(0, at - 3), at + 60).join("\n").slice(0, maxChars);
  }
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (PROFILE_ANCHOR.test(l) || PROFILE_FIGURE.test(l) || /\d{1,3}\s?%/.test(l)) for (let j = Math.max(0, i - 4); j <= Math.min(lines.length - 1, i + 6); j++) keep.add(j);
  });
  // A short page goes whole; a long one, the parts around its figures.
  const picked = lines.join("\n").length <= maxChars ? lines : [...keep].sort((a, b) => a - b).map((i) => lines[i]);
  return picked.join("\n").slice(0, maxChars);
}

async function main() {
  const a = args();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const pages = readJson<{ pages: ProfilePage[] }>(PROFILE_SOURCES_FILE, { pages: [] }).pages.filter((p) => !a.only || a.only.includes(p.institutionId));
  const log = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
  const programmes = readJson<{ programmes: { id: string; institutionId: string; name: string }[] }>(OUTPUT_FILE, { programmes: [] }).programmes;
  const cache = readJson<Record<string, Cached>>(PROFILE_AI_FILE, {});
  const keyOf = (p: ProfilePage) => (p.anchor ? `${p.url}#${p.anchor}` : p.url);
  const todo = pages.filter((p) => log[p.url]?.ok && log[p.url].file && existsSync(log[p.url].file!) && (a.refresh || !cache[keyOf(p)]));
  console.log(`Claude reads ${todo.length} profile pages (${AI_MODEL})…`);
  let input = 0;
  let output = 0;
  let done = 0;
  await pool(todo, 4, async (page) => {
    try {
      const lines = await pageLines(page.url, log[page.url].file!);
      const text = excerpt(lines, page);
      const msg = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: `Page: ${page.url}\n\n${text}` }],
      });
      input += msg.usage.input_tokens;
      output += msg.usage.output_tokens;
      const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      const raw = ((call?.input ?? {}) as { profiles?: RawProfile[] }).profiles ?? [];
      const whole = squash(lines.join(" "));
      const dropped: string[] = [];
      const profiles = raw.map((p) => verify(p, whole, dropped)).filter(hasFigures);
      cache[keyOf(page)] = { url: page.url, extractedAt: today(), profiles, dropped, usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens } };
      console.log(`${page.institutionId.slice(0, 24).padEnd(24)} ${String(profiles.length).padStart(2)} profiles · ${dropped.length} dropped · ${page.url.slice(0, 90)}`);
    } catch (e) {
      console.log(`${page.institutionId.slice(0, 24).padEnd(24)} error: ${(e as Error).message.slice(0, 160)} · ${page.url.slice(0, 80)}`);
    }
    if (++done % 10 === 0) writeJson(PROFILE_AI_FILE, cache);
  });
  writeJson(PROFILE_AI_FILE, cache);

  // Match each profile to the university's programmes by name; the programme whose page holds it is the fallback.
  const all = readJson<{ pages: ProfilePage[] }>(PROFILE_SOURCES_FILE, { pages: [] }).pages;
  const out: ClassProfile[] = [];
  for (const page of all) {
    const c = cache[keyOf(page)];
    if (!c) continue;
    const mine = programmes.filter((p) => p.institutionId === page.institutionId);
    for (const p of c.profiles) {
      let ids: string[] = [];
      if (p.scope === "programme" && p.programme) {
        const scored = mine
          .map((m) => ({ id: m.id, s: namedByAcronym(p.programme!, m.name) ? 1 : nameMatch(p.programme!, m.name) }))
          .filter((x) => x.s >= 0.6)
          .sort((x, y) => y.s - x.s);
        if (scored.length) ids = scored.filter((x) => x.s === scored[0].s).map((x) => x.id);
      }
      if (!ids.length && p.scope === "programme" && page.programmeIds.length === 1) ids = page.programmeIds;
      const { programme, ...rest } = p;
      out.push({ ...rest, institutionId: page.institutionId, programmeIds: ids, programmeName: programme, url: page.url, checked: c.extractedAt });
    }
  }
  writeJson(CLASS_PROFILES_FILE, {
    dataset: "Class profiles from official programme pages",
    builtAt: today(),
    notes: [
      "Figures describe a programme's admitted or enrolled class as its official page or brochure states them: read by Claude (Haiku), each with the quote it came from, checked word for word against the page. Unchecked figures are dropped.",
      "scope = school: the figures cover several programmes or a school's master's students together. programmeIds is empty when the programme isn't in data/raw/programmes.json yet.",
    ],
    counts: { profiles: out.length, matched: out.filter((p) => p.programmeIds.length).length, programmes: new Set(out.flatMap((p) => p.programmeIds)).size },
    profiles: out,
  });
  console.log(`Profiles: ${out.length} · matched to programmes: ${out.filter((p) => p.programmeIds.length).length} · tokens in ${input} out ${output} · cost ≈ US$${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)}`);
}

keepRunning();
main();
