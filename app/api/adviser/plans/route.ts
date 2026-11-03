import { checkPlans, lineCheck, PLANS_HINT, replay } from "@/lib/adviser/checks";
import { runLoop } from "@/lib/adviser/loop";
import { firstMessage, plansPrompt } from "@/lib/adviser/prompts";
import { caseOf, intakeOf, repliesOf } from "@/lib/adviser/request";
import { guard, reply, respond } from "@/lib/adviser/route-kit";
import { READ_TOOL_SCHEMAS, SUBMIT_PLANS } from "@/lib/adviser/schemas";
import { DEADLINE_MS } from "@/lib/adviser/types";
import { finalOf } from "@/lib/agent/audit";

// POST /api/adviser/plans (adviser v2, Step 4, once the audit passed): the planner drafts three dated plans from the
// decision, one of which follows it; the student chooses (docs/agent/roadmap.md). The cases' tool calls are re-run here
// first, so the numbers and ids the plans may use come from the server, not from the browser's copy.
export const maxDuration = 60;

export async function POST(request: Request) {
  const g = await guard(request);
  if (g instanceof Response) return g;
  const { base, key, body } = g;
  const final = finalOf(body.final);
  if (!final) return reply({ error: "bad-request" }, 400);
  const today = new Date();
  const intake = intakeOf(body.intake);
  const replies = repliesOf(body.replies);
  const study = caseOf(body.study, "study");
  const work = caseOf(body.work, "work");
  const ctx = { answers: base.answers, locale: base.locale, context: base.context };
  return respond("planner", g.stream, async (emit) => {
    const { known, lines } = await replay([...study.calls, ...work.calls], ctx);
    const out = await runLoop({
      agent: "planner",
      apiKey: key,
      system: plansPrompt({ locale: base.locale, today: today.toISOString().slice(0, 10), context: base.context }),
      tools: READ_TOOL_SCHEMAS,
      submit: {
        tool: SUBMIT_PLANS,
        check: (v, k) => checkPlans(v, k, lineCheck([...k.texts, JSON.stringify(final), replies.map((r) => r.answer).join(" ")], base.answers, base.text, base.locale, today), today),
        hint: PLANS_HINT,
      },
      firstMessage: firstMessage({ ...base, intake, replies, study, work, toolResults: lines, final }),
      effort: "medium",
      deadlineMs: DEADLINE_MS.plans,
      emit,
      ctx,
      known,
    });
    return { type: "result", agent: "planner", data: out.result };
  });
}
