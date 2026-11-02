// Benefits from official university pages (scripts/benefits/sources.ts): scholarships and fee
// reductions for international postgraduate students, application-fee waivers, application
// deadlines and events for students in Singapore. Pages are fetched politely (robots.txt, pacing);
// Claude (Haiku) lists the benefits on each page with verbatim quotes, and every quoted field is
// checked against the page text: an item whose title or quotes are not on the page is dropped.
// Writes data/raw/benefits.json. Usage: npx tsx scripts/benefits/collect.ts [--only=aston-university]

import Anthropic from "@anthropic-ai/sdk";
import { closeBrowser } from "../pipeline/browser";
import { pageText } from "../pipeline/extract-lib";
import { politeFetch, routeThroughBrowser } from "../pipeline/http";
import { args, keepRunning, pool, readJson, today, writeJson } from "../pipeline/util";
import { BENEFIT_SOURCES, DEFAULT_EXCLUDE, DEFAULT_FOLLOW, type BenefitSource } from "./sources";
import { amountsBacked, dateBacked, slug, squash } from "./verify";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

const OUT = "data/raw/benefits.json";
/** Each page read this run, as checked (scripts/changes/diff.ts confirms changes against it). */
const PAGES = "data/pipeline/benefits/pages-latest.json";
const MODEL = "claude-haiku-5-5";
const MAX_FOLLOW = 30;

export type Benefit = {
  id: string;
  institutionId: string;
  kind: "scholarship" | "fee-reduction" | "application-fee-waiver" | "deadline" | "event";
  title: string;
  value: string | null;
  amount: number | null;
  currency: string | null;
  percent: number | null;
  forInternational: boolean | null;
  postgraduateTaught: boolean | null;
  automatic: boolean | null;
  intake: string | null;
  deadline: string | null; // YYYY-MM-DD
  eventDate: string | null; // YYYY-MM-DD
  format: string | null;
  disciplines: string | null;
  eligibility: string | null;
  quotes: Record<string, string>;
  url: string;
  retrievedAt: string;
};

const TOOL: Anthropic.Tool = {
  name: "report_benefits",
  description: "Report the benefits described on this official university page.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["scholarship", "fee-reduction", "application-fee-waiver", "deadline", "event"] },
            title: { type: "string", description: "One heading or label line copied exactly from the page (do not combine lines or add words). For deadlines, the heading above the dates." },
            value: { type: "string", description: "The amount or discount exactly as written, e.g. '£3,000 tuition fee reduction' or '20% off tuition'" },
            amount: { type: "number" },
            currency: { type: "string", description: "ISO code" },
            percent: { type: "number" },
            forInternational: { type: "boolean", description: "true if open to international (overseas, non-EU) students" },
            postgraduateTaught: { type: "boolean", description: "true if it applies to taught master's / postgraduate taught study" },
            automatic: { type: "boolean", description: "true if awarded automatically without a separate application" },
            intake: { type: "string", description: "Intake or academic year it applies to, as written, e.g. 'September 2027' or '2026/27'" },
            deadline: { type: "string", description: "Application or closing date as YYYY-MM-DD, only if a full date is written" },
            eventDate: { type: "string", description: "Event date as YYYY-MM-DD, for events" },
            format: { type: "string", description: "For events: online, or the city/venue, as written" },
            disciplines: { type: "string", description: "Subjects or schools it is limited to, as written; omit if all" },
            eligibility: { type: "string", description: "Who can get it, quoted exactly (one or two sentences)" },
            quotes: {
              type: "object",
              description: "Verbatim page text supporting each field you filled: keys value, deadline, eligibility, international, intake, eventDate",
              additionalProperties: { type: "string" },
            },
          },
          required: ["kind", "title", "quotes"],
        },
      },
    },
    required: ["items"],
  },
};

const INSTRUCTIONS = `You read one official university web page and list the benefits it describes for students considering a taught postgraduate (master's) degree: scholarships, tuition fee reductions or discounts (including alumni or early-payment discounts), application-fee waivers, application deadlines for postgraduate intakes, and events (webinars, fairs, visits) for prospective students in Singapore or online.
Rules:
- Only what this page states. Never infer amounts, dates or eligibility. Omit a field the page doesn't state.
- Every field you fill must be supported by a verbatim quote from the page in "quotes" (copy the words exactly, including numbers and currency symbols).
- Ignore undergraduate-only, research-degree-only (PhD) and home/UK-only awards; ignore expired awards for past years.
- A page about one award gives one item. A list page gives one item per award only if it states its value or deadline.
- "title" is a single heading or label copied exactly; put the campus, applicant group or intake in "format", "eligibility" or "intake" instead of the title.
- For a table or list of deadlines, give one item per intake for international applicants (skip home/UK/EU-only rows).`;

async function pagesFor(src: BenefitSource): Promise<{ url: string; html: string }[]> {
  const out: { url: string; html: string }[] = [];
  const seen = new Set<string>();
  const follow: string[] = [];
  for (const hub of src.hubs) {
    const r = await politeFetch(hub);
    if (!r.ok) {
      console.log(`  ${hub}: ${r.reason} ${r.detail}`);
      continue;
    }
    const html = r.body.toString("utf8");
    out.push({ url: r.finalUrl, html });
    seen.add(r.finalUrl.replace(/\/$/, ""));
    const followRe = new RegExp(src.follow ?? DEFAULT_FOLLOW, "i");
    const excludeRe = new RegExp(src.exclude ?? (src.follow ? "$^" : DEFAULT_EXCLUDE), "i");
    const host = new URL(r.finalUrl).host;
    for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
      try {
        const u = new URL(m[1].replace(/&amp;/g, "&"), r.finalUrl);
        u.hash = "";
        u.search = "";
        const path = u.pathname.replace(/\/$/, "");
        const key = `${u.origin}${path}`;
        if (u.host !== host || seen.has(key) || !followRe.test(path) || excludeRe.test(path)) continue;
        seen.add(key);
        follow.push(u.toString());
      } catch {}
    }
  }
  for (const url of [...follow.slice(0, MAX_FOLLOW), ...(src.pages ?? [])]) {
    const r = await politeFetch(url);
    if (r.ok) out.push({ url: r.finalUrl, html: r.body.toString("utf8") });
    else console.log(`  ${url}: ${r.reason} ${r.detail}`);
  }
  return out;
}

