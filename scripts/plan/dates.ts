// Dates for the timeline planner (/plan), from official pages: when postgraduate applications open
// and close for international students, and events a student in Singapore can join (info sessions,
// open days, visits to Singapore, webinars), plus Kaplan's own programme previews. Pages are read
// politely; Claude (Haiku) lists the dates with verbatim quotes, and every title and date is checked
// against the page: anything not on it is dropped.
// Writes data/raw/plan-dates.json. Usage: npx tsx scripts/plan/dates.ts [--only=ucl] [--refresh]

import Anthropic from "@anthropic-ai/sdk";
import { closeBrowser } from "../pipeline/browser";
import { pageText } from "../pipeline/extract-lib";
import { politeFetch, routeThroughBrowser } from "../pipeline/http";
import { args, keepRunning, pool, readJson, today, writeJson } from "../pipeline/util";
import { PLAN_SOURCES } from "./date-sources";
import { dateBacked, slug, squash } from "./verify";

process.loadEnvFile?.(new URL("../../.env.local", import.meta.url));

const OUT = "data/raw/plan-dates.json";
/** Each page read this run, as checked (scripts/changes/diff.ts confirms changes against it). */
const PAGES = "data/pipeline/plan/pages-latest.json";
const MODEL = "claude-haiku-5-5";

export type PlanDate = {
  id: string;
  institutionId: string;
  kind: "applications-open" | "application-deadline" | "event";
  title: string;
  date: string;
  endDate: string | null;
  intake: string | null;
  format: string | null;
  quotes: Record<string, string>;
  url: string;
  retrievedAt: string;
};

const TOOL: Anthropic.Tool = {
  name: "report_dates",
  description: "Report the dated items on this official university page.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["applications-open", "application-deadline", "event"],
              description: "applications-open: when applications open for a postgraduate taught intake; application-deadline: when they close (for international applicants); event: an info session, open day, webinar, fair or visit that a prospective postgraduate student in Singapore can attend (online or in Singapore)",
            },
            title: { type: "string", description: "One heading or label line copied exactly from the page" },
            date: { type: "string", description: "YYYY-MM-DD, only if the page writes a full date" },
            endDate: { type: "string", description: "YYYY-MM-DD for a multi-day event, if written" },
            intake: { type: "string", description: "The intake it is for, as written (e.g. 'September 2027')" },
            format: { type: "string", description: "Online, Singapore, or the city/venue, as written" },
            quotes: { type: "object", description: "Verbatim page text for the date (key 'date') and format (key 'format')", additionalProperties: { type: "string" } },
          },
          required: ["kind", "title", "date", "quotes"],
        },
      },
    },
    required: ["items"],
  },
};

const INSTRUCTIONS = `You read one official university web page and list dated items useful to a student in Singapore planning a taught postgraduate (master's) degree:
- when applications open and close for postgraduate taught intakes (international applicants; skip home-only, undergraduate and research-degree dates);
- events they can attend: info sessions, open days, webinars, fairs, and visits to Singapore. Skip events only in other countries' cities, unless online.
Rules: only what the page states, with a full date written on the page; copy titles exactly; quote the date text verbatim in quotes.date. Skip dates in the past for intakes that have started.`;

async function main() {
  const a = args();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Set ANTHROPIC_API_KEY in .env.local");
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  const client = new Anthropic({ apiKey: key, maxRetries: 8, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
  const sources = PLAN_SOURCES.filter((s) => !a.only || a.only.includes(s.institutionId));
  routeThroughBrowser(sources.filter((s) => s.browser).flatMap((s) => s.pages.map((p) => new URL(p).origin)));
  const prev = readJson<{ items: PlanDate[] }>(OUT, { items: [] });
  const ran = new Set(sources.map((s) => s.institutionId));
  const items: PlanDate[] = prev.items.filter((x) => !ran.has(x.institutionId));
  const dropped: { url: string; title: string; reason: string }[] = [];
  const failures: { url: string; reason: string }[] = [];
  const read: Record<string, string> = {};
  let input = 0, output = 0;

  await pool(
    sources.flatMap((s) => s.pages.map((url) => ({ s, url }))),
    4,
    async ({ s, url }) => {
      const r = await politeFetch(url);
      if (!r.ok) {
        failures.push({ url, reason: `${r.reason} ${r.detail}` });
        return;
      }
      const text = pageText({ url: r.finalUrl, html: r.body.toString("utf8") }).lines.join("\n");
      read[r.finalUrl] = squash(text);
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 3000,
        system: `${INSTRUCTIONS}${s.hint ? `\n${s.hint}` : ""}\nToday is ${today()}.`,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: `Page: ${r.finalUrl}\n\n${text.slice(0, 40_000)}` }],
      });
      input += msg.usage.input_tokens;
      output += msg.usage.output_tokens;
      const call = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      const found = ((call?.input as { items?: Partial<PlanDate>[] })?.items ?? []) as (Partial<PlanDate> & { quotes?: Record<string, string> })[];
      const page = squash(text);
      for (const x of found) {
        const quotes = x.quotes ?? {};
        const why =
          !x.title || !page.includes(squash(x.title)) ? "title not on the page"
          : !x.date || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) ? "no full date"
          : !quotes.date || !page.includes(squash(quotes.date)) ? "date quote not on the page"
          : !dateBacked(x.date, quotes.date) ? "date not backed by its quote"
          : null;
        if (why) {
          dropped.push({ url, title: String(x.title ?? ""), reason: why });
          continue;
        }
        const item: PlanDate = {
          id: `${s.institutionId}-${x.kind}-${x.date}-${slug(x.title!)}`,
          institutionId: s.institutionId,
          kind: x.kind as PlanDate["kind"],
          title: x.title!,
          date: x.date!,
          endDate: x.endDate && /^\d{4}-\d{2}-\d{2}$/.test(x.endDate) ? x.endDate : null,
          intake: x.intake && page.includes(squash(x.intake)) ? x.intake : null,
          format: quotes.format && page.includes(squash(quotes.format)) ? (x.format ?? null) : null,
          quotes,
          url: r.finalUrl,
          retrievedAt: today(),
        };
        if (!items.some((i) => i.id === item.id)) items.push(item);
      }
    },
  );
  await closeBrowser();
  writeJson(OUT, {
    note: "Application windows and events from official pages; every title and date is checked against its page.",
    builtAt: today(),
    items: items.sort((p, q) => p.date.localeCompare(q.date)),
    dropped,
    failures,
  });
  writeJson(PAGES, { fetchedAt: today(), pages: read });
  console.log(`${items.length} dates kept, ${dropped.length} dropped, ${failures.length} pages failed · tokens in ${input} out ${output}`);
}

keepRunning();
main();
