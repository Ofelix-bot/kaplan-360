// Drafts a short "claim / know / prepare" checklist for each benefit, at build time, with Claude
// (Haiku), from the benefit's verified quotes only. A bullet that states a number or date not in
// those quotes is dropped. The checklists are stored with the benefits for review before display;
// the site never calls a model at runtime.
// Usage: npx tsx scripts/benefits/checklists.ts [--refresh]

import Anthropic from "@anthropic-ai/sdk";
import { args, keepRunning, pool, readJson, writeJson } from "../pipeline/util";
import type { Benefit } from "./collect";
import { LIMITS } from "./eligibility";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

const FILE = "data/raw/benefits.json";
const MODEL = "claude-haiku-5-5";

export type Checklist = { claim: string[]; know: string[]; prepare: string[] };

const TOOL: Anthropic.Tool = {
  name: "write_checklist",
  description: "A short checklist for a student considering this benefit.",
  input_schema: {
    type: "object",
    properties: {
      claim: { type: "array", items: { type: "string" }, description: "How to get it: the steps the quotes state (apply by, apply via, automatic). Max 3." },
      know: { type: "array", items: { type: "string" }, description: "Conditions and limits the quotes state (who qualifies, intake, value, exclusions). Max 3." },
      prepare: { type: "array", items: { type: "string" }, description: "What to have ready, only as the quotes state (documents, offer, deposit). Max 3; empty if the quotes say nothing." },
      singapore: {
        type: "string",
        enum: ["yes", "no", "unclear"],
        description: "Can a Singapore citizen or permanent resident, or an international student living in Singapore, receive it? 'no' only if the quotes limit it to other nationalities, regions or groups (e.g. refugees, a named country).",
      },
      singaporeQuote: { type: "string", description: "For 'no': the exact words that limit who can receive it." },
    },
    required: ["claim", "know", "prepare", "singapore"],
  },
};

const SYSTEM = `You write a short, neutral checklist for a Singapore student planning a taught master's degree, about one benefit offered by a university.
Use only the facts in the quotes provided. Never add dates, amounts, conditions or steps that the quotes don't state; if a section has nothing to say, return an empty list.
Write each bullet as one plain sentence of at most 20 words. No marketing language, no promises, no "you will get"; say what the university's page states.
Never mention "the quotes", "the page" or what is missing; leave a point out instead.`;

const numbers = (s: string) => s.replace(/(\d),(?=\d{3}\b)/g, "$1").match(/\d+(\.\d+)?/g) ?? [];

async function main() {
  const a = args();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const file = readJson<{ items: (Benefit & { checklist?: Checklist | null; checklistModel?: string; openToSingapore?: boolean | null; openToSingaporeQuote?: string | null })[] }>(FILE, { items: [] });
  const todo = file.items.filter((b) => a.refresh || !b.checklist);
  console.log(`Drafting checklists for ${todo.length} benefits…`);
  let dropped = 0;
  await pool(todo, 4, async (b) => {
    const facts = { title: b.title, kind: b.kind, value: b.value, intake: b.intake, deadline: b.deadline, eventDate: b.eventDate, format: b.format, eligibility: b.eligibility, quotes: b.quotes };
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: JSON.stringify(facts, null, 2) }],
    });
    const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    const raw = (call?.input ?? {}) as Partial<Checklist> & { singapore?: string; singaporeQuote?: string };
    // Not open to Singapore students only when the limiting words are in the benefit's own quotes.
    const sources = [...Object.values(b.quotes), b.eligibility ?? "", b.title].join(" ").replace(/\s+/g, " ").toLowerCase();
    b.openToSingapore =
      raw.singapore === "no" && raw.singaporeQuote && sources.includes(raw.singaporeQuote.replace(/\s+/g, " ").toLowerCase()) && LIMITS.test(raw.singaporeQuote)
        ? false
        : raw.singapore === "yes"
          ? true
          : null;
    b.openToSingaporeQuote = b.openToSingapore === false ? raw.singaporeQuote! : null;
    // Numbers allowed in bullets: those in the quotes, the stored fields and the deadline's parts.
    const allowed = new Set([...Object.values(b.quotes), b.value ?? "", b.intake ?? "", b.title, b.deadline ?? "", b.eventDate ?? ""].flatMap(numbers).concat(
      b.deadline ? b.deadline.split("-").map((x) => String(Number(x))) : [],
    ));
    const clean = (list: unknown) =>
      (Array.isArray(list) ? list : [])
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, 3)
        .filter((s) => {
          // A bullet about the source material ("the quotes give no steps") says nothing to the student.
          const ok = !/\bquotes?\b/i.test(s) && numbers(s).every((n) => allowed.has(n) || allowed.has(String(Number(n))));
          if (!ok) dropped++;
          return ok;
        });
    const checklist = { claim: clean(raw.claim), know: clean(raw.know), prepare: clean(raw.prepare) };
    b.checklist = checklist.claim.length + checklist.know.length + checklist.prepare.length ? checklist : null;
    b.checklistModel = MODEL;
  });
  writeJson(FILE, file);
  console.log(`Done; ${dropped} bullets dropped (a number not in the quotes, or a remark about the source).`);
}

keepRunning();
main();
