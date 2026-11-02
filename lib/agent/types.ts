import type Anthropic from "@anthropic-ai/sdk";
import type { Locale } from "@/lib/i18n/config";
import type { PlanAnswers } from "@/lib/plan-storage";

// The AI adviser's contract between the browser (lib/agent/client.ts, components/agent) and the server (lib/agent/run.ts,
// lib/agent/audit.ts, app/api/agent/*). The browser drives the loop: each POST to /api/agent/step first runs the server
// tools the model asked for on the previous step, then makes ONE model call, so every request stays inside the ~10 s
// the host gives one call. Tools that read data run on the server; tools that touch the visitor (ask_user) or their
// plan (save_to_plan) run in the browser, which keeps the answers. The model chooses the tools and their order; the four
// steps the page shows (profile, analysis, decision, roadmap) are the shape of `finish`, not a fixed script. Nothing is
// stored or logged. Both halves build against this file: change it only with the other half in view.

/** Read tools, run on the server at the start of the next step. */
export const SERVER_TOOLS = ["search_programmes", "admit_rate", "ep_check", "hot_roles", "skill_gap", "outcomes_figures"] as const;
/** Tools the browser handles: a question card, a write to the visitor's plan, and the end of the run. */
export const CLIENT_TOOLS = ["ask_user", "save_to_plan", "finish"] as const;
export type ServerTool = (typeof SERVER_TOOLS)[number];
export type ClientTool = (typeof CLIENT_TOOLS)[number];
export type ToolName = ServerTool | ClientTool;

/** Model calls per run; questions per run; characters the visitor may type. */
export const MAX_STEPS = 12;
export const MAX_ASKS = 2;
export const MAX_TEXT = 800;

/** The page the adviser was opened on, and what the visitor had picked there. */
export type PageContext = {
  page: "outcomes" | "results" | "careers" | "plan" | "profile" | "algorithm" | "parents" | "adviser";
  programmeId?: string;
  roleId?: string;
  industryId?: string;
};

/** The model's conversation, carried by the browser from step to step unchanged. */
export type AgentMessage = Anthropic.MessageParam;

export type ToolCall = { id: string; name: ToolName; input: Record<string, unknown> };

/** One line of the live trace. lane: the column of Step 2 it lights up ("you" = the profile and questions). */
export type TraceEntry = {
  /** The tool_use id. */
  id: string;
  tool: ToolName;
  lane: "education" | "career" | "you";
  /** One plain line in the page's language: what was looked up and what came back. */
  summary: string;
  /** Official quotes behind the result. */
  sources: number;
  ms: number;
  status: "done" | "error";
};

/** POST /api/agent/step. */
export type StepRequest = {
  locale: Locale;
  context: PageContext;
  /** The visitor's saved answers (lib/plan-storage.ts), as the browser holds them. */
  answers: PlanAnswers;
  /** What the visitor typed or said; the same on every step of a run. */
  text: string;
  /** The previous step's `messages`, unchanged; [] on the first step. */
  messages: AgentMessage[];
  /** Results of the client tools the previous step asked for (ask_user: the answer; save_to_plan: what was saved). */
  clientResults: { id: string; content: string }[];
};

export type StepResponse = {
  messages: AgentMessage[];
  /** What the model chose on this step. */
  calls: ToolCall[];
  /** The server tools run at the start of this step, then one line per call chosen on this step. */
  trace: TraceEntry[];
  /** Set when the model called finish: the run is over. */
  final: Final | null;
  /** 1-based; the server answers "too-many-steps" past MAX_STEPS. */
  step: number;
};

/** Where a claim's number or rule comes from, for the footnote and for the audit. */
export type SourceRef = {
  kind: "programme" | "employment" | "ep" | "career" | "policy";
  /** programme id, employment.json record id, "ep", career role id, or policy-risks id. */
  id: string;
  /** For a programme: the programme_evidence field, e.g. "ielts", "fee", "deadline". */
  field?: string;
};
export type Claim = { text: string; sources: SourceRef[] };

/** The finish tool's input: the four steps' content. Every line is in the page's language. */
export type Final = {
  /** Step 2: what the model read about the student, and what it found on each side. */
  analysis: { you: Claim[]; education: Claim[]; career: Claim[] };
  /** Step 3: study on vs start work, row by row, then which way it leans and why. */
  decision: {
    rows: { criterion: "cost" | "benefit" | "risk" | "fit"; study: Claim; work: Claim }[];
    lean: "study" | "work" | "both";
    why: Claim;
  };
  /** Step 4: dated steps. when: "YYYY-MM". */
  roadmap: { when: string; lane: "education" | "career"; text: string }[];
  /** The skills the target role lists that the student's degree doesn't cover, most important first. */
  gaps: { roleId: string; role: string; skill: string; level: number | null; fix: "degree" | "outside"; how: string }[];
  /** Programmes worth a look, best first (at most 3). */
  picks: { programmeId: string; reason: string }[];
};

/** ask_user's input. options: up to 4 short answers the card offers as buttons; free text is always allowed. */
export type AskInput = { question: string; options: string[] };
/** save_to_plan's input: shortlist ids and skill gaps for the visitor's plan. */
export type SaveInput = { programmeIds: string[]; gaps: Final["gaps"] };

/** POST /api/agent/audit: a second, separate model checks every claim in `final` against the official quotes. */
export type AuditRequest = { locale: Locale; text: string; answers: PlanAnswers; final: Final };
export type Verdict = {
  claim: string;
  status: "supported" | "conflict" | "unsupported" | "stale";
  quote: string | null;
  url: string | null;
  /** One plain line on what differs, in the page's language. */
  note: string;
};
export type AuditResponse = { verdicts: Verdict[]; blocked: boolean };

/** Every non-200 answer from /api/agent/*. */
export type AgentError = { error: "bad-request" | "forbidden" | "too-long" | "too-many-steps" | "busy" | "failed" | "unavailable" };
