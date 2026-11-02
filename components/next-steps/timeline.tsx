"use client";

import { MapPinIcon } from "lucide-react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { monthYear } from "@/lib/i18n/format";
import { msg } from "@/lib/i18n/translate";
import type { Leaf, StepOffset } from "@/lib/next-steps";
import { BasisChip, ROAD_ICON, roadVars, useSay } from "./roads";

// The selected leaf at this month, +12 and +24 months: one line, three markers (now filled in amber,
// the two to come hollow in indigo, each with an icon), and under each its month, its state in one line
// and the chip for what that state rests on. Not animated: a new selection swaps its words.

const WHEN: Record<StepOffset, string> = { 0: msg("Now"), 12: msg("+12 months"), 24: msg("+24 months") };
const MARK = 32;

function Marker({ now, road }: { now: boolean; road: Leaf["road"] }) {
  const Icon = now ? MapPinIcon : ROAD_ICON[road];
  return (
    <span aria-hidden className="relative flex shrink-0 items-center justify-center" style={{ width: MARK, height: MARK }}>
      <svg width={MARK} height={MARK} viewBox={`0 0 ${MARK} ${MARK}`} className="absolute inset-0">
        <circle cx={MARK / 2} cy={MARK / 2} r={MARK / 2 - 1.5} fill={now ? "var(--accent)" : "var(--land-card)"} stroke={now ? "var(--accent)" : "var(--brand-ink)"} strokeWidth={2} />
      </svg>
      <Icon className={cn("relative size-4", now ? "text-(--accent-text)" : "text-(--brand-ink)")} />
    </span>
  );
}

export function PathTimeline({ leaf }: { leaf: Leaf }) {
  const t = useT();
  const say = useSay();
  const locale = useIntlLocale();
  return (
    <ol aria-label={t("{leaf}: now, in 12 months and in 24 months", { leaf: say(leaf.name) })} className="relative grid grid-cols-3 gap-3 sm:gap-6" style={roadVars(leaf.road)}>
      {/* The line, from the first marker's middle to the last one's. */}
      <svg aria-hidden className="pointer-events-none absolute top-[15px] left-[16px] h-[2px] w-[calc((100%-0.75rem*2)/3*2+0.75rem*2)] overflow-visible sm:w-[calc((100%-1.5rem*2)/3*2+1.5rem*2)]" preserveAspectRatio="none">
        <line x1="0" y1="1" x2="100%" y2="1" stroke="var(--brand-ink)" strokeWidth={2} />
      </svg>
      {leaf.steps.map((s) => (
        <li key={s.offset} className="relative flex min-w-0 flex-col gap-1.5">
          <Marker now={s.offset === 0} road={leaf.road} />
          <p className="text-xs font-semibold text-muted-foreground tabular-nums">
            <span className="block sm:inline">{t(WHEN[s.offset])}</span>
            <span className="hidden sm:inline"> · </span>
            <span className="block sm:inline">{monthYear(locale, s.month)}</span>
          </p>
          <p className="line-clamp-2 text-[13px] leading-snug font-semibold text-pretty sm:text-sm">{say(s.text)}</p>
          <BasisChip bases={[s.basis, s.rule]} className="self-start" />
          {s.also && (
            <>
              <p className="line-clamp-2 text-xs leading-snug text-(--land-body)">{say(s.also)}</p>
              <BasisChip bases={[s.alsoBasis]} className="self-start" />
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
