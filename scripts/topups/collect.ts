// Top-up and partner bachelor's degrees taught in Singapore, from official programme pages
// (scripts/topups/sources.ts): entry route, length, intakes, core modules, admission criteria,
// English, fees and grants. Pages are fetched politely (robots.txt, pacing) and cached; Claude
// (Haiku) reads each page with verbatim quotes, and every quoted text is checked against the page:
// a field whose words are not on the page is dropped, never guessed.
// Writes data/raw/topups.json. Usage: npx tsx scripts/topups/collect.ts [--only=kaplan] [--refresh] [--limit=3] [--discover]

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import path from "node:path";
import { closeBrowser } from "../pipeline/browser";
import { DATA_DIR } from "../pipeline/config";
import { pageText } from "../pipeline/extract-lib";
import { politeFetch, robotsFor, routeThroughBrowser } from "../pipeline/http";
import { args, keepRunning, pool, readJson, today, writeJson } from "../pipeline/util";
import { KAPLAN_SHARED, KAPLAN_SOURCES, PROVIDERS, type TopupSource } from "./sources";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

const OUT = "data/raw/topups.json";
const CACHE = path.join(DATA_DIR, "topups", "pages");
const MODEL = "claude-haiku-5-5";
const MAX_FOLLOW = 80;

export type Qualification = {
  text: string;
  kind: "polytechnic-diploma" | "kaplan-diploma" | "pei-diploma" | "advanced-diploma" | "higher-diploma" | "a-level" | "degree" | "foreign" | "other";
};
export type Grant = { title: string; value: string | null; eligibility: string | null };
export type Fee = { applicant: "local" | "international" | "all"; amount: number; currency: string; text: string };

export type Topup = {
  id: string;
  provider: string;
  kaplanId: string | null;
  name: string;
  university: string | null;
  route: "top-up" | "advanced-standing" | "direct-honours" | "full-degree" | null;
  routeText: string | null;
  months: [number, number] | null;
  intakeMonths: number[];
  moduleCount: number | null;
  coreModules: string[];
  electiveModules: string[];
  qualifications: Qualification[];
  fieldRequirement: string | null;
  gradeRequirement: string | null;
  english: string[];
  ieltsMin: number | null;
  workExperience: string | null;
  bridging: string | null;
  international: boolean | null;
  fees: Fee[];
  grants: Grant[];
  quotes: Record<string, string>;
  url: string;
  retrievedAt: string;
};

