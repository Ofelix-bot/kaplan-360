"use client";

import { BriefcaseIcon, GraduationCapIcon, ShieldQuestionIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { Spinner } from "@/components/workspace/spinner";
import type { CaseResult } from "@/lib/adviser/types";
import { msg } from "@/lib/i18n/translate";
import { cn } from "cn";
import { Feed, SourceCount } from "./feed";
import type { Side } from "./use-adviser";

// Step 2 of AI adviser v2: the two advisers side by side, "Master's first" and "Work first". Each column is a live feed
// while its adviser works, then its case: the thesis, one line per criterion, the strongest point against it, and when
// it stops being the right call.

export const CRITERIA: Record<CaseResult["points"][number]["criterion"], string> = { cost: msg("Cost"), benefit: msg("Benefit"), risk: msg("Risk"), fit: msg("Fit") };

function Column({ icon, title, side, running }: { icon: ReactNode; title: string; side: Side; running: boolean }) {
  const t = useT();
  const r = side.result;
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {icon}
        {title}
        {running && !r && !side.failed && <Spinner className="ml-auto size-3.5" />}
      </p>
      <Feed items={side.feed} />
      {side.failed && (
        <p className="flex items-center gap-1.5 rounded-md border border-dashed p-2 text-sm text-muted-foreground">
          <ShieldQuestionIcon className="size-4 shrink-0" aria-hidden />
          {t("This side couldn’t finish")}
        </p>
      )}
      {r && r.thesis.text && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-base leading-snug font-semibold">
            {r.thesis.text} <SourceCount n={r.thesis.sources.length} />
          </p>
          <dl className="space-y-1.5 text-sm">
            {r.points.map((p) => (
              <div key={p.criterion} className="grid grid-cols-[4.5rem_1fr] gap-2">
                <dt className="text-xs font-medium text-muted-foreground">{t(CRITERIA[p.criterion])}</dt>
                <dd className="leading-snug">
                  {p.claim.text} <SourceCount n={p.claim.sources.length} />
                </dd>
              </div>
            ))}
          </dl>
          {r.concede.text && (
            <div className="rounded-md bg-muted/60 p-2 text-sm">
              <p className="mb-0.5 text-xs font-semibold text-muted-foreground">{t("Strongest point against")}</p>
              {r.concede.text} <SourceCount n={r.concede.sources.length} />
            </div>
          )}
          {!!r.conditions.length && (
            <div className="text-sm">
              <p className="mb-0.5 text-xs font-semibold text-muted-foreground">{t("Not the right call if")}</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {r.conditions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DebateColumns({ study, work, running }: { study: Side; work: Side; running: boolean }) {
  const t = useT();
  return (
    <div className={cn("grid gap-3 md:grid-cols-2")}>
      <Column icon={<GraduationCapIcon className="size-3.5" aria-hidden />} title={t("Master’s first")} side={study} running={running} />
      <Column icon={<BriefcaseIcon className="size-3.5" aria-hidden />} title={t("Work first")} side={work} running={running} />
    </div>
  );
}
