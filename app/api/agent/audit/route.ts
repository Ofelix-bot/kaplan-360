import Anthropic from "@anthropic-ai/sdk";
import { auditFinal, finalOf } from "@/lib/agent/audit";
import { cleanAnswers } from "@/lib/agent/tools-server";
import { MAX_TEXT } from "@/lib/agent/types";
import { LOCALES, type Locale } from "@/lib/i18n/config";

// POST /api/agent/audit, Make It Fail (lib/agent/audit.ts): AuditRequest in, AuditResponse out (lib/agent/types.ts).
// A separate model call checks every claim of the adviser's finished advice against the official quotes. The same
// guard as /api/parents: this site's own pages only, a few calls a minute per visitor, a capped body, and the text,
// answers and advice are neither stored nor logged. Answers: 200, or {error} with 400 / 403 / 413 / 429 / 502 / 503.

const WINDOW_MS = 60_000;
/** One audit per run, and one more after the rewrite. */
const PER_WINDOW = 10;
const PER_DAY = 100;
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
  if (typeof body.text !== "string") return reply({ error: "bad-request" }, 400);
  const text = body.text.trim();
  if (text.length > MAX_TEXT) return reply({ error: "too-long" }, 413);
  const locale = LOCALES.find((l) => l === body.locale) as Locale | undefined;
  const final = finalOf(body.final);
  if (!locale || !final || !body.answers || typeof body.answers !== "object") return reply({ error: "bad-request" }, 400);

  try {
    return reply(await auditFinal({ locale, text, answers: cleanAnswers(body.answers), final }, key));
  } catch (e) {
    // The error's kind only: never the text, the answers or the advice.
    console.error("agent audit: failed", e instanceof Anthropic.APIError ? e.status : e instanceof Error ? e.name : "unknown");
    return reply({ error: e instanceof Anthropic.RateLimitError ? "busy" : "failed" }, e instanceof Anthropic.RateLimitError ? 429 : 502);
  }
}
