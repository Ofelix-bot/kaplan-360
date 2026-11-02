"use client";

import type { CSSProperties } from "react";
import { cn } from "cn";
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { useLocalName } from "@/components/results/names";
import { RELATED_RULES, type TopUpMarker } from "@/components/results/topup";
import { basisLabel, usualText } from "@/components/results/words";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LEVELS } from "@/lib/admit-range";
import { useResultsData } from "@/lib/workspace/data";

// A private school's degree on the admission range (components/results/topup.ts): read as tier C (QS 301+ or
// unranked), a short bracket under the range's steps over the programme's tier C admits' middle half (a tick at
// their median), or over its admitted level when too few tier C admits reported a GPA; beside it what it rests on,
// the note that this is experience, and the nearest official rules behind a disclosure. The range and its filter
// stay on official evidence.

/** Each step's marks, the First's up to 80 (GPA 4.0 through lib/gpa4.ts's bands). */
const EDGES = [...LEVELS, 80];

/** A UK mark's place across the range's five steps (grid-cols-5 with gap-1: four gaps of 0.25rem). */
function place(mark: number) {
  const m = Math.min(80, Math.max(40, mark));
  let i = 0;
  while (i < LEVELS.length - 1 && m >= EDGES[i + 1]) i++;
  const f = (m - EDGES[i]) / (EDGES[i + 1] - EDGES[i]);
  return `calc(${((i + f) / LEVELS.length).toFixed(4)} * (100% - 1rem) + ${i * 0.25}rem)`;
}

/** The marker's shape: the visitor's amber (as text colour, for contrast), open rather than filled like their own result. */
const Bracket = ({ className, style }: { className: string; style?: CSSProperties }) => <span className={cn("block rounded-b-sm border-2 border-t-0 border-amber-ink", className)} style={style} aria-hidden />;

/** The bracket under the steps: tier C admits' middle half with a tick at their median, or the admitted level's step. */
export function TopUpTrack({ marker }: { marker: TopUpMarker }) {
  return (
    <div className="relative -mt-1.5 h-2.5" aria-hidden>
      <Bracket className="absolute top-0 h-2 min-w-2.5" style={{ left: place(marker.marks[0]), right: `calc(100% - ${place(marker.marks[1])})` }} />
      {marker.k === "cases" && <span className="absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-b-sm bg-amber-ink" style={{ left: place(marker.median) }} />}
    </div>
  );
}

/** What the bracket stands for, what it rests on, the experience note and the related official rules. */
export function TopUpNote({ marker }: { marker: TopUpMarker }) {
  const t = useT();
  const local = useLocalName();
  const universities = useResultsData((s) => s.data?.universities);
  const fmt = (g: number) => g.toFixed(2);
  const label =
    marker.k === "cases"
      ? t("Tier C admits: median GPA {median}, middle half {low}–{high} ({n} cases)", { median: fmt(marker.band.median), low: fmt(marker.band.p25), high: fmt(marker.band.p75), n: marker.band.n })
      : t("Tier C: this programme’s admitted range, {level}", { level: usualText(t, marker.level) });

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-xs leading-relaxed" role="group" aria-label={t("Private-school degree")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Bracket className="h-1.5 w-3 shrink-0" />
        <span className="font-medium tabular-nums">{label}</span>
        <Badge variant="outline" className="h-auto max-w-full text-left font-normal whitespace-normal">
          {marker.k === "cases" ? basisLabel(t, "cases", marker.band.n) : basisLabel(t, marker.basis, marker.n)}
        </Badge>
      </div>
      <Collapsible>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <CollapsibleTrigger className="group/rules flex items-center gap-1 rounded-md text-left font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-data-[panel-open]/rules:rotate-180 motion-reduce:transition-none" />
            {t("Related official rules")}
          </CollapsibleTrigger>
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {t("Not specifically about top-ups")}
          </Badge>
        </div>
        <CollapsibleContent>
          <ul className="mt-2 flex flex-col gap-2 text-muted-foreground">
            {RELATED_RULES.map((r) => {
              const name = local(r.university, universities?.find((u) => u.name === r.university)?.zh ?? null).name;
              return (
                <li key={r.url}>
                  {t("{university}, {page}: “{quote}”", { university: name, page: t(r.page), quote: r.quote })}{" "}
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary underline-offset-4 hover:underline">
                    {t("Source")}
                    <span className="sr-only">: {name}</span>
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </li>
              );
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
