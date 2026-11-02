"use client";

import { useMemo } from "react";
import type { PlanLevel } from "@/lib/plan-storage";
import { usePlanStore } from "@/lib/workspace/plan-store";
import type { Residency } from "./content";

// The three answers the homepage's sections follow, read from and written to the visitor's Start
// planning answers (this browser only): their level (also asked in the hero), whether they are on a
// Student’s Pass, and the month their course ends. Until they answer, the sections show a degree
// student on a Student’s Pass finishing seven months from now.

/** "t" months: year * 12 + month (0-based). */
export type MonthT = number;

export const monthT = (d: Date): MonthT => d.getFullYear() * 12 + d.getMonth();

export function useHomeAnswers(today: Date | null) {
  const ready = usePlanStore((s) => s.ready);
  const answers = usePlanStore((s) => s.answers);
  const update = usePlanStore((s) => s.update);

  return useMemo(() => {
    const now = today ? monthT(today) : 0;
    const stored = answers.graduationYear && answers.graduationMonth ? answers.graduationYear * 12 + answers.graduationMonth - 1 : null;
    // The picker offers the next 18 months; an answer outside them shows the default.
    const courseEnd = stored !== null && stored >= now && stored < now + 18 ? stored : now + 7;
    const residency: Residency = answers.status === "citizen-pr" ? "local" : "student-pass";
    const level: PlanLevel = answers.level ?? "degree";
    return {
      ready,
      level,
      residency,
      /** Whether the visitor has said (or only the default is showing). */
      answered: { level: !!answers.level, residency: !!answers.status, courseEnd: stored !== null },
      courseEnd,
      setLevel: (next: PlanLevel) => next !== answers.level && update({ level: next, programmeId: null, pathwayDegreeId: null }),
      setResidency: (next: Residency) => update({ status: next === "local" ? "citizen-pr" : "student-pass" }),
      setCourseEnd: (t: MonthT) => update({ graduationYear: Math.floor(t / 12), graduationMonth: (t % 12) + 1 }),
    };
  }, [answers, ready, today, update]);
}
