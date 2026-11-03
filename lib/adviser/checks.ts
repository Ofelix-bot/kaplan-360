import "server-only";
import { checkEp, checkFinal, checkIndustry, checkProgramme, checkRole, checkSearch, sourceKey, type Checked } from "@/lib/agent/tools";
import { answersLine, SERVER_RUN, ToolError, type ToolContext, type ToolResult } from "@/lib/agent/tools-server";
import type { Claim, Final, ServerTool, SourceRef } from "@/lib/agent/types";
import type { Locale } from "@/lib/i18n/config";
import { inLanguage, lineOk } from "@/lib/parent-plan";
import type { PlanAnswers } from "@/lib/plan-storage";
import { checkRoads, compareRoads } from "./roads";
import { MAX_ASKS, PLAN_IDS, type CaseResult, type IntakeResult, type Mark, type Plan, type PlanId, type PlansResult, type ReadTool, type ReviewResult, type ToolCallRecord } from "./types";

// What the adviser v2 writes is checked on the way out. Lines: lib/parent-plan.ts lineOk (no admission wording, no
// hedging, only numbers a tool result, the answers or the student's text gave) and the page's language. Sources: every
// id a claim cites must be one a tool returned. Programme and role ids: only ones a tool returned. A line that fails is
// dropped, never the whole answer; a required field left empty gets a neutral line instead. replay() re-runs a stage's
// read-tool calls on the server, so a later stage never trusts tool results or text the browser sends back. The three
// plans (checkPlans) and Kappy's reading of them (checkReview) go through the same line check; a mark Kappy made is kept
// only when its quote stands word for word in the paragraph it marks.

const CHECK: Record<ReadTool, (v: unknown) => Checked<unknown>> = {
  search_programmes: checkSearch,
  admit_rate: checkProgramme,
  ep_check: checkEp,
  hot_roles: checkIndustry,
  skill_gap: checkRole,
  outcomes_figures: () => ({ ok: true, input: {} }),
  compare_roads: checkRoads,
};

export const READ_TOOLS = Object.keys(CHECK) as ReadTool[];
export const isRead = (n: string): n is ReadTool => n in CHECK;

/** Runs one read tool; throws ToolError with a reason the model can act on. */
export async function runRead(tool: ReadTool, input: unknown, ctx: ToolContext): Promise<ToolResult> {
  const checked = CHECK[tool](input);
  if (!checked.ok) throw new ToolError(checked.error);
  if (tool === "compare_roads") return compareRoads(checked.input as never, ctx);
  return SERVER_RUN[tool as ServerTool](checked.input as never, ctx);
}

/** What the tools have returned: their sources, programme and role ids, and every result's text (for the numbers). */
export class Known {
  sources = new Set<string>();
  programmes = new Set<string>();
  roles = new Set<string>();
  texts: string[] = [];
  add(content: string) {
    this.texts.push(content);
    try {
      for (const s of (JSON.parse(content) as { sources?: SourceRef[] }).sources ?? []) {
        this.sources.add(sourceKey(s));
        if (s.kind === "programme") this.programmes.add(s.id);
        if (s.kind === "career") this.roles.add(s.id);
      }
    } catch {}
  }
}

