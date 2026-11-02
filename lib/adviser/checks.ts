import "server-only";
import { checkEp, checkFinal, checkIndustry, checkProgramme, checkRole, checkSearch, sourceKey, type Checked } from "@/lib/agent/tools";
import { answersLine, SERVER_RUN, ToolError, type ToolContext, type ToolResult } from "@/lib/agent/tools-server";
import type { Claim, Final, ServerTool, SourceRef } from "@/lib/agent/types";
import type { Locale } from "@/lib/i18n/config";
import { inLanguage, lineOk } from "@/lib/parent-plan";
import type { PlanAnswers } from "@/lib/plan-storage";
import { checkRoads, compareRoads } from "./roads";
import { MAX_ASKS, type CaseResult, type IntakeResult, type ReadTool, type ToolCallRecord } from "./types";

// What the adviser v2 writes is checked on the way out. Lines: lib/parent-plan.ts lineOk (no admission wording, no
// hedging, only numbers a tool result, the answers or the student's text gave) and the page's language. Sources: every
// id a claim cites must be one a tool returned. Programme and role ids: only ones a tool returned. A line that fails is
// dropped, never the whole answer; a required field left empty gets a neutral line instead. replay() re-runs a stage's
// read-tool calls on the server, so a later stage never trusts tool results or text the browser sends back.

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
