// Chinese names for the universities and programmes, for the Chinese pages: official names first, translations
// otherwise, each marked which.
// - Universities: the official Chinese names of those in Hong Kong, Macau and Singapore (their own names); the
//   others, the name in common use in Chinese (Claude, Opus), marked as translated.
// - Programmes: the official Chinese name from the programme's own Chinese page where its English page links one
//   (hreflang alternates or a 繁/中文 switch; robots.txt honoured, one request at a time per site); the others
//   translated by Claude (Haiku) with a fixed glossary for degree names, and the Chinese name agencies use as a hint.
// Simplified and Traditional (Hong Kong) forms both kept, converted with OpenCC.
// Writes data/raw/chinese-names.json. Usage: npx tsx scripts/pipeline/chinese-names.ts [--refresh]
// A run fills in what earlier runs left out; --refresh translates again what isn't official (--programmes: only the
// programmes); --site does only the names
// elsewhere on the site (data/raw/chinese-site-names.json).

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import * as OpenCC from "opencc-js";
import { AI_MODEL, FETCH_LOG_FILE, INSTITUTIONS_FILE, OUTPUT_FILE, ROOT } from "./config";
import { PROGRAMME_MATCHES_FILE, type ProgrammeMatch } from "./compass-match";
import { closeBrowser } from "./browser";
import { politeFetch, routeThroughBrowser } from "./http";
import { args, keepRunning, pool, readJson, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

export const CHINESE_NAMES_FILE = path.join(ROOT, "data", "raw", "chinese-names.json");
/** Names the site's other data files give as English text, with no id: data/raw/chinese-site-names.json. */
export const SITE_NAMES_FILE = path.join(ROOT, "data", "raw", "chinese-site-names.json");
const SITE_FILES = ["kaplan-programmes.json", "topups.json", "changes.json", "cscse-sg-2026-09.json", "topup-scholarships.json", "plan-dates.json", "plan-activities.json"];
export type ChineseName = { hans: string; hant: string; official: boolean; url?: string };

const toHant = OpenCC.Converter({ from: "cn", to: "hk" });
const toHans = OpenCC.Converter({ from: "hk", to: "cn" });

/** The universities' own Chinese names (Hong Kong and Macau in Traditional, Singapore in Simplified, as they write them). */
const OFFICIAL_UNIVERSITIES: Record<string, string> = {
  "university-of-hong-kong": "香港大學",
  "chinese-university-of-hong-kong": "香港中文大學",
  "hong-kong-university-of-science-and-technology": "香港科技大學",
  "hong-kong-polytechnic-university": "香港理工大學",
  "city-university-of-hong-kong": "香港城市大學",
  "hong-kong-baptist-university": "香港浸會大學",
  "lingnan-university-hong-kong": "嶺南大學",
  "education-university-of-hong-kong": "香港教育大學",
  "hong-kong-metropolitan-university": "香港都會大學",
  "hang-seng-university-of-hong-kong": "香港恒生大學",
  "hong-kong-shue-yan-university": "香港樹仁大學",
  "university-of-macau": "澳門大學",
  "macau-university-of-science-and-technology": "澳門科技大學",
  "city-university-of-macau": "澳門城市大學",
  "macao-polytechnic-university": "澳門理工大學",
  "national-university-of-singapore": "新加坡国立大学",
  "nanyang-technological-university-singapore": "南洋理工大学",
  "singapore-management-university": "新加坡管理大学",
  "singapore-university-of-technology-and-design": "新加坡科技设计大学",
};

const GLOSSARY =
  "Degree names: Master of Science / MSc → 理学硕士; Master of Arts / MA → 文学硕士; Master of Social Sciences → 社会科学硕士; Master of Laws / LLM → 法学硕士; Master of Education / MEd → 教育硕士; Master of Business Administration / MBA → 工商管理硕士; Master of Engineering → 工程硕士; Master of Finance → 金融学硕士; Master of Accounting/Accountancy → 会计学硕士; Master of Public Health → 公共卫生硕士; Master of Social Work → 社会工作硕士; Master of Computing → 计算机硕士; Master of Management → 管理学硕士; Master of Research / MRes → 研究型硕士; PgDip / Postgraduate Diploma → 研究生文凭. Any other “Master of <subject>” is <subject>硕士 (Master of Data Science → 数据科学硕士, Master of Biostatistics → 生物统计学硕士): 理学 and 文学 translate only “of Science” / MSc and “of Arts” / MA, never added. Write the subject first, then the degree (MSc in Finance → 金融学理学硕士). Keep a stream or specialisation in brackets. Keep names of people, places and acronyms as they are when they have no settled Chinese form.";

const DEGREE_GLOSSARY =
  "Qualification names: Diploma in X → X文凭; Advanced Diploma → 高级文凭; Higher Diploma → 高等文凭; Graduate Diploma → 研究生文凭; Certificate → 证书; Bachelor of Science → 理学学士; Bachelor of Arts → 文学学士; Bachelor of Business → 商学学士; Bachelor of Commerce → 商科学士; Bachelor of Engineering → 工学学士; Bachelor of Laws / LLB → 法学学士; Bachelor of Information Technology → 信息技术学士; (Hons) or with Honours → （荣誉）; Double Specialisation → 双专业方向; Major in X → X专业; E-Learning → 网课; (Top-up) → （衔接）, as in 工商管理文学学士（荣誉，衔接）; BA → 文学学士, BSc → 理学学士. Write the subject first, then the qualification (Diploma in Accounting and Finance → 会计与金融文凭; Bachelor of Science (Hons) in Psychology → 心理学理学学士（荣誉））. Keep a major or stream in brackets. Keep names of people, places and acronyms as they are when they have no settled Chinese form.";

const UNI_TOOL: Anthropic.Tool = {
  name: "chinese_names",
  description: "The Chinese name of each numbered university.",
  input_schema: { type: "object", properties: { names: { type: "array", items: { type: "object", properties: { n: { type: "integer" }, zh: { type: "string" } }, required: ["n", "zh"] } } }, required: ["names"] },
};
const PROG_TOOL: Anthropic.Tool = {
  name: "chinese_programme_names",
  description: "The Chinese name of each numbered programme.",
  input_schema: { type: "object", properties: { names: { type: "array", items: { type: "object", properties: { n: { type: "integer" }, zh: { type: "string" } }, required: ["n", "zh"] } } }, required: ["names"] },
};

const CJK = /[㐀-鿿]/;
const VERIFY_TOOL: Anthropic.Tool = {
  name: "programme_names",
  description: "For each numbered programme, the Chinese text that is its own name, copied exactly, or an empty string.",
  input_schema: {
    type: "object",
    properties: {
      names: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer" },
            zh: { type: "string", description: "Copied exactly from one candidate (words around the name, such as a university or department name, may be left out); empty when no candidate is this programme's own name." },
          },
          required: ["n", "zh"],
        },
      },
    },
    required: ["names"],
  },
};
const text = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
/** Full-width brackets, as Chinese names write them. */
const brackets = (s: string) => s.replace(/\s*[(（]\s*/g, "（").replace(/\s*[)）]\s*/g, "）");