const TOOL: Anthropic.Tool = {
  name: "report_programme",
  description: "Report the facts this official programme page states about one bachelor's degree.",
  input_schema: {
    type: "object",
    properties: {
      isBachelor: { type: "boolean", description: "true if the page describes one bachelor's degree (including a top-up); false for a listing, diploma, master's or other page" },
      name: { type: "string", description: "The degree's name exactly as in the page heading" },
      university: { type: "string", description: "The awarding university, as written" },
      route: {
        type: "string",
        enum: ["top-up", "advanced-standing", "direct-honours", "full-degree"],
        description: "top-up: a final-year (or final two years) top-up for diploma holders; advanced-standing: diploma holders get credit or enter year 2; direct-honours: a full honours degree entered directly; full-degree: none of these",
      },
      routeText: { type: "string", description: "The sentence that says how diploma holders enter (e.g. 'Diploma holders can gain direct entry to Year 2 of the Degree'), copied exactly" },
      monthsMin: { type: "number", description: "Shortest length in months (full-time if both are given)" },
      monthsMax: { type: "number" },
      intakeMonths: { type: "array", items: { type: "number" }, description: "Intake months, 1–12" },
      moduleCount: { type: "number" },
      coreModules: { type: "array", items: { type: "string" }, description: "Core or compulsory module names, each copied exactly, in page order" },
      electiveModules: { type: "array", items: { type: "string" }, description: "Elective module names, each copied exactly" },
      qualifications: {
        type: "array",
        description: "Each accepted entry qualification line, copied exactly",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            kind: { type: "string", enum: ["polytechnic-diploma", "kaplan-diploma", "pei-diploma", "advanced-diploma", "higher-diploma", "a-level", "degree", "foreign", "other"] },
          },
          required: ["text", "kind"],
        },
      },
      fieldRequirement: { type: "string", description: "Any requirement that the diploma be in a related field, copied exactly; omit if none is stated" },
      gradeRequirement: { type: "string", description: "Any minimum GPA, grade or result, copied exactly; omit if none" },
      english: { type: "array", items: { type: "string" }, description: "Each English language requirement line, copied exactly" },
      ieltsMin: { type: "number", description: "The overall IELTS minimum stated, if any" },
      workExperience: { type: "string", description: "The work-experience entry route sentence, copied exactly" },
      bridging: { type: "string", description: "The sentence about bridging modules, copied exactly" },
      international: { type: "boolean", description: "true if international applicants (Student's Pass) can apply, e.g. a full-time mode for 'Local / International Applicants'; false if local applicants only" },
      fees: {
        type: "array",
        items: {
          type: "object",
          properties: {
            applicant: { type: "string", enum: ["local", "international", "all"] },
            amount: { type: "number", description: "The total programme fee (the nett or payable figure if both are given)" },
            currency: { type: "string", description: "ISO code" },
            text: { type: "string", description: "The fee line copied exactly, e.g. 'S$24,001.80 payable in 6 instalments'" },
          },
          required: ["applicant", "amount", "currency", "text"],
        },
      },
      grants: {
        type: "array",
        description: "Scholarships, grants or fee reductions named on the page",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "The sentence or heading that names it, copied exactly" },
            value: { type: "string", description: "The amount as written" },
            eligibility: { type: "string", description: "Who can get it, copied exactly" },
          },
          required: ["title"],
        },
      },
      quotes: {
        type: "object",
        description: "Verbatim page text supporting the numbers you filled: keys months, intakeMonths, moduleCount, ieltsMin, international",
        additionalProperties: { type: "string" },
      },
    },
    required: ["isBachelor", "quotes"],
  },
};

const INSTRUCTIONS = `You read one official web page from a Singapore private education institution about a bachelor's degree (often a top-up for diploma holders).
Rules:
- Only what this page states. Never infer. Omit a field the page doesn't state.
- Text fields and list items are copied exactly from the page, word for word, including punctuation.
- Every number you fill is supported by a verbatim quote in "quotes".
- The page may repeat sections for part-time and full-time modes: report each item once.
- Ignore other programmes mentioned in menus, footers or "you may also like" lists.`;

const squash = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/\s+/g, " ").trim().toLowerCase();
const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);

type Page = { url: string; finalUrl: string; html: string; fetchedAt: string };

async function getPage(url: string, refresh: boolean): Promise<Page | { error: string }> {
  const file = path.join(CACHE, createHash("sha1").update(url).digest("hex").slice(0, 16) + ".json");
  const cached = readJson<Page | null>(file, null);
  if (cached && !refresh) return cached;
  const r = await politeFetch(url);
  if (!r.ok) return { error: `${r.reason} ${r.detail}` };
  const page = { url, finalUrl: r.finalUrl, html: r.body.toString("utf8"), fetchedAt: today() };
  writeJson(file, page);
  return page;
}

