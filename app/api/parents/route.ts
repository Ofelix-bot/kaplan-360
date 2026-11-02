import Anthropic from "@anthropic-ai/sdk";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { readFamily, writeFamilyBrief, writeFamilyPlan } from "@/lib/parent-ai";
import { cleanNeeds, MAX_CANDIDATES, MAX_FAMILY_TEXT, type Candidate } from "@/lib/parent-plan";

// POST /api/parents, the parents' page (components/parents), in three calls. {step: "read", text}: the planner's fields
// and the family's needs read from the text (lib/parent-ai.ts readFamily). {step: "plan", text, needs, candidates,
// locale}: three of the candidates the finder's rules picked in the browser, with a reason each and a summary
// (writeFamilyPlan). {step: "brief", text, needs, picks, locale}: this month's steps and the questions for those three
// (writeFamilyBrief). The same guard as /api/profile: this site's own pages only, a few calls a minute per visitor, and
// the text is neither stored nor logged. Answers: 200 {reading, needs}, {plan} or {brief}, or {error} with 400 / 403 /
// 413 / 429 / 502 / 503 ("unavailable": no API key on this deployment).

const WINDOW_MS = 60_000;
/** Three calls make one plan. */
const PER_WINDOW = 12;
const PER_DAY = 100;
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

const str = (v: unknown, max = 160) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The candidates as the page sent them, with only the values each fact allows. */
function candidatesOf(v: unknown): Candidate[] | null {
  if (!Array.isArray(v) || !v.length || v.length > MAX_CANDIDATES) return null;
  const out = v.flatMap((c): Candidate[] => {
    if (!c || typeof c !== "object") return [];
    const o = c as Record<string, unknown>;
    // Programme ids are slugs of their names, and some run past 200 characters.
    const id = str(o.id, 400);
    if (!id) return [];
    return [
      {
        id,
        programme: str(o.programme),
        university: str(o.university),
        country: str(o.country, 60),
        qs: typeof o.qs === "string" ? o.qs.slice(0, 12) : null,
        months: num(o.months),
        feeYearSgd: num(o.feeYearSgd),
        feeTotalSgd: num(o.feeTotalSgd),
        intake: Array.isArray(o.intake) ? o.intake.filter((m): m is number => Number.isInteger(m) && m >= 1 && m <= 12).slice(0, 12) : [],
        ielts: num(o.ielts),
        testsRequired: o.testsRequired === true,
        match: num(o.match),
      },
    ];
  });
  return out.length === v.length && new Set(out.map((c) => c.id)).size === out.length ? out : null;
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return reply({ error: "bad-request" }, 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return reply({ error: "bad-request" }, 400);
  if (text.length > MAX_FAMILY_TEXT) return reply({ error: "too-long" }, 413);

  try {
    if (body.step === "read") return reply(await readFamily(text, key));
    if (body.step === "plan" || body.step === "brief") {
      const candidates = candidatesOf(body.step === "plan" ? body.candidates : body.picks);
      const locale = LOCALES.find((l) => l === body.locale) as Locale | undefined;
      if (!candidates || !locale || !body.needs || typeof body.needs !== "object") return reply({ error: "bad-request" }, 400);
      const needs = cleanNeeds(body.needs as Record<string, unknown>);
      if (body.step === "plan") return reply({ plan: await writeFamilyPlan({ text, needs, candidates, locale }, key) });
      return reply({ brief: await writeFamilyBrief({ text, needs, picks: candidates.slice(0, 3), locale }, key) });
    }
    return reply({ error: "bad-request" }, 400);
  } catch (e) {
    // The error's kind only: never the text.
    console.error("parents: model call failed", e instanceof Anthropic.APIError ? e.status : e instanceof Error ? e.name : "unknown");
    return reply({ error: e instanceof Anthropic.RateLimitError ? "busy" : "failed" }, e instanceof Anthropic.RateLimitError ? 429 : 502);
  }
}
