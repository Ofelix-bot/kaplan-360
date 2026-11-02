"use client";

import { useEffect, useMemo, useRef } from "react";
import { animate, cancelFrame, cubicBezier, easeOut, frame, useMotionValue, useTransform, type EasingFunction, type FrameData, type MotionValue } from "motion/react";
import { useMediaQuery } from "@/lib/use-media-query";
import { EASE_WALK } from "./timings";

// The opening's clocks. Each sequence runs on one MotionValue in seconds; every part of it is a
// keyframe function of that value (useTransform), so the parts can't drift apart, a loop can be held
// at a moment, and reduced motion is the clock stopped at the end.

export const walk = cubicBezier(...EASE_WALK);
export const appear = easeOut;
const still = (x: number) => x;

/** Whether the visitor asked for less motion. False in the static HTML, so hydration matches it. */
export const useReduce = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** A clock that runs once from 0 to `end` when `start` turns true; with reduced motion it is at `end` at once. */
export function useOnce(end: number, start: boolean, reduce: boolean) {
  const t = useMotionValue(0);
  useEffect(() => {
    if (reduce) {
      t.jump(end);
      return;
    }
    if (!start) return;
    const run = animate(t, end, { duration: end - t.get(), ease: "linear" });
    return () => run.stop();
  }, [t, end, start, reduce]);
  return t;
}

/**
 * A loop's clock in seconds, 0 → `loop` and round again, advanced every frame while `running` (and
 * only then: no frame callback otherwise). `hold` stops it, optionally jumping to a moment; `holdAt`
 * lets it run on to a moment and stop there; `release` lets it go on; `rewind` sends it back to 0.
 */
export function useLoop(loop: number, running: boolean) {
  const t = useMotionValue(0);
  const state = useRef({ held: false, until: null as number | null });
  useEffect(() => {
    if (!running) return;
    const tick = ({ delta }: FrameData) => {
      const s = state.current;
      if (s.held) return;
      const next = t.get() + delta / 1000;
      if (s.until !== null && next >= s.until) {
        t.set(s.until);
        s.held = true;
        s.until = null;
      } else t.set(next % loop);
    };
    frame.update(tick, true);
    return () => cancelFrame(tick);
  }, [t, loop, running]);
  return useMemo(
    () => ({
      t,
      hold: (at?: number) => {
        state.current.held = true;
        state.current.until = null;
        if (at !== undefined) t.set(at);
      },
      holdAt: (at: number) => {
        state.current.held = false;
        state.current.until = at;
      },
      release: () => {
        state.current.held = false;
        state.current.until = null;
      },
      rewind: () => t.jump(0),
    }),
    [t],
  );
}

/**
 * One value through keyframes on a clock: `at` are the clock's times (seconds), `to` the values,
 * `ease` one easing per stretch between them (one for all if a single function is given).
 */
export function useKeys(t: MotionValue<number>, at: readonly number[], to: readonly number[], ease: EasingFunction | EasingFunction[] = still) {
  return useTransform(t, [...at], [...to], { ease: Array.isArray(ease) ? ease : at.slice(1).map(() => ease) });
}

/** A loop fraction (or fractions) in seconds. */
export const sec = (loop: number, f: number) => f * loop;
