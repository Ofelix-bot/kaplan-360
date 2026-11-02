"use client";

import { BadgeCheckIcon, CircleDashedIcon, CircleXIcon, ScaleIcon } from "lucide-react";
import { cn } from "cn";
import type { Measure } from "@/lib/next-steps";
import { TILE, useSay } from "./roads";

// A leaf's measure as a mark: a ring for a real fraction (its own unit, its own figure in the middle), a
// tile with BadgeCheck or CircleX for a yes/no fact (Scale when the body decides case by case), a dashed circle for facts not collected yet. Never
// animated: the figure is the point. On a dimmed map node (nodes.tsx Appear) the ring, tile and circle
// fade with FADE; the figure in the ring stays, as text.

/** Fades a mark to 40% (nodes.tsx DIM) while its map node is dimmed. */
export const FADE = "motion-safe:transition-opacity motion-safe:duration-[140ms] motion-safe:ease-out group-data-dim/node:opacity-40";

/** A ring: the track in --land-line, the arc in the road's colour (--r), `shown` in the middle. */
export function ProgressRing({ value, max, shown, size, label }: { value: number; max: number; shown: string; size: number; label: string }) {
  const stroke = size >= 80 ? 8 : 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fill = Math.max(0, Math.min(1, value / max));
  return (
    <span role="img" aria-label={label} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn(FADE, "absolute inset-0 -rotate-90")}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--land-line)" strokeWidth={stroke} />
        {fill > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--r)" strokeWidth={stroke} strokeLinecap={fill < 1 ? "round" : "butt"} strokeDasharray={`${c * fill} ${c}`} />
        )}
      </svg>
      <span aria-hidden className={cn("relative leading-none font-bold tabular-nums", size >= 80 ? "font-heading text-xl" : shown.length > 4 ? "text-[10px] tracking-tight" : "text-xs")}>
        {shown}
      </span>
    </span>
  );
}

/** The measure as a mark of `size` px, with its words as the accessible name. */
export function MeasureMark({ m, size }: { m: Measure; size: number }) {
  const say = useSay();
  const icon = size >= 80 ? "size-10" : "size-6";
  if (m.kind === "ring") return <ProgressRing value={m.value} max={m.max} shown={say(m.shown)} size={size} label={`${say(m.shown)} ${say(m.label)}`} />;
  if (m.kind === "badge")
    return (
      <span role="img" aria-label={say(m.text)} className={cn(m.yes ? TILE : "flex shrink-0 items-center justify-center border-2 border-(--land-line) text-muted-foreground", FADE, "rounded-full")} style={{ width: size, height: size }}>
        {m.yes ? <BadgeCheckIcon aria-hidden className={icon} /> : m.open ? <ScaleIcon aria-hidden className={icon} /> : <CircleXIcon aria-hidden className={icon} />}
      </span>
    );
  return (
    <span role="img" aria-label={say(m.text)} className={cn(FADE, "flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-(--land-line) text-muted-foreground")} style={{ width: size, height: size }}>
      <CircleDashedIcon aria-hidden className={icon} />
    </span>
  );
}
