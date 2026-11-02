import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { TOOLS } from "@/lib/agent/tools";
import { ROADS_TOOL } from "./roads";

// The adviser v2's tools: the six read tools of lib/agent/tools.ts plus compare_roads, and the three submit tools
// (non-strict schemas: a strict schema's first compile takes 13 to 19 s).

const claim: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    text: { type: "string", description: "One short line in the page's language." },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: { kind: { type: "string", enum: ["programme", "employment", "ep", "career", "policy"] }, id: { type: "string" }, field: { type: "string" } },
        required: ["kind", "id"],
      },
    },
  },
  required: ["text", "sources"],
};

const READ_NAMES = ["search_programmes", "admit_rate", "ep_check", "hot_roles", "skill_gap", "outcomes_figures"];
export const READ_TOOL_SCHEMAS: Anthropic.Tool[] = [...TOOLS.filter((t) => READ_NAMES.includes(t.name)), ROADS_TOOL];

export const SUBMIT_INTAKE: Anthropic.Tool = {
  name: "submit_intake",
  description: "Submit what you read about the student, the decision in one line, and at most 2 questions (empty when nothing missing would change the advice).",
  input_schema: {
    type: "object",
    properties: {
      you: { type: "array", items: claim, description: "Up to 5 facts the student gave; sources empty." },
      goal: { type: "string" },
      questions: {
        type: "array",
        items: { type: "object", properties: { id: { type: "string" }, question: { type: "string" }, options: { type: "array", items: { type: "string" } } }, required: ["id", "question", "options"] },
      },
    },
    required: ["you", "goal", "questions"],
  },
};

export const SUBMIT_CASE: Anthropic.Tool = {
  name: "submit_case",
  description: "Submit your case: thesis, one point per criterion, the strongest point against your side, when your side stops being right, programme picks and roles.",
  input_schema: {
    type: "object",
    properties: {
      thesis: claim,
      points: {
        type: "array",
        items: { type: "object", properties: { criterion: { type: "string", enum: ["cost", "benefit", "risk", "fit"] }, claim }, required: ["criterion", "claim"] },
      },
      concede: claim,
      conditions: { type: "array", items: { type: "string" } },
      picks: { type: "array", items: { type: "object", properties: { programmeId: { type: "string" }, reason: { type: "string" } }, required: ["programmeId", "reason"] } },
      roles: { type: "array", items: { type: "object", properties: { roleId: { type: "string" }, reason: { type: "string" } }, required: ["roleId", "reason"] } },
    },
    required: ["thesis", "points", "concede", "conditions", "picks", "roles"],
  },
};

const finish = TOOLS.find((t) => t.name === "finish")!;
export const SUBMIT_DECISION: Anthropic.Tool = {
  name: "submit_decision",
  description: "Submit the decision: analysis, the row-by-row comparison with the lean and the deciding factor, the dated roadmap, the skill gaps and up to 3 programme picks.",
  input_schema: finish.input_schema,
};
