import type { Locale } from "@/lib/i18n/config";
import type { PlanAnswers } from "@/lib/plan-storage";
import type { AgentError, AuditResponse, Claim, Final, PageContext, ServerTool, SourceRef, Verdict } from "@/lib/agent/types";

// AI adviser v2: six stages, each one POST that runs its own tool loop on the server and streams NDJSON events.
// intake reads the student and asks at most two questions; two case agents argue "master's first" and "work first" in
// parallel; the judge weighs both into lib/agent/types.ts Final; the audit (Make It Fail) checks Final against the official
// quotes; once it passes, the planner drafts three plans the student chooses between, and Kappy reads the three and marks
// what matters (docs/agent/roadmap.md). The browser only chains the stages and keeps the answers. Nothing is stored or logged.

export type Agent = "intake" | "study" | "work" | "judge" | "audit" | "planner" | "kappy";
export type ReadTool = ServerTool | "compare_roads";

/** A read-tool call a stage made, so a later stage can re-run it on the server instead of trusting the browser. */
export type ToolCallRecord = { tool: ReadTool; input: Record<string, unknown> };

export type AdviserEvent =
  | { type: "thinking"; agent: Agent; text: string }
  | { type: "tool"; agent: Agent; id: string; tool: ReadTool; lane: "education" | "career" | "you"; summary: string; sources: number; ms: number; status: "done" | "error" }
  | { type: "result"; agent: Agent; data: IntakeResult | CaseResult | Final | AuditResponse | PlansResult | ReviewResult }
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

/** POST /api/adviser/plans (Step 4, once the audit passed): three dated plans drawn from the decision, for the student to choose between. */
export type PlansRequest = CaseRequest & { study: CaseResult; work: CaseResult; final: Final };
export type PlanId = "A" | "B" | "C";
export const PLAN_IDS: readonly PlanId[] = ["A", "B", "C"];
export type PlanStep = Final["roadmap"][number];
export type Plan = {
  id: PlanId;
  /** What the plan does, in a few words ("One-year finance master's in Singapore, January 2027 intake"). */
  title: string;
  /** Which road comes first; "both" for a set sequence. */
  road: "study" | "work" | "both";
  /** The bet this plan makes, one line. */
  bet: string;
  /** 2 to 6 dated steps (when: "YYYY-MM"), in date order. */
  steps: PlanStep[];
  /** What the student gives up by choosing it, one line ("" when the line didn't pass the check). */
  givesUp: string;
  /** The condition it depends on, one line (""). */
  worksIf: string;
  /** Programme ids from the tool results this plan applies to, at most 2. */
  picks: string[];
  /** Role ids from the tool results it applies for, at most 2. */
  roles: string[];
};
export type PlansResult = {
  /** Always three, A to C. */
  plans: Plan[];
  /** The plan that follows the judge's decision (the page says so); the other two are the student's real alternatives. */
  follows: PlanId | null;
};

/** POST /api/adviser/review: Kappy reads the three plans. calls: the cases' tool calls, re-run on the server for the numbers. */
export type ReviewRequest = Base & { final: Final; plans: PlansResult; calls: ToolCallRecord[] };
/** key: what weighs most; risk: what goes wrong if a condition fails; check: a figure or date to confirm on the official page first. */
export type MarkKind = "key" | "risk" | "check";
/** A passage the model chose to highlight in its own paragraph (quote: the exact words), and why. */
export type Mark = { quote: string; kind: MarkKind; why: string };
export type ReviewResult = {
  /** 1 to 4 short paragraphs comparing the plans, each with the passages the model marked. */
  paragraphs: { text: string; marks: Mark[] }[];
  /** One line per plan: what it is best at, and its price. */
  takes: { plan: PlanId; line: string }[];
  /** The one question only the student can answer before choosing ("" when none passed the check). */
  question: string;
  /** The model that wrote it, named by the server, so the page can say which LLM the student is reading. */
  model: string;
};

export const MAX_ASKS = 2;
export const MAX_TEXT = 800;
export const DEADLINE_MS = { intake: 25_000, case: 50_000, judge: 50_000, audit: 50_000, plans: 50_000, review: 45_000 } as const;
/** When the loop tells the model to wrap up. */
export const NUDGE_MS = 38_000;

export type { Claim, Final, SourceRef, Verdict, AuditResponse };
