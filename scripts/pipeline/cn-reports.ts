// Mainland Chinese universities' graduate employment quality reports (毕业生就业质量年度报告), read for what they
// say about graduates who went on to study outside mainland China (出国（境）深造): how many, where (countries and
// regions, ranking bands) and which universities, with counts when the report gives them. Read in reverse, the
// destination lists show where an overseas university's mainland students come from.
// Each report is the university's own public disclosure (信息公开 or its careers site). Steps: the newest report on
// the university's disclosure list (lists/cn-universities.json `list`, or found by cn-discover.ts), or the report
// given (`report`); fetch it (PDF or page) politely; Claude (Haiku) reads the pages about study overseas and records
// each figure with the text it came from, checked verbatim against the report; names are matched to
// data/raw/institutions.json.
// Writes data/pipeline/cn-reports/<id>.json (one per university) and data/raw/cn-destinations.json.
// Usage: npx tsx scripts/pipeline/cn-reports.ts [--only=nju,tongji] [--refresh]

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { closeBrowser } from "./browser";
import { CN_CANDIDATES_FILE, CN_DIR, CN_UNIVERSITIES_FILE, get, html, links, reportFile, reportYear, type CnUniversity } from "./cn-lib";
import type { Discovery } from "./cn-discover";
import { AI_MODEL, INSTITUTIONS_FILE, ROOT } from "./config";
import { pageText } from "./extract-lib";
import { routeThroughBrowser } from "./http";
import { pdfPages } from "./pdf";
import { args, keepRunning, readJson, today, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

export const CN_DESTINATIONS_FILE = path.join(ROOT, "data", "raw", "cn-destinations.json");

type University = CnUniversity & { kind?: string; none?: string };

/** Common Chinese names of overseas universities → roster ids, for names the English matching could miss (checked against the roster at run time). */
const ZH_NAMES: Record<string, string> = {
  香港大学: "university-of-hong-kong", 香港中文大学: "chinese-university-of-hong-kong", 香港科技大学: "hong-kong-university-of-science-and-technology",
  香港城市大学: "city-university-of-hong-kong", 香港理工大学: "hong-kong-polytechnic-university", 香港浸会大学: "hong-kong-baptist-university", 澳门大学: "university-of-macau",
  新加坡国立大学: "national-university-of-singapore", 南洋理工大学: "nanyang-technological-university-singapore", 新加坡管理大学: "singapore-management-university",
  伦敦大学学院: "ucl", 帝国理工学院: "imperial-college-london", 伦敦帝国学院: "imperial-college-london", 伦敦政治经济学院: "london-school-of-economics-and-political-science",
  伦敦国王学院: "king-s-college-london", 爱丁堡大学: "university-of-edinburgh", 曼彻斯特大学: "university-of-manchester", 华威大学: "university-of-warwick",
  牛津大学: "university-of-oxford", 剑桥大学: "university-of-cambridge", 布里斯托大学: "university-of-bristol", 格拉斯哥大学: "university-of-glasgow",
  利兹大学: "university-of-leeds", 杜伦大学: "durham-university", 诺丁汉大学: "university-of-nottingham", 南安普顿大学: "university-of-southampton",
  伯明翰大学: "university-of-birmingham", 谢菲尔德大学: "university-of-sheffield", 悉尼大学: "university-of-sydney", 墨尔本大学: "university-of-melbourne",
  新南威尔士大学: "university-of-new-south-wales", 莫纳什大学: "monash-university", 昆士兰大学: "university-of-queensland", 澳大利亚国立大学: "australian-national-university",
  哥伦比亚大学: "columbia-university", 宾夕法尼亚大学: "university-of-pennsylvania", 约翰斯·霍普金斯大学: "johns-hopkins-university", 约翰霍普金斯大学: "johns-hopkins-university",
  纽约大学: "new-york-university", 南加州大学: "university-of-southern-california", 加州大学伯克利分校: "university-of-california-berkeley", 加州大学洛杉矶分校: "university-of-california-los-angeles",
  卡内基梅隆大学: "carnegie-mellon-university", 卡耐基梅隆大学: "carnegie-mellon-university", 康奈尔大学: "cornell-university", 杜克大学: "duke-university",
  芝加哥大学: "university-of-chicago", 斯坦福大学: "stanford-university", 麻省理工学院: "massachusetts-institute-of-technology", 哈佛大学: "harvard-university",
  多伦多大学: "university-of-toronto", 不列颠哥伦比亚大学: "university-of-british-columbia", 东京大学: "university-of-tokyo", 京都大学: "kyoto-university", 早稻田大学: "waseda-university",
};

const squashZh = (s: string) => s.replace(/\s+/g, "").replace(/[（]/g, "(").replace(/[）]/g, ")").replace(/[，]/g, ",").replace(/[：]/g, ":").replace(/[％]/g, "%").toLowerCase();
const plain = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/\(.*?\)/g, " ").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
const REPORT = /就业质量|就业年度报告|毕业生就业报告|就业工作情况|就业概况|教学质量报告/;

