import { checkCase, lineCheck } from "@/lib/adviser/checks";
import { runLoop } from "@/lib/adviser/loop";
import { casePrompt, firstMessage } from "@/lib/adviser/prompts";
import { guard, reply, respond } from "@/lib/adviser/route-kit";
import { READ_TOOL_SCHEMAS, SUBMIT_CASE } from "@/lib/adviser/schemas";
import { intakeOf, repliesOf } from "@/lib/adviser/request";
import { DEADLINE_MS } from "@/lib/adviser/types";

// POST /api/adviser/case?side=study|work (adviser v2, Step 2): one adviser argues its side with the read tools.
export const maxDuration = 60;

export async function POST(request: Request) {
  const side = new URL(request.url).searchParams.get("side");
  if (side !== "study" && side !== "work") return reply({ error: "bad-request" }, 400);
  const g = await guard(request);
  if (g instanceof Response) return g;
  const { base, key, body } = g;
  const today = new Date();
  const intake = intakeOf(body.intake);
  const replies = repliesOf(body.replies);
  const agent = side;
  return respond(agent, g.stream, async (emit) => {
    const out = await runLoop({
      agent,
      apiKey: key,
      system: casePrompt(side, { locale: base.locale, today: today.toISOString().slice(0, 10), context: base.context }),
      tools: READ_TOOL_SCHEMAS,
      submit: {
        tool: SUBMIT_CASE,
        check: (v, known) => checkCase(v, side, known, lineCheck([...known.texts, replies.map((r) => r.answer).join(" ")], base.answers, base.text, base.locale, today), base.locale, []),
      },
      firstMessage: firstMessage({ ...base, intake, replies }),
      effort: "medium",
      deadlineMs: DEADLINE_MS.case,
      emit,
      ctx: { answers: base.answers, locale: base.locale, context: base.context },
    });
    return { type: "result", agent, data: { ...out.result, calls: out.calls } };
  });
}
