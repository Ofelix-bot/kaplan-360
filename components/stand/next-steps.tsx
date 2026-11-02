"use client";

import { useMemo } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Button } from "@/components/ui/button";
import { msg } from "@/lib/i18n/translate";
import { monthYear } from "@/lib/i18n/format";
import { goalWords } from "@/lib/plan-timeline";
import type { PlanAnswers, PlanGoal } from "@/lib/plan-storage";
import { missingItems, type Lever } from "@/lib/stand/aggregate";
import { say, type GateKey } from "@/lib/stand/types";
import { FOCUS, n, OUTCOME_LABEL } from "./bands";
import { useStand } from "./model";

// Next steps: the three levers that move the most programmes up a band or open them (lib/stand/aggregate.ts
// levers), each with its exact counts, and one tap to add it to /plan as the student's own goal, dated by
// a stated rule: an English score, an internship or research 12 months before the start (when
// applications open, Kaplan 360++'s rule), a grade by graduation, years of work by the start. Work that
// does not fit between graduation (or today) and the start becomes "start one year later". When most
// programmes read Missing, the answers they wait for come first, by how many programmes each holds back.

const SHOWN = 3;
/** Above this share of the scope reading Missing, the missing answers come first. */
const MOSTLY_MISSING = 0.5;
const iso = (m: number) => `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}-01`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** This month, as year × 12 + month index. */
const thisMonth = () => {
  const d = new Date();
  return d.getFullYear() * 12 + d.getMonth();
};

type Room = { from: number; months: number; need: number };
/**
 * The work lever's years against the time before the start: the months from graduation (or from now, if
 * later) to the start, against 12 for each year still to work. Null when they fit.
 */
function workRoom(l: Lever, a: PlanAnswers, start: { month: number }): Room | null {
  const target = typeof l.label.vars?.n === "number" ? l.label.vars.n : (a.workYears ?? 0) + 1;
  const need = 12 * (target - (a.workYears ?? 0));
  const grad = a.graduationYear && a.graduationMonth ? a.graduationYear * 12 + a.graduationMonth - 1 : null;
  const from = Math.max(grad ?? 0, thisMonth());
  const months = start.month - from;
  return months < need ? { from, months: Math.max(0, months), need } : null;
}

/** The goal a lever becomes. */
function goalOf(l: Lever, a: PlanAnswers, start: { year: number; month: number }): PlanGoal {
  const vars = l.label.vars ?? {};
  const to = typeof vars.to === "number" ? vars.to : null;
  const before = { by: iso(start.month - 12), rule: "before-start" as const };
  const grad = a.graduationYear && a.graduationMonth ? a.graduationYear * 12 + a.graduationMonth - 1 : null;
  const base = { id: "", start: start.month, up: l.up + l.eligible };
  if (l.key === "grade") {
    // The figure on the student's own scale: a GPA, a WAM, an average mark or the next class.
    const goal = l.target ? { target: l.target.value, unit: l.target.unit, scale: l.target.scale } : { target: to, unit: "uk" as const };
    const when = grad !== null && iso(grad) > today() ? { by: iso(grad), rule: "graduation" as const } : before;
    return { ...base, lever: "grade", ...goal, ...when };
  }
  if (l.key === "ielts") return { ...base, lever: "ielts", target: to, ...before };
  if (l.key === "work") return { ...base, lever: "work", target: typeof vars.n === "number" ? vars.n : (a.workYears ?? 0) + 1, by: iso(start.month), rule: "start" };
  if (l.key === "later") return { ...base, lever: "later", target: start.year + 1, by: iso(start.month + 12), rule: "start", start: start.month + 12 };
  return { ...base, lever: l.key, target: null, ...before };
}

