// Each programme's English requirement as its own pages word it: minimum scores, and whether applicants whose degree
// was taught in English are exempt (and from which countries, when the exemption names them). Claude (Haiku) reads the
// sentences of the cached official pages (programme page and the English page it cites) that mention English, a test or
// the medium of instruction; every figure keeps its quote, which must appear on the page word for word, or it is dropped.
// Writes data/raw/english-requirements.json. Usage: npx tsx scripts/pipeline/english-programme.ts --countries=Singapore,"Hong Kong SAR" [--refresh]

import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AI_MODEL, CACHE_DIR, FETCH_LOG_FILE, INSTITUTIONS_FILE, OUTPUT_FILE, ROOT } from "./config";
import { politeFetch } from "./http";
import { args, keepRunning, pool, readJson, writeJson } from "./util";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

export const ENGLISH_FILE = path.join(ROOT, "data", "raw", "english-requirements.json");

export type EnglishRequirement = {
  /** "unless-exempt": a score is needed only without an English-taught degree; "all": every applicant whose first language isn't English; "none": the pages state no English requirement. */
  required: "all" | "unless-exempt" | "none";
  exemption: { countries: string[]; quote: string; url: string } | null;
  ielts: { overall: number; minSub: number | null; quote: string } | null;
  toefl: { ibt: number; quote: string } | null;
  pte: { overall: number; quote: string } | null;
  duolingo: { score: number; quote: string } | null;
  checked: string;
};

type Programme = { id: string; institutionId: string; name: string; sourceUrl: string; evidence: { field: string; url: string }[] };

const TOOL: Anthropic.Tool = {
  name: "english_requirement",
  description: "The programme's English language requirement as these sentences state it.",
  input_schema: {
    type: "object",
    properties: {
      required: {
        type: "string",
        enum: ["all", "unless-exempt", "none"],
        description: "unless-exempt: a test score is needed only by applicants whose degree was not taught in English (or similar); all: a score is needed from every applicant whose first language is not English, whatever the language of their degree; none: no English requirement is stated",
      },
      exemptionQuote: { type: "string", description: "The sentence, copied exactly, that exempts applicants whose degree was taught in English (empty if none)" },
      exemptionCountries: { type: "array", items: { type: "string" }, description: "Countries the exemption is limited to, if the sentence lists them (in English); empty if it applies to English-taught degrees from anywhere" },
      ielts: { type: "number", description: "Minimum IELTS overall band; 0 if not stated" },
      ieltsMinSub: { type: "number", description: "Minimum IELTS band in each part, if stated; 0 if not" },
      ieltsQuote: { type: "string", description: "The words stating the IELTS minimum, copied exactly (empty if none)" },
      toefl: { type: "number", description: "Minimum TOEFL iBT total on the 0–120 scale (tests before 21 January 2026); 0 if not stated" },
      toeflQuote: { type: "string" },
      pte: { type: "number", description: "Minimum PTE Academic overall; 0 if not stated" },
      pteQuote: { type: "string" },
      duolingo: { type: "number", description: "Minimum Duolingo English Test score; 0 if not stated" },
      duolingoQuote: { type: "string" },
    },
    required: ["required", "exemptionQuote", "exemptionCountries", "ielts", "ieltsMinSub", "ieltsQuote", "toefl", "toeflQuote", "pte", "pteQuote", "duolingo", "duolingoQuote"],
  },
};

const plain = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ");
const squash = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const ABOUT = /english|ielts|toefl|pte\b|duolingo|medium of (instruction|teaching)|language of (instruction|teaching)|language (proficiency|requirement)/i;