/** Re-runs the calls (deduplicated, at most 16) on the server. */
export async function replay(calls: ToolCallRecord[], ctx: ToolContext): Promise<{ known: Known; lines: string[] }> {
  const seen = new Set<string>();
  const unique = calls
    .filter((c) => {
      const k = `${c.tool}:${JSON.stringify(c.input)}`;
      if (!isRead(c.tool) || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 16);
  const known = new Known();
  const lines: string[] = [];
  const done = await Promise.all(unique.map((c) => runRead(c.tool, c.input, ctx).then((r) => r.content).catch(() => null)));
  done.forEach((content, i) => {
    if (!content) return;
    known.add(content);
    lines.push(`${unique[i].tool} ${JSON.stringify(unique[i].input)}\n${content.slice(0, 12_000)}`);
  });
  return { known, lines };
}

const NUMBER = /\d+(?:[.,]\d+)*/g;
const plain = (n: string) => String(Number(n.replace(/,/g, "")));
const MONTHS = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/g;

/** The line check: the numbers the tools, the answers and the text gave (plus 1 to 6 and the next five years), and the page's language. */
export function lineCheck(texts: string[], answers: PlanAnswers, text: string, locale: Locale, today: Date) {
  const nums = new Set<string>();
  for (let n = 1; n <= 6; n++) nums.add(String(n));
  for (let y = today.getFullYear(); y <= today.getFullYear() + 5; y++) nums.add(String(y));
  for (const t of [...texts, text, answersLine(answers)]) for (const n of t.match(NUMBER) ?? []) nums.add(plain(n));
  return (line: string) => !!line.trim() && lineOk(line.replace(MONTHS, ""), nums) && inLanguage(line, locale);
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max = 240) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function claimOf(v: unknown, known: Set<string>, ok: (l: string) => boolean): Claim | null {
  const o = obj(v);
  const text = str(o.text);
  if (!text || !ok(text)) return null;
  const sources: SourceRef[] = [];
  for (const s of Array.isArray(o.sources) ? o.sources : []) {
    const y = obj(s);
    const kind = y.kind;
    if ((kind !== "programme" && kind !== "employment" && kind !== "ep" && kind !== "career" && kind !== "policy") || typeof y.id !== "string") return null;
    const ref: SourceRef = { kind, id: y.id.slice(0, 400), ...(typeof y.field === "string" ? { field: y.field.slice(0, 60) } : {}) };
    if (!known.has(sourceKey(ref))) return null;
    sources.push(ref);
  }
  return { text, sources };
}

const NEUTRAL: Record<Locale, string> = {
  en: "This line didn't pass the check, so it isn't shown.",
  "zh-hans": "这一条没有通过核对，所以不显示。",
  "zh-hant": "這一條沒有通過核對，所以不顯示。",
};
export const neutral = (locale: Locale): Claim => ({ text: NEUTRAL[locale], sources: [] });

export function checkIntake(v: unknown, ok: (l: string) => boolean, locale: Locale): IntakeResult {
  const o = obj(v);
  const you = (Array.isArray(o.you) ? o.you : [])
    .slice(0, 5)
    .map((c) => claimOf({ ...obj(c), sources: [] }, new Set(), ok))
    .filter((c): c is Claim => !!c);
  const goal = str(o.goal);
  const questions = (Array.isArray(o.questions) ? o.questions : []).slice(0, MAX_ASKS).flatMap((q, i) => {
    const y = obj(q);
    const question = str(y.question, 200);
    if (!question || !inLanguage(question, locale)) return [];
    const options = (Array.isArray(y.options) ? y.options : [])
      .filter((x): x is string => typeof x === "string" && !!x.trim())
      .map((x) => x.trim().slice(0, 80))
      .slice(0, 4);
    return [{ id: str(y.id, 40) || `q${i + 1}`, question, options }];
  });
  return { you, goal: goal && ok(goal) ? goal : "", questions };
}

export function checkCase(v: unknown, side: "study" | "work", known: Known, ok: (l: string) => boolean, locale: Locale, calls: ToolCallRecord[]): CaseResult {
  const o = obj(v);
  const claim = (c: unknown) => claimOf(c, known.sources, ok);
  const points = (Array.isArray(o.points) ? o.points : []).slice(0, 4).flatMap((p): CaseResult["points"] => {
    const y = obj(p);
    const criterion = y.criterion;
    const c = claim(y.claim);
    return (criterion === "cost" || criterion === "benefit" || criterion === "risk" || criterion === "fit") && c ? [{ criterion, claim: c }] : [];
  });
  const idsOf = (list: unknown, key: "programmeId" | "roleId", set: Set<string>) =>
    (Array.isArray(list) ? list : []).flatMap((p) => {
      const y = obj(p);
      const id = str(y[key], 400);
      const reason = str(y.reason);
      return id && set.has(id) ? [{ id, reason: reason && ok(reason) ? reason : "" }] : [];
    });
  return {
    side,
    thesis: claim(o.thesis) ?? neutral(locale),
    points,
    concede: claim(o.concede) ?? neutral(locale),
    conditions: (Array.isArray(o.conditions) ? o.conditions : []).map((c) => str(c)).filter((c) => c && ok(c)).slice(0, 3),
    picks: idsOf(o.picks, "programmeId", known.programmes).slice(0, 3).map((p) => ({ programmeId: p.id, reason: p.reason })),
    roles: idsOf(o.roles, "roleId", known.roles).slice(0, 3).map((p) => ({ roleId: p.id, reason: p.reason })),
    calls,
  };
}

/** The judge's Final through lib/agent/tools.ts checkFinal, with a neutral line where a required field came back empty. */
export function checkDecision(v: unknown, known: Known, ok: (l: string) => boolean, locale: Locale, today: Date): Final {
  const f = checkFinal(v, known, ok, today);
  if (!f.decision.why.text) f.decision.why = neutral(locale);
  return f;
}

const MONTH = /^(\d{4})-(\d{2})$/;

/** The dated steps of a plan: this year to five years on, a lane, a line that passes the check; in date order, at most 6. */
function stepsOf(v: unknown, ok: (l: string) => boolean, today: Date): Plan["steps"] {
  const year = today.getFullYear();
  return (Array.isArray(v) ? v : [])
    .slice(0, 8)
    .flatMap((x): Plan["steps"] => {
      const y = obj(x);
      const when = str(y.when, 7);
      const m = MONTH.exec(when);
      const lane = y.lane === "education" || y.lane === "career" ? y.lane : null;
      const text = str(y.text);
      if (!m || Number(m[1]) < year || Number(m[1]) > year + 5 || Number(m[2]) < 1 || Number(m[2]) > 12 || !lane || !text || !ok(text)) return [];
      return [{ when, lane, text }];
    })
    .sort((p, q) => p.when.localeCompare(q.when))
    .slice(0, 6);
}

/** What the planner must give for the loop to accept its submit_plans (lib/adviser/loop.ts tells it so on a miss). */
export const PLANS_HINT = "three plans with ids A, B and C, each with a title, a bet and at least 2 dated steps (YYYY-MM, this year or later) whose lines use only numbers from the data";

/** The three plans, or null when fewer than three survive (the loop then asks the model again). */
export function checkPlans(v: unknown, known: Known, ok: (l: string) => boolean, today: Date): PlansResult | null {
  const o = obj(v);
  const seen = new Set<PlanId>();
  const plans: Plan[] = [];
  for (const [i, p] of (Array.isArray(o.plans) ? o.plans : []).slice(0, 3).entries()) {
    const y = obj(p);
    const id = PLAN_IDS.find((k) => k === y.id && !seen.has(k)) ?? PLAN_IDS.find((k) => !seen.has(k)) ?? PLAN_IDS[i];
    const title = str(y.title, 90);
    const bet = str(y.bet);
    const steps = stepsOf(y.steps, ok, today);
    const road = y.road === "study" || y.road === "work" || y.road === "both" ? y.road : null;
    if (!title || !ok(title) || !bet || !ok(bet) || steps.length < 2 || !road) continue;
    seen.add(id);
    const ids = (list: unknown, set: Set<string>) => [...new Set((Array.isArray(list) ? list : []).map((x) => str(x, 400)).filter((x) => x && set.has(x)))].slice(0, 2);
    const givesUp = str(y.givesUp);
    const worksIf = str(y.worksIf);
    plans.push({ id, title, road, bet, steps, givesUp: givesUp && ok(givesUp) ? givesUp : "", worksIf: worksIf && ok(worksIf) ? worksIf : "", picks: ids(y.picks, known.programmes), roles: ids(y.roles, known.roles) });
  }
  if (plans.length < 3) return null;
  plans.sort((p, q) => p.id.localeCompare(q.id));
  const follows = PLAN_IDS.find((k) => k === o.follows) ?? null;
  return { plans, follows };
}

export const REVIEW_HINT = "at least one paragraph whose lines use only numbers from the data, with each mark's quote copied word for word from that paragraph";

/** Kappy's reading, or null when no paragraph survives. A mark whose quote isn't in its paragraph is dropped. */
export function checkReview(v: unknown, ok: (l: string) => boolean, model: string): ReviewResult | null {
  const o = obj(v);
  let marks = 0;
  const paragraphs = (Array.isArray(o.paragraphs) ? o.paragraphs : []).slice(0, 4).flatMap((p): ReviewResult["paragraphs"] => {
    const y = obj(p);
    const text = str(y.text, 700);
    if (!text || !ok(text)) return [];
    const kept: Mark[] = [];
    for (const m of Array.isArray(y.marks) ? y.marks : []) {
      const z = obj(m);
      const quote = str(z.quote, 160);
      const why = str(z.why, 200);
      const kind = z.kind === "key" || z.kind === "risk" || z.kind === "check" ? z.kind : null;
      if (!quote || !kind || !why || !ok(why) || !text.includes(quote) || marks >= 6 || kept.some((k) => k.quote === quote)) continue;
      kept.push({ quote, kind, why });
      marks++;
    }
    return [{ text, marks: kept }];
  });
  if (!paragraphs.length) return null;
  const takes: ReviewResult["takes"] = [];
  for (const t of Array.isArray(o.takes) ? o.takes : []) {
    const y = obj(t);
    const plan = PLAN_IDS.find((k) => k === y.plan);
    const line = str(y.line);
    if (plan && line && ok(line) && !takes.some((x) => x.plan === plan)) takes.push({ plan, line });
  }
  const question = str(o.question);
  return { paragraphs, takes, question: question && ok(question) ? question : "", model };
}
