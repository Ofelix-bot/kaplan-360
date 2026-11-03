"use client";

import { ArrowLeftRightIcon, BriefcaseIcon, CheckIcon, GraduationCapIcon, PointerIcon, ShieldCheckIcon } from "lucide-react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Button } from "@/components/ui/button";
import type { Plan, PlanId, PlansResult, ReviewResult } from "@/lib/adviser/types";
import { monthYear } from "@/lib/i18n/format";
import { msg } from "@/lib/i18n/translate";
import { cn } from "cn";
import s from "./adviser.module.css";

// The three plans of Step 4, side by side, as a radio group with nothing chosen until the student chooses: each card
// is one plan's title, the bet it makes, its dated steps (education and career in two colours), what it gives up, the
// condition it depends on, its programmes and roles, Kappy's one-line take once the reading is in, and its button. The
// chosen card stands out in Kappy's way: an ink outline and a hard amber shadow.

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
    <div className={s.cards} role="radiogroup" aria-label={t("Choose one of the three plans")}>
      {plans.plans.map((p) => {
        const road = ROAD[p.road];
        const RoadIcon = road.icon;
        const mine = chosen === p.id;
        const take = review?.takes.find((x) => x.plan === p.id)?.line;
        return (
          <article
            key={p.id}
            className={s.card}
            data-on={mine ? "" : undefined}
            data-dim={chosen && !mine ? "" : undefined}
            aria-labelledby={`plan-${p.id}-title`}
          >
            <div className={s.cardH}>
              <span className={s.planId} aria-hidden>
                {p.id}
              </span>
              <div className="min-w-0 flex-1">
                <p className={s.cardKind}>
                  <RoadIcon className="size-3.5" aria-hidden />
                  {t(road.label)}
                  {plans.follows === p.id && (
                    <span className={s.follows}>
                      <ShieldCheckIcon className="size-3" aria-hidden />
                      {t("Follows the judge’s decision")}
                    </span>
                  )}
                </p>
                <h3 id={`plan-${p.id}-title`}>
                  {t("Plan {id}", { id: p.id })}: {p.title}
                </h3>
              </div>
            </div>

            <p className={s.bet}>
              <b>{t("The bet")}</b>
              {p.bet}
            </p>

            <ol className={s.road}>
              {p.steps.map((step, i) => (
                <li key={i}>
                  <time className={step.lane === "education" ? s.edu : s.car}>{label(step.when)}</time>
                  <span className="min-w-0">
                    <span className="sr-only">{step.lane === "education" ? t("Education") : t("Career")}: </span>
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>

            <dl className={s.terms}>
              {p.givesUp && (
                <div>
                  <dt className={s.label}>{t("You give up")}</dt>
                  <dd className="min-w-0">{p.givesUp}</dd>
                </div>
              )}
              {p.worksIf && (
                <div>
                  <dt className={s.label}>{t("Works if")}</dt>
                  <dd className="min-w-0">{p.worksIf}</dd>
                </div>
              )}
            </dl>

            {(!!p.picks.length || !!p.roles.length) && (
              <ul className={s.links}>
                {p.picks.map((id) => (
                  <li key={id}>
                    <Link href={`/results?programme=${encodeURIComponent(id)}`} className={s.edu}>
                      <GraduationCapIcon className="size-3" aria-hidden />
                      {programmeName(id)}
                    </Link>
                  </li>
                ))}
                {p.roles.map((id) => (
                  <li key={id}>
                    <Link href={`/careers/roles/${encodeURIComponent(id)}`} className={s.car}>
                      <BriefcaseIcon className="size-3" aria-hidden />
                      {roleName(id)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {take && (
              <p className={s.take}>
                <span className="font-semibold">{t("Kappy’s take")}: </span>
                {take}
              </p>
            )}

            <div className="mt-auto pt-1">
              <Button
                role="radio"
                aria-checked={mine}
                variant={mine ? "default" : "outline"}
                className={cn("w-full", mine && s.primary)}
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
