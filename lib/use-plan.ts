"use client";

import { useMemo, useSyncExternalStore } from "react";
import { EMPTY_ANSWERS, getPlanSnapshot, getServerPlanSnapshot, parsePlan, savePlan, subscribePlan, type PlanAnswers } from "@/lib/plan-storage";

/**
 * The Start planning answers for steps 2 and 3 and the results page: read from this browser, and
 * written back on every change with the visitor's "remember on this device" choice.
 * `ready` is false on the server and before the browser has been read.
 */
export function usePlan() {
  const snapshot = useSyncExternalStore(subscribePlan, getPlanSnapshot, getServerPlanSnapshot);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const stored = useMemo(() => parsePlan(snapshot), [snapshot]);
  const answers = stored?.answers ?? EMPTY_ANSWERS;
  const remember = stored?.remember ?? true;
  const update = (patch: Partial<PlanAnswers>) => savePlan({ ...answers, ...patch }, remember);
  /** The example student being shown instead of the visitor's own answers, if one is open. */
  const example = stored?.example ?? null;
  return { ready, answers, remember, update, example };
}
