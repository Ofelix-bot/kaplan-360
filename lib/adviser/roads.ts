import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getResultsData } from "@/lib/data/results";
import { KAPLAN } from "@/lib/data/employment";
import { epFloor, needsWorkPass } from "@/lib/ep";
import type { SourceRef } from "@/lib/agent/types";
import { ToolError, type ToolContext, type ToolResult } from "@/lib/agent/tools-server";

// compare_roads (adviser v2): master's first against work first in money and time, worked out here, no model.
// study: the programme's yearly fee in S$ × its length, the month it ends, and whether the student's yearly budget
// (S$, lib/plan-storage.ts) covers the fee. work: the Kaplan graduates' median starting salary (PEI GES 2024/25) and,
// for a student who needs a work pass, the Employment Pass floor (lib/ep.ts) against it. both: the months of study
// × that salary, the pay not earned while studying ("our count").

export type RoadsInput = { programmeId?: string; roleId?: string };

export const ROADS_TOOL: Anthropic.Tool = {
  name: "compare_roads",
  description:
    "Master's first vs work first in money and time for this student: a programme's total tuition (S$) and end month, whether their budget covers it, the Kaplan graduates' median starting salary, the Employment Pass floor when they need one, and the pay not earned while studying (our count). Pass a programmeId from search_programmes.",
  input_schema: {
    type: "object",
    properties: {
      programmeId: { type: "string", description: "A programme id from search_programmes." },
      roleId: { type: "string", description: "A role id from hot_roles or skill_gap, if the case is about one role." },
    },
  },
};

export function checkRoads(v: unknown): { ok: true; input: RoadsInput } | { ok: false; error: string } {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const programmeId = typeof o.programmeId === "string" && o.programmeId.trim() ? o.programmeId.trim().slice(0, 400) : undefined;
  const roleId = typeof o.roleId === "string" && o.roleId.trim() ? o.roleId.trim().slice(0, 200) : undefined;
  return { ok: true, input: { programmeId, roleId } };
}

const say = (c: ToolContext, en: string, hans: string, hant: string) => (c.locale === "en" ? en : c.locale === "zh-hans" ? hans : hant);

export async function compareRoads(x: RoadsInput, c: ToolContext): Promise<ToolResult> {
  const a = c.answers;
  const sources: SourceRef[] = [{ kind: "employment", id: "sg-kaplan-2024-25" }];
  const salary = KAPLAN.latest.medianSalary;
  const out: Record<string, unknown> = { work: { medianStartingSalarySgdMonth: salary, survey: "PEI GES 2024/25, Kaplan degree graduates" } };
  if (needsWorkPass(a)) {
    const floor = epFloor(a, false);
    const fin = epFloor(a, true);
    const later = { ...a, graduationYear: 2027, graduationMonth: 1 };
    sources.push({ kind: "ep", id: "ep" });
    (out.work as Record<string, unknown>).employmentPassFloorSgdMonth = { schedule: floor.schedule === "current" ? "applications before 1 Jan 2027" : "applications from 1 Jan 2027", general: floor.value, financialServices: fin.value, fromJan2027: { general: epFloor(later, false).value, financialServices: epFloor(later, true).value } };
    (out.work as Record<string, unknown>).floorAboveMedian = floor.value > salary;
  } else {
    (out.work as Record<string, unknown>).needsWorkPass = false;
  }
  let months: number | null = null;
  if (x.programmeId) {
    const data = await getResultsData();
    const p = data.programmes.find((q) => q.id === x.programmeId);
    if (!p) throw new ToolError(`No programme with id ${x.programmeId}: use an id from search_programmes.`);
    months = p.months;
    // A fee stated for the whole course in S$ is the total as stated; else the yearly S$ figure × the years.
    const total = p.feeBasis === "course" && p.fee?.currency === "SGD" ? p.fee.amount : p.feeSgd && p.months ? Math.round((p.feeSgd * Math.max(p.months, 12)) / 12) : null;
    const startYear = a.graduationYear ?? new Date().getFullYear();
    const startMonth = a.graduationMonth ?? new Date().getMonth() + 1;
    const end = p.months ? new Date(Date.UTC(startYear, startMonth - 1 + 1 + p.months, 1)).toISOString().slice(0, 7) : null;
    sources.push({ kind: "programme", id: p.id, field: "tuition" });
    out.study = {
      programme: p.name,
      feeYearSgd: p.feeBasis === "course" ? null : p.feeSgd,
      feeAsStated: p.fee ? `${p.fee.currency ?? ""} ${p.fee.amount} ${p.feeBasis === "course" ? "for the whole course" : p.feeBasis === "year" ? "a year" : ""}`.trim() : null,
      months: p.months,
      tuitionTotalSgd: total,
      endsAround: end,
      budgetYearSgd: a.budget,
      budgetCoversFee: a.budget && p.feeSgd ? a.budget >= p.feeSgd : null,
    };
  }
  if (months) out.both = { payNotEarnedWhileStudyingSgd: months * salary, basis: "our count: months of study × median starting salary" };
  if (x.roleId) out.role = { roleId: x.roleId, note: "Use skill_gap or hot_roles for this role's pay." };
  out.sources = sources;
  const s = salary.toLocaleString("en");
  return {
    content: JSON.stringify(out),
    trace: {
      tool: "search_programmes",
      lane: "you",
      summary: say(c, `Compared both roads: median start S$${s} a month${months ? `, ${months} months of study` : ""}.`, `对比两条路：起薪中位数每月 S$${s}${months ? `，读书 ${months} 个月` : ""}。`, `對比兩條路：起薪中位數每月 S$${s}${months ? `，讀書 ${months} 個月` : ""}。`),
      sources: sources.length,
    },
  };
}
