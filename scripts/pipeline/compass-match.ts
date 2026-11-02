// Links 指南者 cases (compass-cases.ts) to this database:
// 1. each offer's programme, named in Chinese by the agency, to the university's programmes here: Claude (Haiku)
//    picks only the same programme (same subject and degree), never just the same field;
// 2. each overseas undergraduate school, named in Chinese, to its English name and country (Haiku), then to the
//    QS World University Rankings 2027 list by name; where the name is not exact, Haiku chooses among the closest
//    QS names in that country or none. The rank always comes from the QS file, never from the model.
// Answers are cached, so a rerun only asks about new names.
// Writes data/pipeline/compass/programme-matches.json and schools.json. Usage: npx tsx scripts/pipeline/compass-match.ts

import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import { COMPASS_CASES_FILE, COMPASS_DIR, type CompassCase } from "./compass-cases";
import { institutionFor, OFFER_UNIVERSITIES, reloadMappedUniversities, splitTitle, titleParts, UNIVERSITIES_FILE, type MappedUniversity } from "./compass-lib";
import { AI_MODEL, INSTITUTIONS_FILE, OUTPUT_FILE, ROOT } from "./config";
import { FEIYUE_FILE, type FeiyueReport } from "./feiyue-reports";
import { GRADCAFE_FILE, type GradcafeResult } from "./gradcafe-results";
import { JJL_FILE, type JjlCase } from "./jjl-cases";
import { args, keepRunning, readJson, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

export const PROGRAMME_MATCHES_FILE = path.join(COMPASS_DIR, "programme-matches.json");
export const SCHOOLS_FILE = path.join(COMPASS_DIR, "schools.json");
const QS_FILE = path.join(ROOT, "data", "raw", "qs-wur-2027.json");

/** `checked`: an unsure match the naming model looked at again (its answer replaces ids and sure). */
export type ProgrammeMatch = { ids: string[]; sure: boolean; checked?: boolean };
export type School = { english: string | null; country: string | null; qsName: string | null; qsRank: string | null; qsRankValue: number | null; how: "exact" | "chosen" | "none" };
type Qs = { name: string; country: string; rank: string; rankValue: number };
type Programme = { id: string; institutionId: string; name: string; degreeType: string | null; studyMode: string | null };

const MATCH_TOOL: Anthropic.Tool = {
  name: "match_programmes",
  description: "For each numbered Chinese programme name, the ids of the university's programmes that are the same programme.",
  input_schema: {
    type: "object",
    properties: {
      matches: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "The number of the Chinese name" },
            ids: { type: "array", items: { type: "string" }, description: "Ids from the list that are this same programme (several only when the list holds the same programme more than once, e.g. full-time and part-time). Empty when none is the same programme." },
            sure: { type: "boolean", description: "true when the subject and the degree clearly agree" },
          },
          required: ["n", "ids", "sure"],
        },
      },
    },
    required: ["matches"],
  },
};

const SCHOOL_TOOL: Anthropic.Tool = {
  name: "name_schools",
  description: "The official English name and country of each numbered university, named in Chinese.",
  input_schema: {
    type: "object",
    properties: {
      schools: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer" },
            english: { type: "string", description: "The university's official English name; empty if you don't know which university it is" },
            country: { type: "string", description: "Its country or territory, written as in this list where possible: United Kingdom, United States, Australia, Canada, Hong Kong SAR, Macau SAR, Taiwan, Singapore, Malaysia, Japan, South Korea, New Zealand, Ireland, Netherlands, France, Germany, China (Mainland)" },
          },
          required: ["n", "english", "country"],
        },
      },
    },
    required: ["schools"],
  },
};

const CONFIRM_TOOL: Anthropic.Tool = {
  name: "confirm_matches",
  description: "For each numbered Chinese programme name, the ids among its candidates that are the same programme.",
  input_schema: {
    type: "object",
    properties: {
      answers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer" },
            ids: { type: "array", items: { type: "string" }, description: "Candidate ids that are this very programme; empty if none is" },
          },
          required: ["n", "ids"],
        },
      },
    },
    required: ["answers"],
  },
};

