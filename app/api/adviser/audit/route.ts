import { auditFinal, finalOf } from "@/lib/agent/audit";
import { callModel } from "@/lib/adviser/model";
import { guard, reply, respond } from "@/lib/adviser/route-kit";
import { DEADLINE_MS } from "@/lib/adviser/types";

// POST /api/adviser/audit (adviser v2, Make It Fail): lib/agent/audit.ts unchanged in what it checks, on Opus with
// adaptive thinking (effort high) through lib/adviser/model.ts, inside the stage's deadline.
export const maxDuration = 60;

export async function POST(request: Request) {
  const g = await guard(request);
  if (g instanceof Response) return g;
  const { base, key, body } = g;
  const final = finalOf(body.final);
  if (!final) return reply({ error: "bad-request" }, 400);
  const deadline = Date.now() + DEADLINE_MS.audit;
  return respond("audit", g.stream, async (emit) => {
    const data = await auditFinal({ locale: base.locale, text: base.text, answers: base.answers, final }, key, (p) =>
      callModel({ agent: "audit", apiKey: key, ...p, effort: "high", deadline, onThinking: (text) => emit({ type: "thinking", agent: "audit", text }) }),
    );
    return { type: "result", agent: "audit", data };
  });
}
