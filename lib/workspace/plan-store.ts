import { create } from "zustand";
import { EMPTY_ANSWERS, getPlanSnapshot, parsePlan, savePlan, subscribePlan, type PlanAnswers } from "@/lib/plan-storage";

// The Start planning answers as a Zustand store, for the shadcn/ui pages. The answers stay where they
// always were (lib/plan-storage.ts: this browser only, "remember on this device" or for the session,
// an example student in place of them while one is open), so pages still on lib/use-plan.ts see every
// change. `ready` is false on the server and until the browser has been read.

type PlanState = {
  ready: boolean;
  answers: PlanAnswers;
  remember: boolean;
  /** The example student shown in place of the visitor's own answers, if one is open. */
  example: string | null;
  update: (patch: Partial<PlanAnswers>) => void;
};

const read = () => {
  const stored = parsePlan(getPlanSnapshot());
  return { answers: stored?.answers ?? EMPTY_ANSWERS, remember: stored?.remember ?? true, example: stored?.example ?? null };
};

export const usePlanStore = create<PlanState>()((set, get) => ({
  ready: false,
  answers: EMPTY_ANSWERS,
  remember: true,
  example: null,
  update: (patch) => {
    const answers = { ...get().answers, ...patch };
    // Saving announces the change, which reads it back. With storage blocked the answers still
    // apply for as long as the page is open.
    if (!savePlan(answers, get().remember)) set({ answers });
  },
}));

let started = false;

/** Reads this browser's answers and follows later changes (other tabs, other pages). Call after the first render. */
export function startPlanStore() {
  if (started) return;
  started = true;
  const sync = () => usePlanStore.setState({ ...read(), ready: true });
  sync();
  subscribePlan(sync);
}
