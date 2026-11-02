// 寄托天下 Offer 榜 (offer.gter.net): applicants' own reports of master's results (offers, conditional offers, waiting
// lists and rejections), through the list endpoint the public page uses (robots.txt allows it; no login). Two passes:
// the master's reports of intakes 2022 onwards (result, university, programme, intake), and every master's report
// filed under an undergraduate category (清北中科大, other top universities, 985, 211, 双非, overseas, 中外合作), so the
// reports that give one carry it. Merged by report id. One request at a time (run with PIPELINE_INTERVAL_MS=3000).
// Included at the site owner's direction for academic use; the platform's user agreement restricts reuse of its
// content, and the site owner is seeking permission (2026-10-22).
// Writes data/pipeline/gter/cases.json. Usage: PIPELINE_INTERVAL_MS=3000 npx tsx scripts/pipeline/gter-cases.ts

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config";
import { politeFetch } from "./http";
import { keepRunning, readJson, today, writeJson } from "./util";

export const GTER_DIR = path.join(DATA_DIR, "gter");
export const GTER_CASES_FILE = path.join(GTER_DIR, "cases.json");
const API = "https://offer.gter.net/api/lists";
/** MSc, MA, MBA, MEd, MEng, LLM (the platform's degree codes). */
const MASTERS = "1,3,6,7,8,9";
const YEARS = [2022, 2023, 2024, 2025, 2026, 2027];
/** The platform's undergraduate categories, as this site groups them. */
export const GRADES: Record<string, { name: string; group: "985" | "211" | "other" | "overseas" }> = {
  1: { name: "清北中科大", group: "985" },
  5: { name: "浙大/复旦/南大/南开/武大/华中科大/上海交大/天大", group: "985" },
  2: { name: "985", group: "985" },
  3: { name: "211", group: "211" },
  4: { name: "双非", group: "other" },
  6: { name: "海外", group: "overseas" },
  8: { name: "中外合作", group: "other" },
};

export type GterCase = {
  id: string;
  url: string;
  school: string;
  programme: string;
  degree: string;
  result: string;
  semester: string | null;
  /** The undergraduate category the report was filed under, when it gives one. */
  grade: string | null;
  note: string;
};

type Item = { id: string; url: string; schoolname: string; professional: string; degree: string; apply_results: string; semester: string | null; message: string | null };

async function list(params: string, onPage: (items: Item[]) => void) {
  for (let page = 1; ; page++) {
    const r = await politeFetch(`${API}?limit=20&page=${page}&${params}`);
    if (!r.ok) {
      console.log(`${params} page ${page}: ${r.reason} ${r.detail}`);
      if (r.reason === "robots" || r.reason === "blocked") throw new Error("stopped: " + r.detail);
      return;
    }
    let j: { data?: { count?: number; data?: Item[] } };
    try {
      j = JSON.parse(r.body.toString("utf8"));
    } catch {
      console.log(`${params} page ${page}: not JSON (stopped)`);
      return;
    }
    const items = j.data?.data ?? [];
    if (!items.length) return;
    onPage(items);
    const count = j.data?.count ?? 0;
    if (page % 25 === 0) console.log(`${params}: page ${page}/${Math.ceil(count / 20)}`);
    if (page * 20 >= count) return;
  }
}

async function main() {
  mkdirSync(GTER_DIR, { recursive: true });
  const cases = new Map<string, GterCase>(readJson<{ cases: GterCase[] }>(GTER_CASES_FILE, { cases: [] }).cases.map((c) => [c.id, c]));
  const add = (x: Item, grade: string | null) => {
    const prev = cases.get(x.id);
    cases.set(x.id, {
      id: x.id,
      url: x.url,
      school: x.schoolname ?? "",
      programme: (x.professional ?? "").replace(/\s+/g, " ").trim(),
      degree: x.degree ?? "",
      result: x.apply_results ?? "",
      semester: x.semester ?? null,
      grade: grade ?? prev?.grade ?? null,
      note: (x.message ?? "").slice(0, 200),
    });
  };
  const save = () => writeJson(GTER_CASES_FILE, { source: "寄托天下 Offer 榜 (offer.gter.net)", checked: today(), cases: [...cases.values()] });
  for (const y of YEARS) {
    await list(`degree=${MASTERS}&year=${y}`, (items) => items.forEach((x) => add(x, null)));
    save();
    console.log(`intake ${y}: ${cases.size} reports so far`);
  }
  for (const [g, { name }] of Object.entries(GRADES)) {
    await list(`degree=${MASTERS}&schoolgrade=${g}`, (items) => items.forEach((x) => add(x, g)));
    save();
    console.log(`category ${name}: ${cases.size} reports so far`);
  }
  save();
  console.log(`Reports: ${cases.size} · with a category: ${[...cases.values()].filter((c) => c.grade).length}`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/pipeline/gter-cases.ts")) {
  keepRunning();
  main();
}
