"use client";

import { useId } from "react";
import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "cn";
import { useIntlLocale, useLocale, useT } from "@/components/i18n/I18nProvider";
import { campusLabel, studyCountry } from "@/components/results/facets";
import { useLocalName } from "@/components/results/names";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useModel } from "@/components/workspace/model";
import { money } from "@/components/workspace/programme-detail";
import { DEFAULT_CRITERIA, type Criterion } from "@/lib/finder/criteria";
import { risksFor } from "@/lib/finder/nationality-risk";
import { monthName } from "@/lib/i18n/format";
import { transitions } from "@/lib/motion";
import type { ResultsProgramme } from "@/lib/results-types";
import { MatchRate } from "./match-rate";
import { ProgrammeDetails } from "./programme-details";
import { PILL_LABEL } from "./position-dots";
import { Pill } from "./parts";
import { RecognitionBadges, StandingLine } from "./standing";
import { MAX_COMPARE, type FinderRow } from "./use-finder";

// One programme in the finder's list: QS, name, university and where, length, fee and start; the three
// requirement pills and the match rate; its figures on the chosen sort criteria and its Singapore recognition
// badges (./standing.tsx); a box to compare it; and the details, opened in place (./programme-details.tsx).

/** "1 year", "18 months". */
export function lengthText(t: ReturnType<typeof useT>, months: number | null) {
  if (!months) return null;
  return months % 12 === 0 ? t(months === 12 ? "1 year" : "{n} years", { n: months / 12 }) : t("{n} months", { n: months });
}

/** The fee as the page states it, a year or for the course. */
export function feeText(t: ReturnType<typeof useT>, p: ResultsProgramme) {
  if (!p.fee) return null;
  const amount = money(p.fee.amount, p.fee.currency);
  return p.feeBasis === "year" ? t("{amount} / year", { amount }) : p.feeBasis === "course" || p.feeBasis === "one-year" ? t("{amount} for the course", { amount }) : amount;
}

/** The first two intake months: "September", "January, September". */
export function intakeText(locale: string, mask: number) {
  const months = Array.from({ length: 12 }, (_, i) => i).filter((i) => mask & (1 << i));
  return months.length ? months.slice(0, 2).map((i) => monthName(locale, i, "long")).join(" / ") : null;
}

export function QsBadge({ qs }: { qs: string | null }) {
  const t = useT();
  return (
    <div className="grid size-14 shrink-0 place-items-center content-center rounded-xl bg-muted text-center">
      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">QS</span>
      <span className={cn("leading-tight font-bold tabular-nums", qs ? "text-[17px]" : "text-[11px] text-muted-foreground")}>{qs ? `#${qs.replace(/^=/, "")}` : t("Unranked")}</span>
    </div>
  );
}

/** "布里斯托大学 · University of Bristol · 英国": the Chinese name with the English after it on Chinese pages. */
export function useUniversityLine() {
  const t = useT();
  const local = useLocalName();
  return (r: Pick<FinderRow, "p" | "u">) => {
    const uni = local(r.u.name, r.u.zh);
    const where = r.p.kaplan ? t("Kaplan Singapore") : r.p.campus ? (campusLabel(r.p, t) ?? t(studyCountry(r))) : t(r.u.country);
    return [uni.name, uni.en, where].filter(Boolean).join(" · ");
  };
}

export function ProgrammeCard({ r, criteria = DEFAULT_CRITERIA, open, onToggle }: { r: FinderRow; criteria?: Criterion[]; open: boolean; onToggle: () => void }) {
  const t = useT();
  const locale = useLocale();
  const intl = useIntlLocale();
  const m = useModel();
  const id = useId();
  const local = useLocalName();
  const line = useUniversityLine();
  const { p } = r;
  const title = local(p.name, p.zh);
  const facts = [
    lengthText(t, p.months) && t("Length {value}", { value: lengthText(t, p.months)! }),
    t("Fee {value}", { value: feeText(t, p) ?? t("not stated") }),
    p.intake ? t("Starts {months}", { months: intakeText(intl, p.intake)! }) : null,
  ].filter(Boolean);
  const compared = m.answers.shortlist.includes(p.id);
  // Visa rules that cover the student's nationality (/profile), for this programme.
  const risks = risksFor(p.risks, m.answers.nationality);
  const full = m.answers.shortlist.length >= MAX_COMPARE;
  return (
    <article aria-labelledby={`${id}-name`} className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-start gap-x-4 sm:gap-x-5 lg:items-center gap-y-4 p-5 lg:grid-cols-[56px_minmax(0,1fr)_auto_auto_auto]">
        <QsBadge qs={r.u.qs} />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={`${id}-name`} className="text-[17px] leading-snug font-bold">
            {title.name}
            {p.mode === "part-time" && (
              <Badge variant="outline" className="ml-2 border-(--fd-gap)/50 align-middle text-(--fd-gap)" title={t("Part-time only: not for a Student’s Pass")}>
                {t("Part-time only")}
              </Badge>
            )}
          </h3>
          {locale !== "en" && title.en && <p className="text-sm text-muted-foreground">{title.en}</p>}
          <p className="text-[15px] text-muted-foreground">{line(r)}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span>{facts.join("　")}</span>
            <label className="inline-flex items-center gap-1.5">
              <Checkbox checked={compared} disabled={!compared && full} onCheckedChange={() => m.toggleStar(p.id)} />
              {t("Compare")}
              {!compared && full && <span className="text-xs">({t("{n} at most", { n: MAX_COMPARE })})</span>}
            </label>
          </div>
          <StandingLine r={r} criteria={criteria} />
          <RecognitionBadges r={r} className="mt-1" />
          {risks.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 text-sm">
              {risks.map((x) => (
                <li key={x.id} className={cn("flex items-start gap-1.5", x.block ? "text-destructive" : "text-(--fd-gap)")}>
                  <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {x.url ? (
                    <a href={x.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      {t(x.label)}
                    </a>
                  ) : (
                    t(x.label)
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-more`}
          onClick={onToggle}
          className="col-start-3 row-start-1 grid size-11 place-items-center rounded-xl border border-border bg-card outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 lg:col-start-5"
        >
          <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
          <span className="sr-only">{open ? t("Hide the details of {name}", { name: title.name }) : t("Details of {name}", { name: title.name })}</span>
        </button>
        <div className="col-span-3 flex flex-wrap items-end gap-x-8 gap-y-3 sm:pl-[76px] lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:pl-0">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold">{t("Requirements")}</span>
            <div className="flex gap-1.5">
              <Pill state={r.grade} title={t(PILL_LABEL[r.grade])}>{r.grade === "unset" ? t("Grades: not filled in") : t("Grades")}</Pill>
              <Pill state={r.english} title={t(PILL_LABEL[r.english])}>{r.english === "unset" ? t("English: not filled in") : t("English")}</Pill>
              <Pill state={r.work} title={t(PILL_LABEL[r.work])}>{r.work === "unset" ? t("Work: not filled in") : t("Work")}</Pill>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 lg:hidden">
            <span className="text-xs font-semibold">{t("Match rate")}</span>
            <MatchRate match={r.match} />
          </div>
        </div>
        <div className="hidden flex-col gap-1.5 lg:col-start-4 lg:row-start-1 lg:flex">
          <span className="text-xs font-semibold">{t("Match rate")}</span>
          <MatchRate match={r.match} />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={`${id}-more`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0, transition: transitions.exit }} transition={transitions.enter} className="overflow-hidden">
            <ProgrammeDetails r={r} />
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
