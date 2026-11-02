// Chinese universities' student-run application handbooks (飞跃手册) on GitHub: each post is one graduate's own
// account of their applications, with their background and every result, admits and rejections. Claude (Haiku)
// reads each post into the applicant's background and their master's applications; a university or programme is
// kept only if its name appears in the post. The repositories are cloned beforehand into a data folder (they are
// read as text, never run). Included at the site owner's direction for academic use, with each post's address;
// some repositories carry no licence, and the site owner is seeking permission (2026-10-22).
// Writes data/pipeline/feiyue/reports.json. Usage: npx tsx scripts/pipeline/feiyue-reports.ts <data folder>

import Anthropic from "@anthropic-ai/sdk";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { AI_MODEL, DATA_DIR } from "./config";
import { keepRunning, pool, readJson, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

export const FEIYUE_FILE = path.join(DATA_DIR, "feiyue", "reports.json");
/** A year as posts write it ("25Fall" → 25) in full: 2025. */
export const fullYear = (y: number | null) => (y !== null && y < 100 ? 2000 + y : y);

/** Each handbook: its GitHub repository, the folder its posts are in, and the university its writers studied at. */
const HANDBOOKS = [
  { repo: "SUSTech-Application/SUSTechapplication", dir: "SUSTechapplication", posts: "content", university: "南方科技大学" },
  { repo: "Hainanu-Application/Hainanu-Application.github.io", dir: "Hainanu-Application.github.io", posts: "", university: "海南大学" },
  { repo: "west2-online/fzu-run", dir: "fzu-run", posts: "", university: "福州大学" },
];

export type FeiyueApplication = { university: string; programme: string; result: "admit" | "reject" | "waitlist" | "other" };
export type FeiyueReport = {
  repo: string;
  file: string;
  url: string;
  /** The writer's university, its year if the post gives it, and their background. */
  undergrad: string;
  year: number | null;
  gpa: number | null;
  gpaScale: number | null;
  ielts: number | null;
  toefl: number | null;
  gre: number | null;
  research: boolean;
  internships: boolean;
  workYears: number | null;
  applications: FeiyueApplication[];
};

const TOOL: Anthropic.Tool = {
  name: "applicant_report",
  description: "The applicant's background and every master's application with its result, as the post gives them.",
  input_schema: {
    type: "object",
    properties: {
      year: { type: "integer", description: "The intake year applied for (e.g. 2026 for 26Fall), 0 if not given" },
      gpa: { type: "number", description: "Undergraduate GPA or average as written, 0 if not given" },
      gpaScale: { type: "number", description: "Its scale (4, 4.3, 5 or 100), 0 if not given" },
      ielts: { type: "number" },
      toefl: { type: "number" },
      gre: { type: "number", description: "GRE total, 0 if none" },
      research: { type: "boolean", description: "Research experience (科研, a lab, papers)" },
      internships: { type: "boolean", description: "Internships" },
      workYears: { type: "number", description: "Years of full-time work, 0 if none" },
      applications: {
        type: "array",
        description: "Master's applications only (taught or research master's: MSc, MA, MPhil, MEng, MS, …); leave out PhDs",
        items: {
          type: "object",
          properties: {
            university: { type: "string", description: "As written in the post" },
            programme: { type: "string", description: "As written in the post" },
            result: { type: "string", enum: ["admit", "reject", "waitlist", "other"] },
          },
          required: ["university", "programme", "result"],
        },
      },
    },
    required: ["year", "gpa", "gpaScale", "ielts", "toefl", "gre", "research", "internships", "workYears", "applications"],
  },
};

function markdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e.startsWith(".") || e === "node_modules") continue;
    const f = path.join(dir, e);
    if (statSync(f).isDirectory()) out.push(...markdownFiles(f));
    else if (/\.md$/i.test(e)) out.push(f);
  }
  return out;
}

async function main() {
  const root = process.argv[2];
  if (!root) throw new Error("Pass the folder the handbooks were cloned into");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const stored = readJson<{ reports: FeiyueReport[] }>(FEIYUE_FILE, { reports: [] });
  const reports = new Map(stored.reports.map((r) => [r.url, r]));
  let input = 0, output = 0;

  for (const h of HANDBOOKS) {
    const base = path.join(root, h.dir);
    const files = markdownFiles(path.join(base, h.posts)).filter((f) => {
      const t = readFileSync(f, "utf8");
      // Posts about master's applications: a master's word and a result word.
      return t.length > 400 && /硕士|master|MSc|MA\b|MEng|MS\b|授课/i.test(t) && /录取|拒|offer|admit|reject|AD\b|Rej/i.test(t);
    });
    console.log(`${h.repo}: ${files.length} posts`);
    await pool(files, 4, async (f) => {
      const rel = path.relative(base, f).replace(/\\/g, "/");
      const url = `https://github.com/${h.repo}/blob/HEAD/${rel}`;
      if (reports.has(url)) return;
      const post = readFileSync(f, "utf8").slice(0, 30_000);
      const msg = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 3000,
        system:
          "You read one graduate's post from a Chinese university's study-abroad handbook. Give their background and every MASTER'S application they list with its result (admit, reject, waitlist; other for withdrawn or unknown). Names exactly as the post writes them. Leave out PhD applications.",
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: post }],
      });
      input += msg.usage.input_tokens;
      output += msg.usage.output_tokens;
      const v = (msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use")?.input ?? {}) as Record<string, unknown>;
      const num = (x: unknown, hi: number) => (typeof x === "number" && x > 0 && x <= hi ? x : null);
      const flat = post.toLowerCase();
      const apps = ((v.applications as FeiyueApplication[] | undefined) ?? []).filter(
        (x) => x.university && x.programme && flat.includes(x.university.toLowerCase().slice(0, 6)) && ["admit", "reject", "waitlist", "other"].includes(x.result),
      );
      if (!apps.length) return;
      reports.set(url, {
        repo: h.repo,
        file: rel,
        url,
        undergrad: h.university,
        year: fullYear(num(v.year, 2030)),
        gpa: num(v.gpa, 100),
        gpaScale: num(v.gpaScale, 100),
        ielts: num(v.ielts, 9),
        toefl: num(v.toefl, 120),
        gre: num(v.gre, 340),
        research: !!v.research,
        internships: !!v.internships,
        workYears: num(v.workYears, 40),
        applications: apps,
      });
    });
    writeJson(FEIYUE_FILE, { source: "Chinese universities' 飞跃手册 on GitHub", reports: [...reports.values()] });
  }
  const all = [...reports.values()];
  console.log(`Posts with master's applications: ${all.length} · applications: ${all.reduce((n, r) => n + r.applications.length, 0)} (admits ${all.reduce((n, r) => n + r.applications.filter((x) => x.result === "admit").length, 0)}, rejections ${all.reduce((n, r) => n + r.applications.filter((x) => x.result === "reject").length, 0)}) · tokens in ${input} out ${output} · ≈ US$${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/pipeline/feiyue-reports.ts")) {
  keepRunning();
  main();
}
