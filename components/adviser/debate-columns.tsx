"use client";

import type { ReactNode } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import type { CaseResult } from "@/lib/adviser/types";
import { msg } from "@/lib/i18n/translate";
import s from "./adviser.module.css";
import { Blink, Feed, SourceCount } from "./feed";
import type { Side } from "./use-adviser";

// Step 2 of AI adviser v2: the two advisers side by side, "Master's first" and "Work first", each with its own Kappy
// (the cap and the briefcase, components/adviser/adviser-kappy.tsx) on a pixel-grid head. Each column is a live feed
// while its adviser works, then its case: the thesis, one line per criterion, the strongest point against it, and when
// it stops being the right call.

export const CRITERIA: Record<CaseResult["points"][number]["criterion"], string> = { cost: msg("Cost"), benefit: msg("Benefit"), risk: msg("Risk"), fit: msg("Fit") };

type KappySide = (which: "study" | "work", heading: ReactNode) => ReactNode;

function Column({ which, title, side, running, kappy }: { which: "study" | "work"; title: string; side: Side; running: boolean; kappy: KappySide }) {
  const t = useT();
  const r = side.result;
  return (
    <div className={s.col}>
      {kappy(
        which,
        <h3>
          {title}
          {running && !r && !side.failed && <Blink />}
        </h3>,
      )}
      <div className={s.colBody}>
        <Feed items={side.feed} />
        {side.failed && <p className={s.failed}>{t("This side couldn’t finish")}</p>}
        {r && r.thesis.text && (
          <div className={s.case}>
            <p className={s.thesis}>
              {r.thesis.text} <SourceCount n={r.thesis.sources.length} />
            </p>
            <dl className={s.points}>
              {r.points.map((p) => (
                <div key={p.criterion}>
                  <dt>{t(CRITERIA[p.criterion])}</dt>
                  <dd>
                    {p.claim.text} <SourceCount n={p.claim.sources.length} />
                  </dd>
                </div>
              ))}
            </dl>
            {r.concede.text && (
              <p className={s.concede}>
                <span className={s.label}>{t("Strongest point against")}: </span>
                {r.concede.text} <SourceCount n={r.concede.sources.length} />
              </p>
            )}
            {!!r.conditions.length && (
              <div className="text-sm">
                <p className={s.label}>{t("Not the right call if")}</p>
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
    </div>
  );
}

export function DebateColumns({ study, work, running, kappy }: { study: Side; work: Side; running: boolean; kappy: KappySide }) {
  const t = useT();
  return (
    <div className={s.cols}>
      <Column which="study" title={t("Master’s first")} side={study} running={running} kappy={kappy} />
      <Column which="work" title={t("Work first")} side={work} running={running} kappy={kappy} />
    </div>
  );
}
