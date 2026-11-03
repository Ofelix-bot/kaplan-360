import "server-only";
import type { Claim, SourceRef, Verdict } from "@/lib/agent/types";
import { isRead } from "./checks";
import { PLAN_IDS, type CaseResult, type IntakeResult, type PlansResult, type ToolCallRecord } from "./types";

// The parts of an adviser v2 request that came back from the browser, read with only the shapes they may have. They are
// data: the judge re-runs the cases' tool calls on the server (lib/adviser/checks.ts replay) and every line it writes
// is checked against those results, so a changed case can't bring in a number or a source.

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const KINDS = ["programme", "employment", "ep", "career", "policy"] as const;

function claim(v: unknown): Claim {
  const o = obj(v);
  const sources = arr(o.sources, 8).flatMap((s): SourceRef[] => {
    const y = obj(s);
    const kind = KINDS.find((k) => k === y.kind);
    return kind && typeof y.id === "string" ? [{ kind, id: y.id.slice(0, 400), ...(typeof y.field === "string" ? { field: y.field.slice(0, 60) } : {}) }] : [];
  });
  return { text: str(o.text), sources };
}

export function intakeOf(v: unknown): IntakeResult {
  const o = obj(v);
  return {
    you: arr(o.you, 5).map(claim).filter((c) => c.text),
    goal: str(o.goal),
    questions: arr(o.questions, 2).map((q, i) => {
      const y = obj(q);
      return { id: str(y.id, 40) || `q${i + 1}`, question: str(y.question, 200), options: arr(y.options, 4).map((x) => str(x, 80)).filter(Boolean) };
    }),
  };
}

export function repliesOf(v: unknown): { id: string; answer: string }[] {
  return arr(v, 2).map((r) => ({ id: str(obj(r).id, 40), answer: str(obj(r).answer, 300) })).filter((r) => r.answer);
}

export function callsOf(v: unknown): ToolCallRecord[] {
  return arr(v, 16).flatMap((c): ToolCallRecord[] => {
    const y = obj(c);
    return typeof y.tool === "string" && isRead(y.tool) ? [{ tool: y.tool, input: obj(y.input) }] : [];
  });
}

/** A case as the browser holds it; an empty one (thesis "") when that side didn't finish. */
export function caseOf(v: unknown, side: "study" | "work"): CaseResult {
  const o = obj(v);
  const crit = ["cost", "benefit", "risk", "fit"] as const;
  return {
    side,
    thesis: claim(o.thesis),
    points: arr(o.points, 4).flatMap((p) => {
      const y = obj(p);
      const criterion = crit.find((c) => c === y.criterion);
      return criterion ? [{ criterion, claim: claim(y.claim) }] : [];
    }),
    concede: claim(o.concede),
    conditions: arr(o.conditions, 3).map((c) => str(c)).filter(Boolean),
    picks: arr(o.picks, 3).map((p) => ({ programmeId: str(obj(p).programmeId, 400), reason: str(obj(p).reason) })).filter((p) => p.programmeId),
    roles: arr(o.roles, 3).map((p) => ({ roleId: str(obj(p).roleId, 200), reason: str(obj(p).reason) })).filter((p) => p.roleId),
    calls: callsOf(o.calls),
  };
}

export function verdictsOf(v: unknown): Verdict[] {
  const statuses = ["supported", "conflict", "unsupported", "stale"] as const;
  return arr(v, 40).flatMap((x): Verdict[] => {
    const y = obj(x);
    const status = statuses.find((s) => s === y.status);
    return status ? [{ claim: str(y.claim), status, quote: typeof y.quote === "string" ? y.quote.slice(0, 600) : null, url: typeof y.url === "string" ? y.url.slice(0, 400) : null, note: str(y.note) }] : [];
  });
}

/** The three plans as the browser holds them (Kappy's reading rests on the server's re-run tool results, not on these lines). */
export function plansOf(v: unknown): PlansResult | null {
  const o = obj(v);
  const plans = arr(o.plans, 3).flatMap((p): PlansResult["plans"] => {
    const y = obj(p);
    const id = PLAN_IDS.find((k) => k === y.id);
    const road = (["study", "work", "both"] as const).find((r) => r === y.road);
    const steps = arr(y.steps, 6).flatMap((s): PlansResult["plans"][number]["steps"] => {
      const z = obj(s);
      const lane = (["education", "career"] as const).find((l) => l === z.lane) ?? null;
      const when = str(z.when, 7);
      const text = str(z.text);
      return lane && /^\d{4}-\d{2}$/.test(when) && text ? [{ when, lane, text }] : [];
    });
    const title = str(y.title, 90);
    if (!id || !road || !title || !steps.length) return [];
    const ids = (w: unknown) => arr(w, 2).map((x) => str(x, 400)).filter(Boolean);
    return [{ id, title, road, bet: str(y.bet), steps, givesUp: str(y.givesUp), worksIf: str(y.worksIf), picks: ids(y.picks), roles: ids(y.roles) }];
  });
  if (plans.length !== 3) return null;
  return { plans, follows: PLAN_IDS.find((k) => k === o.follows) ?? null };
}
