"use client";

import { createContext, use, useDeferredValue, useMemo, type ReactNode } from "react";
import type { Awarder } from "@/lib/data/partners";
import type { KaplanProgrammeOption, SchoolOption } from "@/lib/plan-options-types";
import { plannedDegree, type PlanAnswers } from "@/lib/plan-storage";
import type { ResultsData } from "@/lib/results-types";
import { distribution, levers, prepareAll, type Distribution, type Lever } from "@/lib/stand/aggregate";
import { otherSchoolDegree, standProfile, type StandDegree } from "@/lib/stand/profile";
import type { Prepared } from "@/lib/stand/score";
import type { StandProfile } from "@/lib/stand/types";
import { useResultsData } from "@/lib/workspace/data";
import { usePlanStore } from "@/lib/workspace/plan-store";

// Where you stand's state, worked out once per change for the whole page: the student's degree and
// profile from the planner's answers (lib/plan-storage.ts, shared with /results and /plan), the
// programmes in their scope (countries and budget), the index over every one of them (lib/stand), and
// the levers. The index runs in the browser; the answers never leave it.

/** What the server gives the page: Kaplan's programmes, the 13 fields, the other private schools, the awarding universities. */
export type StandProps = {
  programmes: KaplanProgrammeOption[];
  disciplines: Record<string, string>;
  schools: SchoolOption[];
  awarders: Record<string, Awarder>;
};

export type StandModel = StandProps & {
  data: ResultsData;
  answers: PlanAnswers;
  update: (patch: Partial<PlanAnswers>) => void;
  example: string | null;
  /** Kaplan, or another private school (its id). */
  school: string;
  /** The Kaplan degree the index reads (the one studied, or for a diploma student the one planned next). */
  kaplanId: string | null;
  degree: StandDegree | null;
  profile: StandProfile;
  /** The programmes in the student's countries and budget, prepared once (lib/stand/score.ts prepare). */
  scope: Prepared[];
  dist: Distribution;
  levers: Lever[];
  /** The levers are being worked out again after a change (they follow the answers a moment later). */
  stale: boolean;
  /** The start the goals are dated from: the student's start year, or the first after their degree. */
  start: { year: number; month: number; stated: boolean };
  /** The degree as the index reads it, from changed answers (the simulator). */
  degreeFor: (a: PlanAnswers) => StandDegree | null;
};

const Ctx = createContext<StandModel | null>(null);

export function useStand(): StandModel {
  const m = use(Ctx);
  if (!m) throw new Error("useStand needs a StandProvider with the data loaded");
  return m;
}

/** The degree the index reads: another school's from its answers, else the Kaplan degree and its awarder's country. */
function degreeOf(a: PlanAnswers, props: StandProps): StandDegree | null {
  if (a.school && a.school !== "kaplan") return otherSchoolDegree(a);
  const id = plannedDegree(a);
  const k = props.programmes.find((p) => p.id === id && p.level === "degree");
  return k ? { name: k.name, university: k.university, country: props.awarders[k.id]?.country ?? null, discipline: k.discipline } : null;
}

/**
 * The first start after the bachelor's: the September after graduation (the January after, for a student
 * after a January start), a year later for a diploma student, who takes the degree first; next year with
 * no graduation date. Never a start that has already begun.
 */
export function defaultStartYear(a: PlanAnswers, today: Date): number {
  if (!a.graduationYear || !a.graduationMonth) return today.getFullYear() + 1;
  const after = a.intake === "jan-mar" ? a.graduationYear + 1 : a.graduationYear + (a.graduationMonth > 8 ? 1 : 0);
  let y = after + (a.level === "diploma" ? 1 : 0);
  while (startMonthOf(a, y) <= today.getFullYear() * 12 + today.getMonth()) y++;
  return y;
}

/** The start month for a start year: January for a January-to-March start, else September. */
export const startMonthOf = (a: PlanAnswers, year: number) => year * 12 + (a.intake === "jan-mar" ? 0 : 8);

export function StandProvider({ props, children }: { props: StandProps; children: (ready: boolean) => ReactNode }) {
  const data = useResultsData((s) => s.data);
  const answers = usePlanStore((s) => s.answers);
  const update = usePlanStore((s) => s.update);
  const example = usePlanStore((s) => s.example);
  const ready = usePlanStore((s) => s.ready);

  const degree = useMemo(() => degreeOf(answers, props), [answers, props]);
  const profile = useMemo(() => standProfile(answers, degree), [answers, degree]);
  const countries = answers.countries.join("|");
  const scope = useMemo(() => {
    if (!data) return [];
    const only = new Set(countries ? countries.split("|") : []);
    const budget = answers.budget;
    return prepareAll(data).filter((x) => (!only.size || only.has(x.country)) && (budget === null || x.p.feeSgd === null || x.p.feeSgd <= budget));
  }, [data, countries, answers.budget]);
  const dist = useMemo(() => (data ? distribution(profile, data, scope) : null), [data, profile, scope]);
  // Six recomputes: they follow a moment behind typing, so the inputs never wait for them.
  const leverProfile = useDeferredValue(profile);
  const leverScope = useDeferredValue(scope);
  const list = useMemo(() => (data ? levers(leverProfile, data, leverScope) : []), [data, leverProfile, leverScope]);

  const model = useMemo<StandModel | null>(() => {
    if (!data || !dist || !ready) return null;
    const year = answers.startYear ?? defaultStartYear(answers, new Date());
    return {
      ...props,
      data,
      answers,
      update,
      example,
      school: answers.school && answers.school !== "kaplan" ? answers.school : "kaplan",
      kaplanId: plannedDegree(answers),
      degree,
      profile,
      scope,
      dist,
      levers: list,
      stale: leverProfile !== profile || leverScope !== scope,
      start: { year, month: startMonthOf(answers, year), stated: answers.startYear !== null },
      degreeFor: (a) => degreeOf(a, props),
    };
  }, [data, dist, ready, answers, props, update, example, degree, profile, scope, list, leverProfile, leverScope]);

  return <Ctx value={model}>{children(!!model)}</Ctx>;
}