/** The newest university-wide report on a disclosure list: the highest year, a whole-university title before a college's. */
async function newest(list: string): Promise<{ url: string; title: string } | null> {
  const pick = (body: string, base: string) =>
    links(body, base)
      .filter((l) => REPORT.test(l.text) && l.url.replace(/\/$/, "") !== list.replace(/\/$/, ""))
      .map((l) => ({ ...l, year: reportYear(l.text) || reportYear(decodeURIComponent(l.url)), college: /学院|学部|系|研究院|分校|校区/.test(l.text.replace(/大学|学校/g, "")) }))
      .filter((l) => l.year > 0)
      .map((l, _, all) => {
        // An employment report beats a teaching-quality report (which names study abroad in a line at most) unless it is years older.
        const newestYear = Math.max(...all.map((x) => x.year));
        return { ...l, employment: /就业/.test(l.text) && l.year >= newestYear - 3 };
      })
      .sort((a, b) => Number(a.college) - Number(b.college) || Number(b.employment) - Number(a.employment) || b.year - a.year)[0];
  let page = await get(list);
  if (!page || page.pdf) return null;
  let best = pick(html(page.file), page.finalUrl);
  if (!best) {
    // Lists drawn by script come back empty: read the list in the browser once.
    routeThroughBrowser([new URL(list).origin]);
    page = await get(list, undefined, true);
    if (page && !page.pdf) best = pick(html(page.file), page.finalUrl);
  }
  return best ? { url: best.url, title: best.text } : null;
}

type Figure = { cohort?: string | null; count: number | null; pct: number | null; quote: string };
type Read = {
  cohort: string | null;
  abroad: (Figure & { group: string | null })[];
  regions: (Figure & { region: string })[];
  ranked: (Figure & { band: string })[];
  destinations: { nameZh: string; nameEn: string; count: number | null; group: string | null; list: string | null; quote: string }[];
};

const figure = (description: string, extra: Record<string, unknown>, required: string[]) => ({
  type: "array",
  description,
  items: {
    type: "object",
    properties: {
      ...extra,
      cohort: { anyOf: [{ type: "string" }, { type: "null" }], description: "The cohort this figure is for, as written, when the text compares cohorts (2022届)" },
      count: { anyOf: [{ type: "number" }, { type: "null" }], description: "Number of graduates, when the text gives one" },
      pct: { anyOf: [{ type: "number" }, { type: "null" }], description: "Percentage, when the text gives one (65.2 for 65.2%)" },
      quote: { type: "string", description: "A short excerpt copied exactly from the text that contains the figure" },
    },
    required: [...required, "cohort", "count", "pct", "quote"],
  },
});

