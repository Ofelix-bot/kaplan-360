import type { Locale } from "@/lib/i18n/config";
import type { PlanAnswers } from "@/lib/plan-storage";
import type { AgentError, AuditResponse, Claim, Final, PageContext, ServerTool, SourceRef, Verdict } from "@/lib/agent/types";

// AI adviser v2: four stages, each one POST that runs its own tool loop on the server and streams NDJSON events.
// intake reads the student and asks at most two questions; two case agents argue "master's first" and "work first" in
// parallel; the judge weighs both into lib/agent/types.ts Final; the audit (Make It Fail) checks Final against the official
// quotes. The browser only chains the stages and keeps the answers. Nothing is stored or logged.

export type Agent = "intake" | "study" | "work" | "judge" | "audit";
export type ReadTool = ServerTool | "compare_roads";

/** A read-tool call a stage made, so a later stage can re-run it on the server instead of trusting the browser. */
export type ToolCallRecord = { tool: ReadTool; input: Record<string, unknown> };

export type AdviserEvent =
  | { type: "thinking"; agent: Agent; text: string }
  | { type: "tool"; agent: Agent; id: string; tool: ReadTool; lane: "education" | "career" | "you"; summary: string; sources: number; ms: number; status: "done" | "error" }
  | { type: "result"; agent: Agent; data: IntakeResult | CaseResult | Final | AuditResponse }
  | { type: "error"; agent: Agent; error: AgentError["error"] };

export type Base = { locale: Locale; context: PageContext; answers: PlanAnswers; text: string };

/** POST /api/adviser/intake */
export type IntakeRequest = Base;
export type IntakeResult = {
  /** What the adviser read about the student (Step 2 "you" column). */
  you: Claim[];
  /** One line: what this student is deciding. */
  goal: string;
  /** At most MAX_ASKS; empty when nothing missing would change the advice. */
  questions: { id: string; question: string; options: string[] }[];
};

/** POST /api/adviser/case?side=study|work */
export type CaseRequest = Base & { intake: IntakeResult; replies: { id: string; answer: string }[] };
export type CaseResult = {
  side: "study" | "work";
  thesis: Claim;
  points: { criterion: "cost" | "benefit" | "risk" | "fit"; claim: Claim }[];
  /** The strongest point against this side, stated honestly. */
  concede: Claim;
  /** When this side stops being the right call for this student. */
  conditions: string[];
  picks: { programmeId: string; reason: string }[];
  roles: { roleId: string; reason: string }[];
  calls: ToolCallRecord[];
};

/** POST /api/adviser/judge. fix: the audit's verdicts when this is the one rewrite. */
export type JudgeRequest = CaseRequest & { study: CaseResult; work: CaseResult; fix?: Verdict[]; previous?: Final };

/** POST /api/adviser/audit: the existing lib/agent/types.ts AuditRequest / AuditResponse, unchanged. */

export const MAX_ASKS = 2;
export const MAX_TEXT = 800;
export const DEADLINE_MS = { intake: 25_000, case: 50_000, judge: 50_000, audit: 50_000 } as const;
/** When the loop tells the model to wrap up. */
export const NUDGE_MS = 38_000;

export type { Claim, Final, SourceRef, Verdict, AuditResponse };