const CHOOSE_TOOL: Anthropic.Tool = {
  name: "choose_ranked_name",
  description: "For each numbered university, the number of the QS entry that is the same university, or 0 for none.",
  input_schema: {
    type: "object",
    properties: {
      choices: { type: "array", items: { type: "object", properties: { n: { type: "integer" }, pick: { type: "integer" } }, required: ["n", "pick"] } },
    },
    required: ["choices"],
  },
};

/** Naming universities from Chinese is harder than matching programme names, and there are few: a stronger model. */
const NAMING_MODEL = "claude-opus-5-5";
/** Chinese names the model rightly calls ambiguous, read the way Chinese applicants most often mean them. */
const KNOWN: Record<string, { english: string; country: string }> = {
  纽卡斯尔大学: { english: "Newcastle University", country: "United Kingdom" },
  奥克兰大学: { english: "The University of Auckland", country: "New Zealand" },
};
/** Universities that merged: their graduates' degrees are counted under the QS entry of the merged university. */
const MERGED: Record<string, string> = {
  "University of South Australia": "Adelaide University",
  "The University of Adelaide": "Adelaide University",
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|of|at|in|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const tokens = (s: string) => new Set(norm(s).split(" ").filter((t) => t.length > 1 && t !== "university"));
const abbreviation = (s: string) => /\(([A-Z][A-Za-z&. ]{1,15})\)/.exec(s)?.[1]?.replace(/[. ]/g, "") ?? null;
/** "University College London" → "UCL", for QS entries listed under their initials alone. */
const initials = (s: string) =>
  s
    .replace(/\(.*?\)/g, " ")
    .split(/[\s,–-]+/)
    .filter((w) => /^[A-Z]/.test(w) && !/^(Of|The|And|At|In)$/i.test(w))
    .map((w) => w[0])
    .join("");

async function main() {
  const a = args();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  let input = 0, output = 0, namingIn = 0, namingOut = 0;
  const ask = async (system: string, tool: Anthropic.Tool, content: string, max = 8000, model = AI_MODEL) => {
    // The naming model doesn't take a forced tool choice: it is asked to answer through the tool instead.
    const forced = model === AI_MODEL;
    const msg = await client.messages.create({
      model,
      max_tokens: max,
      system: forced ? system : `${system} Answer only by calling the ${tool.name} tool once, covering every numbered item.`,
      tools: [tool],
      tool_choice: forced ? { type: "tool", name: tool.name } : { type: "auto" },
      messages: [{ role: "user", content }],
    });
    if (model === AI_MODEL) {
      input += msg.usage.input_tokens;
      output += msg.usage.output_tokens;
    } else {
      namingIn += msg.usage.input_tokens;
      namingOut += msg.usage.output_tokens;
    }
    return (msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use")?.input ?? {}) as Record<string, unknown>;
  };
  // --schools asks about the overseas schools again without asking about programme names again.
  const refreshProgrammes = a.refresh && !a.flag("schools");
  const refreshSchools = a.refresh || a.flag("schools");

  const cases = readJson<{ cases: CompassCase[] }>(COMPASS_CASES_FILE, { cases: [] }).cases;
  const programmes = readJson<{ programmes: Programme[] }>(OUTPUT_FILE, { programmes: [] }).programmes;

  // 0. Universities outside Singapore and Hong Kong, as the agency names them in offer titles: the naming model gives
  // each one's English name and country; it is then found among this database's universities (exact name, or chosen
  // among the closest names in that country, or none).
  const roster = readJson<{ institutions: { id: string; name: string; country: string | null; kaggle?: { names?: string[] } | null }[] }>(INSTITUTIONS_FILE, { institutions: [] }).institutions;
  const withProgrammes = new Set(programmes.map((p) => p.institutionId));
  const here = roster.filter((i) => withProgrammes.has(i.id));
  const universities = readJson<Record<string, MappedUniversity>>(UNIVERSITIES_FILE, {});
  // Applicants' own reports name universities too (飞跃手册, in Chinese or English); GradCafe's are read per university here.
  const feiyue = readJson<{ reports: FeiyueReport[] }>(FEIYUE_FILE, { reports: [] }).reports;
  const gradcafe = readJson<{ results: GradcafeResult[] }>(GRADCAFE_FILE, { results: [] }).results;
  const jjl = readJson<{ cases: JjlCase[] }>(JJL_FILE, { cases: [] }).cases;
  // Names already found here (the Singapore and Hong Kong list, a named part such as 悉尼大学（University of Sydney）, or an English name as it is here) aren't asked.
  const reported = [...feiyue, ...jjl].flatMap((r) => r.applications.map((x) => x.university.trim())).filter((u) => u && !institutionFor(u));
  const unresolved = [
    ...new Set([...cases.filter((c) => !splitTitle(c.title)).map((c) => titleParts(c.title)?.university).filter((u): u is string => !!u), ...reported]),
  ].filter((u) => a.flag("universities") || !universities[u]);
  const toName: { zh: string; english: string; country: string }[] = [];
  for (let i = 0; i < unresolved.length; i += 120) {
    const batch = unresolved.slice(i, i + 120);
    const v = await ask(
      "You identify universities and business schools named in Chinese or English, as a Chinese study-abroad agency or applicants write them (e.g. 伦敦大学学院 is University College London, 加州大学洛杉矶分校 is University of California, Los Angeles, HKU is The University of Hong Kong). Give each one's official English name as the institution itself uses it, and its country or territory. A campus elsewhere keeps its campus (纽约大学上海校区 → NYU Shanghai, China (Mainland)). If a name is ambiguous or you don't know it, leave english empty.",
      SCHOOL_TOOL,
      batch.map((s, j) => `${j + 1}. ${s}`).join("\n"),
      8000,
      NAMING_MODEL,
    );
    for (const s of (v.schools as { n: number; english: string; country: string }[] | undefined) ?? []) {
      const zh = batch[s.n - 1];
      if (zh) toName.push({ zh, english: s.english?.trim() ?? "", country: s.country?.trim() ?? "" });
    }
    console.log(`universities named: ${Math.min(i + 120, unresolved.length)}/${unresolved.length}`);
  }
  const rosterNames = (r: (typeof here)[number]) => [r.name, ...(r.kaggle?.names ?? [])];
  const pick: { zh: string; english: string; country: string; candidates: typeof here }[] = [];
  for (const s of toName) {
    if (!s.english) {
      universities[s.zh] = { english: null, country: s.country || null, institutionId: null, how: "none" };
      continue;
    }
    const inCountry = here.filter((r) => r.country === s.country);
    const pool = inCountry.length ? inCountry : here;
    const exact = pool.find((r) => rosterNames(r).some((n) => norm(n) === norm(s.english) || abbreviation(n) === s.english.replace(/[. ]/g, "") || (/^[A-Z]{2,6}$/.test(n) && n === initials(s.english))));
    if (exact) {
      universities[s.zh] = { english: s.english, country: s.country, institutionId: exact.id, how: "exact" };
      continue;
    }
    const mine = tokens(s.english);
    const candidates = pool
      .map((r) => ({ r, score: Math.max(...rosterNames(r).map((n) => [...mine].filter((x) => tokens(n).has(x)).length / Math.max(1, new Set([...mine, ...tokens(n)]).size))) }))
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 8)
      .map((x) => x.r);
    if (!candidates.length) universities[s.zh] = { english: s.english, country: s.country, institutionId: null, how: "none" };
    else pick.push({ ...s, candidates });
  }
  for (let i = 0; i < pick.length; i += 40) {
    const batch = pick.slice(i, i + 40);
    const text = batch.map((s, j) => `${j + 1}. ${s.english} (${s.country}; Chinese: ${s.zh})\n${s.candidates.map((r, k) => `   ${k + 1}) ${r.name}`).join("\n")}`).join("\n");
    const v = await ask(
      "For each institution, pick the entry that is the same institution (a renamed or merged university counts when the entry is its current name; a business school counts as its university only if the entry is that university and the school is part of it). Answer 0 when none of the entries is that institution.",
      CHOOSE_TOOL,
      text,
      4000,
      NAMING_MODEL,
    );
    const picks = new Map(((v.choices as { n: number; pick: number }[] | undefined) ?? []).map((c) => [c.n, c.pick]));
    batch.forEach((s, j) => {
      const r = s.candidates[(picks.get(j + 1) ?? 0) - 1];
      universities[s.zh] = { english: s.english, country: s.country, institutionId: r?.id ?? null, how: r ? "chosen" : "none" };
    });
  }
  writeJson(UNIVERSITIES_FILE, universities);
  reloadMappedUniversities();
  if (toName.length) console.log(`Universities named: ${toName.length} · found here: ${Object.values(universities).filter((u) => u.institutionId).length} of ${Object.keys(universities).length}`);

  /** How a university is named to the model: as the agency names it in Singapore and Hong Kong, else its name here. */
  const universityName = (id: string) => OFFER_UNIVERSITIES.find(([, x]) => x === id)?.[0] ?? roster.find((r) => r.id === id)?.name ?? id;

  // 1. Programmes.
  const matches = readJson<Record<string, ProgrammeMatch>>(PROGRAMME_MATCHES_FILE, {});
  const names = new Map<string, Map<string, number>>();
  const count = (institutionId: string, name: string) => {
    const m = names.get(institutionId) ?? new Map<string, number>();
    m.set(name, (m.get(name) ?? 0) + 1);
    names.set(institutionId, m);
  };
  for (const c of cases) {
    const t = splitTitle(c.title);
    if (t) count(t.institutionId, t.zh);
  }
  for (const r of gradcafe) count(r.institutionId, r.programme);
  for (const r of [...feiyue, ...jjl])
    for (const x of r.applications) {
      const id = institutionFor(x.university.trim());
      if (id) count(id, x.programme.trim());
    }
  for (const [institutionId, zhNames] of names) {
    const own = programmes.filter((p) => p.institutionId === institutionId);
    const ids = new Set(own.map((p) => p.id));
    const todo = [...zhNames.keys()].filter((zh) => refreshProgrammes || !matches[`${institutionId}|${zh}`]);
    if (!todo.length || !own.length) continue;
    const university = universityName(institutionId);
    for (let i = 0; i < todo.length; i += 80) {
      const batch = todo.slice(i, i + 80);
      const list = own.map((p) => `${p.id} | ${p.name}${p.degreeType ? ` | ${p.degreeType}` : ""}${p.studyMode ? ` | ${p.studyMode}` : ""}`).join("\n");
      const asked = batch.map((zh, j) => `${j + 1}. ${zh}`).join("\n");
      const v = await ask(
        "You match master's programmes, named by a Chinese study-abroad agency or by applicants themselves (in Chinese or English, often shortened), to one university's official English programme list. The same programme means the same subject and the same kind of degree (MSc, MA, MSocSc, LLM, MEd, MBA, MComp, MTech, …): its official name, a translation of it, or a shortened form. Rules: never match a different programme in the same field (Finance is not FinTech; Analytics is not Business Analytics; Marketing is not Marketing Analytics). 管理学硕士 and 管理学理学硕士 are a Master/MSc in Management, never an MBA (工商管理硕士). Computer Engineering (计算机工程) is not Computing or Computer Science. A programme run jointly with another university (联合开设, 联合培养) is a different programme unless the list names that joint programme. A general degree is not one of its specialisations, and one specialisation is not another. Give several ids only when the list holds this very programme more than once (the same name or a variant of it, e.g. full-time and part-time). Mark sure only when the subject and the degree clearly agree. If the list doesn't hold the same programme, give no ids.",
        MATCH_TOOL,
        `University: ${university} (${institutionId})\n\nThe university's programmes (id | name | degree | mode):\n${list}\n\nNames to match:\n${asked}`,
      );
      const nameOf = new Map(own.map((p) => [p.id, p.name]));
      const chinese = (id: string) => /\(CN\)|Chinese/i.test(nameOf.get(id) ?? "");
      for (const m of (v.matches as { n: number; ids: string[]; sure: boolean }[] | undefined) ?? []) {
        const zh = batch[m.n - 1];
        if (!zh) continue;
        // The agency marks the teaching language; keep only the version taught in it.
        const lang = /中文授课/.test(zh) ? "zh" : /英文授课/.test(zh) ? "en" : null;
        const kept = (m.ids ?? []).filter((id) => ids.has(id) && (lang === "zh" ? chinese(id) : lang === "en" ? !chinese(id) : true));
        matches[`${institutionId}|${zh}`] = { ids: kept, sure: !!m.sure };
      }
      for (const zh of batch) matches[`${institutionId}|${zh}`] ??= { ids: [], sure: false };
      writeJson(PROGRAMME_MATCHES_FILE, matches);
      console.log(`${institutionId}: ${Math.min(i + 80, todo.length)}/${todo.length} names asked`);
    }
  }

  // 1b. Matches Haiku wasn't sure of: the naming model looks again, with the candidates' full names and the
  // university's other programmes, and keeps only the ids that are this very programme.
  const unsureKeys = Object.entries(matches).filter(([, m]) => m.ids.length && !m.sure && !m.checked).map(([k]) => k);
  for (let i = 0; i < unsureKeys.length; i += 40) {
    const batch = unsureKeys.slice(i, i + 40);
    const text = batch
      .map((k, j) => {
        const [institutionId, zh] = k.split("|");
        const own = programmes.filter((p) => p.institutionId === institutionId);
        const candidates = matches[k].ids.map((id) => `   - ${id} | ${own.find((p) => p.id === id)?.name ?? id}`).join("\n");
        const others = own.filter((p) => !matches[k].ids.includes(p.id)).map((p) => p.name).slice(0, 60).join("; ");
        return `${j + 1}. ${zh} (at ${universityName(institutionId)})\n   candidates:\n${candidates}\n   the university's other programmes here: ${others}`;
      })
      .join("\n\n");
    const v = await ask(
      "Each numbered item is a master's programme named in Chinese by a study-abroad agency, with candidate programmes from the university's official English list. Keep a candidate only if it is this very programme: the same subject and degree (a stream or track named in brackets, e.g. 常规方向 'general stream', belongs to the programme that offers it). A different subject in the same field, a joint programme with another university, or one specialisation for another is not the same. If the general programme and a special variant (a fellowship, scholarship or other cohort) are both candidates, keep only the general programme.",
      CONFIRM_TOOL,
      text,
      8000,
      NAMING_MODEL,
    );
    const answers = new Map(((v.answers as { n: number; ids: string[] }[] | undefined) ?? []).map((x) => [x.n, x.ids ?? []]));
    batch.forEach((k, j) => {
      const kept = (answers.get(j + 1) ?? []).filter((id) => matches[k].ids.includes(id));
      matches[k] = { ids: kept, sure: kept.length > 0, checked: true };
    });
    writeJson(PROGRAMME_MATCHES_FILE, matches);
    console.log(`unsure matches looked at again: ${Math.min(i + 40, unsureKeys.length)}/${unsureKeys.length}`);
  }

  // 2. Overseas undergraduate schools.
  const qs = readJson<{ universities: Qs[] }>(QS_FILE, { universities: [] }).universities;
  const schools = readJson<Record<string, School>>(SCHOOLS_FILE, {});
  const overseas = [...new Set(cases.filter((c) => c.category === "海外本科" && c.school).map((c) => c.school))].filter((s) => refreshSchools || !schools[s]);
  const named: { zh: string; english: string; country: string }[] = [];
  for (let i = 0; i < overseas.length; i += 120) {
    const batch = overseas.slice(i, i + 120);
    const v = await ask(
      "You identify universities named in Chinese (or English), as Chinese students write them, e.g. 乐卓博大学 is La Trobe University. Give each one's official English name as the university itself uses it, and its country or territory. A branch campus abroad counts as its parent university (诺丁汉大学马来西亚分校 → University of Nottingham, United Kingdom). When a name joins two universities with + (a joint or 2+2 degree), give the one outside mainland China. If a name is ambiguous or you don't know it, leave english empty.",
      SCHOOL_TOOL,
      batch.map((s, j) => `${j + 1}. ${s}`).join("\n"),
      8000,
      NAMING_MODEL,
    );
    for (const s of (v.schools as { n: number; english: string; country: string }[] | undefined) ?? []) {
      const zh = batch[s.n - 1];
      if (zh) named.push({ zh, ...(KNOWN[zh] ?? { english: s.english?.trim() ?? "", country: s.country?.trim() ?? "" }) });
    }
    console.log(`overseas schools named: ${Math.min(i + 120, overseas.length)}/${overseas.length}`);
  }
  // Exact names first (the name, or its abbreviation, as QS writes it); the rest go to Haiku with the closest QS names.
  const unsure: { zh: string; english: string; country: string; candidates: Qs[] }[] = [];
  for (const s of named) {
    if (!s.english) {
      schools[s.zh] = { english: null, country: s.country || null, qsName: null, qsRank: null, qsRankValue: null, how: "none" };
      continue;
    }
    const inCountry = qs.filter((q) => q.country === s.country);
    const pool = inCountry.length ? inCountry : qs;
    const merged = Object.entries(MERGED).find(([from]) => norm(from) === norm(s.english))?.[1];
    const exact = pool.find(
      (q) =>
        norm(q.name) === norm(merged ?? s.english) ||
        abbreviation(q.name) === s.english.replace(/[. ]/g, "") ||
        (/^[A-Z]{2,6}$/.test(q.name) && q.name === initials(s.english)),
    );
    if (exact) {
      schools[s.zh] = { english: s.english, country: s.country, qsName: exact.name, qsRank: exact.rank, qsRankValue: exact.rankValue, how: "exact" };
      continue;
    }
    const mine = tokens(s.english);
    const candidates = pool
      .map((q) => {
        const t = tokens(q.name);
        const shared = [...mine].filter((x) => t.has(x)).length;
        return { q, score: shared / Math.max(1, new Set([...mine, ...t]).size) };
      })
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 8)
      .map((x) => x.q);
    if (!candidates.length) schools[s.zh] = { english: s.english, country: s.country, qsName: null, qsRank: null, qsRankValue: null, how: "none" };
    else unsure.push({ ...s, candidates });
  }
  for (let i = 0; i < unsure.length; i += 40) {
    const batch = unsure.slice(i, i + 40);
    const text = batch.map((s, j) => `${j + 1}. ${s.english} (${s.country}; Chinese: ${s.zh})\n${s.candidates.map((q, k) => `   ${k + 1}) ${q.name}`).join("\n")}`).join("\n");
    const v = await ask(
      "For each university, pick the QS ranking entry that is the same institution. A renamed or merged university counts as the same when the entry is its current name; a named campus counts as the university when QS lists the university as a whole or that campus as its main one (Purdue University West Lafayette → Purdue University). Answer 0 when none of the entries is that university.",
      CHOOSE_TOOL,
      text,
      4000,
      NAMING_MODEL,
    );
    const picks = new Map(((v.choices as { n: number; pick: number }[] | undefined) ?? []).map((c) => [c.n, c.pick]));
    batch.forEach((s, j) => {
      const q = s.candidates[(picks.get(j + 1) ?? 0) - 1];
      schools[s.zh] = q
        ? { english: s.english, country: s.country, qsName: q.name, qsRank: q.rank, qsRankValue: q.rankValue, how: "chosen" }
        : { english: s.english, country: s.country, qsName: null, qsRank: null, qsRankValue: null, how: "none" };
    });
  }
  writeJson(SCHOOLS_FILE, schools);

  const matched = Object.values(matches).filter((m) => m.ids.length).length;
  console.log(`Programme names: ${Object.keys(matches).length}, matched ${matched} · overseas schools: ${Object.keys(schools).length}, with a QS rank ${Object.values(schools).filter((s) => s.qsRankValue).length} · Haiku tokens in ${input} out ${output} (≈ US$${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)}) · ${NAMING_MODEL} tokens in ${namingIn} out ${namingOut}`);
}

// Run only as a script: compass-build.ts imports the file names and types.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/pipeline/compass-match.ts")) {
  keepRunning();
  main();
}
