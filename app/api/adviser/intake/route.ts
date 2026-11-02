import { checkIntake, lineCheck } from "@/lib/adviser/checks";
import { runLoop } from "@/lib/adviser/loop";
import { firstMessage, intakePrompt } from "@/lib/adviser/prompts";
import { guard, respond } from "@/lib/adviser/route-kit";
import { SUBMIT_INTAKE } from "@/lib/adviser/schemas";
import { DEADLINE_MS } from "@/lib/adviser/types";

// POST /api/adviser/intake (adviser v2, Step 1): reads the student, asks at most two questions. No read tools.
export const maxDuration = 60;

export async function POST(request: Request) {
  const g = await guard(request);
  if (g instanceof Response) return g;
  const { base, key } = g;
  const today = new Date();
  const ok = lineCheck([], base.answers, base.text, base.locale, today);
  return respond("intake", g.stream, async (emit) => {
    const out = await runLoop({
      agent: "intake",
      apiKey: key,
      system: intakePrompt({ locale: base.locale, today: today.toISOString().slice(0, 10), context: base.context }),
      tools: [],
      submit: { tool: SUBMIT_INTAKE, check: (v) => checkIntake(v, ok, base.locale) },
      firstMessage: firstMessage(base),
      effort: "low",
      deadlineMs: DEADLINE_MS.intake,
      emit,
      ctx: { answers: base.answers, locale: base.locale, context: base.context },
    });
    return { type: "result", agent: "intake", data: out.result };
  });
}