/** Programme pages linked from a provider's hubs. */
async function discover(p: (typeof PROVIDERS)[number], refresh: boolean): Promise<TopupSource[]> {
  const out = new Map<string, TopupSource>();
  for (const u of p.pages ?? []) out.set(u, { provider: p.id, url: u });
  if (p.sitemap) {
    const re = new RegExp(p.sitemap.pattern, "i");
    const robots = await robotsFor(p.sitemap.origin);
    const queue = robots !== "unreachable" && robots.sitemaps.length ? [...robots.sitemaps] : [p.sitemap.origin + "/sitemap.xml"];
    for (let n = 0; queue.length && n < 40; n++) {
      const r = await politeFetch(queue.shift()!, 40_000_000);
      if (!r.ok) {
        console.log(`  sitemap: ${r.reason} ${r.detail}`);
        continue;
      }
      const xml = r.body.toString("utf8");
      const locs = Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g), (m) => m[1].trim());
      if (/<sitemapindex/.test(xml)) queue.push(...locs.filter((l) => !/image|post-|category|tag/i.test(l)));
      else for (const l of locs) if (re.test(new URL(l).pathname)) out.set(l.replace(/\/$/, ""), { provider: p.id, url: l });
    }
  }
  const follow = new RegExp(p.follow ?? "degree|bachelor|top-up", "i");
  const exclude = new RegExp(p.exclude ?? "$^", "i");
  for (const hub of p.hubs) {
    const page = await getPage(hub, refresh);
    if ("error" in page) {
      console.log(`  ${hub}: ${page.error}`);
      continue;
    }
    const host = new URL(page.finalUrl).host;
    for (const m of page.html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
      try {
        const u = new URL(m[1].replace(/&amp;/g, "&"), page.finalUrl);
        u.hash = "";
        u.search = "";
        if (u.host !== host || !follow.test(u.pathname) || exclude.test(u.pathname)) continue;
        out.set(u.toString().replace(/\/$/, ""), { provider: p.id, url: u.toString() });
      } catch {}
    }
  }
  return [...out.values()].slice(0, MAX_FOLLOW);
}

