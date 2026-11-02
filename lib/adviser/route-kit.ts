import "server-only";
import { cleanAnswers } from "@/lib/agent/tools-server";
import type { AgentError, PageContext } from "@/lib/agent/types";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { ModelError } from "./model";
import { MAX_TEXT, type AdviserEvent, type Agent, type Base } from "./types";

// What the four adviser v2 routes share: the guard copied from app/api/parents/route.ts (this site's own pages, a
// limit per visitor address, a size limit, no key → 503, the text and answers never logged), and the answer: an NDJSON
// stream of AdviserEvents whose last line is always a result or an error, or with ?stream=0 one JSON {events}.

const WINDOW_MS = 60_000;
const PER_WINDOW = 30;
const PER_DAY = 500;
const MAX_BODY = 200_000;
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

export const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (error: AgentError["error"], status: number) => reply({ error }, status);

const PAGES: PageContext["page"][] = ["outcomes", "results", "careers", "plan", "profile", "algorithm", "parents", "adviser"];
const str = (v: unknown, max = 400) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export function contextOf(v: unknown): PageContext {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const page = PAGES.find((p) => p === o.page) ?? "adviser";
  return { page, programmeId: str(o.programmeId), roleId: str(o.roleId), industryId: str(o.industryId, 80) };
}

export type Guarded = { key: string; body: Record<string, unknown>; base: Base; stream: boolean };

/** The guard; a Response when the request is refused. */
export async function guard(request: Request): Promise<Guarded | Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fail("unavailable", 503);
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let sameSite = false;
  try {
    sameSite = !!origin && !!host && new URL(origin).host === host;
  } catch {}
  if (!sameSite) return fail("forbidden", 403);
  const ip = request.headers.get("x-nf-client-connection-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!allow(ip)) return fail("busy", 429);
  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY) return fail("too-long", 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return fail("bad-request", 400);
  }
  if (!body || typeof body !== "object") return fail("bad-request", 400);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length > MAX_TEXT) return fail("too-long", 413);
  const locale = LOCALES.find((l) => l === body.locale) as Locale | undefined;
  if (!locale) return fail("bad-request", 400);
  const stream = new URL(request.url).searchParams.get("stream") !== "0";
  return { key, body, stream, base: { locale, context: contextOf(body.context), answers: cleanAnswers(body.answers), text } };
}

/** Runs a stage and answers with its events: streamed, or all at once with ?stream=0. The last event is the result or an error. */
export function respond(agent: Agent, stream: boolean, run: (emit: (e: AdviserEvent) => void) => Promise<AdviserEvent & { type: "result" }>): Response | Promise<Response> {
  const errorOf = (e: unknown): AdviserEvent => {
    if (!(e instanceof ModelError)) console.error("adviser: stage failed", agent, e instanceof Error ? e.name : "unknown");
    return { type: "error", agent, error: e instanceof ModelError && e.kind === "busy" ? "busy" : "failed" };
  };
  if (!stream) {
    const events: AdviserEvent[] = [];
    return run((e) => events.push(e))
      .then((r) => reply({ events: [...events, r] }))
      .catch((e) => reply({ events: [...events, errorOf(e)] }));
  }
  const enc = new TextEncoder();
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (e: AdviserEvent) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
        } catch {
          closed = true;
        }
      };
      try {
        write(await run(write));
      } catch (e) {
        write(errorOf(e));
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