function LeverCard({ l, rank, room }: { l: Lever; rank: number; room?: Room }) {
  const t = useT();
  const locale = useIntlLocale();
  const { answers, update, start } = useStand();
  const goal = goalOf(l, answers, start);
  const added = answers.goals.find((g) => g.lever === l.key);
  const words = goalWords(added ?? goal, today(), t, locale);
  const total = l.up + l.eligible;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-(--land-line) bg-(--land-card) p-4 sm:p-5">
      <div className="flex items-baseline gap-3">
        <span aria-hidden className="font-heading text-sm font-bold text-muted-foreground tabular-nums">
          {rank}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-heading text-lg leading-snug font-bold text-pretty">{say(t, l.label)}</h3>
          <p className="text-sm text-(--land-body)">
            {l.up > 0 && (l.up === 1 ? t("1 programme moves up a band") : t("{n} programmes move up a band", { n: n(l.up) }))}
            {l.up > 0 && l.eligible > 0 && " · "}
            {l.eligible > 0 && (l.eligible === 1 ? t("1 programme opens to you") : t("{n} programmes open to you", { n: n(l.eligible) }))}
          </p>
          <ul className="flex flex-col text-xs text-muted-foreground tabular-nums">
            {l.moves.slice(0, 3).map((mv) => (
              <li key={`${mv.from}>${mv.to}`}>{t("{from} → {to}: {n}", { from: t(OUTCOME_LABEL[mv.from]), to: t(OUTCOME_LABEL[mv.to]), n: n(mv.n) })}</li>
            ))}
          </ul>
          {room && (
            <p className="text-xs text-pretty text-muted-foreground">
              {t("Your start in {start} is {months} months after {from}, short of the {need} months of full-time work, so this step moves your start a year later.", {
                start: monthYear(locale, start.month),
                months: room.months,
                from: monthYear(locale, room.from),
                need: room.need,
              })}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 border-t border-(--land-line) pt-3">
        <p className="text-sm font-medium">{words.head}</p>
        {words.rule && <p className="text-xs text-pretty text-muted-foreground">{words.rule}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {added ? (
            <>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                <CheckIcon aria-hidden className="size-4" />
                {t("In your plan")}
              </span>
              <Link href="/plan" className={cn("text-sm font-medium text-(--brand-ink) underline-offset-4 hover:underline", FOCUS, "rounded-sm")}>
                {t("Open my plan")}
              </Link>
              <Button variant="ghost" size="sm" onClick={() => update({ goals: answers.goals.filter((g) => g !== added) })}>
                {t("Remove")}
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={total === 0} onClick={() => update({ goals: [...answers.goals.filter((g) => g.lever !== l.key), { ...goal, id: Date.now().toString(36) }] })}>
              <PlusIcon />
              {t("Add to my plan")}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/** Each missing answer as the step that gives it. */
const MISSING_STEP: Record<GateKey, string> = {
  "degree-type": msg("Give your degree type"),
  grade: msg("Give your expected grade"),
  english: msg("Give an English test score"),
  tests: msg("Give a GRE or GMAT score"),
  work: msg("Give your years of full-time work"),
  subject: msg("Give your degree’s field"),
};

/** The answers programmes wait for, each with the number of programmes it holds back. */
function MissingFirst() {
  const t = useT();
  const { profile, data, scope } = useStand();
  const items = useMemo(() => missingItems(profile, data, scope), [profile, data, scope]);
  if (!items.length) return null;
  return (
    <ol className="flex flex-col gap-2">
      {items.map((it) => (
        <li key={it.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-2xl border border-(--land-line) bg-(--land-card) px-4 py-3">
          <a href="#stand-title" className={cn("font-heading text-base font-bold text-(--brand-ink) underline-offset-4 hover:underline", FOCUS, "rounded-sm")}>
            {t(it.key === "grade" && profile.grade ? msg("Give your average mark") : MISSING_STEP[it.key])}
          </a>
          <span className="text-sm text-(--land-body) tabular-nums">{it.n === 1 ? t("1 programme needs it") : t("{n} programmes need it", { n: n(it.n) })}</span>
        </li>
      ))}
    </ol>
  );
}

export function NextSteps() {
  const t = useT();
  const { levers, stale, answers, start, dist } = useStand();
  const useful = levers.filter((l) => l.applicable && !l.sameAs && l.up + l.eligible > 0);
  const top = useful.slice(0, SHOWN);
  const later = levers.find((l) => l.sameAs === "work" && l.applicable) ?? null;
  const mostlyMissing = dist.total > 0 && dist.counts.missing > dist.total * MOSTLY_MISSING;
  return (
    <section aria-labelledby="next" aria-busy={stale} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 id="next" className="font-heading text-2xl font-bold tracking-[-0.01em] sm:text-3xl">
          {t("Next steps")}
        </h2>
      </div>
      {(mostlyMissing || !top.length) && <MissingFirst />}
      {top.length > 0 && (
        <ol className={cn("grid gap-3 lg:grid-cols-3", stale && "opacity-70")}>
          {top.map((l, i) => {
            // Work that does not fit before the start: the later start, which moves the same programmes.
            const room = l.key === "work" && later ? workRoom(l, answers, start) : null;
            return room ? <LeverCard key={l.key} l={later!} rank={i + 1} room={room} /> : <LeverCard key={l.key} l={l} rank={i + 1} />;
          })}
        </ol>
      )}
      {!top.length && !dist.counts.missing && <p className="text-sm text-muted-foreground">{t("None of the six changes moves a programme up a band for these answers.")}</p>}
      {answers.goals.length > 0 && !answers.shortlist.length && (
        <p className="text-sm text-(--land-body)">
          {t.rich("Your plan shows your goals once you star a programme on <a>Programmes for you</a>.", {
            a: (c) => (
              <Link href="/results" className={cn("font-medium text-(--brand-ink) underline underline-offset-4", FOCUS, "rounded-sm")}>
                {c}
              </Link>
            ),
          })}
        </p>
      )}
    </section>
  );
}