/** The Chinese name some Hong Kong universities print on the programme's English page: HKUST, PolyU, CityU. */
function inlineChineseName(html: string): string | null {
  const m =
    /Award Title \(Chinese\)\s*<\/div>\s*<div class="block-row-content">([\s\S]*?)<\/div>/i.exec(html) ??
    /<div class="title-chi">([\s\S]*?)<\/div>/i.exec(html) ??
    /<div class="prog_title_chi">([\s\S]*?)<\/div>/i.exec(html);
  const zh = m ? brackets(text(m[1])) : "";
  return CJK.test(zh) ? zh : null;
}

/** Headings on a Chinese page that name a master's degree: the candidates for the programme's own name. */
function chineseCandidates(html: string): string[] {
  const parts = [
    ...[...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1]),
    /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? "",
    ...[...html.matchAll(/<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/gi)].slice(0, 12).map((m) => m[2]),
  ]
    .flatMap((s) => text(s).split(/\s*[|｜–—]\s*|\s+-\s+/))
    .map((s) => s.trim())
    .filter((s) => CJK.test(s) && /碩士|硕士/.test(s) && s.length <= 60);
  return [...new Set(parts)].slice(0, 8);
}

/** The page's Chinese version, where it links one (an hreflang alternate or a 繁/中文 switch). */
function chineseAlternate(html: string, pageUrl: string): string | null {
  const alt =
    /<link[^>]+hreflang="zh(?:-hk|-hant|-tw|-mo)?"[^>]+href="([^"]+)"/i.exec(html)?.[1] ??
    /<link[^>]+href="([^"]+)"[^>]+hreflang="zh(?:-hk|-hant|-tw|-mo)?"/i.exec(html)?.[1] ??
    /<a[^>]+href="([^"#]+)"[^>]*>\s*(?:<[^>]+>\s*)*(?:繁|繁體|繁体|中文|TC)\s*</.exec(html)?.[1];
  if (!alt || /^javascript:/i.test(alt)) return null;
  try {
    const url = new URL(alt, pageUrl).toString();
    return url === pageUrl ? null : url;
  } catch {
    return null;
  }
}

