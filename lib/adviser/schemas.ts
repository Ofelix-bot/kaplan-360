import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { TOOLS } from "@/lib/agent/tools";
import { ROADS_TOOL } from "./roads";

// The adviser v2's tools: the six read tools of lib/agent/tools.ts plus compare_roads, and the five submit tools
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

const step: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    when: { type: "string", description: "YYYY-MM, this month or later." },
    lane: { type: "string", enum: ["education", "career"] },
    text: { type: "string", description: "One concrete action, one line, in the page's language." },
  },
  required: ["when", "lane", "text"],
};

export const SUBMIT_PLANS: Anthropic.Tool = {
  name: "submit_plans",
  description: "Submit the three plans the student chooses between (ids A, B and C), and which of them follows the judge's decision.",
  input_schema: {
    type: "object",
    properties: {
      plans: {
        type: "array",
        description: "Exactly three.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: ["A", "B", "C"] },
            title: { type: "string", description: "What the plan does, in a few words." },
            road: { type: "string", enum: ["study", "work", "both"], description: "Which road comes first; both: a set sequence." },
            bet: { type: "string", description: "The bet this plan makes, one line." },
            steps: { type: "array", items: step, description: "3 to 6 dated steps, in date order." },
            givesUp: { type: "string", description: "What the student gives up by choosing it, one line." },
            worksIf: { type: "string", description: "The condition it depends on, one line." },
            picks: { type: "array", items: { type: "string" }, description: "Up to 2 programme ids from the tool results." },
            roles: { type: "array", items: { type: "string" }, description: "Up to 2 role ids from the tool results." },
          },
          required: ["id", "title", "road", "bet", "steps", "givesUp", "worksIf", "picks", "roles"],
        },
      },
      follows: { type: "string", enum: ["A", "B", "C"], description: "The plan that follows the judge's decision." },
    },
    required: ["plans", "follows"],
  },
};

export const SUBMIT_REVIEW: Anthropic.Tool = {
  name: "submit_review",
  description: "Submit your reading of the three plans: the paragraphs with the passages you marked, one line per plan, and the one question only the student can answer.",
  input_schema: {
    type: "object",
    properties: {
      paragraphs: {
        type: "array",
        description: "2 to 4 short paragraphs.",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            marks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  quote: { type: "string", description: "The exact words from this paragraph's text, 2 to 12 words inside one sentence." },
                  kind: { type: "string", enum: ["key", "risk", "check"] },
                  why: { type: "string", description: "One short line: why this matters." },
                },
                required: ["quote", "kind", "why"],
              },
            },
          },
          required: ["text", "marks"],
        },
      },
      takes: {
        type: "array",
        description: "One per plan.",
        items: { type: "object", properties: { plan: { type: "string", enum: ["A", "B", "C"] }, line: { type: "string" } }, required: ["plan", "line"] },
      },
      question: { type: "string", description: "The one question only the student can answer, that decides between the plans." },
    },
    required: ["paragraphs", "takes", "question"],
  },
};