async function main() {
  const a = args();
  const countries = (process.argv.find((x) => x.startsWith("--countries="))?.split("=")[1] ?? "Singapore,Hong Kong SAR").split(",");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const { institutions } = readJson<{ institutions: { id: string; country: string | null }[] }>(INSTITUTIONS_FILE, { institutions: [] });
  const country = new Map(institutions.map((i) => [i.id, i.country ?? ""]));
  const { programmes } = readJson<{ programmes: Programme[] }>(OUTPUT_FILE, { programmes: [] });
  const log = readJson<Record<string, { file?: string }>>(FETCH_LOG_FILE, {});
  const stored = readJson<{ programmes: Record<string, EnglishRequirement>; universities?: Record<string, EnglishRequirement & { url: string }> }>(ENGLISH_FILE, { programmes: {} });
  const out = stored.programmes;
  const universities = stored.universities ?? {};
  const save = () => writeJson(ENGLISH_FILE, { notes: NOTES, programmes: out, universities });
  // --countries=all reads every programme.
  const inScope = (p: Programme) => countries.includes("all") || countries.includes(country.get(p.institutionId) ?? "");
  const todo = a.flag("universities") ? [] : programmes.filter((p) => inScope(p) && (a.refresh || !out[p.id]));
  console.log(`Programmes to read: ${todo.length}`);

  let input = 0, output = 0, kept = 0;
  /** One programme's (or one university's) English requirement from its pages; null when the answer can't be read. */
  const readRequirement = async (label: string, pages: { url: string; text: string }[], fallbackUrl: string): Promise<EnglishRequirement | null> => {
    // The sentences about English, with the one before and after (exemptions often follow the scores).
    const parts: string[] = [];
    for (const pg of pages) {
      const s = pg.text.split(/(?<=[.;:])\s+(?=[A-Z0-9*(•–-])/);
      s.forEach((x, i) => {
        if (ABOUT.test(x)) parts.push([s[i - 1], x, s[i + 1]].filter(Boolean).join(" ").slice(0, 900));
      });
    }
    const text = [...new Set(parts)].join("\n").slice(0, 14_000);
    if (!text) return { required: "none", exemption: null, ielts: null, toefl: null, pte: null, duolingo: null, checked: new Date().toISOString().slice(0, 10) };
    const system =
      "You read sentences from a university's official pages about one master's programme and state its English language requirement. Copy quotes exactly as written. Scores only when the sentences state them for this programme or the university's taught postgraduate programmes. An exemption counts only if it is about the applicant's degree having been taught (or the institution's medium of instruction being) English; being a native speaker alone is not one.";
    const read = async (model: string) => {
      const forced = model === AI_MODEL;
      const msg = await client.messages.create({
        model,
        max_tokens: 1500,
        system: forced ? system : `${system} Answer only by calling the ${TOOL.name} tool once.`,
        tools: [TOOL],
        tool_choice: forced ? { type: "tool", name: TOOL.name } : { type: "auto" },
        messages: [{ role: "user", content: `${label}\n\n${text}` }],
      });
      input += msg.usage.input_tokens;
      output += msg.usage.output_tokens;
      return (msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use")?.input ?? {}) as Record<string, unknown>;
    };
    // A garbled answer (tool parameters leaking into a string) is asked again of a stronger model.
    const garbled = (x: Record<string, unknown>) => /<\/?parameter|<\/\w+>/.test(JSON.stringify(x));
    let v = await read(AI_MODEL);
    if (garbled(v)) v = await read("claude-opus-5-5");
    if (garbled(v)) return null;
    const all = squash(pages.map((pg) => pg.text).join(" "));
    const onPage = (q: unknown) => typeof q === "string" && q.trim().length >= 8 && all.includes(squash(q));
    const has = (q: unknown, n: number) => onPage(q) && new RegExp(`(^|[^\\d.])${String(n).replace(".", "\\.")}(\\.0)?([^\\d]|$)`).test(String(q));
    const exemptionQuote = String(v.exemptionQuote ?? "");
    const exemptUrl = pages.find((pg) => squash(pg.text).includes(squash(exemptionQuote)))?.url ?? fallbackUrl;
    const num = (x: unknown) => (typeof x === "number" && x > 0 ? x : null);
    const ielts = num(v.ielts), toefl = num(v.toefl), pte = num(v.pte), duolingo = num(v.duolingo);
    // The model sometimes gives the countries as one string: a list either way.
    const countriesOf = (x: unknown) => (Array.isArray(x) ? x.map(String) : typeof x === "string" && x.trim() ? x.split(/,|\band\b/).map((s) => s.trim()).filter(Boolean) : []);
    const r: EnglishRequirement = {
      required: (["all", "unless-exempt", "none"].includes(String(v.required)) ? v.required : "all") as EnglishRequirement["required"],
      exemption: onPage(exemptionQuote) ? { countries: countriesOf(v.exemptionCountries), quote: exemptionQuote, url: exemptUrl } : null,
      ielts: ielts && ielts <= 9 && has(v.ieltsQuote, ielts) ? { overall: ielts, minSub: num(v.ieltsMinSub), quote: String(v.ieltsQuote) } : null,
      toefl: toefl && toefl <= 120 && has(v.toeflQuote, toefl) ? { ibt: toefl, quote: String(v.toeflQuote) } : null,
      pte: pte && pte <= 90 && has(v.pteQuote, pte) ? { overall: pte, quote: String(v.pteQuote) } : null,
      duolingo: duolingo && duolingo <= 160 && has(v.duolingoQuote, duolingo) ? { score: duolingo, quote: String(v.duolingoQuote) } : null,
      checked: new Date().toISOString().slice(0, 10),
    };
    // Without a quoted exemption the requirement applies to all (a model's "unless-exempt" needs its sentence).
    if (!r.exemption && r.required === "unless-exempt") r.required = "all";
    return r;
  };

  await pool(todo, Number(process.argv.find((x) => x.startsWith("--pool="))?.split("=")[1] ?? 4), async (p) => {
    const urls = [...new Set([p.sourceUrl, ...p.evidence.filter((e) => /ielts|toefl|pte|duolingo|english/i.test(e.field)).map((e) => e.url)])];
    const pages = urls.flatMap((url) => {
      const f = log[url]?.file;
      return f && existsSync(f) ? [{ url, text: plain(readFileSync(f, "utf8")) }] : [];
    });
    const r = await readRequirement(`Programme: ${p.name}`, pages, p.sourceUrl);
    if (!r) return;
    out[p.id] = r;
    if (++kept % 50 === 0) {
      save();
      console.log(`read ${kept}/${todo.length}`);
    }
  });

  // --universities: each university's general taught-postgraduate English page, the rule for programmes whose own
  // pages state none (fetched politely, robots.txt honoured).
  if (a.flag("universities"))
    for (const [id, url] of Object.entries(UNIVERSITY_PAGES)) {
      const r = await politeFetch(url);
      if (!r.ok) {
        console.log(`${id}: ${r.reason} ${r.detail}`);
        continue;
      }
      const html = r.body.toString("utf8");
      mkdirSync(DEFAULTS_CACHE, { recursive: true });
      writeFileSync(path.join(DEFAULTS_CACHE, `${id}.html`), html);
      const req = await readRequirement(`All taught postgraduate (master's) programmes of this university`, [{ url, text: plain(html) }], url);
      if (req) universities[id] = { ...req, url };
      console.log(`${id}: ${req ? `${req.required}${req.exemption ? " · exempt with an English-taught degree" : ""}${req.ielts ? ` · IELTS ${req.ielts.overall}` : ""}${req.toefl ? ` · TOEFL ${req.toefl.ibt}` : ""}` : "not read"}`);
    }
  save();
  const vals = Object.values(out);
  console.log(
    `Programmes: ${vals.length} · exempt with an English-taught degree: ${vals.filter((x) => x.exemption).length} (limited to listed countries: ${vals.filter((x) => x.exemption?.countries.length).length}) · score from all: ${vals.filter((x) => x.required === "all").length} · none stated: ${vals.filter((x) => x.required === "none").length} · tokens in ${input} out ${output} · ≈ US$${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)}`,
  );
}

const NOTES = [
  "Each programme's English requirement as its official pages word it (programme page, and the university English page it cites): minimum scores, and whether applicants whose degree was taught in English are exempt. Read by Claude (Haiku); every quote is checked word for word against the page, and a figure must appear in its quote.",
  "universities: the general taught-postgraduate English rule from each university's own admissions page, used for its programmes whose pages state none.",
];

/** Universities' general taught-postgraduate English pages (official admissions pages). */
const UNIVERSITY_PAGES: Record<string, string> = {
  "chinese-university-of-hong-kong": "https://www.gs.cuhk.edu.hk/admissions/requirements",
  "university-of-hong-kong": "https://admissions.hku.hk/tpg/admissions-requirements",
  "city-university-of-hong-kong": "https://www.cityu.edu.hk/pg/taught-postgraduate-programmes/entrance-requirements",
  "education-university-of-hong-kong": "https://gs.eduhk.hk/pg-programmes-2026/",
  "hang-seng-university-of-hong-kong": "https://gs.hsu.edu.hk/en/frequently-asked-questions-faq/",
  "hong-kong-polytechnic-university": "https://www.polyu.edu.hk/study/pg/taught-postgraduate/admission-requirements-tpg",
};
const DEFAULTS_CACHE = path.join(CACHE_DIR, "english-defaults");

keepRunning();
main();
