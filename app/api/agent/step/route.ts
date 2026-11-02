import Anthropic from "@anthropic-ai/sdk";
import { messagesOf, runStep, TooManySteps } from "@/lib/agent/run";
import { cleanAnswers } from "@/lib/agent/tools-server";
import { MAX_TEXT, type PageContext } from "@/lib/agent/types";
import { LOCALES, type Locale } from "@/lib/i18n/config";

// POST /api/agent/step, one step of the AI adviser (lib/agent/run.ts): StepRequest in, StepResponse out
// (lib/agent/types.ts). The browser drives the loop and carries the conversation; each step runs the server tools the
// model chose last time, then makes one model call. The same guard as /api/parents: this site's own pages only, a
// few calls a minute per visitor, a capped body, and the text and answers are neither stored nor logged. Answers:
// 200, or {error} with 400 ("bad-request", "too-many-steps") / 403 / 413 / 429 / 502 / 503 ("unavailable": no API key).

const WINDOW_MS = 60_000;
/** A run is up to 12 steps. */
const PER_WINDOW = 30;
const PER_DAY = 300;
/** The conversation grows with each step's tool results; past this it isn't one this server wrote. */
const MAX_BODY = 200_000;
/** Requests per visitor address on this server instance: best effort, it resets when the instance does. */
const seen = new Map<string, number[]>();

function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (seen.get(ip) ?? []).filter((t) => now - t < 86_400_000);
  if (recent.filter((t) => now - t < WINDOW_MS).length >= PER_WINDOW || recent.length >= PER_DAY) return false;
  recent.push(now);
  seen.set(ip, recent);
  if (seen.size > 5000) seen.delete(seen.keys().next().value!);
  return true;
}

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const PAGES: PageContext["page"][] = ["outcomes", "results", "careers", "plan", "profile", "algorithm", "parents", "adviser"];

function contextOf(v: unknown): PageContext | null {
  const x = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  const page = PAGES.find((p) => p === x?.page);
  if (!x || !page) return null;
  const id = (k: string) => (typeof x[k] === "string" && x[k] ? { [k]: (x[k] as string).slice(0, 400) } : {});
  return { page, ...id("programmeId"), ...id("roleId"), ...id("industryId") };
}

function clientResultsOf(v: unknown): { id: string; content: string }[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > 10) return null;
  const out = v.flatMap((r) => (r && typeof r === "object" && typeof r.id === "string" && typeof r.content === "string" ? [{ id: r.id.slice(0, 200), content: r.content.slice(0, MAX_TEXT * 2) }] : []));
  return out.length === v.length ? out : null;
}

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return reply({ error: "unavailable" }, 503);
  // The site's own pages only: the browser always sends Origin on a POST from a page.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let sameSite = false;
  try {
    sameSite = !!origin && !!host && new URL(origin).host === host;
  } catch {}
  if (!sameSite) return reply({ error: "forbidden" }, 403);
  const ip = request.headers.get("x-nf-client-connection-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!allow(ip)) return reply({ error: "busy" }, 429);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return reply({ error: "too-long" }, 413);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply({ error: "too-long" }, 413);
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return reply({ error: "bad-request" }, 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (typeof body.text !== "string") return reply({ error: "bad-request" }, 400);
  if (text.length > MAX_TEXT) return reply({ error: "too-long" }, 413);
  const locale = LOCALES.find((l) => l === body.locale) as Locale | undefined;
  const context = contextOf(body.context);
  const messages = messagesOf(body.messages);
  const clientResults = clientResultsOf(body.clientResults);
  if (!locale || !context || !messages || !clientResults || !body.answers || typeof body.answers !== "object") return reply({ error: "bad-request" }, 400);

  try {
    return reply(await runStep({ locale, context, answers: cleanAnswers(body.answers), text, messages, clientResults }, key));
  } catch (e) {
    if (e instanceof TooManySteps) return reply({ error: "too-many-steps" }, 400);
    // The error's kind only: never the text or the answers.
    console.error("agent step: failed", e instanceof Anthropic.APIError ? e.status : e instanceof Error ? e.name : "unknown");
    if (e instanceof Anthropic.BadRequestError) return reply({ error: "bad-request" }, 400);
    return reply({ error: e instanceof Anthropic.RateLimitError ? "busy" : "failed" }, e instanceof Anthropic.RateLimitError ? 429 : 502);
  }
}
