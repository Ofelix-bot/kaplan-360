"use client";

import { CheckIcon, HelpCircleIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { CARDS, CHECK, type CheckState } from "@/content/landing.en";

// A check's state as a small chip: "Checks out", "Still to check", "Crossed out". Colours and icons
// as in 02 · Check (components/landing/distance/Check.tsx STATE), words from CHECK.states. StillChip
// is the "still to check" note on the cards ("{label}: Still to check"), once two copies of STILL.

const STATE: Record<CheckState, { icon: React.ReactNode; className: string }> = {
  holds: { icon: <CheckIcon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.75} />, className: "bg-(--land-ok-bg) text-(--land-ok)" },
  check: { icon: <HelpCircleIcon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.5} />, className: "bg-(--land-check-bg) text-(--land-check)" },
  out: { icon: <XIcon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.75} />, className: "bg-(--land-no-bg) text-(--land-no)" },
};

const CHIP = "inline-flex w-fit items-center gap-1 rounded-full py-0.5 pr-2 pl-1 text-[11px] leading-4 font-medium";

/** `label` (an English message, translated here) replaces the state's own words. */
export function StatusChip({ state, label, className }: { state: CheckState; label?: string; className?: string }) {
  const t = useT();
  const s = STATE[state];
  return (
    <span className={cn(CHIP, s.className, className)}>
      {s.icon}
      {t(label ?? CHECK.states[state])}
    </span>
  );
}

/** "{label}: Still to check", or just "Still to check" without a label. `label` is an English message. */
export function StillChip({ label, className }: { label?: string; className?: string }) {
  const t = useT();
  return (
    <span className={cn(CHIP, STATE.check.className, className)}>
      <HelpCircleIcon aria-hidden className="size-3.5 shrink-0" />
      {label ? t(CARDS.part, { label: t(label), state: t(CARDS.toCheck) }) : t(CARDS.toCheck)}
    </span>
  );
}