const TOOL: Anthropic.Tool = {
  name: "record_overseas_study",
  description: "Record what the report says about graduates who went on to study outside mainland China.",
  input_schema: {
    type: "object",
    properties: {
      cohort: { anyOf: [{ type: "string" }, { type: "null" }], description: "The graduating cohort the report covers, as written (2025届, 2024年)" },
      abroad: figure("How many graduates went to study outside mainland China (出国（境）深造, 留学), per group", { group: { anyOf: [{ type: "string" }, { type: "null" }], description: "本科生, 硕士生, 博士生 or 全体" } }, ["group"]),
      regions: figure("Countries or regions those graduates went to, with the number or share the text gives", { region: { type: "string", description: "As written: 英国, 中国香港, 美国 …" } }, ["region"]),
      ranked: figure("Shares or numbers admitted by universities in a ranking band (QS 前50, 世界排名前100 …)", { band: { type: "string", description: "As written" } }, ["band"]),
      destinations: {
        type: "array",
        description: "Universities outside mainland China the text names as where graduates went on to study",
        items: {
          type: "object",
          properties: {
            nameZh: { type: "string", description: "The university as the report names it" },
            nameEn: { type: "string", description: "Its usual English name" },
            count: { anyOf: [{ type: "number" }, { type: "null" }], description: "Graduates going there, only when the text gives a number for that university" },
            group: { anyOf: [{ type: "string" }, { type: "null" }], description: "本科生, 硕士生, 博士生 or 全体, when stated" },
            list: { anyOf: [{ type: "string" }, { type: "null" }], description: "The heading of the list or table it is in, as written (出国（境）深造人数前十的院校)" },
            quote: { type: "string", description: "A short excerpt copied exactly from the text that contains the name (and its number, if any)" },
          },
          required: ["nameZh", "nameEn", "count", "group", "list", "quote"],
        },
      },
    },
    required: ["cohort", "abroad", "regions", "ranked", "destinations"],
  },
};

const SYSTEM = `You read part of a mainland Chinese university's report on its graduates (毕业生就业质量报告 or a teaching quality report). Record what it says about graduates who went on to study outside mainland China (Hong Kong, Macau, Taiwan and abroad: 出国（境）深造, 留学, 境外升学):
- abroad: how many went, per group (本科生, 硕士生, 博士生 or 全体), as a number and/or a share;
- regions: the countries or regions they went to, with their numbers or shares;
- ranked: shares or numbers admitted by universities in a ranking band (QS 前50, 世界排名前100 …);
- destinations: every university outside mainland China the text names as a destination, with its number only when the text gives one for that university, the group, and the heading of the list or table it is in.
Every item carries a short quote copied exactly from the text containing its figure or name. In a table, quote the row (the name with its number); if the names and numbers are separated so you cannot tell which number belongs to which name, give the names with count null. Do not list universities in mainland China. Do not infer, total or convert anything the text does not state. Leave a list empty when the text says nothing about it.`;

