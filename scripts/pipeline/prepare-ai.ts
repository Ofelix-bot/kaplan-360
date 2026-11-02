// "How should I prepare?": a short "Before applying" list for each programme, drafted at build time
// by Claude (Haiku) from that programme's own official quotes only (entry requirement, English and
// other tests, fee, intake, length, background). Nothing about any student is sent. A step is
// dropped when it states a number the quotes don't, talks about "the quote" / "the page", or uses
// admission wording (lib/rai.ts). Quotes unchanged since the last run are not sent again.
// Usage: npx tsx scripts/pipeline/prepare-ai.ts [--limit=N] [--refresh]

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import path from "node:path";
import { bannedWording } from "../../lib/rai";
import { AI_MODEL, OUTPUT_FILE, ROOT } from "./config";
import { args, keepRunning, pool, readJson, today, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

export const PREPARE_FILE = path.join(ROOT, "data", "raw", "programme-prepare.json");

type Evidence = { field: string; value: string | null; quote: string };
type Programme = { id: string; name: string; evidence: Evidence[] };
export type Prepared = { steps: string[]; model: string; builtAt: string; quotesHash: string; dropped: number };

const FIELDS = ["academicRequirement", "background", "ielts", "toefl", "pte", "duolingo", "gre", "gmat", "tuition", "intakes", "duration"];

const TOOL: Anthropic.Tool = {
  name: "before_applying",
  description: "What a student should check or get ready before applying to this programme.",
  input_schema: {
    type: "object",
    properties: {
      steps: {
        type: "array",
        items: { type: "string" },
        description: "2 to 4 steps, each one plain sentence of at most 22 words, in the order a student would do them.",
      },
    },
    required: ["steps"],
  },
};

const SYSTEM = `You write a short "Before applying" list for a Singapore student considering one taught master's programme.
Use only the facts in the official quotes provided. Turn requirements into concrete preparation: documents to gather, tests to book, fees to budget for, intakes to plan around, subjects the student's degree must cover.
Never add facts, dates, amounts or scores that the quotes don't state. Never say whether anyone will be admitted, their chances, or whether they are eligible; say what the university's page asks for.
Write each step as one imperative sentence of at most 22 words, e.g. "Book an IELTS Academic test early enough to reach 6.5 overall before you apply."
Never mention "the quotes" or "the page"; leave a point out instead.`;

const numbers = (s: string) => s.replace(/(\d),(?=\d{3}\b)/g, "$1").match(/\d+(\.\d+)?/g) ?? [];

async function main() {
  const a = args();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const programmes = readJson<{ programmes: Programme[] }>(OUTPUT_FILE, { programmes: [] }).programmes;
  const out = readJson<{ model: string; items: Record<string, Prepared> }>(PREPARE_FILE, { model: AI_MODEL, items: {} });

  const work = programmes
    .map((p) => {
      const facts = p.evidence.filter((e) => FIELDS.includes(e.field)).map((e) => ({ field: e.field, quote: e.quote.slice(0, 500) }));
      const quotesHash = createHash("sha1").update(JSON.stringify(facts)).digest("hex").slice(0, 16);
      return { p, facts, quotesHash };
    })
    // Something to prepare from, and not done already with the same quotes.
    .filter((w) => w.facts.length >= 2 && (a.refresh || out.items[w.p.id]?.quotesHash !== w.quotesHash))
    .slice(0, a.limit ?? Infinity);
  console.log(`Drafting "Before applying" for ${work.length} programmes (${AI_MODEL})…`);

  let input = 0;
  let output = 0;
  let dropped = 0;
  let done = 0;
  await pool(work, 4, async ({ p, facts, quotesHash }) => {
    try {
      const msg = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 400,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: JSON.stringify({ programme: p.name, quotes: facts }, null, 1) }],
      });
      input += msg.usage.input_tokens;
      output += msg.usage.output_tokens;
      const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      const raw = ((call?.input as { steps?: unknown })?.steps ?? []) as unknown[];
      const allowed = new Set(facts.flatMap((f) => numbers(f.quote)));
      let drop = 0;
      const steps = raw
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, 4)
        .filter((s) => {
          const ok = !/\bquotes?\b|\bthe page\b/i.test(s) && !bannedWording(s) && numbers(s).every((n) => allowed.has(n) || allowed.has(String(Number(n))));
          if (!ok) drop++;
          return ok;
        });
      dropped += drop;
      out.items[p.id] = { steps, model: AI_MODEL, builtAt: today(), quotesHash, dropped: drop };
    } catch (e) {
      console.log(`${p.id}: ${(e as Error).message.slice(0, 120)}`);
    }
    if (++done % 50 === 0) {
      writeJson(PREPARE_FILE, out);
      console.log(`${done}/${work.length}`);
    }
  });
  writeJson(PREPARE_FILE, out);
  console.log(`Done; ${dropped} steps dropped (a number not in the quotes, admission wording or a remark about the source).`);
  console.log(`Tokens: input ${input}, output ${output} · cost ≈ US$${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)}`);
}

if (process.argv[1]?.endsWith("prepare-ai.ts")) {
  keepRunning();
  main();
}