async function main() {
  const a = args();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const want = (id: string) => !a.only || a.only.includes(id);
  const providers = PROVIDERS.filter((p) => want(p.id));
  routeThroughBrowser(providers.filter((p) => p.browser).flatMap((p) => [...p.hubs, ...(p.pages ?? []), ...(p.sitemap ? [p.sitemap.origin] : [])].map((h) => new URL(h).origin)));

  const sources: TopupSource[] = want("kaplan") ? [...KAPLAN_SOURCES] : [];
  for (const p of providers) {
    const found = await discover(p, a.refresh);
    console.log(`${p.id}: ${found.length} candidate pages`);
    sources.push(...found);
  }
  if (a.flag("discover")) {
    console.log(sources.map((s) => `${s.provider} ${s.url}`).join("\n"));
    await closeBrowser();
    return;
  }
  const todo = a.limit ? sources.slice(0, a.limit) : sources;

  const prev = readJson<{ programmes: Topup[] }>(OUT, { programmes: [] });
  const ran = new Set(todo.map((s) => s.provider));
  const programmes: Topup[] = a.limit ? [...prev.programmes] : prev.programmes.filter((t) => !ran.has(t.provider));
  const failures: { url: string; reason: string }[] = [];
  const dropped: { url: string; field: string; text: string }[] = [];
  let input = 0, output = 0;

  await pool(todo, 4, async (src) => {
    const page = await getPage(src.url, a.refresh);
    if ("error" in page) {
      failures.push({ url: src.url, reason: page.error });
      console.log(`  ✗ ${src.url}: ${page.error}`);
      return;
    }
    const text = pageText({ url: page.finalUrl, html: page.html }).lines.join("\n");
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: INSTRUCTIONS,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: `Page: ${page.finalUrl}\n\n${text.slice(0, 45_000)}` }],
    });
    input += msg.usage.input_tokens;
    output += msg.usage.output_tokens;
    const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    const r = (call?.input ?? {}) as Record<string, unknown> & { quotes?: Record<string, string> };
    if (!r.isBachelor) {
      failures.push({ url: src.url, reason: "not a bachelor's degree page" });
      return;
    }
    const body = squash(text);
    const on = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0 && body.includes(squash(s));
    const keepText = (field: string, s: unknown) => {
      if (s == null || s === "") return null;
      if (on(s)) return s;
      dropped.push({ url: src.url, field, text: String(s) });
      return null;
    };
    const keepList = (field: string, xs: unknown) => ((Array.isArray(xs) ? xs : []) as string[]).filter((x) => keepText(field, x) !== null);
    // A quote may join a label and its value from two lines ("Programme type: Full-time, 4 years"):
    // it counts when every piece between the joins is on the page.
    const quoteOn = (q: unknown): q is string =>
      on(q) ||
      (typeof q === "string" &&
        q.split(/\s*(?:[:;()]|\.\.\.|…)\s*/).filter((p) => p.trim().length >= 3).every((p) => body.includes(squash(p))) &&
        q.split(/\s*(?:[:;()]|\.\.\.|…)\s*/).some((p) => p.trim().length >= 3));
    const quotes = Object.fromEntries(
      Object.entries(r.quotes ?? {}).filter(([k, q]) => {
        if (quoteOn(q)) return true;
        dropped.push({ url: src.url, field: `quote:${k}`, text: String(q) });
        return false;
      }),
    );
    const backed = (k: string, n: unknown) => (typeof n === "number" && quotes[k] && squash(quotes[k]).includes(String(n)) ? n : null);
    // Lengths are often written in years ("4 years", "1.5 to 2.5 years"): 48 months is backed by "4 … year".
    const backedMonths = (n: unknown) => {
      if (typeof n !== "number" || !quotes.months) return null;
      const q = squash(quotes.months);
      return q.includes(String(n)) || (/year/.test(q) && new RegExp(`(^|[^\\d.])${String(n / 12).replace(".", "\\.")}([^\\d]|$)`).test(q)) ? n : null;
    };
    const name = keepText("name", r.name);
    if (!name) {
      failures.push({ url: src.url, reason: "degree name not on the page" });
      return;
    }
    const mMin = backedMonths(r.monthsMin);
    const mMax = backedMonths(r.monthsMax) ?? mMin;
    const t: Topup = {
      id: src.kaplanId ?? `${src.provider}-${slug(name)}`,
      provider: src.provider,
      kaplanId: src.kaplanId ?? null,
      name,
      university: keepText("university", r.university),
      route: (r.route as Topup["route"]) ?? null,
      routeText: keepText("routeText", r.routeText),
      months: mMin ? [Math.min(mMin, mMax!), Math.max(mMin, mMax!)] : null,
      intakeMonths: quotes.intakeMonths ? ((r.intakeMonths as number[]) ?? []).filter((m) => m >= 1 && m <= 12) : [],
      moduleCount: backed("moduleCount", r.moduleCount),
      coreModules: keepList("coreModules", r.coreModules),
      electiveModules: keepList("electiveModules", r.electiveModules),
      qualifications: ((r.qualifications as Qualification[]) ?? []).filter((q) => keepText("qualifications", q.text) !== null),
      fieldRequirement: keepText("fieldRequirement", r.fieldRequirement),
      gradeRequirement: keepText("gradeRequirement", r.gradeRequirement),
      english: keepList("english", r.english),
      ieltsMin: backed("ieltsMin", r.ieltsMin),
      workExperience: keepText("workExperience", r.workExperience),
      bridging: keepText("bridging", r.bridging),
      international: quotes.international && typeof r.international === "boolean" ? r.international : null,
      fees: ((r.fees as Fee[]) ?? []).filter((f) => keepText("fees", f.text) !== null && squash(f.text).includes(String(f.amount).split(".")[0])),
      grants: ((r.grants as Grant[]) ?? [])
        .filter((g) => keepText("grants", g.title) !== null)
        .map((g) => ({ title: g.title, value: on(g.value) ? g.value! : null, eligibility: on(g.eligibility) ? g.eligibility! : null })),
      quotes,
      url: page.finalUrl,
      retrievedAt: page.fetchedAt,
    };
    const i = programmes.findIndex((x) => x.id === t.id);
    if (i >= 0) programmes[i] = t;
    else programmes.push(t);
    console.log(`  ✓ ${t.id}: ${t.coreModules.length} core, ${t.qualifications.length} quals, ${t.fees.length} fees, ${t.grants.length} grants`);
  });
  await closeBrowser();
  writeJson(OUT, {
    note: "Bachelor's and top-up degrees taught in Singapore, from official programme pages; every text is checked word for word against its page.",
    builtAt: today(),
    shared: KAPLAN_SHARED,
    programmes: programmes.sort((x, y) => x.provider.localeCompare(y.provider) || x.id.localeCompare(y.id)),
    failures,
    dropped,
  });
  console.log(`${programmes.length} programmes, ${failures.length} failures, ${dropped.length} dropped fields · tokens in ${input} out ${output}`);
}

keepRunning();
main();
