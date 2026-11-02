"use client";

import { useMemo } from "react";
import { CalendarDaysIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { useHomeAnswers } from "@/lib/home/answers";
import { EP_FROM, EXAMPLE_INTAKE_MONTHS, VISIT_DAYS } from "@/lib/home/content";
import { monthYear } from "@/lib/i18n/format";
import { toast } from "@/components/ui/toast";
import { Count } from "./count";
import { ReceiptChip } from "../receipts";
import { SectionHead } from "./section-head";
import { MonthPicker } from "./month-picker";
import { Segmented } from "./segmented";
import { TiltCard } from "./tilt-card";

// 01 Your clock: on a Student's Pass, the days until the pass and the visit pass after it run out,
// on a timeline from today with the new Employment Pass minimum and a university's intakes; for a
// Singaporean or PR, the days until the course ends and the next intake. The student picks the
// month their course ends; it is kept with their Start planning answers.

const DAY = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
/** The last day of month t (year * 12 + month). */
const monthEnd = (t: number) => new Date(Math.floor(t / 12), (t % 12) + 1, 0);

type Answers = ReturnType<typeof useHomeAnswers>;

export function Clock({ today, answers }: { today: Date | null; answers: Answers }) {
  const t = useT();
  const locale = useIntlLocale();
  const sp = answers.residency === "student-pass";
  const day = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  const model = useMemo(() => {
    if (!today) return null;
    const end = monthEnd(answers.courseEnd);
    const visitEnd = addDays(end, VISIT_DAYS);
    const horizon = addDays(visitEnd, 150);
    const span = horizon.getTime() - today.getTime();
    const pct = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - today.getTime()) / span) * 100));
    const intakes: Date[] = [];
    for (let y = end.getFullYear(); y <= horizon.getFullYear(); y++)
      for (const m of EXAMPLE_INTAKE_MONTHS) {
        const d = new Date(y, m, 1);
        if (d > end && d <= horizon) intakes.push(d);
      }
    const ep = new Date(EP_FROM.year, EP_FROM.month, 1);
    return { end, visitEnd, intakes, ep, pct, showEp: sp && ep > today && pct(ep) < 100, days: daysBetween(today, sp ? visitEnd : end) };
  }, [today, answers.courseEnd, sp]);

  return (
    <section id="clock" aria-labelledby="clock-title" className="relative border-b bg-background">
      <div className="home-wrap grid gap-12 py-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-24">
        <div className="flex flex-col gap-8">
          <SectionHead
            id="clock-title"
            index="01"
            eyebrow={t("Your clock")}
            title={sp ? t("Your Student’s Pass ends the day your course does.") : t("Your clock is the intake calendar.")}
            lede={
              sp
                ? t("After that, ICA’s answer names a short-term visit pass of up to 89 days. The one-year pass to look for work is only for graduates of institutions on ICA’s list, and Kaplan isn’t on it.")
                : t("As a Singaporean or PR there’s no pass to run out. Your timing is set by when each master’s starts and when its applications close.")
            }
          />
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span id="clock-residency" className="text-xs font-medium text-muted-foreground">
                {t("How are you in Singapore?")}
              </span>
              <Segmented
                labelledBy="clock-residency"
                value={answers.ready ? answers.residency : null}
                options={[
                  { value: "student-pass", label: t("Student’s Pass") },
                  { value: "local", label: t("Singaporean or PR") },
                ]}
                onChange={(v) => {
                  answers.setResidency(v);
                  toast.add({ title: t("The page now follows your answer"), description: v === "local" ? t("Singaporean or PR") : t("Student’s Pass") });
                }}
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-2">
                <span id="clock-end" className="text-xs font-medium text-muted-foreground">
                  {t("My course ends in")}
                </span>
                {today ? <MonthPicker today={today} value={answers.courseEnd} onPick={answers.setCourseEnd} labelledBy="clock-end" /> : <Skeleton className="h-9 w-44 rounded-full" />}
              </div>
              <ReceiptChip ids={sp ? ["visit-89", "ihl-list", "stp-apply", "ep-2027"] : ["monash-intakes"]} title={t("Your clock")} className="mb-1" />
            </div>
            {sp && answers.level === "diploma" && (
              <p className="max-w-xl rounded-xl bg-muted px-4 py-3 text-sm text-pretty">
                <span className="font-semibold">{t("Going from diploma to degree?")}</span>{" "}
                {t("That counts as a new course, so you need a new Student’s Pass, applied for at least four weeks before the degree starts.")}
              </p>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <TiltCard className="overflow-hidden rounded-3xl bg-brand text-white shadow-[0_24px_60px_-20px_rgb(36_15_110/0.55)]">
            <div className="relative flex flex-col gap-5 p-6 sm:p-8">
              {/* The pass card's own marks: a ribbon in the site's amber, and the pass's validity as a bar. */}
              <span aria-hidden className="absolute -top-16 -right-10 size-48 rounded-full bg-amber/25 blur-3xl" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.78rem] font-semibold tracking-[0.12em] text-white/70 uppercase">{sp ? t("Student’s Pass") : t("Your course")}</p>
                <CalendarDaysIcon aria-hidden className="size-5 text-amber" />
              </div>
              <div className="flex items-end gap-3">
                {model ? (
                  <Count value={model.days} className="font-heading text-[clamp(4.5rem,11vw,7.5rem)] leading-[0.82] font-bold tracking-tighter tabular-nums" />
                ) : (
                  <Skeleton className="h-24 w-48 bg-white/15" />
                )}
                <span className="pb-1.5 text-lg font-medium text-white/70">{t("days")}</span>
              </div>
              <p className="max-w-md text-white/80 text-pretty">
                {model
                  ? sp
                    ? t.rich("until you need a new pass or a flight home: <b>{date}</b>.", { b: (c) => <span className="font-semibold text-white">{c}</span> }, { date: day(model.visitEnd) })
                    : t.rich("until your course ends on <b>{date}</b>.", { b: (c) => <span className="font-semibold text-white">{c}</span> }, { date: day(model.end) })
                  : " "}
              </p>
            </div>
          </TiltCard>

          {model ? <Timeline sp={sp} today={today!} model={model} day={day} /> : <Skeleton className="h-28 w-full" />}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-6 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {model && sp && (
              <>
                <Stat term={t("Student’s Pass ends")} value={day(model.end)} sub={t("in {n} days", { n: daysBetween(today!, model.end) })} />
                <Stat term={t("Visit pass, at most")} value={t("{n} days", { n: VISIT_DAYS })} sub={t("until {date}", { date: day(model.visitEnd) })} />
                <Stat term={t("Job-search pass")} value={t("Not for you")} sub={t("1 year for ICA-listed schools")} />
                <Stat term={t("Work pass from 2027")} value="S$6,000" sub={t("a month, at age 23")} />
              </>
            )}
            {model && !sp && (
              <>
                <Stat term={t("Course ends")} value={day(model.end)} sub={t("in {n} days", { n: daysBetween(today!, model.end) })} />
                <Stat term={t("Next example intake")} value={model.intakes[0] ? monthYear(locale, model.intakes[0].getFullYear() * 12 + model.intakes[0].getMonth()) : "—"} sub={t("Monash, Feb · Jul · Nov")} />
                <Stat term={t("Gap to fill")} value={model.intakes[0] ? t("{n} days", { n: daysBetween(model.end, model.intakes[0]) }) : "—"} sub={t("work, travel or a short course")} />
                <Stat term={t("Part-time option")} value={t("Yes")} sub={t("some Kaplan master’s are local-only")} />
              </>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Stat({ term, value, sub }: { term: string; value: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[0.72rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{term}</dt>
      <dd className="text-lg font-semibold tracking-tight tabular-nums">{value}</dd>
      <dd className="text-xs text-muted-foreground">{sub}</dd>
    </div>
  );
}

type Model = { end: Date; visitEnd: Date; intakes: Date[]; ep: Date; pct: (d: Date) => number; showEp: boolean };

/**
 * Today to five months after the visit pass: the pass, the visit pass and the time with no pass to
 * stay, with markers to rest on (or tap, or focus) for what each one is and where it comes from.
 * The popovers keep inside the window: they flip above or below and slide sideways at the edges.
 */
function Timeline({ sp, today, model, day }: { sp: boolean; today: Date; model: Model; day: (d: Date) => string }) {
  const t = useT();
  const locale = useIntlLocale();
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 140, damping: 22 };
  const s = model.pct(model.end);
  const c = model.pct(model.visitEnd);
  const label = sp
    ? t("Student’s Pass until {end}, then a visit pass until {visit}, then no pass to stay.", { end: day(model.end), visit: day(model.visitEnd) })
    : t("Studying until {end}.", { end: day(model.end) });

  return (
    <figure className="flex flex-col gap-4">
      <div className="relative pt-9 pb-11">
        <p className="sr-only">{label}</p>
        {model.showEp && (
          <Marker at={model.pct(model.ep)} top label={t("EP S$6,000")} tone="warning" spring={spring}>
            <p className="font-medium">{t("New Employment Pass minimum")}</p>
            <p className="text-muted-foreground">{t("From January 2027, new Employment Pass applications need at least S$6,000 a month at age 23.")}</p>
            <ReceiptChip ids={["ep-2027"]} title={t("New Employment Pass minimum")} />
          </Marker>
        )}
        <div aria-hidden className="relative h-3 overflow-hidden rounded-full bg-muted">
          <motion.div className="absolute inset-y-0 left-0 bg-primary" initial={false} animate={{ width: `${s}%` }} transition={spring} />
          {sp && (
            <>
              <motion.div className="absolute inset-y-0 bg-amber" initial={false} animate={{ left: `${s}%`, width: `${Math.max(0, c - s)}%` }} transition={spring} />
              <motion.div
                className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--color-destructive)_70%,transparent)_0_4px,transparent_4px_8px)]"
                initial={false}
                animate={{ left: `${c}%` }}
                transition={spring}
              />
            </>
          )}
        </div>
        {model.intakes.map((d) => (
          <Marker key={d.getTime()} at={model.pct(d)} dot label={monthYear(locale, d.getFullYear() * 12 + d.getMonth())} spring={spring}>
            <p className="font-medium">{t("Example intake: {month}", { month: monthYear(locale, d.getFullYear() * 12 + d.getMonth(), "long") })}</p>
            <p className="text-muted-foreground">{t("Monash’s Master of Banking and Finance starts in February, July and November. Applications close earlier.")}</p>
            <ReceiptChip ids={["monash-intakes"]} title={t("Example intakes")} />
          </Marker>
        ))}
        <Marker at={0} label={t("Today")} spring={spring}>
          <p className="font-medium">{t("Today, {date}", { date: day(today) })}</p>
          <p className="text-muted-foreground">{sp ? t("{n} days of Student’s Pass left.", { n: daysBetween(today, model.end) }) : t("{n} days until your course ends.", { n: daysBetween(today, model.end) })}</p>
        </Marker>
        <Marker at={s} label={t("Course ends")} spring={spring}>
          <p className="font-medium">{t("Course ends: {date}", { date: day(model.end) })}</p>
          <p className="text-muted-foreground">{sp ? t("Your Student’s Pass is cancelled when your course ends.") : t("Pick the intake that follows your last exam.")}</p>
          {sp && <ReceiptChip ids={["visit-89"]} title={t("Course ends")} />}
        </Marker>
        {sp && (
          <Marker at={c} label={t("Day 89")} spring={spring}>
            <p className="font-medium">{t("The visit pass ends: {date}", { date: day(model.visitEnd) })}</p>
            <p className="text-muted-foreground">{t("A short-term visit pass lasts up to 89 days. After that you need another pass or a flight home.")}</p>
            <ReceiptChip ids={["visit-89", "ihl-list"]} title={t("Day 89")} />
          </Marker>
        )}
      </div>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <Swatch className="bg-primary" label={sp ? t("Student’s Pass") : t("Studying")} />
        {sp && <Swatch className="bg-amber" label={t("Visit pass, up to 89 days")} />}
        {sp && <Swatch className="bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--color-destructive)_70%,transparent)_0_3px,transparent_3px_6px)]" label={t("No pass to stay")} />}
        <Swatch className="rounded-full bg-[#8576e6]" label={t("Example intakes (Monash)")} />
        <span className="text-muted-foreground/80">{t("Rest on a marker for details")}</span>
      </figcaption>
    </figure>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className={cn("inline-block size-2.5 rounded-sm", className)} />
      {label}
    </span>
  );
}

