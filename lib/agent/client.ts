"use client";

import { create } from "zustand";
import { mockAudit, mockStep } from "@/lib/agent/mock";
import { CLIENT_TOOLS, MAX_ASKS, MAX_STEPS, SERVER_TOOLS, type AgentError, type AgentMessage, type AskInput, type AuditResponse, type Final, type PageContext, type SaveInput, type StepRequest, type StepResponse, type ToolCall, type TraceEntry } from "@/lib/agent/types";
import type { Locale } from "@/lib/i18n/config";
import type { SkillGap } from "@/lib/plan-storage";
import { usePlanStore } from "@/lib/workspace/plan-store";
import { useWorkspace } from "@/lib/workspace/store";

// The adviser's loop, in the browser (lib/agent/types.ts has the contract). One run: POST /api/agent/step until the
// model calls finish, handling the browser's tools on the way (a question card, a write to the visitor's plan); then
// POST /api/agent/audit, and when the audit blocks, one more round in which the model rewrites against the audit's
// quotes. The visitor's answers never leave this browser except inside these two requests. ?mock=1 (or
// NEXT_PUBLIC_AGENT_MOCK=1) replays lib/agent/mock.ts instead of calling the server.

export type RunStatus = "idle" | "running" | "asking" | "auditing" | "done" | "error";

/** A trace line as the page shows it: the server's entries, the browser's own, and the calls still running. */
export type TraceLine = TraceEntry & { pending?: boolean };

type Saved = { programmes: number; gaps: number; before: { shortlist: string[]; skillGaps: SkillGap[] } };

type RunState = {
  status: RunStatus;
  trace: TraceLine[];
  ask: { id: string; input: AskInput } | null;
  final: Final | null;
  audit: AuditResponse | null;
  /** The first audit blocked and the model rewrote its answer. */
  rewritten: boolean;
  /** That first, blocking audit (the page keeps showing what it caught). */
  blocked: AuditResponse | null;
  saved: Saved | null;
  error: AgentError["error"] | null;
  start: (x: { text: string; locale: Locale; context: PageContext }) => void;
  answer: (text: string) => void;
  undoSave: () => void;
  reset: () => void;
};

const mocked = () => process.env.NEXT_PUBLIC_AGENT_MOCK === "1" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("mock"));

class AgentFailure extends Error {
  constructor(readonly code: AgentError["error"]) {
    super(code);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new AgentFailure("failed");
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<AgentError>) | null;
  if (!res.ok || !data) throw new AgentFailure(data?.error ?? (res.status === 404 ? "unavailable" : "failed"));
  return data;
}

const isServer = (name: string) => (SERVER_TOOLS as readonly string[]).includes(name);
const isClient = (name: string) => (CLIENT_TOOLS as readonly string[]).includes(name);

