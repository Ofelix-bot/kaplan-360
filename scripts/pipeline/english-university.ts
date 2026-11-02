// University-wide minimum English scores for taught graduate applicants, for universities whose
// programme pages state none (common in the US, Canada and New Zealand): one official page per
// university (lists/university-english.json, found as the page the programme pages link to), read
// by Claude (Haiku). A score is kept only when its quote is on the page word for word and contains
// it. build.ts uses it for that university's programmes that state no score of their own.
// Usage: npx tsx scripts/pipeline/english-university.ts [--only=id1,id2] [--refresh]

import Anthropic from "@anthropic-ai/sdk";
import { closeBrowser } from "./browser";
import { AI_MODEL, UNIVERSITY_ENGLISH_FILE } from "./config";
import { pageText } from "./extract-lib";
import { politeFetch, routeThroughBrowser } from "./http";
import list from "./lists/university-english.json";
import { args, keepRunning, readJson, today, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

export type UniversityMinimum = {
  url: string;
  retrievedAt: string;
  ielts: { value: number; quote: string } | null;
  toefl: { value: number; quote: string } | null;
  /** Who the page says the minimum is for, in its words. */
  appliesTo: string | null;
  dropped: string[];
};

const TOOL: Anthropic.Tool = {
  name: "record_minimum",
  description: "The university-wide minimum English test scores for taught master's (postgraduate coursework) applicants, as the page states them.",
  input_schema: {
    type: "object",
    properties: {
      ieltsOverall: { type: ["object", "null"], properties: { value: { type: "number" }, quote: { type: "string" } }, required: ["value", "quote"], description: "Minimum IELTS Academic overall band." },
      toeflTotal: { type: ["object", "null"], properties: { value: { type: "number" }, quote: { type: "string" } }, required: ["value", "quote"], description: "Minimum TOEFL iBT total score (0–120)." },
      appliesTo: { type: ["string", "null"], description: "The words saying which applicants or programmes the minimum is for." },
    },
    required: ["ieltsOverall", "toeflTotal", "appliesTo"],
  },
};

const SYSTEM = `You read an official university page about English language requirements, for a study-planning prototype for Singapore students.
Record the university-wide minimum scores that apply to taught master's (postgraduate coursework / graduate) applicants: IELTS Academic overall and TOEFL iBT total.
Use only what the page states. If the page gives different minimums for different programmes or faculties and no general one, use null. Ignore undergraduate, research-only, paper-based and component (sub-score) minimums.
Each quote must be copied exactly from the page text, be one line or sentence, and contain the score.`;

const squash = (s: string) => s.replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/\s+/g, " ").trim().toLowerCase();

async function main() {
  const a = args();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const pages = list.pages as Record<string, { url: string; browser?: boolean }>;
  const out = readJson<Record<string, UniversityMinimum>>(UNIVERSITY_ENGLISH_FILE, {});
  const todo = Object.entries(pages).filter(([id]) => (!a.only || a.only.includes(id)) && (a.refresh || !out[id]));
  routeThroughBrowser(todo.filter(([, p]) => p.browser).map(([, p]) => new URL(p.url).origin));
  let input = 0;
  let output = 0;
  for (const [id, p] of todo) {
    const r = await politeFetch(p.url);
    if (!r.ok) {
      console.log(`${id}: ${r.reason} ${r.detail}`);
      continue;
    }
    const text = pageText({ url: p.url, html: r.body.toString("utf8") });
    const blob = text.lines.join("\n");
    // Lines about tests and minimums, with a little context, capped.
    const keep = new Set<number>();
    text.lines.forEach((l, i) => /ielts|toefl|english|minimum|graduate|postgraduate|master|coursework/i.test(l) && [i - 1, i, i + 1].forEach((k) => k >= 0 && keep.add(k)));
    const ctx = [...keep].sort((x, y) => x - y).map((i) => text.lines[i]).join("\n").slice(0, 24_000);
    const msg = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 500,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: `Page: ${p.url}\n\n${ctx}` }],
    });
    input += msg.usage.input_tokens;
    output += msg.usage.output_tokens;
    const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    const ans = (call?.input ?? {}) as { ieltsOverall?: { value: number; quote: string } | null; toeflTotal?: { value: number; quote: string } | null; appliesTo?: string | null };
    const dropped: string[] = [];
    const check = (v: { value: number; quote: string } | null | undefined, name: string, lo: number, hi: number) => {
      if (!v) return null;
      if (!(v.value >= lo && v.value <= hi)) return dropped.push(`${name} ${v.value} out of range`), null;
      if (!squash(blob).includes(squash(v.quote))) return dropped.push(`${name} quote not on the page`), null;
      if (!squash(v.quote).includes(String(v.value))) return dropped.push(`${name} score not in its quote`), null;
      return { value: v.value, quote: v.quote };
    };
    out[id] = {
      url: r.finalUrl,
      retrievedAt: today(),
      ielts: check(ans.ieltsOverall, "IELTS", 4, 9),
      toefl: check(ans.toeflTotal, "TOEFL", 40, 120),
      appliesTo: ans.appliesTo ?? null,
      dropped,
    };
    console.log(`${id.padEnd(40)} IELTS ${out[id].ielts?.value ?? "-"} · TOEFL ${out[id].toefl?.value ?? "-"}${dropped.length ? ` · dropped: ${dropped.join("; ")}` : ""}`);
    writeJson(UNIVERSITY_ENGLISH_FILE, out);
  }
  console.log(`Tokens: input ${input}, output ${output} · cost ≈ US$${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)}`);
  await closeBrowser();
}

// Run only when executed directly: build.ts imports this file for its types.
if (process.argv[1]?.endsWith("english-university.ts")) {
  keepRunning();
  main();
}
