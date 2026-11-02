import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Agent } from "./types";

// One model call for the adviser v2 (lib/adviser/loop.ts): streamed so the thinking summary reaches the page as it is
// written; adaptive thinking with a summarized display; tool_choice auto only (Opus 5.5 and Sonnet 5.5 refuse forced
// tools and disabled thinking with a 400). Every call is bound to its stage's deadline by an AbortController. 429, 5xx,
// overloaded and network errors are retried at most twice inside the deadline with exponential backoff and jitter;
// a 400 is never retried. ADVISER_FAST=1 asks for fast mode; any error there falls back to the standard speed.

export const model = () => process.env.ADVISER_MODEL || "claude-opus-5-5";
export type Effort = "low" | "medium" | "high";

export class ModelError extends Error {
  constructor(readonly kind: "failed" | "busy") {
    super(kind);
  }
}

let fastOff = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function client(apiKey: string) {
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  return new Anthropic({ apiKey, maxRetries: 0, defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined });
}

const retryable = (e: unknown) =>
  e instanceof Anthropic.APIConnectionError ||
  e instanceof Anthropic.RateLimitError ||
  e instanceof Anthropic.InternalServerError ||
  (e instanceof Anthropic.APIError && (e.status === 529 || (e.status ?? 0) >= 500));

export type CallInput = {
  agent: Agent;
  apiKey: string;
  system: string;
  tools: Anthropic.Tool[];
  messages: Anthropic.MessageParam[];
  effort: Effort;
  /** Epoch ms after which the call is aborted. */
  deadline: number;
  onThinking?: (text: string) => void;
};

async function once(x: CallInput, fast: boolean): Promise<Anthropic.Message> {
  const ctrl = new AbortController();
  const left = x.deadline - Date.now();
  if (left <= 500) throw new ModelError("failed");
  const timer = setTimeout(() => ctrl.abort(), left);
  const tools = x.tools.map((t, i) => (i === x.tools.length - 1 ? { ...t, cache_control: { type: "ephemeral" as const } } : t));
  const params: Anthropic.MessageStreamParams = {
    model: model(),
    max_tokens: 32000,
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort: x.effort },
    system: [{ type: "text", text: x.system, cache_control: { type: "ephemeral" } }],
    tools,
    tool_choice: { type: "auto" },
    messages: x.messages,
  };
  try {
    const stream = client(x.apiKey).messages.stream(
      fast ? ({ ...params, speed: "fast" } as Anthropic.MessageStreamParams) : params,
      { signal: ctrl.signal, ...(fast ? { headers: { "anthropic-beta": "fast-mode-2026-02-01" } } : {}) },
    );
    if (x.onThinking) {
      // The summary goes out at most every 300 ms, as the text so far for this block.
      let buf = "";
      let last = 0;
      const send = x.onThinking;
      stream.on("thinking", (delta) => {
        buf += delta;
        if (Date.now() - last >= 300) {
          last = Date.now();
          send(buf);
          buf = "";
        }
      });
      stream.on("contentBlock", () => {
        if (buf) send(buf);
        buf = "";
      });
    }
    return await stream.finalMessage();
  } finally {
    clearTimeout(timer);
  }
}

/** One reply from the model, retried on transient errors inside the deadline. Throws ModelError. */
export async function callModel(x: CallInput): Promise<Anthropic.Message> {
  const wantFast = process.env.ADVISER_FAST === "1" && !fastOff;
  if (wantFast) {
    try {
      return await once(x, true);
    } catch (e) {
      fastOff = true;
      console.error("adviser: fast mode failed, standard speed from now", e instanceof Anthropic.APIError ? e.status : e instanceof Error ? e.name : "unknown");
    }
  }
  for (let attempt = 0; ; attempt++) {
    try {
      return await once(x, false);
    } catch (e) {
      if (e instanceof ModelError) throw e;
      const status = e instanceof Anthropic.APIError ? e.status : undefined;
      console.error("adviser: model call failed", x.agent, status ?? (e instanceof Error ? e.name : "unknown"));
      const wait = 600 * 2 ** attempt + Math.random() * 400;
      if (!retryable(e) || attempt >= 2 || Date.now() + wait + 3000 > x.deadline) {
        throw new ModelError(e instanceof Anthropic.RateLimitError ? "busy" : "failed");
      }
      await sleep(wait);
    }
  }
}