/** The programme's own website elsewhere at the university (a department's or school's), where the page links it. */
function programmeWebsite(html: string, pageUrl: string): string | null {
  const host = new URL(pageUrl).hostname;
  // The university's own domain: hku.hk, cuhk.edu.hk.
  const root = host.split(".").slice(/\.(edu|ac|com|org)\.[a-z]{2}$/.test(host) ? -3 : -2).join(".");
  for (const m of html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]{0,160}?)<\/a>/gi)) {
    let u: URL;
    try {
      u = new URL(m[1]);
    } catch {
      continue;
    }
    if (u.hostname === host || !u.hostname.endsWith(root) || /onlineapp|apply|login/i.test(u.href)) continue;
    if (/programme website|program website|programme homepage|^https?:\/\//i.test(text(m[2]))) return u.href;
  }
  return null;
}

/** The Chinese versions of an English address by its path, as many sites name them: /en/ → /tc/, or no /en/ at all. */
const swapped = (url: string) => {
  if (/\/eng\//.test(url)) return [url.replace(/\/eng\//, "/chi/")];
  return /\/en\//.test(url) ? [url.replace(/\/en\//, "/tc/"), url.replace(/\/en\//, "/")] : [];
};

/** Tries each in turn until one succeeds. */
async function firstOf<T>(items: T[], f: (x: T) => Promise<boolean>) {
  for (const x of items) if (await f(x)) return true;
  return false;
}

async function main() {
  const a = args();
  // HKMU answers scripted requests with 403: its pages, English and Chinese, through the real browser (as asia-catalogue.ts).
  routeThroughBrowser(["https://www.hkmu.edu.hk"]);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const ask = async (model: string, system: string, tool: Anthropic.Tool, content: string) => {
    const forced = model === AI_MODEL;
    const msg = await client.messages.create({
      model,
      max_tokens: 8000,
      system: forced ? system : `${system} Answer only by calling the ${tool.name} tool once, covering every numbered item.`,
      tools: [tool],
      tool_choice: forced ? { type: "tool", name: tool.name } : { type: "auto" },
      messages: [{ role: "user", content }],
    });
    const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    // The list sometimes comes back as JSON text rather than an array.
    let names: unknown = (call?.input as { names?: unknown } | undefined)?.names;
    if (typeof names === "string") {
      try {
        names = JSON.parse(names);
      } catch {
        names = [];
      }
    }
    const list = Array.isArray(names) ? (names as { n: number; zh: unknown }[]) : [];
    return new Map(list.filter((x) => x && typeof x.zh === "string").map((x) => [Number(x.n), (x.zh as string).trim()]));
  };
  /** ask(), with a failed batch left for the next run instead of stopping this one. */
  const tryAsk = async (...x: Parameters<typeof ask>) => {
    try {
      return await ask(...x);
    } catch (e) {
      console.log(`batch failed (left for the next run): ${(e as Error).message}`);
      return new Map<number, string>();
    }
  };

  const { institutions } = readJson<{ institutions: { id: string; name: string; country: string | null }[] }>(INSTITUTIONS_FILE, { institutions: [] });
  const { programmes } = readJson<{ programmes: { id: string; institutionId: string; name: string; degreeType: string | null; sourceUrl: string }[] }>(OUTPUT_FILE, { programmes: [] });
  const log = readJson<Record<string, { file?: string }>>(FETCH_LOG_FILE, {});
  const stored = readJson<{ universities: Record<string, ChineseName>; programmes: Record<string, ChineseName> }>(CHINESE_NAMES_FILE, { universities: {}, programmes: {} });
  const unis = stored.universities;
  const progs = stored.programmes;
  const save = () =>
    writeJson(CHINESE_NAMES_FILE, {
      notes: [
        "Chinese names for the Chinese pages. official: the institution's own name (universities in Hong Kong, Macau and Singapore; programmes from their own Chinese pages, with the page's address). Otherwise translated by Claude: universities by the name in common use, programmes with a fixed glossary for degree names.",
      ],
      universities: unis,
      programmes: progs,
    });
  const both = (zh: string, official: boolean, url?: string): ChineseName => {
    // Full-width brackets and no spaces between Chinese characters, as the names are written.
    const hans = toHans(brackets(zh).replace(/(?<=[㐀-鿿（）])\s+(?=[㐀-鿿（）])/g, ""));
    return { hans, hant: toHant(hans), official, ...(url ? { url } : {}) };
  };

  // 1. Universities.
  const used = new Set(programmes.map((p) => p.institutionId));
  for (const [id, zh] of Object.entries(OFFICIAL_UNIVERSITIES)) if (used.has(id)) unis[id] = { hans: toHans(zh), hant: toHant(toHans(zh)), official: true };
  const uniTodo = institutions.filter((i) => used.has(i.id) && (a.refresh || !unis[i.id]));
  for (let i = 0; i < uniTodo.length; i += 60) {
    const batch = uniTodo.slice(i, i + 60);
    const got = await tryAsk(
      "claude-opus-5-5",
      "Give each university's Chinese name in Simplified Chinese: the name it uses itself in Chinese if it has one (its Chinese website or materials), otherwise the name in common use in mainland China (as Chinese Wikipedia or Chinese study-abroad guides write it). Only the name.",
      UNI_TOOL,
      batch.map((u, j) => `${j + 1}. ${u.name} (${u.country ?? ""})`).join("\n"),
    );
    batch.forEach((u, j) => {
      const zh = got.get(j + 1);
      if (zh && CJK.test(zh)) unis[u.id] = both(zh, false);
    });
    save();
    console.log(`universities: ${Math.min(i + 60, uniTodo.length)}/${uniTodo.length}`);
  }

  // 2. Programmes: the official Chinese name where the university publishes one (Hong Kong and Macau).
  const uniOf = new Map(institutions.map((i) => [i.id, i]));
  const official = programmes.filter((p) => /Hong Kong|Macau/.test(uniOf.get(p.institutionId)?.country ?? ""));
  const cached = (p: (typeof programmes)[number]) => {
    const f = log[p.sourceUrl]?.file;
    return f && existsSync(f) ? readFileSync(f, "utf8") : null;
  };
  // a. Printed on the English page itself.
  let printed = 0;
  for (const p of official) {
    const html = cached(p);
    const zh = html && inlineChineseName(html);
    if (!zh) continue;
    progs[p.id] = both(zh, true, p.sourceUrl);
    printed++;
  }
  // b. On a Chinese page: the programme page's own Chinese version, or that of the programme's own website.
  const found: { p: (typeof programmes)[number]; url: string; candidates: string[] }[] = [];
  // --site and --programmes: the pages read above aren't read again.
  const todo = a.flag("site") || a.flag("programmes") ? [] : official.filter((p) => a.refresh || !progs[p.id]?.official);
  await pool(todo, 6, async (p) => {
    const html = cached(p);
    if (!html) return;
    const tryPage = async (url: string | null) => {
      if (!url) return false;
      const r = await politeFetch(url);
      if (!r.ok) return false;
      const candidates = chineseCandidates(r.body.toString("utf8"));
      if (candidates.length) found.push({ p, url: r.finalUrl, candidates });
      return candidates.length > 0;
    };
    const alternate = chineseAlternate(html, p.sourceUrl);
    if (alternate ? await tryPage(alternate) : await firstOf(swapped(p.sourceUrl), tryPage)) return;
    const site = programmeWebsite(html, p.sourceUrl);
    if (!site) return;
    const r = await politeFetch(site);
    if (!r.ok) return;
    const siteAlternate = chineseAlternate(r.body.toString("utf8"), r.finalUrl);
    if (siteAlternate) await tryPage(siteAlternate);
    else await firstOf(swapped(r.finalUrl), tryPage);
  });
  await closeBrowser();
  // A name read from a Chinese page in an earlier run whose page didn't answer this time is checked as it stands.
  for (const p of todo) if (progs[p.id]?.official && !found.some((x) => x.p === p)) found.push({ p, url: progs[p.id].url ?? p.sourceUrl, candidates: [progs[p.id].hant] });
  // c. Checked: the heading that is the programme's own name, copied exactly from the page.
  let read = 0;
  for (let i = 0; i < found.length; i += 40) {
    const batch = found.slice(i, i + 40);
    const got = await tryAsk(
      "claude-opus-5-5",
      "Each numbered item is a master's programme (its English name and university) with headings from a Chinese web page found for it. Give the heading text that is this programme's own Chinese name, copied exactly; words around the name, such as the university's or department's name, may be left out. Give an empty string when no heading is: a department's or faculty's name, a list or section heading, a degree title without the subject the English name gives, or another programme's name.",
      VERIFY_TOOL,
      batch.map((x, j) => `${j + 1}. ${x.p.name} (${uniOf.get(x.p.institutionId)?.name ?? ""})\n   ${x.candidates.map((c) => `「${c}」`).join(" ")}`).join("\n"),
    );
    batch.forEach((x, j) => {
      const zh = got.get(j + 1);
      if (zh && CJK.test(zh) && x.candidates.some((c) => c.includes(zh))) {
        progs[x.p.id] = both(brackets(zh), true, x.url);
        read++;
      } else if (progs[x.p.id]?.official) delete progs[x.p.id]; // not the programme's own name after all: translated below
    });
  }
  save();
  console.log(`official programme names: ${printed} printed on the English page, ${read} from Chinese pages (${found.length} pages read) · Hong Kong and Macau programmes: ${official.length}`);

  // 3. Programmes: translated, with the Chinese name agencies use (compass-match.ts) as a hint.
  const hints = new Map<string, string>();
  for (const [k, m] of Object.entries(readJson<Record<string, ProgrammeMatch>>(PROGRAMME_MATCHES_FILE, {})))
    if (m.sure && CJK.test(k.split("|")[1] ?? "")) for (const id of m.ids) if (!hints.has(id)) hints.set(id, k.split("|")[1]);
  // --programmes: translate again every programme without an official name (as --refresh does, without the rest).
  const progTodo = programmes.filter((p) => !progs[p.id] || ((a.refresh || a.flag("programmes")) && !progs[p.id].official));
  // The database's degree type only where the name itself names no degree ("Data Science" [MSc]); a name that does wins.
  const NAMED_DEGREE = /\b(master|masters|msc|ma|mba|llm|mres|mphil|meng|med|mfin|macc|pgdip|pgcert|postgraduate|graduate diploma|graduate certificate)\b/i;
  const uniName = new Map(institutions.map((i) => [i.id, i.name]));
  const batches = Array.from({ length: Math.ceil(progTodo.length / 60) }, (_, k) => progTodo.slice(k * 60, k * 60 + 60));
  let doneBatches = 0;
  await pool(batches, 4, async (batch) => {
    const got = await tryAsk(
      AI_MODEL,
      `Translate each master's programme name into Simplified Chinese as Chinese students and universities write programme names. ${GLOSSARY} Where an agency's Chinese name is given as a hint, follow it unless it is wrong, but leave out a length it adds (（2年制）) when the English name gives none.`,
      PROG_TOOL,
      batch.map((p, j) => `${j + 1}. ${p.name}${p.degreeType && !NAMED_DEGREE.test(p.name) ? ` [${p.degreeType}]` : ""} — ${uniName.get(p.institutionId) ?? ""}${hints.has(p.id) ? ` (agency: ${hints.get(p.id)})` : ""}`).join("\n"),
    );
    batch.forEach((p, j) => {
      const zh = got.get(j + 1);
      if (zh && CJK.test(zh)) progs[p.id] = both(zh, false);
    });
    if (++doneBatches % 10 === 0) {
      save();
      console.log(`programmes translated: ${doneBatches}/${batches.length} batches`);
    }
  });
  // A length the agency's name added ("（1.5年制）") stays out when the English name gives none.
  let lengths = 0;
  for (const p of programmes) {
    const z = progs[p.id];
    if (!z || z.official || /\d|year|month|semester/i.test(p.name)) continue;
    const hans = z.hans.replace(/（[\d.一二两三四五半]+(?:年|个月|學期|学期)制?）/g, "");
    if (hans === z.hans || !CJK.test(hans)) continue;
    progs[p.id] = both(hans, false);
    lengths++;
  }
  save();
  console.log(`Lengths taken out of translated names: ${lengths}`);
  console.log(`Universities: ${Object.keys(unis).length} (official ${Object.values(unis).filter((x) => x.official).length}) · programmes: ${Object.keys(progs).length} (official ${Object.values(progs).filter((x) => x.official).length})`);

  // 4. Names elsewhere on the site, by their English text: partner universities, top-up providers and Singapore
  //    schools in the site's data files, and Kaplan's and the top-up degrees. A university here keeps its name above.
  const site = readJson<{ schools: Record<string, ChineseName>; degrees: Record<string, ChineseName> }>(SITE_NAMES_FILE, { schools: {}, degrees: {} });
  const raw = (f: string) => readJson<unknown>(path.join(ROOT, "data", "raw", f), {});
  const schoolNames = new Set<string>();
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" && /^(university|institution)$/i.test(k)) schoolNames.add(v.trim());
      else if (Array.isArray(v) && /^universities$/i.test(k)) {
        for (const x of v) if (typeof x === "string") schoolNames.add(x.trim());
      } else walk(v);
    }
  };
  for (const f of SITE_FILES) walk(raw(f));
  const cscse = raw("cscse-sg-2026-09.json") as { categories?: Record<string, string[]> };
  for (const list of Object.values(cscse.categories ?? {})) for (const x of list) schoolNames.add(x.trim());
  schoolNames.delete("");
  const nameKey = (s: string) =>
    s
      .replace(/,\s*(UK|United Kingdom|Australia|US|USA|Canada|Ireland|New Zealand)\s*$/i, "")
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/\bthe\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterByKey = new Map(institutions.map((i) => [nameKey(i.name), i.id]));
  // Every university here by its English name too, for pages that have only the name (scholarships, changes).
  for (const i of institutions) if (unis[i.id]) site.schools[i.name] = unis[i.id];
  const schoolTodo: string[] = [];
  for (const n of schoolNames) {
    const id = rosterByKey.get(nameKey(n));
    if (id && unis[id]) site.schools[n] = unis[id];
    else if (a.refresh || !site.schools[n]) schoolTodo.push(n);
  }
  for (let i = 0; i < schoolTodo.length; i += 60) {
    const batch = schoolTodo.slice(i, i + 60);
    const got = await tryAsk(
      "claude-opus-5-5",
      "Give each university's or school's Chinese name in Simplified Chinese: the name it uses itself in Chinese if it has one (its Chinese website or materials; Singapore private schools often have one for Chinese students), otherwise the name in common use in mainland China. Keep a campus or centre in the name (James Cook University, Singapore Campus → 詹姆斯库克大学新加坡校区). A former name in brackets is left out. Only the name.",
      UNI_TOOL,
      batch.map((n, j) => `${j + 1}. ${n}`).join("\n"),
    );
    batch.forEach((n, j) => {
      const zh = got.get(j + 1);
      if (zh && CJK.test(zh)) site.schools[n] = both(zh, false);
    });
  }
  const degreeNames = new Set<string>();
  for (const f of ["kaplan-programmes.json", "topups.json"]) for (const p of (raw(f) as { programmes?: { name: string }[] }).programmes ?? []) degreeNames.add(p.name.trim());
  const degreeTodo = [...degreeNames].filter((n) => a.refresh || !site.degrees[n]);
  for (let i = 0; i < degreeTodo.length; i += 60) {
    const batch = degreeTodo.slice(i, i + 60);
    const got = await tryAsk(
      AI_MODEL,
      `Translate each diploma or bachelor's degree name into Simplified Chinese as Chinese students write qualification names. ${DEGREE_GLOSSARY}`,
      PROG_TOOL,
      batch.map((n, j) => `${j + 1}. ${n}`).join("\n"),
    );
    batch.forEach((n, j) => {
      const zh = got.get(j + 1);
      if (zh && CJK.test(zh)) site.degrees[n] = both(zh, false);
    });
  }
  writeJson(SITE_NAMES_FILE, {
    notes: [
      "Chinese names by English text, for names the site's data files give without an id (partner universities, top-up providers and Singapore schools; Kaplan's and the top-up degrees). Universities in the database keep their names from chinese-names.json; the others are translated by Claude.",
    ],
    schools: site.schools,
    degrees: site.degrees,
  });
  console.log(`Site names: schools ${Object.keys(site.schools).length} of ${schoolNames.size} · degrees ${Object.keys(site.degrees).length} of ${degreeNames.size}`);
}

keepRunning();
main();
