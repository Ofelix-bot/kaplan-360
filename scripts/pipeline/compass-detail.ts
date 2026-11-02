// Case pages from 指南者's library (compass-cases.ts lists them): for a spread of case ids across the whole library, the
// publication date (ids grow with time, so the build dates every case by interpolation); for the newest cases of each
// programme linked here (compass-match.ts), the experiences the page lists (the agency often shows only the first).
// Claude (Haiku) sorts each experience line into internship, work, research, competition, project or other.
// Same rules as the listing: robots.txt allows the pages, no login, one request at a time (PIPELINE_INTERVAL_MS=4000),
// a page without the case's details is skipped. Raw pages are cached gzipped.
// Writes data/pipeline/compass/details.json. Usage: PIPELINE_INTERVAL_MS=4000 npx tsx scripts/pipeline/compass-detail.ts [--per=4]

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { closeBrowser } from "./browser";
import { COMPASS_CASES_FILE, type CompassCase } from "./compass-cases";
import { DETAILS_FILE, type Detail, type Kind } from "./compass-build";
import { splitTitle } from "./compass-lib";
import { PROGRAMME_MATCHES_FILE, type ProgrammeMatch } from "./compass-match";
import { AI_MODEL, CACHE_DIR } from "./config";
import { politeFetch } from "./http";
import { args, keepRunning, readJson, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

const PAGE_CACHE = path.join(CACHE_DIR, "compass");
/** Ids sampled across the library just for dates. */
const DATE_SAMPLES = 24;

const KIND_TOOL: Anthropic.Tool = {
  name: "sort_experiences",
  description: "The kind of each numbered experience line from a student's application background.",
  input_schema: {
    type: "object",
    properties: {
      kinds: {
        type: "array",
        items: {
          type: "object",
          properties: { n: { type: "integer" }, kind: { type: "string", enum: ["internship", "work", "research", "competition", "project", "other"] } },
          required: ["n", "kind"],
        },
      },
    },
    required: ["kinds"],
  },
};

function parseDetail(html: string): Omit<Detail, "kinds"> | null {
  const date = /"pubDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(html)?.[1] ?? null;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&[lr]dquo;/g, '"')
    .replace(/&[lr]squo;/g, "'")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const start = text.indexOf("主要经历");
  if (start < 0) return date ? { date, experiences: [], hidden: false } : null;
  const experiences: string[] = [];
  let hidden = false;
  for (const line of text.slice(start + 1, start + 40)) {
    if (/详细经历不对外展示/.test(line)) {
      hidden = true;
      break;
    }
    if (/^(背景提升|Offer展示|项目简介|录取报告|查看更多)/.test(line)) break;
    if (line.length >= 4) experiences.push(line.replace(/^\d+\s*[.、]\s*/, "").slice(0, 160));
  }
  return { date, experiences, hidden };
}

async function main() {
  const a = args();
  const per = Number(process.argv.find((x) => x.startsWith("--per="))?.split("=")[1] ?? 4);
  const { cases } = readJson<{ cases: CompassCase[] }>(COMPASS_CASES_FILE, { cases: [] });
  const matches = readJson<Record<string, ProgrammeMatch>>(PROGRAMME_MATCHES_FILE, {});
  const details = readJson<Record<string, Detail>>(DETAILS_FILE, {});

  // Which cases: a spread across the id range (dates), then each linked programme's newest `per` (experience).
  const ids = cases.map((c) => c.id).sort((x, y) => x - y);
  const want = new Set<number>();
  for (let i = 0; i < DATE_SAMPLES; i++) want.add(ids[Math.round((i / (DATE_SAMPLES - 1)) * (ids.length - 1))]);
  const byProgramme = new Map<string, CompassCase[]>();
  for (const c of cases) {
    const t = splitTitle(c.title);
    const m = t ? matches[`${t.institutionId}|${t.zh}`] : null;
    if (m?.sure) for (const id of m.ids) byProgramme.set(id, [...(byProgramme.get(id) ?? []), c]);
  }
  for (const list of byProgramme.values()) for (const c of [...list].sort((x, y) => y.id - x.id).slice(0, per)) want.add(c.id);
  const todo = [...want].filter((id) => a.refresh || !details[id]).sort((x, y) => y - x);
  console.log(`Case pages to read: ${todo.length} (${want.size} wanted)`);

  let read = 0, failed = 0;
  for (const id of todo) {
    const file = path.join(PAGE_CACHE, `newst_${id}.html.gz`);
    let html: string | null = null;
    if (existsSync(file)) html = gunzipSync(readFileSync(file)).toString("utf8");
    else {
      const r = await politeFetch(`https://www.compassedu.hk/newst_${id}`);
      if (!r.ok) {
        failed++;
        console.log(`newst_${id}: ${r.reason} ${r.detail}`);
        if (r.reason === "robots" || r.reason === "blocked") break;
        continue;
      }
      html = r.body.toString("utf8");
      mkdirSync(PAGE_CACHE, { recursive: true });
      writeFileSync(file, gzipSync(html));
    }
    const d = parseDetail(html);
    if (!d) {
      failed++;
      continue;
    }
    details[id] = { ...d, kinds: [] };
    if (++read % 25 === 0) {
      writeJson(DETAILS_FILE, details);
      console.log(`read ${read}/${todo.length}`);
    }
  }
  writeJson(DETAILS_FILE, details);

  // Sort the experience lines (Haiku, in batches); a page that lists none keeps no kinds.
  const key = process.env.ANTHROPIC_API_KEY;
  const lines = Object.entries(details).flatMap(([id, d]) => (d.kinds.length || !d.experiences.length ? [] : d.experiences.map((e, j) => ({ id, j, e }))));
  if (key && lines.length) {
    const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
    const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
    let input = 0, output = 0;
    const kinds = new Map<string, Kind[]>();
    for (let i = 0; i < lines.length; i += 100) {
      const batch = lines.slice(i, i + 100);
      const msg = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 4000,
        system:
          "Each line is one experience a Chinese master's applicant listed (in Chinese). Say what kind it is: internship (实习, or a short role while studying), work (a job after graduating), research (科研, a lab, a paper, a research assistant), competition (竞赛, contests, modelling competitions), project (a course or personal project), other (exchange, volunteering, student union, certificates).",
        tools: [KIND_TOOL],
        tool_choice: { type: "tool", name: KIND_TOOL.name },
        messages: [{ role: "user", content: batch.map((l, j) => `${j + 1}. ${l.e}`).join("\n") }],
      });
      input += msg.usage.input_tokens;
      output += msg.usage.output_tokens;
      const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      for (const k of ((call?.input as { kinds?: { n: number; kind: Kind }[] })?.kinds ?? [])) {
        const l = batch[k.n - 1];
        if (l) kinds.set(l.id, [...(kinds.get(l.id) ?? []), k.kind]);
      }
    }
    for (const [id, k] of kinds) details[id].kinds = k;
    writeJson(DETAILS_FILE, details);
    console.log(`Experience lines sorted: ${lines.length} · tokens in ${input} out ${output} · ≈ US$${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)}`);
  }
  console.log(`Case pages read ${read}, failed ${failed} · dated ${Object.values(details).filter((d) => d.date).length}`);
  await closeBrowser();
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/pipeline/compass-detail.ts")) {
  keepRunning();
  main();
}