async function main() {
  const a = args();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const sources = BENEFIT_SOURCES.filter((s) => !a.only || a.only.includes(s.institutionId));
  routeThroughBrowser(sources.filter((s) => s.browser).flatMap((s) => [...s.hubs, ...(s.pages ?? [])].map((h) => new URL(h).origin)));
  const prev = readJson<{ items: Benefit[]; dropped: unknown[] }>(OUT, { items: [], dropped: [] });
  // Runs add up: the model may list an award on one run and miss it on the next, so earlier verified
  // items stay (each with its own retrievedAt) unless --refresh clears these universities first.
  const keep = a.refresh ? prev.items.filter((b) => !sources.some((s) => s.institutionId === b.institutionId)) : prev.items;
  const items: Benefit[] = [...keep];
  const dropped: { institutionId: string; url: string; title: string; reason: string; value: string | null; quotes: Record<string, string> }[] = [];
  const read: Record<string, string> = {};
  let input = 0, output = 0;

  await pool(sources, 4, async (src) => {
    const pages = await pagesFor(src);
    console.log(`${src.institutionId}: ${pages.length} pages`);
    for (const p of pages) {
      const text = pageText(p).lines.join("\n");
      read[p.url] = squash(text);
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 2500,
        system: INSTRUCTIONS,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: `Page: ${p.url}\n\n${text.slice(0, 30_000)}` }],
      });
      input += msg.usage.input_tokens;
      output += msg.usage.output_tokens;
      const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      const found = ((call?.input as { items?: Record<string, unknown>[] })?.items ?? []) as (Partial<Benefit> & { quotes?: Record<string, string> })[];
      const page = squash(text);
      for (const raw of found) {
        const quotes = raw.quotes ?? {};
        const why =
          !raw.title || !page.includes(squash(raw.title)) ? "title not on the page"
          : Object.entries(quotes).find(([, q]) => !q || !page.includes(squash(q)))?.[0] ? `quote for ${Object.entries(quotes).find(([, q]) => !q || !page.includes(squash(q)))![0]} not on the page`
          : raw.value && !page.includes(squash(raw.value)) && !amountsBacked(raw.value, quotes.value) ? "value not on the page"
          : raw.deadline && !(quotes.deadline && dateBacked(raw.deadline, quotes.deadline)) ? "deadline not backed by its quote"
          : raw.eventDate && !(quotes.eventDate && dateBacked(raw.eventDate, quotes.eventDate)) ? "event date not backed by its quote"
          : null;
        if (why) {
          dropped.push({ institutionId: src.institutionId, url: p.url, title: String(raw.title ?? ""), reason: why, value: raw.value ?? null, quotes: raw.quotes ?? {} });
          continue;
        }
        const b: Benefit = {
          id: `${src.institutionId}-${slug(String(raw.kind))}-${slug(raw.title!)}`,
          institutionId: src.institutionId,
          kind: raw.kind as Benefit["kind"],
          title: raw.title!,
          value: raw.value ?? null,
          amount: raw.amount ?? null,
          currency: raw.currency ?? null,
          percent: raw.percent ?? null,
          forInternational: raw.forInternational ?? null,
          postgraduateTaught: raw.postgraduateTaught ?? null,
          automatic: raw.automatic ?? null,
          intake: raw.intake ?? null,
          deadline: raw.deadline ?? null,
          eventDate: raw.eventDate ?? null,
          format: raw.format ?? null,
          disciplines: raw.disciplines ?? null,
          eligibility: raw.eligibility && page.includes(squash(raw.eligibility)) ? raw.eligibility : null,
          quotes,
          url: p.url,
          retrievedAt: today(),
        };
        // Read again with the same value and dates: keep what checklists.ts worked out for it (its
        // checklist, and whether its wording limits it to other countries), so only new or changed
        // records are drafted again.
        const before = prev.items.find((x) => x.id === b.id) as (Benefit & Record<string, unknown>) | undefined;
        if (before?.checklist && before.value === b.value && before.deadline === b.deadline && before.eventDate === b.eventDate)
          for (const k of ["checklist", "checklistModel", "openToSingapore", "openToSingaporeQuote"]) Object.assign(b, { [k]: before[k] });
        // The same award on its own page and on a list page: keep the fuller record.
        const i = items.findIndex((x) => x.id === b.id);
        const filled = (x: Benefit) => Object.values(x).filter((v) => v !== null).length;
        if (i < 0) items.push(b);
        else if (filled(b) > filled(items[i])) items[i] = b;
      }
    }
  });
  await closeBrowser();
  writeJson(OUT, {
    note: "Benefits read from official university pages; every field is backed by a verbatim quote checked against the page.",
    builtAt: today(),
    items: items.sort((x, y) => x.id.localeCompare(y.id)),
    dropped,
  });
  writeJson(PAGES, { fetchedAt: today(), pages: read });
  console.log(`${items.length} benefits kept, ${dropped.length} dropped · tokens in ${input} out ${output} ≈ US$${((input * 0.1 + output * 0.5) / 1e6).toFixed(3)}`);
}

keepRunning();
main();