/** A point on the timeline: a tick and label (or a dot), opening a popover on hover, tap or focus. */
function Marker({
  at,
  label,
  children,
  spring,
  top = false,
  dot = false,
  tone,
}: {
  at: number;
  label: string;
  children: React.ReactNode;
  spring: object;
  top?: boolean;
  dot?: boolean;
  tone?: "warning";
}) {
  // Labels near either end line up with the end instead of hanging off it.
  const shift = at < 8 ? "translate-x-0" : at > 92 ? "-translate-x-full" : "-translate-x-1/2";
  const align = at < 8 ? "items-start" : at > 92 ? "items-end" : "items-center";
  return (
    <motion.div className={cn("absolute", dot ? "top-[2.375rem] -translate-x-1/2" : cn(top ? "top-0" : "bottom-0", shift))} initial={false} animate={{ left: `${at}%` }} transition={spring}>
      <Popover>
        <PopoverTrigger
          openOnHover
          delay={120}
          closeDelay={80}
          className={cn(
            "group rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            dot ? "grid size-5 place-items-center" : cn("flex px-0.5", align, top ? "flex-col" : "flex-col-reverse"),
          )}
        >
          {dot ? (
            <span className="block size-3 rounded-full border-2 border-background bg-[#8576e6] transition-transform group-hover:scale-125" />
          ) : (
            <>
              <span className={cn("text-[0.7rem] font-medium whitespace-nowrap transition-colors group-hover:text-foreground", tone === "warning" ? "text-amber-ink" : "text-muted-foreground")}>{label}</span>
              <span aria-hidden className={cn("mx-auto my-1 block w-px", top ? "h-5" : "h-3", tone === "warning" ? "bg-amber-ink" : "bg-foreground/30")} />
            </>
          )}
          {dot && <span className="sr-only">{label}</span>}
        </PopoverTrigger>
        <PopoverContent side={top ? "top" : "bottom"} className="w-72 gap-2 text-[0.8rem] leading-snug">
          {children}
        </PopoverContent>
      </Popover>
    </motion.div>
  );
}
