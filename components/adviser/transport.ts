import type { AgentError } from "@/lib/agent/types";
import type { AdviserEvent } from "@/lib/adviser/types";

// How the AI adviser v2 page talks to /api/adviser/* (lib/adviser/types.ts): one POST per stage, NDJSON back, one
// AdviserEvent per line, the last line {type:"result"} or {type:"error"}. Also replays a recorded or mock run through the
// same callback, so the page's state machine never knows which it is getting.

export type ErrorCode = AgentError["error"] | "timeout" | "missing";

/** A stage that ended without a result. */
export class StageFailure extends Error {
  constructor(public code: ErrorCode) {
    super(code);
  }
}

const TIMEOUT_MS = 58_000;
const STATUS: Record<number, ErrorCode> = { 400: "bad-request", 403: "forbidden", 413: "too-long", 429: "busy", 502: "failed", 503: "unavailable" };

/** One parsed line, or null for a bad one. Never throws. */
export function parseLine(line: string): AdviserEvent | null {
  const s = line.trim();
  if (!s) return null;
  try {
    const x = JSON.parse(s) as unknown;
    if (x && typeof x === "object" && typeof (x as { type?: unknown }).type === "string") return x as AdviserEvent;
  } catch {}
  return null;
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/** The stage's result data, after passing every event to onEvent. */
function settle(last: AdviserEvent | null): unknown {
  if (last?.type === "result") return last.data;
  if (last?.type === "error") throw new StageFailure(last.error ?? "failed");
  throw new StageFailure("failed");
}

/** One POST, streamed. Throws StageFailure, or the abort when `outer` is aborted. */
async function postOnce(url: string, body: unknown, onEvent: (e: AdviserEvent) => void, outer: AbortSignal): Promise<unknown> {
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, TIMEOUT_MS);
  const stop = () => ctl.abort();
  outer.addEventListener("abort", stop, { once: true });
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: ErrorCode } | null;
      throw new StageFailure(json?.error ?? STATUS[res.status] ?? (res.status === 404 ? "unavailable" : "failed"));
    }
    let last: AdviserEvent | null = null;
    const take = (line: string) => {
      const e = parseLine(line);
      if (!e) return;
      if (e.type === "result" || e.type === "error") last = e;
      onEvent(e);
    };
    // ?stream=0 answers {events}; a host that buffered the stream may also send JSON.
    if ((res.headers.get("content-type") ?? "").includes("application/json")) {
      const json = (await res.json().catch(() => null)) as { events?: unknown[] } | null;
      for (const e of Array.isArray(json?.events) ? json.events : []) take(JSON.stringify(e));
      return settle(last);
    }
    if (!res.body) return settle(last);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(take);
    }
    buffer += decoder.decode();
    take(buffer);
    return settle(last);
  } catch (e) {
    if (e instanceof StageFailure) throw e;
    if (outer.aborted) throw e;
    if (timedOut) throw new StageFailure("timeout");
    // A network error (fetch or the stream broke).
    throw new StageFailure(isAbort(e) ? "timeout" : "failed");
  } finally {
    clearTimeout(timer);
    outer.removeEventListener("abort", stop);
  }
}

/**
 * POST a stage; on a network error or HTTP 502 ("failed") once more after a random 0.5–1.5 s. onRetry runs before the
 * second try so the caller can clear what the first one streamed.
 */
export async function postStage(url: string, body: unknown, onEvent: (e: AdviserEvent) => void, signal: AbortSignal, onRetry: () => void): Promise<unknown> {
  try {
    return await postOnce(url, body, onEvent, signal);
  } catch (e) {
    if (!(e instanceof StageFailure) || e.code !== "failed") throw e;
    await wait(500 + Math.random() * 1000, signal);
    onRetry();
    return postOnce(url, body, onEvent, signal);
  }
}

/** Replays recorded events with a short gap each (the whole stage in at most ~6 s). */
export async function replayStage(events: AdviserEvent[] | undefined, onEvent: (e: AdviserEvent) => void, signal: AbortSignal): Promise<unknown> {
  if (!events?.length) throw new StageFailure("missing");
  const gap = Math.min(150, Math.max(30, 6000 / events.length));
  let last: AdviserEvent | null = null;
  for (const e of events) {
    await wait(gap, signal);
    if (!e || typeof e !== "object" || typeof e.type !== "string") continue;
    if (e.type === "result" || e.type === "error") last = e;
    onEvent(e);
  }
  return settle(last);
}