/** The skill-gap id /careers uses (components/careers/RoleGapPanel.tsx), so a gap saved twice stays one row. */
const gapId = (roleId: string, skill: string) => `${roleId}-${skill.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** save_to_plan: the programmes onto the shortlist and the gaps into the plan, as /careers' gap panel saves them. */
function applySave(input: SaveInput): Saved {
  const a = usePlanStore.getState().answers;
  const before = { shortlist: a.shortlist, skillGaps: a.skillGaps };
  const ids = (Array.isArray(input.programmeIds) ? input.programmeIds : []).filter((id): id is string => typeof id === "string" && !!id).slice(0, 6);
  const gaps: SkillGap[] = (Array.isArray(input.gaps) ? input.gaps : []).slice(0, 12).flatMap((g) =>
    g && typeof g.roleId === "string" && typeof g.skill === "string"
      ? [{ id: gapId(g.roleId, g.skill), roleId: g.roleId, role: String(g.role ?? ""), skill: g.skill, level: typeof g.level === "number" ? g.level : 0, via: g.fix === "degree" ? "kaplan" : "outside", module: null, own: g.fix === "degree" } satisfies SkillGap]
      : [],
  );
  const shortlist = [...new Set([...a.shortlist, ...ids])];
  const skillGaps = [...a.skillGaps.filter((x) => !gaps.some((g) => g.id === x.id)), ...gaps];
  usePlanStore.getState().update({ shortlist, skillGaps });
  return { programmes: shortlist.length - a.shortlist.length, gaps: gaps.length, before };
}

/** What the model reads back when the audit blocks its answer: each failed claim with the official quote. */
function auditNote(audit: AuditResponse): string {
  const failed = audit.verdicts.filter((v) => v.status !== "supported");
  return [
    "The audit blocked this answer. Fix every claim below using only the quoted official text, keep everything else, and call finish again.",
    ...failed.map((v) => `- ${v.status}: "${v.claim}"${v.quote ? ` — official text: "${v.quote}"` : " — no official text supports it; remove it"}${v.note ? ` (${v.note})` : ""}`),
  ].join("\n");
}

let runId = 0;
let resolveAsk: ((text: string) => void) | null = null;

export const useAdviser = create<RunState>()((set, get) => {
  /** Merges trace lines by id: a later line (the result) replaces the earlier one (the call). */
  const addTrace = (lines: TraceLine[]) =>
    set((s) => {
      const trace = [...s.trace];
      for (const l of lines) {
        const i = trace.findIndex((x) => x.id === l.id);
        if (i >= 0) trace[i] = l;
        else trace.push(l);
      }
      return { trace };
    });

  async function run(x: { text: string; locale: Locale; context: PageContext }, id: number) {
    const mock = mocked();
    const step = (req: StepRequest) => (mock ? mockStep(req) : post<StepResponse>("/api/agent/step", req));
    const audit = (final: Final) => (mock ? mockAudit() : post<AuditResponse>("/api/agent/audit", { locale: x.locale, text: x.text, answers: usePlanStore.getState().answers, final }));
    const live = () => id === runId;

    let messages: AgentMessage[] = [];
    let clientResults: StepRequest["clientResults"] = [];
    let asks = 0;
    // A rewrite round on top of the run's own steps.
    for (let n = 0; n < MAX_STEPS + 2; n++) {
      const res = await step({ locale: x.locale, context: x.context, answers: usePlanStore.getState().answers, text: x.text, messages, clientResults });
      if (!live()) return;
      messages = res.messages;
      clientResults = [];
      addTrace(res.trace);
      // Server calls show as running until the next step answers with their result.
      addTrace(res.calls.filter((c) => isServer(c.name)).map((c) => ({ id: c.id, tool: c.name, lane: "you", summary: "", sources: 0, ms: 0, status: "done", pending: true })));

      for (const c of res.calls.filter((c: ToolCall) => isClient(c.name))) {
        if (c.name === "ask_user") {
          const input = c.input as AskInput;
          if (asks >= MAX_ASKS) {
            clientResults.push({ id: c.id, content: "No more questions this run: go on with what you have." });
            continue;
          }
          asks += 1;
          set({ status: "asking", ask: { id: c.id, input: { question: String(input.question ?? ""), options: Array.isArray(input.options) ? input.options.slice(0, 4).map(String) : [] } } });
          const reply = await new Promise<string>((r) => (resolveAsk = r));
          if (!live()) return;
          set({ status: "running", ask: null });
          addTrace([{ id: c.id, tool: "ask_user", lane: "you", summary: `${input.question} → ${reply}`, sources: 0, ms: 0, status: "done" }]);
          clientResults.push({ id: c.id, content: reply });
        } else if (c.name === "save_to_plan") {
          const saved = applySave(c.input as SaveInput);
          set({ saved });
          addTrace([{ id: c.id, tool: "save_to_plan", lane: "you", summary: `${saved.programmes}|${saved.gaps}`, sources: 0, ms: 0, status: "done" }]);
          clientResults.push({ id: c.id, content: `Saved to the student's plan: ${saved.programmes} new programmes on the shortlist, ${saved.gaps} skill gaps.` });
        }
      }

      if (res.final) {
        set({ final: res.final, status: "auditing", audit: null });
        const verdicts = await audit(res.final);
        if (!live()) return;
        set({ audit: verdicts });
        const finishId = res.calls.find((c) => c.name === "finish")?.id;
        if (verdicts.blocked && !get().rewritten && finishId) {
          set({ rewritten: true, blocked: verdicts, status: "running" });
          clientResults.push({ id: finishId, content: auditNote(verdicts) });
          continue;
        }
        set({ status: "done" });
        return;
      }
      if (!res.calls.length) throw new AgentFailure("failed");
    }
    throw new AgentFailure("too-many-steps");
  }

  return {
    status: "idle",
    trace: [],
    ask: null,
    final: null,
    audit: null,
    rewritten: false,
    blocked: null,
    saved: null,
    error: null,
    start: (x) => {
      const id = ++runId;
      resolveAsk = null;
      // Read on /results: the programme the visitor has open.
      const selected = x.context.page === "results" ? useWorkspace.getState().selectedId : null;
      const context = selected ? { ...x.context, programmeId: selected } : x.context;
      set({ status: "running", trace: [], ask: null, final: null, audit: null, rewritten: false, blocked: null, saved: null, error: null });
      run({ ...x, context }, id).catch((e) => {
        if (id === runId) set({ status: "error", ask: null, error: e instanceof AgentFailure ? e.code : "failed" });
      });
    },
    answer: (text) => {
      const r = resolveAsk;
      resolveAsk = null;
      r?.(text.trim() || "(no answer)");
    },
    undoSave: () => {
      const saved = get().saved;
      if (!saved) return;
      usePlanStore.getState().update(saved.before);
      set({ saved: null });
    },
    reset: () => {
      runId += 1;
      resolveAsk = null;
      set({ status: "idle", trace: [], ask: null, final: null, audit: null, rewritten: false, blocked: null, saved: null, error: null });
    },
  };
});
