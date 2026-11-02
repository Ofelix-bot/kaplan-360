"use client";

import { useDeferredValue, useId, useMemo, useState, type ReactNode } from "react";
import { cn } from "cn";
import { RotateCcwIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TESTS } from "@/lib/english-tests";
import type { Classification, PlanAnswers } from "@/lib/plan-storage";
import { distribution } from "@/lib/stand/aggregate";
import { standProfile } from "@/lib/stand/profile";
import { ieltsEquivalent } from "@/lib/stand/rules";
import { OUTCOMES } from "@/lib/stand/types";
import { n, OUTCOME_LABEL, OUTCOME_TEXT } from "./bands";
import { FieldLabel, Stepper } from "./fields";
import { CLASSES, gradeKind } from "./grade";
import { useStand } from "./model";

// What if: the grade, English score, work, internships, research and start year changed. Every
// programme in scope is scored again on each change (about 10 ms); nothing is saved until "Use these
// as my answers". A start later than the saved one counts each extra year as a year of full-time work
// (Kaplan 360++'s rule: the index has no other time factor).

type Patch = Partial<Pick<PlanAnswers, "classification" | "averageMark" | "degreeGpa" | "englishTest" | "englishScore" | "workYears" | "internshipsSame" | "internshipsOther" | "research" | "startYear">>;

/** A slider's one value. */
const one = (x: number | readonly number[]) => (typeof x === "number" ? x : x[0]);
/** The class an average mark falls in on the UK scale. */
const classOf = (m: number): Exclude<Classification, "unsure"> => (m >= 70 ? "first" : m >= 60 ? "2:1" : m >= 50 ? "2:2" : "third");

