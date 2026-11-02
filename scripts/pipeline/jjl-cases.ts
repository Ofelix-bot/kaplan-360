// 金吉列留学 (jjl.cn) case articles: the agency's published success stories. The case index (505 pages) gives each
// article's title, summary and date; master's articles from 2022 on are fetched, and Claude (Haiku) reads each into
// the student's background (undergraduate school, GPA, English and test scores, experience) and their master's
// results. A university or programme is kept only if its name appears in the article. robots.txt allows the pages;
// one request at a time (PIPELINE_INTERVAL_MS=3000). These are chosen to advertise (often a low GPA's success), so
// the build marks them apart. Included at the site owner's direction for academic use (2026-10-22).
// Writes data/pipeline/jjl/cases.json. Usage: PIPELINE_INTERVAL_MS=3000 npx tsx scripts/pipeline/jjl-cases.ts

import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { AI_MODEL, DATA_DIR } from "./config";
import { politeFetch } from "./http";
import { keepRunning, pool, readJson, today, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

export const JJL_FILE = path.join(DATA_DIR, "jjl", "cases.json");
const INDEX = (page: number) => `https://www.jjl.cn/case/tag-${encodeURIComponent("留学案例")}${page > 1 ? `__page-${page}` : ""}`;
const SINCE = "2022-01-01";
const MASTERS = /硕士|研究生|master|msc|\bma\b|\bms\b|mba|llm|meng|mpa|mph|授课/i;
const NOT_MASTERS = /本科|高中|中学|小学|初中|预科|博士(?!后)|phd|艺术|签证/i;

export type JjlApplication = { university: string; programme: string; result: "admit" | "reject" | "waitlist" | "other" };
export type JjlCase = {
  url: string;
  title: string;
  date: string;
  undergrad: string | null;
  gpa: number | null;
  gpaScale: number | null;
  ielts: number | null;
  toefl: number | null;
  gre: number | null;
  gmat: number | null;
  research: boolean;
  internships: boolean;
  workYears: number | null;
  applications: JjlApplication[];
};
type Entry = { url: string; title: string; summary: string; date: string };

const TOOL: Anthropic.Tool = {
  name: "case_report",
  description: "The student's background and every master's application with its result, as the article gives them.",
  input_schema: {
    type: "object",
    properties: {
      undergrad: { type: "string", description: "The student's undergraduate university as written (empty if not given)" },
      gpa: { type: "number", description: "Undergraduate GPA or average as written, 0 if not given" },
      gpaScale: { type: "number", description: "Its scale (4, 4.3, 5, 7 or 100), 0 if not given" },
      ielts: { type: "number" },
      toefl: { type: "number" },
      gre: { type: "number" },
      gmat: { type: "number" },
      research: { type: "boolean" },
      internships: { type: "boolean" },
      workYears: { type: "number", description: "Years of full-time work, 0 if none" },
      applications: {
        type: "array",
        description: "Master's applications only, with results (admit, reject, waitlist; other if not said)",
        items: {
          type: "object",
          properties: { university: { type: "string" }, programme: { type: "string" }, result: { type: "string", enum: ["admit", "reject", "waitlist", "other"] } },
          required: ["university", "programme", "result"],
        },
      },
    },
    required: ["undergrad", "gpa", "gpaScale", "ielts", "toefl", "gre", "gmat", "research", "internships", "workYears", "applications"],
  },
};

const decode = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

async function main() {
  mkdirSync(path.dirname(JJL_FILE), { recursive: true });
  const stored = readJson<{ entries: Entry[]; cases: JjlCase[]; indexDone: number }>(JJL_FILE, { entries: [], cases: [], indexDone: 0 });
  const entries = new Map(stored.entries.map((e) => [e.url, e]));
  const cases = new Map(stored.cases.map((c) => [c.url, c]));
  let indexDone = stored.indexDone;
  const save = () => writeJson(JJL_FILE, { source: "金吉列留学 case articles (jjl.cn/case)", checked: today(), indexDone, entries: [...entries.values()], cases: [...cases.values()] });

  // 1. The case index: every article's title, summary and date.
  for (let page = indexDone + 1; page <= 600; page++) {
    const r = await politeFetch(INDEX(page));
    if (!r.ok) {
      console.log(`index page ${page}: ${r.reason} ${r.detail}`);
      break;
    }
    const html = r.body.toString("utf8");
    const items = html.split('<div class="result-item').slice(1);
    if (!items.length) break;
    for (const it of items) {
      const url = /class="info-title" href="(\/\/www\.jjl\.cn\/case\/\d+\.html)"/.exec(it)?.[1];
      if (!url) continue;
      entries.set(`https:${url}`, {
        url: `https:${url}`,
        title: decode(/class="info-title"[^>]*>([^<]*)</.exec(it)?.[1] ?? ""),
        summary: decode((/class="info-desc[^"]*">([\s\S]*?)<a /.exec(it)?.[1] ?? "").replace(/<[^>]+>/g, " ")),
        date: /class="time">(\d{4}-\d{2}-\d{2})/.exec(it)?.[1] ?? "",
      });
    }
    indexDone = page;
    if (page % 25 === 0) {
      save();
      console.log(`index page ${page}: ${entries.size} articles`);
    }
    if (!/__page-\d+/.test(html.slice(html.lastIndexOf("下一页") - 300, html.lastIndexOf("下一页")))) break;
  }
  save();

  // 2. Master's articles from 2022 on: fetched, then read.
  const todo = [...entries.values()].filter((e) => e.date >= SINCE && MASTERS.test(`${e.title} ${e.summary}`) && !NOT_MASTERS.test(e.title) && !cases.has(e.url));
  console.log(`Index: ${entries.size} articles · master's from ${SINCE}: ${todo.length} to read`);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  let input = 0, output = 0, read = 0;
  // Pages one at a time (the fetcher paces them); the model reads them as they come.
  await pool(todo, 3, (e) =>
    readArticle(e).catch((err) => console.log(`${e.url}: ${(err as Error).message} (left for the next run)`)),
  );
  async function readArticle(e: Entry) {
    const r = await politeFetch(e.url);
    if (!r.ok) return;
    const html = r.body.toString("utf8");
    const body = html.slice(html.indexOf(e.title.slice(0, 12)) > 0 ? html.indexOf(e.title.slice(0, 12)) : 0);
    const text = decode(body.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, "\n")).slice(0, 12_000);
    const msg = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2500,
      system:
        "You read one study-abroad agency's case article (in Chinese, with English names). Give the student's background and every MASTER'S application it reports with its result. Names exactly as written. Leave out bachelor's and PhD applications, and anything that isn't about this student.",
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: `${e.title}\n\n${text}` }],
    });
    input += msg.usage.input_tokens;
    output += msg.usage.output_tokens;
    const v = (msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use")?.input ?? {}) as Record<string, unknown>;
    const num = (x: unknown, hi: number) => (typeof x === "number" && x > 0 && x <= hi ? x : null);
    const flat = text.toLowerCase();
    // The list sometimes comes back as JSON text rather than an array.
    let listed: unknown = v.applications;
    if (typeof listed === "string") {
      try {
        listed = JSON.parse(listed);
      } catch {
        listed = [];
      }
    }
    const apps = (Array.isArray(listed) ? (listed as JjlApplication[]) : []).filter(
      (x) => x && typeof x.university === "string" && typeof x.programme === "string" && x.university && x.programme && flat.includes(x.university.toLowerCase().slice(0, 5)),
    );
    if (apps.length)
      cases.set(e.url, {
        url: e.url,
        title: e.title,
        date: e.date,
        undergrad: typeof v.undergrad === "string" && v.undergrad.trim() && flat.includes(v.undergrad.trim().toLowerCase().slice(0, 4)) ? v.undergrad.trim() : null,
        gpa: num(v.gpa, 100),
        gpaScale: num(v.gpaScale, 100),
        ielts: num(v.ielts, 9),
        toefl: num(v.toefl, 120),
        gre: num(v.gre, 340),
        gmat: num(v.gmat, 805),
        research: !!v.research,
        internships: !!v.internships,
        workYears: num(v.workYears, 40),
        applications: apps,
      });
    if (++read % 50 === 0) {
      save();
      console.log(`articles read ${read}/${todo.length} · with master's results ${cases.size}`);
    }
  }
  save();
  console.log(`Articles with master's results: ${cases.size} · applications ${[...cases.values()].reduce((n, c) => n + c.applications.length, 0)} · tokens in ${input} out ${output} · ≈ US$${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/pipeline/jjl-cases.ts")) {
  keepRunning();
  main();
}
