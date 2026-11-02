"use client";

import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { useLocalName } from "@/components/results/names";
import { localToday } from "@/lib/benefit-state";
import { applyExampleFromUrl } from "@/lib/example-link";
import { TESTS } from "@/lib/english-tests";
import { monthYear } from "@/lib/i18n/format";
import { downloadIcs, downloadPdf } from "@/lib/plan-files";
import { planInput, plannedDegree, type PlanSources } from "@/lib/plan-input";
import { toRoad } from "@/lib/plan-road";
import { buildPlan } from "@/lib/plan-timeline";
import type { ResultsData } from "@/lib/results-types";
import { usePlan } from "@/lib/use-plan";
import { STATUSES } from "./PlanAboutYou";
import { TodayContext } from "./road/parts";
import { PlanEmpty, PlanError, PlanFrame, PlanLoading } from "./road/PlanFrame";
import { PlanHeader } from "./road/PlanHeader";
import { Road, RoadLegend } from "./road/Road";

// /plan's Timeline tab (./PlanTabs.tsx, the default; Map is the other): the student's own road to their
// master's (lib/plan-road.ts lays the plan out; components/plan/road draws it), from their starred
// programmes and answers, with the plan downloadable as a PDF (which keeps the six-lane chart) and a
// calendar file. Everything is worked out and saved on the device.

const noSubscribe = () => () => {};

export default function PlanView({ sources }: { sources: PlanSources }) {
  const t = useT();
  const locale = useIntlLocale();
  const local = useLocalName();
  const names = useSiteNames();
  const { ready, answers } = usePlan();
  const today = useSyncExternalStore(noSubscribe, localToday, () => null);
  const [data, setData] = useState<ResultsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  // ?example=<id> (a link "with our worked example"): opened before the first paint in the browser, so the
  // visitor's own plan (or the empty state) doesn't show for a frame first.
  useLayoutEffect(() => {
    applyExampleFromUrl();
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/data/programmes")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: ResultsData) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const plan = useMemo(() => {
    if (!data || !today || !ready) return null;
    return buildPlan({
      ...planInput({ today, answers, data, sources }),
      t,
      locale,
      name: local,
      school: (en) => names.school(en).name,
      degreeName: (en) => names.degree(en).name,
    });
  }, [data, today, ready, answers, sources, t, locale, local, names]);
  const road = useMemo(() => (plan && today ? toRoad(plan, today, { t, locale }) : null), [plan, today, t, locale]);

  if (failed)
    return (
      <PlanFrame>
        <PlanHeader start={null} />
        <PlanError />
      </PlanFrame>
    );
  if (ready && !answers.shortlist.length)
    return (
      <PlanFrame>
        <PlanHeader start={null} />
        <PlanEmpty />
      </PlanFrame>
    );
  if (!plan || !road || !today)
    return (
      <PlanFrame>
        <PlanHeader start={null} />
        <PlanLoading />
      </PlanFrame>
    );

  const month = (m: number) => monthYear(locale, m);
  const start = month(plan.start);
  const n = answers.shortlist.length;
  // The answers the plan is built from, said once in the heading's meta line (a missing one is asked in Now).
  const grad = answers.graduationYear && answers.graduationMonth ? month(answers.graduationYear * 12 + answers.graduationMonth - 1) : null;
  const test = TESTS.find((x) => x.value === answers.englishTest);
  const taken = answers.englishTestYear && answers.englishTestMonth ? month(answers.englishTestYear * 12 + answers.englishTestMonth - 1) : null;
  const status = STATUSES.find((s) => s.value === answers.status);
  const english = road.meta[0]?.short
    ?? (answers.englishTest === "none"
      ? t("No English test yet")
      : test && answers.englishScore != null
        ? taken
          ? t("{test} {score}, taken {date}", { test: t(test.short), score: answers.englishScore, date: taken })
          : `${t(test.short)} ${answers.englishScore}`
        : null);
  // The university's own words on how recent a test must be, for the score said in the meta line.
  const rules = [...new Map(road.meta.flatMap((i) => i.rules ?? []).map((r) => [`${r.label}|${r.quote}`, r] as const)).values()];
  const facts = [
    grad && (answers.level === "diploma" ? t("Diploma ends {date}", { date: grad }) : answers.level === "degree" ? t("Degree ends {date}", { date: grad }) : t("Graduating {date}", { date: grad })),
    status && t(status.label),
    english,
  ].filter((x): x is string => !!x);

  const save = async (kind: "pdf" | "ics") => {
    if (kind === "ics") return downloadIcs(plan, today, t);
    const planned = plannedDegree(answers, sources.kaplan);
    const count = t(n === 1 ? "{n} programme" : "{n} programmes", { n });
    const who = [planned && names.degree(planned.name).name, count, t("start {date}", { date: start })].filter(Boolean).join(" · ");
    setBusy(true);
    try {
      await downloadPdf(plan, who, today, t, locale);
    } finally {
      setBusy(false);
    }
  };

  return (
    <TodayContext.Provider value={today}>
      <PlanFrame>
        <PlanHeader start={start} count={n} facts={facts} rules={rules} save={{ onSave: save, busy }} />
        <Road road={road} />
        <RoadLegend />
      </PlanFrame>
    </TodayContext.Provider>
  );
}
