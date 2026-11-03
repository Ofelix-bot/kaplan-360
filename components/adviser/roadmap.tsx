"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, BookmarkPlusIcon, CheckIcon, HandIcon, RotateCcwIcon, Undo2Icon } from "lucide-react";
import Link from "@/components/i18n/Link";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/workspace/spinner";
import type { Final } from "@/lib/agent/types";
import type { PlanId, PlansResult, ReviewResult } from "@/lib/adviser/types";
import { monthYear } from "@/lib/i18n/format";
import type { SavedRoadmap, SkillGap } from "@/lib/plan-storage";
import { useResultsData } from "@/lib/workspace/data";
import { usePlanStore } from "@/lib/workspace/plan-store";
import { cn } from "cn";
import { Feed } from "./feed";
import { KappyRead } from "./kappy-read";
import { KappyStage } from "./kappy-stage";
import { PlanCards } from "./plan-cards";
import type { ErrorCode } from "./transport";
import type { FeedItem, Mode, Phase } from "./use-adviser";

// Step 4 of AI adviser v2, "Your roadmap" (docs/agent/roadmap.md): once the audit has passed, the planner drafts three
// plans the student chooses between (nothing is chosen for them), Kappy reads the three and marks what it thinks matters,
// and "Save plan X to my plan" puts the chosen plan's dated steps, programmes and the skill gaps into the plan, with a
// 10 s undo. The page says throughout that a large language model is drafting, reading and highlighting, and shows its
// reasoning summary as it goes. If the planner fails, the judge's own dated steps stand in, with a retry.

