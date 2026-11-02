"use client";

import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Road as RoadData, RoadEntry } from "@/lib/plan-road";
import { AskPrompt } from "./AboutYouFields";
import { Chevron, Flag, FOCUS, RuleQuote, When } from "./parts";
import { EntryAsks, EntryBody, EntryLines, StopRow } from "./StopRow";

// /plan's one road, drawn like the homepage's old road section (deleted 2026-10-29): a 2px rail with a
// filled dot for Now, a ringed dot for each later stop and a larger filled one for the master's start.
// Now is open: what runs today or starts within four months, three rows then "N more", with the
// Student's Pass work rule in plain sight. Each later stop is one closed row (date, basis, a headline
// that starts with a verb, at most one flag) that opens in place. Nothing moves until it is tapped.

/** A stop on the rail: the rail runs from the first dot's centre to the last one's. */
const STOP =
  "relative grid grid-cols-[34px_minmax(0,1fr)] gap-x-3 pb-8 last:pb-0 before:absolute before:top-0 before:bottom-0 before:left-[16px] before:w-[2px] before:bg-(--land-line) first:before:top-[14px] last:before:bottom-auto last:before:h-[11px]";
const RING = "relative z-[1] size-[22px] justify-self-center rounded-full border-[2.5px] border-(--brand-ink) bg-(--land-ground)";

export function Road({ road }: { road: RoadData }) {
  const t = useT();
  const { now } = road;
  return (
    <ol aria-label={t("Your road, from now to your master’s")}>
      <li className={STOP}>
        <span aria-hidden className="relative z-[1] mt-[3px] size-[22px] justify-self-center rounded-full bg-(--brand-ink) shadow-[0_0_0_6px_var(--land-halo)]" />
        <section aria-labelledby="plan-now" className="min-w-0">
          <h2 id="plan-now" className="font-heading text-xl leading-7 font-bold tracking-[-0.01em]">
            {t("Now")}
            {now.label && <span className="font-sans text-[15px] font-medium tracking-normal text-muted-foreground"> · {now.label}</span>}
          </h2>
          {now.work && (
            <div className="mt-2 flex flex-col gap-1">
              <p className="text-[15px] leading-snug font-medium text-pretty text-foreground">{now.work.line}</p>
              {now.work.rule && <RuleQuote rule={now.work.rule} lead={now.work.detail !== now.work.line ? now.work.detail : null} />}
            </div>
          )}
          {now.asks.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {now.asks.map((a) => (
                <AskPrompt key={a} ask={a} />
              ))}
            </div>
          )}
          {now.rows.length > 0 ? (
            <Rows rows={now.rows} className="mt-1" />
          ) : (
            <p className="mt-2 text-[15px] text-(--land-body)">{t("Nothing due in the next 4 months.")}</p>
          )}
          {now.more.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className={cn("group/row mt-1 inline-flex min-h-8 items-center gap-1 text-[14px] font-semibold text-(--brand-ink)", FOCUS)}>
                <span className="group-data-[panel-open]/row:hidden">{t("{n} more", { n: now.more.length })}</span>
                <span className="hidden group-data-[panel-open]/row:inline">{t("Show less")}</span>
                <Chevron className="mt-0 text-(--brand-ink)" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Rows rows={now.more} />
              </CollapsibleContent>
            </Collapsible>
          )}
        </section>
      </li>
      {road.stops.map((s) => (
        <li key={s.id} className={STOP}>
          <span aria-hidden className={s.kind === "start" ? "relative z-[1] -mt-[6px] size-[34px] rounded-full bg-(--brand-ink) shadow-[0_0_0_8px_var(--land-halo)]" : RING} />
          <RoadStop entry={s} />
        </li>
      ))}
    </ol>
  );
}

function Rows({ rows, className }: { rows: RoadEntry[]; className?: string }) {
  return (
    <ul className={cn("divide-y divide-(--land-line)", className)}>
      {rows.map((r) => (
        <li key={r.id}>
          <StopRow entry={r} />
        </li>
      ))}
    </ul>
  );
}

/** A later stop: its heading is the button that opens it. */
function RoadStop({ entry }: { entry: RoadEntry }) {
  return (
    <Collapsible className="min-w-0">
      <h2>
        <CollapsibleTrigger className={cn("group/row flex w-full items-start gap-3 text-left", FOCUS)}>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <When when={entry.when} basis={entry.basis} />
            <span lang={entry.lang} className="font-heading text-[17px] leading-[1.3] font-semibold tracking-[-0.005em] text-pretty text-foreground sm:text-lg">
              {entry.title}
            </span>
            <EntryLines entry={entry} />
            {entry.flag && <Flag text={entry.flag.text} basis={entry.flag.basis} />}
          </span>
          <Chevron className="mt-7" />
        </CollapsibleTrigger>
      </h2>
      <EntryAsks entry={entry} />
      <CollapsibleContent>
        <EntryBody entry={entry} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The privacy line, said once under the road. */
export function RoadLegend() {
  const t = useT();
  return (
    <footer className="flex flex-col gap-1 border-t border-(--land-line) pt-4 text-[13px] leading-5 text-muted-foreground">
      <p>{t("Made on this device. Nothing is sent.")}</p>
    </footer>
  );
}
