// Names for programme pages the rules could not name (headings that aren't "Master of …", Chinese
// titles first, generic page titles): Claude (Haiku) copies the programme's English name from the
// page, and the name is kept only when it appears there word for word. Run after extract.ts, then
// run extract.ts again to apply the names. Writes data/pipeline/ai-names.json.
// Usage: npx tsx scripts/pipeline/name-ai.ts --only=<ids>

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AI_MODEL, DATA_DIR, EXTRACTED_FILE, FETCH_LOG_FILE } from "./config";
import { degreeOf, pageText } from "./extract-lib";
import type { ExtractedRecord } from "./extract";
import type { FetchEntry } from "./fetch";
import { args, keepRunning, pool, readJson, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

const OUT = path.join(DATA_DIR, "ai-names.json");

const TOOL: Anthropic.Tool = {
  name: "name_programme",
  description: "Name the one degree programme this official page describes.",
  input_schema: {
    type: "object",
    properties: {
      isOneProgramme: { type: "boolean", description: "true if the page describes one taught degree programme (master's or bachelor's); false for a list, a faculty home page or anything else" },
      name: { type: "string", description: "The programme's full English name, copied exactly from the page, e.g. 'Master of Science in Data Science'" },
    },
    required: ["isOneProgramme"],
  },
};

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

async function main() {
  const a = args();
  if (!a.only) throw new Error("Pass --only=<university ids>");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const extracted = readJson<ExtractedRecord[]>(EXTRACTED_FILE, []);
  const log = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
  const names = readJson<Record<string, { name: string; source: string }>>(OUT, {});
  const todo = extracted.filter((r) => a.only!.includes(r.source) && r.result && !r.result.name && r.pages.length && (a.refresh || !names[r.base]));
  console.log(`Claude names ${todo.length} pages (${AI_MODEL})…`);
  let kept = 0, input = 0, output = 0;
  await pool(todo, 4, async (r) => {
    const pages = r.pages.map((url) => pageText({ url, html: readFileSync(log[url].file!, "utf8") }));
    const text = pages.map((p) => [p.title, ...p.h1, ...p.lines.slice(0, 150)].filter(Boolean).join("\n")).join("\n").slice(0, 12_000);
    const msg = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 200,
      system: "You read one official university web page. Give the name of the single degree programme it describes, copied exactly from the page (the English name if both Chinese and English are given). Do not invent or translate a name.",
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: `Page: ${r.base}\n\n${text}` }],
    });
    input += msg.usage.input_tokens;
    output += msg.usage.output_tokens;
    const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    const v = (call?.input ?? {}) as { isOneProgramme?: boolean; name?: string };
    if (!v.isOneProgramme || !v.name || !degreeOf(v.name)) return;
    const on = pages.some((p) => squash([p.title ?? "", ...p.h1, ...p.lines].join("\n")).includes(squash(v.name!)));
    if (!on) return;
    names[r.base] = { name: v.name, source: r.source };
    kept++;
  });
  writeJson(OUT, names);
  console.log(`${kept} names kept · tokens in ${input} out ${output}`);
}

keepRunning();
main();