function Control({ label, value, children }: { label: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-(--land-body)">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

export function Simulator() {
  const t = useT();
  const { answers, update, data, scope, dist, degree, degreeFor, start } = useStand();
  const [patch, setPatch] = useState<Patch>({});
  const deferred = useDeferredValue(patch);
  const set = (p: Patch) => setPatch((x) => ({ ...x, ...p }));
  const v = { ...answers, ...patch };
  const grade = gradeKind(degree);
  const savedStart = start.year;
  const simStart = patch.startYear ?? savedStart;

  /** The answers as they would be saved: the extra years of a later start become years of work. */
  const effective = (p: Patch): Partial<PlanAnswers> => {
    const s = p.startYear ?? savedStart;
    const extra = Math.max(0, s - savedStart);
    const work = p.workYears !== undefined ? p.workYears : answers.workYears;
    const years = extra ? (work ?? 0) + extra : p.workYears;
    // /results' work filter reads workExperience: it follows the years, as on the inputs.
    return { ...p, ...(years !== undefined && years !== null ? { workYears: years, workExperience: years > 0 ? "have" : "none" } : {}) };
  };
  const sim = useMemo(() => {
    const a = { ...answers, ...effective(deferred) };
    return distribution(standProfile(a, degreeFor(a)), data, scope);
    // `effective` reads only the values listed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, deferred, data, scope, degreeFor, savedStart]);
  const changed = Object.keys(patch).some((k) => patch[k as keyof Patch] !== answers[k as keyof Patch]);
  const ids = { grade: useId(), english: useId() };

  const test = v.englishTest === "toefl" || v.englishTest === "pte" ? v.englishTest : "ielts";
  const scale = TESTS.find((x) => x.value === test)!;
  const score = v.englishTest === test ? v.englishScore : null;
  const equivalent = test !== "ielts" && score !== null ? ieltsEquivalent(test, score) : null;
  const years = Array.from({ length: 4 }, (_, i) => savedStart + i);

  return (
    <section aria-labelledby="simulator" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 id="simulator" className="font-heading text-2xl font-bold tracking-[-0.01em] sm:text-3xl">
          {t("What if")}
        </h2>
      </div>

      <div className="grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid content-start gap-x-6 gap-y-5 sm:grid-cols-2">
          {grade?.kind === "wam" && (
            <Control label={t("Expected WAM")} value={v.averageMark !== null ? `${v.averageMark}%` : "–"}>
              <Slider min={50} max={100} step={1} value={[v.averageMark ?? 65]} onValueChange={(x) => set({ averageMark: one(x), classification: null })} thumbLabels={[t("Expected WAM")]} />
            </Control>
          )}
          {grade?.kind === "gpa" && (
            <Control label={t("Expected GPA")} value={v.degreeGpa !== null ? `${v.degreeGpa} / ${grade.scale}` : "–"}>
              <Slider min={2} max={grade.scale} step={0.05} value={[v.degreeGpa ?? 3]} onValueChange={(x) => set({ degreeGpa: Math.round(one(x) * 100) / 100 })} thumbLabels={[t("Expected GPA")]} />
            </Control>
          )}
          {grade?.kind === "class" &&
            (v.averageMark !== null ? (
              <Control label={t("Average mark")} value={`${v.averageMark}%`}>
                <Slider
                  min={40}
                  max={85}
                  step={1}
                  value={[v.averageMark]}
                  onValueChange={(x) => {
                    const m = one(x);
                    set({ averageMark: m, classification: classOf(m) });
                  }}
                  thumbLabels={[t("Average mark")]}
                />
              </Control>
            ) : (
              <div className="flex flex-col gap-2">
                <FieldLabel id={ids.grade}>{t("Expected class")}</FieldLabel>
                <ToggleGroup
                  aria-labelledby={ids.grade}
                  variant="outline"
                  size="sm"
                  spacing={1}
                  className="w-full"
                  value={v.classification && v.classification !== "unsure" ? [v.classification] : []}
                  onValueChange={(x) => x[0] && set({ classification: x[0] as Classification })}
                >
                  {CLASSES.map((c) => (
                    <ToggleGroupItem key={c.value} value={c.value} className="flex-1">
                      {t(c.label)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ))}
          {!grade && <p className="text-sm text-muted-foreground">{t("Choose your degree above to try another grade.")}</p>}

          <Control
            label={test === "ielts" ? t("IELTS") : t(scale.short)}
            value={score === null ? t("Not taken") : equivalent !== null ? t("{score} (IELTS {ielts})", { score, ielts: equivalent }) : score}
          >
            <Slider
              min={scale.min!}
              max={scale.max!}
              step={scale.step!}
              value={[score ?? scale.start!]}
              onValueChange={(x) => set({ englishTest: test, englishScore: one(x) })}
              thumbLabels={[test === "ielts" ? t("IELTS") : t(scale.short)]}
            />
          </Control>

          <Stepper label={t("Work (years)")} value={patch.workYears !== undefined ? patch.workYears : answers.workYears} max={15} onChange={(x) => set({ workYears: x })} />
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:col-span-2">
            <Stepper label={t("Field internships")} value={v.internshipsSame} max={9} onChange={(x) => set({ internshipsSame: x })} />
            <Stepper label={t("Other internships")} value={v.internshipsOther} max={9} onChange={(x) => set({ internshipsOther: x })} />
          </div>
          <Stepper label={t("Research")} value={v.research} max={9} onChange={(x) => set({ research: x })} />
          <div className="flex flex-col gap-2">
            <FieldLabel id={ids.english}>{t("Start year")}</FieldLabel>
            <ToggleGroup aria-labelledby={ids.english} variant="outline" size="sm" spacing={1} className="w-full" value={[String(simStart)]} onValueChange={(x) => x[0] && set({ startYear: Number(x[0]) })}>
              {years.map((y) => (
                <ToggleGroupItem key={y} value={String(y)} className="flex-1 tabular-nums">
                  {y}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="flex flex-col gap-3 self-start rounded-2xl border border-(--land-line) bg-(--land-card) p-4">
          <table className="w-full text-sm tabular-nums">
            <caption className="pb-2 text-left text-xs text-muted-foreground">{t("Programmes per band, with these changes")}</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 text-left font-medium">
                  {t("Band")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("Saved")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("With these")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("Change")}
                </th>
              </tr>
            </thead>
            <tbody aria-live="polite">
              {OUTCOMES.map((o) => {
                const d = sim.counts[o] - dist.counts[o];
                return (
                  <tr key={o} className="border-t border-(--land-line)">
                    <th scope="row" className={cn("py-1.5 text-left font-semibold", OUTCOME_TEXT[o])}>
                      {t(OUTCOME_LABEL[o])}
                    </th>
                    <td className="py-1.5 text-right">{n(dist.counts[o])}</td>
                    <td className="py-1.5 text-right font-semibold">{n(sim.counts[o])}</td>
                    <td className={cn("py-1.5 text-right", d === 0 ? "text-muted-foreground" : "font-semibold")}>{d === 0 ? "0" : d > 0 ? `+${n(d)}` : `−${n(-d)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!changed}
              onClick={() => {
                update(effective(patch));
                setPatch({});
              }}
            >
              {t("Use these as my answers")}
            </Button>
            <Button variant="ghost" disabled={!Object.keys(patch).length} onClick={() => setPatch({})}>
              <RotateCcwIcon />
              {t("Back to my answers")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
