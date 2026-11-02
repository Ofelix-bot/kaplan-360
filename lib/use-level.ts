"use client";

import { useSyncExternalStore } from "react";
import { EMPTY_ANSWERS, getPlanSnapshot, getServerPlanSnapshot, parsePlan, savePlan, subscribePlan, type PlanLevel } from "@/lib/plan-storage";

/**
 * The visitor's level (diploma or degree), shared by the homepage picker and Start planning:
 * one answer, kept in this browser like the rest of the plan. Null on the server and until chosen.
 */
export function useLevel(): [PlanLevel | null, (level: PlanLevel) => void] {
  const plan = parsePlan(useSyncExternalStore(subscribePlan, getPlanSnapshot, getServerPlanSnapshot));
  const level = plan?.answers.level ?? null;
  const setLevel = (next: PlanLevel) => {
    if (next === level) return;
    const answers = plan?.answers ?? EMPTY_ANSWERS;
    // A programme belongs to one level, so changing level clears it (as the Start planning form does).
    savePlan({ ...answers, level: next, programmeId: null, pathwayDegreeId: null }, plan?.remember ?? false);
  };
  return [level, setLevel];
}
