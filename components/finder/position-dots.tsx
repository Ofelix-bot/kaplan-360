"use client";

import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { msg } from "@/lib/i18n/translate";
import type { State } from "@/lib/finder/row-state";

// The requirement pills' labels, and the five dots that "Where you are" showed before the match rate
// (components/finder/match-rate.tsx) replaced them on the finder's cards.

const WORDS = [
  msg("No result to place yet"),
  msg("At the minimum only if your result is high in its class"),
  msg("Over the minimum, under where admitted students usually are"),
  msg("Possibly where admitted students usually are"),
  msg("Where admitted students usually are"),
  msg("Above where admitted students usually start"),
];

export const PILL_LABEL: Record<State, string> = {
  met: msg("Meets it"),
  gap: msg("A gap"),
  none: msg("Not required"),
  unset: msg("Not filled in"),
  unknown: msg("Not stated in a comparable way: check the official page"),
};

export function PositionDots({ n }: { n: number }) {
  const t = useT();
  return (
    <span role="img" aria-label={t(WORDS[n])} title={t(WORDS[n])} className="flex h-6 items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("h-1.5 w-4 rounded-full", i <= n ? "bg-primary" : "bg-(--fd-dot-off)")} />
      ))}
    </span>
  );
}
