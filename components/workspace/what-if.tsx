"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { budgetChoices, budgetLabel } from "@/components/results/budget";
import { checks } from "@/components/results/compare";
import { useLocalName } from "@/components/results/names";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transitions } from "@/lib/motion";
import type { Classification, PlanAnswers } from "@/lib/plan-storage";
import type { ResultsProgramme, ResultsUniversity } from "@/lib/results-types";
import { AnimatedNumber } from "./animated-number";
import { useModel } from "./model";

// What-if: try a different English score, degree result or budget and see how many more of the
// programmes' published minimums you'd meet, and which ones change. Your saved answers and the list
// never change; it's rule-based, in the browser.

type Item = { p: ResultsProgramme; u: ResultsUniversity };

const CLASSES: { value: Classification; label: string }[] = [
  { value: "first", label: "First" },
  { value: "2:1", label: "2:1" },
  { value: "2:2", label: "2:2" },
  { value: "third", label: "Third" },
];
const TEST_LABEL = { ielts: "IELTS", toefl: "TOEFL iBT", pte: "PTE", duolingo: "Duolingo" } as const;
const STEP = { ielts: 0.5, toefl: 1, pte: 1, duolingo: 5 } as const;
/** A select's value for "not set". */
const NONE = "-";

/** Meets every minimum that can be compared, and within budget when a budget is set. */
const fits = (x: Item, a: PlanAnswers, university: string | null, awardedIn: string | null) =>
  (a.budget === null || x.p.feeSgd === null || x.p.feeSgd <= a.budget) && !checks(x.p, a, university, undefined, awardedIn).some((c) => c.state === "below");

export function WhatIf() {
  const t = useT();
  const local = useLocalName();
  const { answers, asksClass, university, awardedIn, results } = useModel();
  const items = results.whatIf;
  const test = answers.englishTest && answers.englishTest !== "none" ? answers.englishTest : "ielts";
  const own = answers.englishTest === test ? answers.englishScore : null;
  const [score, setScore] = useState<number | null>(own);
  const [cls, setCls] = useState<Classification | null>(answers.classification);
  const [budget, setBudget] = useState<number | null>(answers.budget);
  const what: PlanAnswers = { ...answers, englishTest: test, englishScore: score, classification: cls, budget };
  const changed = score !== own || cls !== answers.classification || budget !== answers.budget;

  const result = useMemo(() => {
    const before = items.filter((x) => fits(x, answers, university, awardedIn));
    const after = items.filter((x) => fits(x, what, university, awardedIn));
    const b = new Set(before.map((x) => x.p.id));
    const a = new Set(after.map((x) => x.p.id));
    const byRank = (x: Item, y: Item) => (x.u.qsValue ?? 9999) - (y.u.qsValue ?? 9999);
    return { before: before.length, after: after.length, gained: after.filter((x) => !b.has(x.p.id)).sort(byRank), lost: before.filter((x) => !a.has(x.p.id)).sort(byRank) };
    // `what` is rebuilt from the three inputs on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, answers, university, score, cls, budget]);

  const reset = () => {
    setScore(own);
    setCls(answers.classification);
    setBudget(answers.budget);
  };
  const delta = result.after - result.before;
  const budgets = budgetChoices(answers.budget);
  const list = (title: string, xs: Item[]) => (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-xs font-medium">{title}</p>
      <ul className="flex flex-col gap-0.5 text-xs">
        {xs.slice(0, 5).map((x) => (
          <li key={x.p.id} className="truncate">
            {local(x.p.name, x.p.zh).name} <span className="text-muted-foreground">{local(x.u.name, x.u.zh).name}</span>
          </li>
        ))}
      </ul>
      {xs.length > 5 && <p className="text-xs text-muted-foreground">{t("and {n} more", { n: xs.length - 5 })}</p>}
    </div>
  );

  return (
    <Collapsible className="rounded-xl border bg-(--rs-raised)">
      <CollapsibleTrigger className="group/whatif flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        <Badge className="bg-amber text-amber-text">
          <SparklesIcon />
          {t("What if")}
        </Badge>
        <span className="min-w-0 flex-1 truncate">{t("Another score, result or budget?")}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/whatif:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 border-t px-3 pt-3 pb-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("{test} overall", { test: TEST_LABEL[test] })}</span>
              <Input className="h-8 w-24" type="number" inputMode="decimal" step={STEP[test]} value={score ?? ""} onChange={(e) => setScore(e.target.value === "" ? null : Number(e.target.value))} />
            </label>
            {asksClass && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground" id="whatif-class">
                  {t("Degree result")}
                </span>
                <Select items={[{ value: NONE, label: t("Not sure") }, ...CLASSES.map((c) => ({ value: c.value, label: t(c.label) }))]} value={cls ?? NONE} onValueChange={(v) => setCls(!v || v === NONE ? null : (v as Classification))}>
                  <SelectTrigger className="w-28" aria-labelledby="whatif-class">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("Not sure")}</SelectItem>
                    {CLASSES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {t(c.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground" id="whatif-budget">
                {t("Tuition budget")}
              </span>
              <Select items={budgets.map((b) => ({ value: b.value === null ? NONE : String(b.value), label: budgetLabel(t, b) }))} value={budget === null ? NONE : String(budget)} onValueChange={(v) => setBudget(!v || v === NONE ? null : Number(v))}>
                <SelectTrigger className="w-44" aria-labelledby="whatif-budget">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {budgets.map((b) => (
                    <SelectItem key={b.short} value={b.value === null ? NONE : String(b.value)}>
                      {budgetLabel(t, b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={reset} disabled={!changed}>
              <RotateCcwIcon />
              {t("Reset")}
            </Button>
          </div>
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm" aria-live="polite">
            {t("Meeting every minimum:")} <AnimatedNumber value={result.before} className="font-heading font-semibold tabular-nums" />
            <AnimatePresence initial={false}>
              {changed && (
                <motion.span key="after" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, transition: transitions.exit }} transition={transitions.enter} className="inline-flex items-baseline gap-1.5">
                  → <AnimatedNumber value={result.after} className="font-heading font-semibold tabular-nums" />
                  <Badge variant={delta > 0 ? "default" : delta < 0 ? "destructive" : "secondary"} className="tabular-nums">
                    {delta > 0 ? `+${delta}` : delta}
                  </Badge>
                </motion.span>
              )}
            </AnimatePresence>
          </p>
          {changed && (result.gained.length > 0 || result.lost.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {result.gained.length > 0 && list(t("Now within reach of the published minimums"), result.gained)}
              {result.lost.length > 0 && list(t("No longer within these choices"), result.lost)}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
