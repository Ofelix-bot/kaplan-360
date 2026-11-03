import { checkReview, lineCheck, replay, REVIEW_HINT } from "@/lib/adviser/checks";
import { runLoop } from "@/lib/adviser/loop";
import { model } from "@/lib/adviser/model";
import { firstMessage, reviewPrompt } from "@/lib/adviser/prompts";
import { callsOf, plansOf } from "@/lib/adviser/request";
import { guard, reply, respond } from "@/lib/adviser/route-kit";
import { SUBMIT_REVIEW } from "@/lib/adviser/schemas";
import { DEADLINE_MS } from "@/lib/adviser/types";
import { finalOf } from "@/lib/agent/audit";

// POST /api/adviser/review (adviser v2, Step 4): Kappy reads the three plans, compares them for the student and marks
// the passages of its own text it thinks matter (docs/agent/roadmap.md). It calls no tools; the numbers it may write are
// the ones the cases' re-run tool calls, the decision and the plans hold. It never picks a plan: the student does.
export const maxDuration = 60;

export async function POST(request: Request) {
  const g = await guard(request);
  if (g instanceof Response) return g;
  const { base, key, body } = g;
  const final = finalOf(body.final);
  const plans = plansOf(body.plans);
  if (!final || !plans) return reply({ error: "bad-request" }, 400);
  const today = new Date();
  const ctx = { answers: base.answers, locale: base.locale, context: base.context };
  return respond("kappy", g.stream, async (emit) => {
    const { known } = await replay(callsOf(body.calls), ctx);
    const ok = lineCheck([...known.texts, JSON.stringify(final), JSON.stringify(plans)], base.answers, base.text, base.locale, today);
    const out = await runLoop({
      agent: "kappy",
      apiKey: key,
      system: reviewPrompt({ locale: base.locale, today: today.toISOString().slice(0, 10), context: base.context }),
      tools: [],
      submit: { tool: SUBMIT_REVIEW, check: (v) => checkReview(v, ok, model()), hint: REVIEW_HINT },
      firstMessage: firstMessage({ ...base, final, plans }),
      effort: "low",
      deadlineMs: DEADLINE_MS.review,
      emit,
      ctx,
      known,
    });
    return { type: "result", agent: "kappy", data: out.result };
  });
}
