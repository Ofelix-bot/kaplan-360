import { checkDecision, lineCheck, replay } from "@/lib/adviser/checks";
import { runLoop } from "@/lib/adviser/loop";
import { firstMessage, judgePrompt } from "@/lib/adviser/prompts";
import { caseOf, intakeOf, repliesOf, verdictsOf } from "@/lib/adviser/request";
import { guard, respond } from "@/lib/adviser/route-kit";
import { READ_TOOL_SCHEMAS, SUBMIT_DECISION } from "@/lib/adviser/schemas";
import { DEADLINE_MS } from "@/lib/adviser/types";

// POST /api/adviser/judge (adviser v2, Steps 3 and 4): weighs both cases into a Final. The cases' tool calls are re-run
// here first, so the numbers and sources the judge may use come from the server, not from the browser's copy.
export const maxDuration = 60;

export async function POST(request: Request) {
  const g = await guard(request);
  if (g instanceof Response) return g;
  const { base, key, body } = g;
  const today = new Date();
  const intake = intakeOf(body.intake);
  const replies = repliesOf(body.replies);
  const study = caseOf(body.study, "study");
  const work = caseOf(body.work, "work");
  const fix = verdictsOf(body.fix);
  const rewrite = body.fix !== undefined;
  const previous = rewrite && body.previous && typeof body.previous === "object" ? body.previous : undefined;
  const ctx = { answers: base.answers, locale: base.locale, context: base.context };
  return respond("judge", g.stream, async (emit) => {
    const { known, lines } = await replay([...study.calls, ...work.calls], ctx);
    const out = await runLoop({
      agent: "judge",
      apiKey: key,
      system: judgePrompt({ locale: base.locale, today: today.toISOString().slice(0, 10), context: base.context, rewrite }),
      tools: READ_TOOL_SCHEMAS,
      submit: { tool: SUBMIT_DECISION, check: (v, k) => checkDecision(v, k, lineCheck([...k.texts, replies.map((r) => r.answer).join(" ")], base.answers, base.text, base.locale, today), base.locale, today) },
      firstMessage: firstMessage({ ...base, intake, replies, study, work, toolResults: lines, verdicts: fix, previous }),
      // Medium: high ran to the 50 s deadline on Arjun (2026-11-03 check:adviser run 2).
      effort: "medium",
      deadlineMs: DEADLINE_MS.judge,
      emit,
      ctx,
      known,
    });
    return { type: "result", agent: "judge", data: out.result };
  });
}
