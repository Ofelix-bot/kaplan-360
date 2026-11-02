"use client";

import { cn } from "cn";
import { motion } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { GROUP_NAME, GROUPS } from "@/components/results/words";
import { transitions } from "@/lib/motion";
import type { CasesGroup, CasesSpread, CasesTier } from "@/lib/results-types";
import { TIERS } from "@/lib/tiers";

// The figures of reported admitted students as small charts: GPAs on the 4-point scale, and the
// tiers and groups of their first degrees. The visitor's own result is marked on them in amber: data,
// never a verdict on their chances.

// The GPA strip runs from 2.0 to 4.0, as on the admitted-students rows.
const LOW = 2;
const HIGH = 4;
const TICKS = [2, 3, 4];
const at = (g: number) => Math.min(100, Math.max(0, ((g - LOW) / (HIGH - LOW)) * 100));
const fmt = (n: number) => n.toFixed(2);

/** Literal class names, so Tailwind sees them. */
export const MIX_BG: Record<CasesGroup, string> = {
  "985": "bg-mix-985",
  "211": "bg-mix-211",
  other: "bg-mix-other",
  qs50: "bg-mix-qs50",
  qs300: "bg-mix-qs300",
  qsRest: "bg-mix-qsRest",
};
/** Tiers A, B and C on the mainland ramp (A darkest), with a letter colour at AA on each in both themes. */
const TIER_BG: Record<CasesTier, string> = { A: "bg-mix-985", B: "bg-mix-211", C: "bg-mix-other" };
const TIER_TEXT: Record<CasesTier, string> = { A: "text-background", B: "text-background", C: "text-foreground" };
/** A segment narrower than this share carries no letter; the legend below names it. */
const LETTER_MIN = 0.06;

/**
 * Admitted GPAs on a 2.0–4.0 axis: the middle 80% light, the middle half darker, the median as a
 * line, and the visitor's result in amber (one value from a mark, a span from a class alone).
 */
export function GpaBand({ spread, you, size = "sm" }: { spread: CasesSpread; you: { low: number; high: number } | null; size?: "sm" | "lg" }) {
  const t = useT();
  const large = size === "lg";
  const grow = { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition: transitions.enter };
  const label = t("Middle 80%: {low}–{high} · median {median}", { low: fmt(spread.p10), high: fmt(spread.p90), median: fmt(spread.median) });
  const bar = (
    <div role="img" aria-label={label} className={cn("relative", large ? "h-3" : "h-1.5")}>
      <div className="absolute inset-0 rounded-full bg-muted" />
      <motion.div {...grow} className="absolute inset-y-0 rounded-full bg-primary/20" style={{ left: `${at(spread.p10)}%`, width: `${at(spread.p90) - at(spread.p10)}%`, originX: 0 }} />
      <motion.div {...grow} className="absolute inset-y-0 rounded-full bg-primary/55" style={{ left: `${at(spread.p25)}%`, width: `${Math.max(at(spread.p75) - at(spread.p25), 1)}%`, originX: 0 }} />
      <div className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-primary" style={{ left: `${at(spread.median)}%` }} />
      {you && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -inset-y-1 min-w-1 rounded-full bg-amber ring-2 ring-background"
          style={{ left: `${at(you.low)}%`, width: `${Math.max(at(you.high) - at(you.low), 0)}%`, x: you.low === you.high ? "-50%" : 0 }}
        />
      )}
    </div>
  );
  if (!large) return bar;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-4 text-[11px] leading-4 tabular-nums">
        <span className="absolute -translate-x-1/2 font-medium whitespace-nowrap" style={{ left: `${Math.min(88, Math.max(12, at(spread.median)))}%` }}>
          {t("median {median}", { median: fmt(spread.median) })}
        </span>
      </div>
      {bar}
      <div className="relative h-4 text-[11px] leading-4 text-muted-foreground tabular-nums" aria-hidden>
        {TICKS.map((tick, i) => (
          <span key={tick} className={cn("absolute", i === 0 ? "" : i === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${at(tick)}%` }}>
            {tick.toFixed(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A share in whole per cent, "<1%" for a few cases that round to nothing. */
export const share = (k: number, of: number) => (!of || !k ? "0%" : k / of < 0.005 ? "<1%" : `${Math.round((k / of) * 100)}%`);

/** First-degree backgrounds of the admits as one bar, with the shares listed below it; the visitor's own group is marked. */
export function MixBar({ mix, you }: { mix: Record<CasesGroup, number>; you: CasesGroup | null }) {
  const t = useT();
  const total = GROUPS.reduce((sum, g) => sum + mix[g], 0);
  if (!total) return null;
  const present = GROUPS.filter((g) => mix[g] > 0);
  return (
    <div className="flex flex-col gap-2">
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={transitions.enter}
        style={{ originX: 0 }}
        className="flex h-3 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={present.map((g) => `${t(GROUP_NAME[g])} ${share(mix[g], total)}`).join(", ")}
      >
        {present.map((g) => (
          <div key={g} className={cn("h-full first:rounded-l-full last:rounded-r-full", MIX_BG[g], you === g && "ring-2 ring-amber ring-inset")} style={{ width: `${(mix[g] / total) * 100}%` }} />
        ))}
      </motion.div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {GROUPS.filter((g) => mix[g] > 0 || you === g).map((g) => (
          <li key={g} className={cn("flex items-center gap-1.5", !mix[g] && "text-muted-foreground", you === g && "font-medium")}>
            <span className={cn("size-2 shrink-0 rounded-full", MIX_BG[g])} />
            <span className="truncate">{t(GROUP_NAME[g])}</span>
            <span className="ml-auto tabular-nums">{share(mix[g], total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** First-degree tiers of the admits as one bar, A to C, each segment lettered and the shares listed below; the visitor's own tier is marked. */
export function TierBar({ mix, you }: { mix: Record<CasesTier, number>; you: CasesTier | null }) {
  const t = useT();
  const total = TIERS.reduce((sum, x) => sum + mix[x], 0);
  if (!total) return null;
  const present = TIERS.filter((x) => mix[x] > 0);
  return (
    <div className="flex flex-col gap-1.5">
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={transitions.enter}
        style={{ originX: 0 }}
        className="flex h-5 gap-0.5 overflow-hidden rounded-md"
        role="img"
        aria-label={present.map((x) => `${t("Tier {tier}", { tier: x })} ${share(mix[x], total)}`).join(", ")}
      >
        {present.map((x) => (
          <div
            key={x}
            className={cn("flex h-full items-center justify-center text-[11px] font-semibold first:rounded-l-md last:rounded-r-md", TIER_BG[x], TIER_TEXT[x], you === x && "ring-2 ring-amber ring-inset")}
            style={{ width: `${(mix[x] / total) * 100}%` }}
          >
            {mix[x] / total >= LETTER_MIN && x}
          </div>
        ))}
      </motion.div>
      <ul className="grid grid-cols-3 gap-x-3 text-xs">
        {TIERS.map((x) => (
          <li key={x} className={cn("flex items-center gap-1.5", !mix[x] && "text-muted-foreground", you === x && "font-medium")}>
            <span className={cn("size-2 shrink-0 rounded-full", TIER_BG[x])} />
            <span className="truncate">{t("Tier {tier}", { tier: x })}</span>
            <span className="ml-auto tabular-nums">{share(mix[x], total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