/** The skill-gap id /careers uses (components/careers/RoleGapPanel.tsx), so a gap saved twice stays one row. */
const gapId = (roleId: string, skill: string) => `${roleId}-${skill.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** "2026-11" as a month index, or null. */
function monthIndex(when: string): number | null {
  const m = /^(\d{4})-(\d{1,2})/.exec(when);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
}

function useProgrammeName() {
  const byId = useResultsData((s) => s.byId);
  return (id: string) => byId?.get(id)?.name ?? id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Before = { shortlist: string[]; skillGaps: SkillGap[]; roadmap: SavedRoadmap | null };

type Props = {
  final: Final;
  phase: Phase;
  mode: Mode;
  plans: PlansResult | null;
  plansFeed: FeedItem[];
  plansError: ErrorCode | null;
  plansDemo: boolean;
  review: ReviewResult | null;
  reviewFeed: FeedItem[];
  reviewError: ErrorCode | null;
  onRetry: (which: "plans" | "review") => void;
};

export function Roadmap({ final, phase, mode, plans, plansFeed, plansError, plansDemo, review, reviewFeed, reviewError, onRetry }: Props) {
  const t = useT();
  const locale = useIntlLocale();
  const name = useProgrammeName();
  const [chosen, setChosen] = useState<PlanId | null>(null);
  const [saved, setSaved] = useState<Before | null>(null);
  const [undone, setUndone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // Programme names for the picks: the finder's data, loaded only when a plan names one.
  const wantsNames = !!plans?.plans.some((p) => p.picks.length) || !!final.picks.length;
  useEffect(() => {
    if (wantsNames) useResultsData.getState().load();
  }, [wantsNames]);
  // New plans: the choice starts over (state adjusted during render, not in an effect).
  const [seen, setSeen] = useState(plans);
  if (seen !== plans) {
    setSeen(plans);
    setChosen(null);
    setSaved(null);
    setUndone(false);
  }

  const planning = phase === "planning";
  const reviewing = phase === "reviewing";
  const plan = plans?.plans.find((p) => p.id === chosen) ?? null;
  const label = (when: string) => {
    const i = monthIndex(when);
    return i === null ? when : monthYear(locale, i);
  };

  const save = () => {
    if (!plan) return;
    const a = usePlanStore.getState().answers;
    const before: Before = { shortlist: a.shortlist, skillGaps: a.skillGaps, roadmap: a.roadmap };
    const gaps: SkillGap[] = final.gaps.map((g) => ({
      id: gapId(g.roleId, g.skill),
      roleId: g.roleId,
      role: g.role,
      skill: g.skill,
      level: g.level ?? 0,
      via: g.fix === "degree" ? "kaplan" : "outside",
      module: null,
      own: g.fix === "degree",
    }));
    // The plan's own programmes; a study plan that names none takes the judge's picks.
    const picks = plan.picks.length ? plan.picks : plan.road === "work" ? [] : final.picks.map((p) => p.programmeId);
    usePlanStore.getState().update({
      shortlist: [...new Set([...a.shortlist, ...picks])],
      skillGaps: [...a.skillGaps.filter((x) => !gaps.some((g) => g.id === x.id)), ...gaps],
      roadmap: { plan: plan.id, title: plan.title, steps: plan.steps, savedAt: new Date().toISOString().slice(0, 10) },
    });
    setSaved(before);
    setUndone(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(null), 10_000);
  };

  const undo = () => {
    if (!saved) return;
    usePlanStore.getState().update(saved);
    setSaved(null);
    setUndone(true);
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <div className="space-y-5" data-kappy-stage>
      {/* The stage: Kappy and its line, "you decide" and what is doing the drafting. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <KappyStage phase={phase} plans={plans} review={review} plansError={plansError} reviewError={reviewError} tools={plansFeed} chosen={chosen} saved={!!saved} />
        <div className="flex max-w-md flex-col items-start gap-1.5 sm:items-end sm:text-right">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-amber-500 bg-amber-500/10 px-3 py-1 text-xs font-bold tracking-wide text-amber-900 uppercase dark:text-amber-200">
            <HandIcon className="size-3.5" aria-hidden />
            {t("Human must decide")}
          </span>
          <p className="text-xs leading-snug text-muted-foreground">
            {mode === "mock" || plansDemo
              ? t("Three plans from demo data, and a demo reading: no model is called for this step here.")
              : t("A large language model drafts three plans from the decision above, each with a different bet. Kappy, the same model, reads them and highlights what it thinks matters. Neither picks for you: a plan is saved only when you choose it.")}
          </p>
        </div>
      </div>

      {/* The planner at work: its reasoning summary and lookups, live. */}
      {planning && (
        <div className="rounded-lg border border-dashed bg-muted/40 p-3" role="status">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Spinner className="size-3.5" />
            {t("The model is drafting three plans: its reasoning summary and lookups, as they happen")}
          </p>
          {plansFeed.length ? <Feed items={plansFeed} /> : <p className="text-xs text-muted-foreground italic">{t("Waiting for the first words…")}</p>}
        </div>
      )}

      {plans && <PlanCards plans={plans} review={review} chosen={chosen} onChoose={setChosen} programmeName={name} disabled={!!saved} />}

      {/* The planner failed: the judge's own steps stand in, with a retry. */}
      {!plans && plansError && !planning && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
            <span className="text-destructive">{t("The three plans didn’t come through this time.")}</span>
            {mode !== "replay" && (
              <Button size="sm" variant="outline" onClick={() => onRetry("plans")}>
                <RotateCcwIcon aria-hidden />
                {t("Draft the three plans again")}
              </Button>
            )}
          </div>
          {!!final.roadmap.length && (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">{t("Meanwhile, the judge’s dated steps")}</p>
              <ol className="space-y-2">
                {[...final.roadmap].sort((a, b) => a.when.localeCompare(b.when)).map((s, i) => (
                  <li key={i} className={cn("flex items-baseline gap-3 text-sm", s.lane === "education" ? "text-primary" : "text-amber-700 dark:text-amber-400")}>
                    <span className="inline-block size-2.5 shrink-0 rounded-full bg-current" aria-hidden />
                    <span className="w-20 shrink-0 text-xs font-semibold tabular-nums">{label(s.when)}</span>
                    <span className="sr-only">{s.lane === "education" ? t("Education") : t("Career")}: </span>
                    <span className="min-w-0 text-foreground">{s.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {plans && (review || reviewing || reviewError) && <KappyRead review={review} reviewing={reviewing} feed={reviewFeed} error={reviewError} onRetry={() => onRetry("review")} demo={mode === "mock" || plansDemo} />}

      <p className="flex gap-3 text-[11px]">
        <span className="flex items-center gap-1 text-primary">
          <span className="inline-block size-2 rounded-full bg-current" aria-hidden /> {t("Education")}
        </span>
        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <span className="inline-block size-2 rounded-full bg-current" aria-hidden /> {t("Career")}
        </span>
      </p>

      {!!final.gaps.length && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">{t("Skill gaps, whichever plan you choose")}</p>
          <ul className="space-y-1 text-sm">
            {final.gaps.map((g, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{g.skill}</span>
                <span className={cn("rounded px-1.5 text-[11px]", g.fix === "degree" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-700 dark:text-amber-400")}>
                  {g.fix === "degree" ? t("At Kaplan") : t("Outside")}
                </span>
                <span className="text-muted-foreground">{g.how}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plans && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={!plan || !!saved}>
            {saved ? <CheckIcon aria-hidden /> : <BookmarkPlusIcon aria-hidden />}
            {saved ? t("Saved") : plan ? t("Save plan {id} to my plan", { id: plan.id }) : t("Choose a plan first")}
          </Button>
          {!plan && !saved && <span className="text-xs text-muted-foreground">{t("Nothing is saved until you choose.")}</span>}
          {(saved || undone) && (
            <Link href="/plan" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline">
              {t("Open your plan")} <ArrowRightIcon className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      )}

      {saved && plan && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg" role="status">
          <CheckIcon className="size-4 shrink-0 text-primary" strokeWidth={3} aria-hidden />
          <span className="flex-1">{t("Saved plan {id} to your plan: {n} dated steps and {g} skill gaps.", { id: plan.id, n: plan.steps.length, g: final.gaps.length })}</span>
          <Button size="sm" variant="ghost" onClick={undo}>
            <Undo2Icon aria-hidden />
            {t("Undo")}
          </Button>
        </div>
      )}
    </div>
  );
}
