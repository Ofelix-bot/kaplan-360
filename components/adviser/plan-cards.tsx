"use client";

import { ArrowLeftRightIcon, BriefcaseIcon, CheckIcon, GraduationCapIcon, PointerIcon, ShieldCheckIcon } from "lucide-react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Button } from "@/components/ui/button";
import type { Plan, PlanId, PlansResult, ReviewResult } from "@/lib/adviser/types";
import { monthYear } from "@/lib/i18n/format";
import { msg } from "@/lib/i18n/translate";
import { cn } from "cn";

// The three plans of Step 4, side by side, as a radio group with nothing chosen until the student chooses: each card
// is one plan's title, the bet it makes, its dated steps (education and career in two colours), what it gives up, the
// condition it depends on, its programmes and roles, Kappy's one-line take once the reading is in, and its button.

const ROAD: Record<Plan["road"], { icon: typeof GraduationCapIcon; label: string }> = {
  study: { icon: GraduationCapIcon, label: msg("Master’s first") },
  work: { icon: BriefcaseIcon, label: msg("Work first") },
  both: { icon: ArrowLeftRightIcon, label: msg("Work first, then a master’s") },
};

/** "2026-11" as a month index, or null. */
function monthIndex(when: string): number | null {
  const m = /^(\d{4})-(\d{1,2})/.exec(when);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
}

const roleName = (id: string) => id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

type Props = {
  plans: PlansResult;
  review: ReviewResult | null;
  chosen: PlanId | null;
  onChoose: (id: PlanId) => void;
  programmeName: (id: string) => string;
  disabled?: boolean;
};

export function PlanCards({ plans, review, chosen, onChoose, programmeName, disabled }: Props) {
  const t = useT();
  const locale = useIntlLocale();
  const label = (when: string) => {
    const i = monthIndex(when);
    return i === null ? when : monthYear(locale, i);
  };
  return (
    <div className="grid gap-3 lg:grid-cols-3" role="radiogroup" aria-label={t("Choose one of the three plans")}>
      {plans.plans.map((p) => {
        const road = ROAD[p.road];
        const RoadIcon = road.icon;
        const mine = chosen === p.id;
        const take = review?.takes.find((x) => x.plan === p.id)?.line;
        return (
          <article
            key={p.id}
            className={cn("flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow", mine ? "border-primary ring-2 ring-primary" : chosen ? "opacity-80" : "")}
            aria-labelledby={`plan-${p.id}-title`}
          >
            <div className="flex items-start gap-2.5">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-base font-bold", mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")} aria-hidden>
                {p.id}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <RoadIcon className="size-3.5" aria-hidden />
                  {t(road.label)}
                  {plans.follows === p.id && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 normal-case tracking-normal text-primary">
                      <ShieldCheckIcon className="size-3" aria-hidden />
                      {t("Follows the judge’s decision")}
                    </span>
                  )}
                </p>
                <h3 id={`plan-${p.id}-title`} className="text-base leading-snug font-semibold">
                  {t("Plan {id}", { id: p.id })}: {p.title}
                </h3>
              </div>
            </div>

            <p className="text-sm leading-snug">
              <span className="mr-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 uppercase dark:text-amber-300">{t("The bet")}</span>
              {p.bet}
            </p>

            <ol className="space-y-1.5 border-l-2 border-muted pl-3">
              {p.steps.map((s, i) => (
                <li key={i} className={cn("relative flex items-baseline gap-2 text-sm", s.lane === "education" ? "text-primary" : "text-amber-700 dark:text-amber-400")}>
                  <span className="absolute -left-[0.95rem] top-1.5 size-2.5 rounded-full border-2 border-card bg-current" aria-hidden />
                  <span className="w-20 shrink-0 text-xs font-semibold tabular-nums">{label(s.when)}</span>
                  <span className="sr-only">{s.lane === "education" ? t("Education") : t("Career")}: </span>
                  <span className="min-w-0 leading-snug text-foreground">{s.text}</span>
                </li>
              ))}
            </ol>

            <dl className="space-y-1 text-sm">
              {p.givesUp && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-xs font-semibold text-muted-foreground">{t("You give up")}</dt>
                  <dd className="min-w-0 leading-snug">{p.givesUp}</dd>
                </div>
              )}
              {p.worksIf && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-xs font-semibold text-muted-foreground">{t("Works if")}</dt>
                  <dd className="min-w-0 leading-snug">{p.worksIf}</dd>
                </div>
              )}
            </dl>

            {(!!p.picks.length || !!p.roles.length) && (
              <ul className="flex flex-wrap gap-1.5 text-xs">
                {p.picks.map((id) => (
                  <li key={id}>
                    <Link href={`/results?programme=${encodeURIComponent(id)}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-primary hover:bg-muted">
                      <GraduationCapIcon className="size-3" aria-hidden />
                      {programmeName(id)}
                    </Link>
                  </li>
                ))}
                {p.roles.map((id) => (
                  <li key={id}>
                    <Link href={`/careers/roles/${encodeURIComponent(id)}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-amber-800 hover:bg-muted dark:text-amber-300">
                      <BriefcaseIcon className="size-3" aria-hidden />
                      {roleName(id)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {take && (
              <p className="rounded-md border-l-2 border-amber-500 bg-amber-500/10 px-2.5 py-1.5 text-sm leading-snug">
                <span className="font-semibold">{t("Kappy’s take")}: </span>
                {take}
              </p>
            )}

            <div className="mt-auto pt-1">
              <Button
                role="radio"
                aria-checked={mine}
                variant={mine ? "default" : "outline"}
                className="w-full"
                disabled={disabled}
                onClick={() => onChoose(p.id)}
              >
                {mine ? <CheckIcon aria-hidden /> : <PointerIcon aria-hidden />}
                {mine ? t("Your choice: plan {id}", { id: p.id }) : t("Choose plan {id}", { id: p.id })}
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
