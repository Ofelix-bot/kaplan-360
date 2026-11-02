import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { LANE } from "@/lib/agent/tools";
import { ToolError, type ToolContext } from "@/lib/agent/tools-server";
import type { ServerTool } from "@/lib/agent/types";
import { isRead, Known, runRead } from "./checks";
import { callModel, ModelError, type Effort } from "./model";
import { NUDGE_MS, type AdviserEvent, type Agent, type ToolCallRecord } from "./types";

// The server-side tool loop of one adviser v2 stage. Each turn: one model call (lib/adviser/model.ts); the assistant
// message goes back unchanged, thinking blocks included; every read tool the turn chose runs in parallel and all the
// results go back in one user message (a tool that throws comes back as an is_error result and the loop carries on).
// At NUDGE_MS the model is told to wrap up. It ends when the model calls the submit tool with input that passes its
// check; an end_turn without it is retried once; at most MAX_TOOLS read calls; the stage's deadline aborts the call.

const MAX_TOOLS = 12;

export type LoopInput<T> = {
  agent: Agent;
  apiKey: string;
  system: string;
  tools: Anthropic.Tool[];
  submit: { tool: Anthropic.Tool; check: (input: unknown, known: Known) => T | null };
  firstMessage: string;
  effort: Effort;
  deadlineMs: number;
  emit: (e: AdviserEvent) => void;
  ctx: ToolContext;
  /** Tool results the stage starts with (the judge's replayed calls). */
  known?: Known;
};

export type LoopOutput<T> = { result: T; calls: ToolCallRecord[]; known: Known };

const nudge = (submit: string) => `Time is nearly up. Call ${submit} now with what you have; drop any claim you cannot source.`;

export async function runLoop<T>(x: LoopInput<T>): Promise<LoopOutput<T>> {
  const t0 = Date.now();
  const deadline = t0 + x.deadlineMs;
  const known = x.known ?? new Known();
  const calls: ToolCallRecord[] = [];
  const name = x.submit.tool.name;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: x.firstMessage }];
  let used = 0;
  let nudged = false;
  let retries = 0;

  for (let turn = 0; turn < 20; turn++) {
    const tools = used >= MAX_TOOLS ? [x.submit.tool] : [...x.tools, x.submit.tool];
    const msg = await callModel({
      agent: x.agent,
      apiKey: x.apiKey,
      system: x.system,
      tools,
      messages,
      effort: x.effort,
      deadline,
      onThinking: (text) => x.emit({ type: "thinking", agent: x.agent, text }),
    });
    if (msg.stop_reason === "refusal") throw new ModelError("failed");
    messages.push({ role: "assistant", content: msg.content as Anthropic.ContentBlockParam[] });
    const uses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

    const submitted = uses.find((u) => u.name === name);
    if (submitted) {
      const result = x.submit.check(submitted.input, known);
      if (result) return { result, calls, known };
    }
    if (!uses.length) {
      if (++retries > 1) throw new ModelError("failed");
      messages.push({ role: "user", content: `Call ${name} now, once, with your answer.` });
      continue;
    }

    const results: Anthropic.ContentBlockParam[] = await Promise.all(
      uses.map(async (u): Promise<Anthropic.ToolResultBlockParam> => {
        if (u.name === name) return { type: "tool_result", tool_use_id: u.id, content: "That input didn't pass the check: every field is required. Call it again.", is_error: true };
        if (!isRead(u.name)) return { type: "tool_result", tool_use_id: u.id, content: `No tool named ${u.name}.`, is_error: true };
        const tool = u.name;
        const s = Date.now();
        const lane = tool === "compare_roads" ? "you" : LANE[tool as ServerTool];
        if (++used > MAX_TOOLS) return { type: "tool_result", tool_use_id: u.id, content: `Tool limit reached: call ${name} now.`, is_error: true };
        try {
          const r = await runRead(tool, u.input, x.ctx);
          known.add(r.content);
          calls.push({ tool, input: (u.input ?? {}) as Record<string, unknown> });
          x.emit({ type: "tool", agent: x.agent, id: u.id, tool, lane, summary: r.trace.summary, sources: r.trace.sources, ms: Date.now() - s, status: "done" });
          return { type: "tool_result", tool_use_id: u.id, content: r.content };
        } catch (e) {
          const why = e instanceof ToolError ? e.message : "The lookup failed; carry on without it.";
          if (!(e instanceof ToolError)) console.error("adviser: tool failed", tool, e instanceof Error ? e.name : "unknown");
          x.emit({ type: "tool", agent: x.agent, id: u.id, tool, lane, summary: why.slice(0, 120), sources: 0, ms: Date.now() - s, status: "error" });
          return { type: "tool_result", tool_use_id: u.id, content: why, is_error: true };
        }
      }),
    );
    // Past NUDGE_MS (or the tool limit): the same user message tells the model to submit.
    if (!nudged && (Date.now() - t0 > Math.min(NUDGE_MS, x.deadlineMs * 0.7) || used >= MAX_TOOLS)) {
      nudged = true;
      results.push({ type: "text", text: nudge(name) });
    }
    messages.push({ role: "user", content: results });
  }
  throw new ModelError("failed");
}
