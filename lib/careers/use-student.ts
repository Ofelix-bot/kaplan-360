"use client";

import { useEffect, useMemo } from "react";
import { applyExampleFromUrl, closeExampleNow, openExampleNow } from "@/lib/example-link";
import { degreeChoice, EMPTY_ANSWERS, getPlanSnapshot, parsePlan, plannedDegree, savePlan } from "@/lib/plan-storage";
import { usePlan } from "@/lib/use-plan";
import { studentFromAnswers } from "./match";
import type { MatchStudent, StudentContext } from "./types";

// The /careers student: the shared Start planning answers (lib/plan-storage.ts, this browser only), or the
// worked example while one is open, turned into a MatchStudent with the server-sliced StudentContext.
// The example rules (plan §3.4, decisions Q3 and C1):
// - ?example=<id> opens that example;
// - with no example open, no degree of the visitor's own and no auto-open yet this session, Arjun opens
//   (sessionStorage "kaplan360:careers-auto", so "Use my own details" is not undone at once);
// - picking a degree is the visitor's own input: it closes the example and writes to their own answers.

const AUTO = "kaplan360:careers-auto";

function autoDone(): boolean {
  try {
    return window.sessionStorage.getItem(AUTO) !== null;
  } catch {
    // Storage blocked: count it as done, so the example never reopens on every page.
    return true;
  }
}

function markAuto() {
  try {
    window.sessionStorage.setItem(AUTO, "1");
  } catch {}
}

/** The MatchStudent from this browser's answers. `ready` is false on the server and before the browser is read. */
export function useMatchStudent(ctx: StudentContext): { student: MatchStudent; ready: boolean; example: string | null } {
  const { answers, ready, example } = usePlan();
  const student = useMemo(() => studentFromAnswers(answers, ctx), [answers, ctx]);
  return { student, ready, example };
}

/** On mount: the URL's example, else Arjun for a first visit with no degree of the visitor's own (plan §3.4). */
export function useCareersAutoExample(): void {
  useEffect(() => {
    const fromUrl = applyExampleFromUrl();
    const stored = parsePlan(getPlanSnapshot());
    // An example is open already (from the link, the menu or earlier): once it is closed, it stays closed.
    if (fromUrl || stored?.example) return markAuto();
    if (plannedDegree(stored?.answers ?? EMPTY_ANSWERS)) return;
    if (autoDone()) return;
    markAuto();
    openExampleNow("arjun");
  }, []);
}

/**
 * The visitor picks a degree (C1): the example closes first, then the choice goes into the visitor's OWN
 * answers, read afresh after closing (not the example's). A diploma student's pick is their next degree
 * (pathwayDegreeId); see degreeChoice in lib/plan-storage.ts.
 */
export function pickDegree(programmeId: string): boolean {
  closeExampleNow();
  // The visitor chose for themselves: never auto-open the example over it this session.
  markAuto();
  const own = parsePlan(getPlanSnapshot());
  const answers = own?.answers ?? EMPTY_ANSWERS;
  return savePlan({ ...answers, ...degreeChoice(answers, programmeId) }, own?.remember ?? true);
}
