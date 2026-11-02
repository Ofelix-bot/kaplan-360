// The academic entry requirement, read again by Claude (Haiku) for the programmes whose requirement the rules found
// (added 2026-11-01: in two sample checks about a quarter of the rules' requirements were the wrong sentence: a route
// for the university's own or the country's own degree holders, a shortened version's entry, a ranking method, a
// sentence cut off). Claude copies the requirement for international applicants to the standard programme word for
// word and says whom it applies to; it is kept only when it is on the page verbatim and applies to all or to
// international applicants. A page that gives none is recorded too, so build.ts shows no requirement rather than the
// rules' sentence. Writes data/pipeline/ai-requirements.json, which build.ts prefers over the rules.
// Usage: npx tsx scripts/pipeline/requirement-ai.ts --only=<ids> [--refresh]

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AI_MODEL, DATA_DIR, EXTRACTED_FILE, FETCH_LOG_FILE, INSTITUTIONS_FILE } from "./config";
import { pageText, type PageText } from "./extract-lib";
import type { ExtractedRecord } from "./extract";
import type { FetchEntry } from "./fetch";
import { args, pool, readJson, today, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

export const REQUIREMENTS_FILE = path.join(DATA_DIR, "ai-requirements.json");

export type RequirementResult = {
  base: string;
  source: string;
  model: string;
  extractedAt: string;
  /** The requirement as the page gives it, or null when the page gives none for international applicants. */
  requirement: string | null;
  url: string | null;
  /** Why a requirement was not kept ("applies to …", "not on the page verbatim", "not stated"). */
  dropped: string | null;
  usage: { input: number; output: number };
};

const TOOL: Anthropic.Tool = {
  name: "entry_requirement",
  description: "The academic entry requirement this programme page states.",
  input_schema: {
    type: "object",
    properties: {
      requirement: {
        type: ["string", "null"],
        description:
          "The academic entry requirement for applicants to the standard (full-length) programme, copied exactly from the page: one to three consecutive sentences naming the qualification needed (degree, subject, grade, GPA or credits). null when the page states none.",
      },
      appliesTo: {
        type: "string",
        enum: ["all applicants", "international applicants", "the university's own graduates", "holders of the country's own degrees", "a shortened or accelerated version", "something else"],
        description: "Whom the copied requirement is for, as the page says.",
      },
    },
    required: ["requirement", "appliesTo"],
  },
};

const INSTRUCTIONS = `You read official university programme pages for a study-planning tool for international students in Singapore.
Copy the programme's academic entry requirement exactly as written: the sentence(s) that say which bachelor's degree (subject, grade, GPA, credits) an applicant needs.
When the page gives several routes, copy the one for international applicants or for all applicants with a bachelor's degree from another university, not the route for the university's own graduates, for holders of the country's own named degrees, for a list of named degrees that qualify automatically ("If you have completed one of the following bachelor's degrees … you automatically fulfil …": copy the rule for other degrees instead), or for a shortened, accelerated or advanced-standing version.
Never copy: a lead-in that ends before the requirement ("Applicants must prove the following:"), an English language rule, a ranking or selection method, a description of the course, or a list heading.
Copy the words exactly, including punctuation; do not join text from different parts of the page; do not shorten words. If the page states no academic requirement, give null.`;

const squash = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

/** Words of an entry requirement and of its section headings. */
const ENTRY = /(entry|admission|eligib|requirement|applicant|apply|bachelor|undergraduate|degree|honou?rs|gpa|cgpa|grade|average|ects|credits?|qualification|equivalent|prerequisite|who (is it|can apply)|background)/i;

/** The page's lines around requirement words (±3 lines), at most `maxChars`. */
function requirementContext(pages: PageText[], maxChars = 12000): string {
  let size = 0;
  return pages
    .map((p) => {
      const keep = new Set<number>();
      p.lines.forEach((l, i) => {
        if (!ENTRY.test(l) || l.length > 900) return;
        for (let j = Math.max(0, i - 3); j <= Math.min(p.lines.length - 1, i + 3); j++) {
          if (keep.has(j)) continue;
          if (size + p.lines[j].length + 1 > maxChars) return;
          keep.add(j);
          size += p.lines[j].length + 1;
        }
      });
      return [`[page: ${p.url}]`, ...[...keep].sort((a, b) => a - b).map((i) => p.lines[i])].join("\n");
    })
    .join("\n");
}

async function main() {
  const a = args();
  if (!a.only) throw new Error("Pass --only=<university ids>");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });

  const extracted = readJson<ExtractedRecord[]>(EXTRACTED_FILE, []);
  const log = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
  const roster = readJson<{ institutions: { id: string; country: string | null }[] }>(INSTITUTIONS_FILE, { institutions: [] });
  const countryOf = new Map(roster.institutions.map((r) => [r.id, r.country]));
  const prev = readJson<Record<string, RequirementResult>>(REQUIREMENTS_FILE, {});

  // Programmes in the data whose requirement came from the rules.
  const todo = extracted
    .filter((r) => r.result?.discipline && r.result.degreeType && r.result.academic && r.pages.length)
    .filter((r) => a.only!.includes(r.source))
    .filter((r) => a.refresh || !prev[r.base])
    .filter((r) => r.pages.every((u) => log[u]?.file));
  console.log(`Claude reads the entry requirement of ${todo.length} programmes (${AI_MODEL})…`);

  let input = 0, output = 0, kept = 0, none = 0, rejected = 0, failed = 0, done = 0;
  await pool(todo, 4, async (r) => {
    try {
      const pages = r.pages.map((url) => pageText({ url, html: readFileSync(log[url].file!, "utf8") }));
      const msg = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 600,
        system: INSTRUCTIONS,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: `Programme: ${r.result!.name}\nCountry: ${countryOf.get(r.source) ?? "unknown"}\n\nPage text:\n${requirementContext(pages)}` }],
      });
      input += msg.usage.input_tokens;
      output += msg.usage.output_tokens;
      const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      const v = (call?.input ?? {}) as { requirement?: string | null; appliesTo?: string };
      const text = typeof v.requirement === "string" ? v.requirement.trim() : "";
      const page = text ? pages.find((p) => squash(p.lines.join(" ")).includes(squash(text))) : undefined;
      let requirement: string | null = null;
      let dropped: string | null = null;
      if (!text) dropped = "not stated";
      else if (!page) dropped = "not on the page verbatim";
      else if (v.appliesTo !== "all applicants" && v.appliesTo !== "international applicants") dropped = `applies to ${v.appliesTo ?? "unknown"}`;
      else requirement = text;
      if (requirement) kept++;
      else if (dropped === "not stated") none++;
      else rejected++;
      prev[r.base] = { base: r.base, source: r.source, model: AI_MODEL, extractedAt: today(), requirement, url: page?.url ?? null, dropped, usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens } };
    } catch (e) {
      failed++;
      console.log(`${r.source.slice(0, 12).padEnd(12)} ${String(r.result?.name).slice(0, 48).padEnd(48)} error: ${(e as Error).message.slice(0, 200)}`);
    }
    if (++done % 25 === 0) writeJson(REQUIREMENTS_FILE, prev);
  });
  writeJson(REQUIREMENTS_FILE, prev);
  console.log(`kept ${kept} · none on the page ${none} · not kept ${rejected} · failed ${failed}`);
  console.log(`Tokens: input ${input}, output ${output} · cost ≈ US${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)} (Haiku 5.5: $0.10 / $0.50 per MTok)`);
}

// Run only when executed directly: build.ts imports this file for its types.
if (process.argv[1]?.endsWith("requirement-ai.ts")) main();
