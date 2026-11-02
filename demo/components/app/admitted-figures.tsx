"use client"

import { cn } from "cn"
import { motion } from "motion/react"

import { gpa as formatGpa, percent } from "@/lib/format"
import { MIX_GROUPS } from "@/lib/labels"
import { transitions } from "@/lib/motion"
import type { MixGroup, Spread } from "@/lib/types"

const GPA_MIN = 2.5
const GPA_MAX = 4
const TICKS = [2.5, 3, 3.5, 4]

const at = (value: number) =>
  Math.min(100, Math.max(0, ((value - GPA_MIN) / (GPA_MAX - GPA_MIN)) * 100))

/** Literal class names, so Tailwind sees them. */
export const MIX_BG: Record<MixGroup, string> = {
  "985": "bg-mix-985",
  "211": "bg-mix-211",
  other: "bg-mix-other",
  qs50: "bg-mix-qs50",
  qs300: "bg-mix-qs300",
  qsRest: "bg-mix-qsRest",
}

function describe(spread: Spread, mine: number | null) {
  const band = `middle 80% of admitted GPAs ${formatGpa(spread.p10)} to ${formatGpa(spread.p90)}, median ${formatGpa(spread.median)}`
  return mine === null ? band : `${band}; yours ${formatGpa(mine)}`
}

/**
 * Admitted GPAs on a 2.0–4.0 axis: the middle 80% (p10–p90) light, the middle half darker,
 * the median as a line, and the student's own GPA in amber when they have entered one.
 */
export function GpaBand({
  spread,
  mine,
  size = "sm",
}: {
  spread: Spread
  mine: number | null
  size?: "sm" | "lg"
}) {
  const large = size === "lg"
  const grow = { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition: transitions.enter }
  const bar = (
    <div
      role="img"
      aria-label={describe(spread, mine)}
      className={cn("relative", large ? "h-3" : "h-1.5")}
    >
      <div className="absolute inset-0 rounded-full bg-muted" />
      <motion.div
        {...grow}
        className="absolute inset-y-0 rounded-full bg-primary/20"
        style={{
          left: `${at(spread.p10)}%`,
          width: `${at(spread.p90) - at(spread.p10)}%`,
          originX: 0,
        }}
      />
      <motion.div
        {...grow}
        className="absolute inset-y-0 rounded-full bg-primary/55"
        style={{
          left: `${at(spread.p25)}%`,
          width: `${Math.max(at(spread.p75) - at(spread.p25), 1)}%`,
          originX: 0,
        }}
      />
      <div
        className="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-primary"
        style={{ left: `${at(spread.median)}%` }}
      />
      {mine !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -inset-y-1 w-1 -translate-x-1/2 rounded-full bg-amber ring-2 ring-background"
          style={{ left: `${at(mine)}%` }}
        />
      )}
    </div>
  )
  if (!large) return bar

  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-4 text-[11px] leading-4 tabular-nums">
        <span
          className="absolute -translate-x-1/2 font-medium whitespace-nowrap text-foreground"
          style={{ left: `${Math.min(88, Math.max(12, at(spread.median)))}%` }}
        >
          Median {formatGpa(spread.median)}
        </span>
      </div>
      {bar}
      <div className="relative h-4 text-[11px] leading-4 text-muted-foreground tabular-nums">
        {TICKS.map((tick, i) => (
          <span
            key={tick}
            className={cn(
              "absolute",
              i === 0 ? "" : i === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2"
            )}
            style={{ left: `${at(tick)}%` }}
          >
            {tick.toFixed(1)}
          </span>
        ))}
      </div>
      {mine !== null && (
        <p className="text-xs text-muted-foreground">
          <span className="mr-1.5 inline-block size-2 rounded-full bg-amber align-middle" />
          Your GPA {formatGpa(mine)}
        </p>
      )}
    </div>
  )
}

/** First-degree backgrounds of the admits as one bar, with the shares listed below it. */
export function MixBar({ mix }: { mix: Record<MixGroup, number> }) {
  const total = MIX_GROUPS.reduce((sum, g) => sum + mix[g.id], 0)
  if (!total) return null
  const present = MIX_GROUPS.filter((g) => mix[g.id] > 0)
  return (
    <div className="flex flex-col gap-2">
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={transitions.enter}
        style={{ originX: 0 }}
        className="flex h-3 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={present
          .map((g) => `${g.label} ${percent(mix[g.id], total)}%`)
          .join(", ")}
      >
        {present.map((g) => (
          <div
            key={g.id}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", MIX_BG[g.id])}
            style={{ width: `${(mix[g.id] / total) * 100}%` }}
          />
        ))}
      </motion.div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {MIX_GROUPS.map((g) => (
          <li
            key={g.id}
            className={cn("flex items-center gap-1.5", !mix[g.id] && "text-muted-foreground")}
          >
            <span className={cn("size-2 shrink-0 rounded-full", MIX_BG[g.id])} />
            <span className="truncate">{g.label}</span>
            <span className="ml-auto tabular-nums">{percent(mix[g.id], total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
