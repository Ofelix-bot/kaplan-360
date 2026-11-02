import table from "@/data/raw/ep-qualifying-salary.json";
import type { PlanAnswers } from "@/lib/plan-storage";

// The Employment Pass minimum qualifying salary for the student: MOM's table by age (data/raw/ep-qualifying-salary.json,
// receipt "ep-age" in lib/home/receipts.ts), for financial services or every other sector, on the schedule that
// applies when they would apply (graduation month: before January 2027 the current table, after it the 2027 one).

const FIRST_AGE = 23;
const LAST_AGE = 45;
const FROM_2027 = 2027 * 12;

export type EpFloor = {
  value: number;
  /** The age read (23 = "23 or below", 45 = "45 and above"); null when the year of birth or graduation isn't known (the 23-or-below figure). */
  age: number | null;
  sector: "general" | "financial";
  schedule: "current" | "from2027";
};

/** The salary floor for these answers; `financial`: the degree is in accounting and finance. */
export function epFloor(a: Pick<PlanAnswers, "birthYear" | "graduationYear" | "graduationMonth">, financial: boolean): EpFloor {
  const at = a.graduationYear && a.graduationMonth ? a.graduationYear * 12 + a.graduationMonth - 1 : null;
  const schedule = at !== null && at < FROM_2027 ? "current" : "from2027";
  const age = a.birthYear && a.graduationYear ? Math.min(LAST_AGE, Math.max(FIRST_AGE, a.graduationYear - a.birthYear)) : null;
  const sector = financial ? "financial" : "general";
  return { value: table[sector][schedule][(age ?? FIRST_AGE) - FIRST_AGE], age, sector, schedule };
}

/** Citizens and permanent residents need no work pass. */
export const needsWorkPass = (a: Pick<PlanAnswers, "sgStatus" | "status">) => a.sgStatus !== "citizen" && a.sgStatus !== "pr" && a.status !== "citizen-pr";