async function main() {
  const a = args();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  mkdirSync(CN_DIR, { recursive: true });
  const universities = readJson<{ universities: University[] }>(CN_UNIVERSITIES_FILE, { universities: [] }).universities;
  const discovered = readJson<Record<string, Discovery>>(CN_CANDIDATES_FILE, {});
  const roster = readJson<{ institutions: { id: string; name: string; kaggle?: { names?: string[] } | null }[] }>(INSTITUTIONS_FILE, { institutions: [] }).institutions;
  const ids = new Set(roster.map((i) => i.id));
  const byName = new Map<string, string>();
  for (const i of roster) for (const n of [i.name, ...(i.kaggle?.names ?? [])]) if (!byName.has(plain(n))) byName.set(plain(n), i.id);
  const match = (zh: string, en: string) => {
    const z = ZH_NAMES[zh.replace(/\s+/g, "")];
    return (z && ids.has(z) ? z : null) ?? byName.get(plain(en)) ?? byName.get(plain(`University of ${en.replace(/ University$/i, "")}`)) ?? byName.get(plain(`The ${en}`)) ?? null;
  };

  let input = 0;
  let output = 0;
  for (const u of universities.filter((u) => !a.only || a.only.includes(u.id))) {
    const out = path.join(CN_DIR, `${u.id}.json`);
    if (existsSync(out) && !a.refresh) continue;
    // One university's failure (a site down, an unreadable PDF) must not stop the others.
    try {
      const found = u.report ? { url: u.report, title: u.kind ?? "" } : u.list ? await newest(u.list) : discovered[u.id]?.candidates[0] ? { url: discovered[u.id].candidates[0].url, title: discovered[u.id].candidates[0].text } : null;
      if (!found) {
        writeJson(out, { id: u.id, status: "not found", reason: u.none ?? (u.list ? `no report link on ${u.list}` : "no disclosure list or report known"), checked: today() });
        console.log(`${u.id.padEnd(9)} not found ${u.none ?? u.list ?? ""}`);
        continue;
      }
      let doc = await reportFile(found.url);
      // A report page drawn by script (careers platforms such as 91job) comes back nearly empty: read it in the browser.
      if (doc && !doc.pdf && (html(doc.file).match(/[一-鿿]/g) ?? []).length < 300) {
        routeThroughBrowser([new URL(found.url).origin]);
        await get(found.url, undefined, true);
        doc = await reportFile(found.url);
      }
      if (!doc) {
        writeJson(out, { id: u.id, status: "not fetched", url: found.url, checked: today() });
        console.log(`${u.id.padEnd(9)} not fetched ${found.url}`);
        continue;
      }
      const pages = doc.pdf ? await pdfPages(doc.file) : [pageText({ url: doc.url, html: html(doc.file) }).lines.join("\n")];
      const all = pages.join("\n");
      // A PDF whose fonts carry no Unicode map reads as symbols: nothing can be quoted from it.
      const cjk = (all.match(/[一-鿿]/g) ?? []).length;
      if (cjk < 300) {
        writeJson(out, { id: u.id, status: "unreadable", url: doc.url, chars: all.length, cjk, checked: today() });
        console.log(`${u.id.padEnd(9)} unreadable text (${cjk} Chinese characters) · ${doc.url.slice(0, 90)}`);
        continue;
      }
      // The pages about study outside mainland China, in order, up to ~30k characters.
      const picked = pages.filter((p) => /出国|出境|境外|留学|海外|国\(境\)外|国（境）外/.test(p) && /深造|升学|留学|录取/.test(p));
      const text = (picked.length ? picked : pages).join("\n\n").slice(0, 30_000);
      const msg = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: `Report: ${u.zh} (${u.en}) · ${found.title} · ${doc.url}\n\n${text}` }],
      });
      input += msg.usage.input_tokens;
      output += msg.usage.output_tokens;
      const read = (msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use")?.input ?? {}) as Partial<Read>;
      const whole = squashZh(all);
      const dropped: string[] = [];
      const num = (n: number | null) => (n === null ? null : String(n).replace(/\.0+$/, ""));
      // Kept only when the quote is in the report and holds its own figure (and name).
      const quoted = <T extends Figure>(xs: T[] | undefined, label: (x: T) => string, name?: (x: T) => string) =>
        (xs ?? []).filter((x) => {
          const q = squashZh(x.quote ?? "");
          const ok = q.length >= 2 && whole.includes(q) && (!name || q.includes(squashZh(name(x)))) && (x.count === null || q.includes(num(x.count)!)) && (x.pct === null || q.includes(num(x.pct)!));
          if (!ok) dropped.push(label(x));
          return ok;
        });
      const destinations = quoted(
        (read.destinations ?? []).map((d) => ({ ...d, pct: null })),
        (d) => d.nameZh,
        (d) => d.nameZh,
      ).map(({ pct, ...d }) => (void pct, { ...d, institutionId: match(d.nameZh, d.nameEn) }));
      const abroad = quoted(read.abroad, (x) => `abroad ${x.group}`).filter((x) => /出国|出境|境外|留学|海外|国\(境\)外/.test(squashZh(x.quote)));
      const regions = quoted(read.regions, (x) => `region ${x.region}`, (x) => x.region);
      const ranked = quoted(read.ranked, (x) => `ranked ${x.band}`);
      writeJson(out, {
        id: u.id,
        status: "read",
        university: u.zh,
        universityEn: u.en,
        tier: u.tier,
        url: doc.url,
        title: found.title || null,
        year: reportYear(`${read.cohort ?? ""} ${found.title}`) || null,
        cohort: read.cohort ?? null,
        pages: pages.length,
        abroad,
        regions,
        ranked,
        destinations,
        dropped,
        checked: today(),
      });
      console.log(
        `${u.id.padEnd(9)} ${(read.cohort ?? "?").padEnd(8)} ${String(pages.length).padStart(3)}p · abroad ${abroad.length} · regions ${regions.length} · ranked ${ranked.length} · destinations ${destinations.length} (${destinations.filter((d) => d.count !== null).length} with numbers, ${destinations.filter((d) => d.institutionId).length} matched) · dropped ${dropped.length} · ${doc.url.slice(0, 70)}`,
      );
    } catch (e) {
      console.log(`${u.id}: error ${(e as Error).message.slice(0, 160)}`);
    }
  }

  // Everything read so far, by overseas university.
  const reports = universities
    .map((u) => readJson<Record<string, unknown> | null>(path.join(CN_DIR, `${u.id}.json`), null))
    .filter((x): x is Record<string, unknown> => !!x && x.status === "read");
  const byInstitution: Record<string, { from: string; fromEn: string; tier: string; cohort: string | null; count: number | null; group: string | null; list: string | null; url: string }[]> = {};
  for (const rep of reports) {
    // A university named twice in one report (the text's top destinations and a table): once, with the larger number.
    const best = new Map<string, Read["destinations"][number] & { institutionId: string | null }>();
    for (const d of rep.destinations as (Read["destinations"][number] & { institutionId: string | null })[]) {
      if (!d.institutionId) continue;
      const prev = best.get(d.institutionId);
      if (!prev || (d.count ?? -1) > (prev.count ?? -1)) best.set(d.institutionId, d);
    }
    for (const d of best.values())
      (byInstitution[d.institutionId!] ??= []).push({ from: rep.university as string, fromEn: rep.universityEn as string, tier: rep.tier as string, cohort: rep.cohort as string | null, count: d.count, group: d.group, list: d.list, url: rep.url as string });
  }
  writeJson(CN_DESTINATIONS_FILE, {
    dataset: "Study outside mainland China in mainland 985/211 universities' graduate employment quality reports",
    builtAt: today(),
    notes: [
      "Each report is the university's own public disclosure (毕业生就业质量年度报告, or its teaching quality report where that is what it publishes). The newest found for each university is used, so years differ; several universities publish only a summary or have stopped publishing.",
      "Read by Claude (Haiku); every figure keeps the report's own wording, checked verbatim against the report text. Destination lists are usually the main or top-ten destinations, not every graduate.",
    ],
    reports: reports.map(({ dropped, ...rest }) => (void dropped, rest)),
    notFound: universities
      .map((u) => readJson<Record<string, unknown> | null>(path.join(CN_DIR, `${u.id}.json`), null))
      .filter((x): x is Record<string, unknown> => !!x && x.status !== "read")
      .map((x) => ({ id: x.id, status: x.status, reason: x.reason ?? null, url: x.url ?? null })),
    byInstitution,
  });
  console.log(`Reports read: ${reports.length} · overseas universities matched: ${Object.keys(byInstitution).length} · tokens in ${input} out ${output} · ≈ US$${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)}`);
  await closeBrowser();
}

keepRunning();
main();
