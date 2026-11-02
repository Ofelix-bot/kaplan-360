"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";

/**
 * A number that counts to its value: from zero the first time it scrolls into view, then from its
 * last value whenever the value changes, so a change reads as a change. Reduced motion shows the
 * value at once.
 */
export function Count({ value, format, className, duration = 0.7 }: { value: number; format?: (n: number) => string; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (n) => (format ? format(Math.round(n)) : Math.round(n).toLocaleString("en-SG")));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    if (!inView) return;
    const controls = animate(mv, value, { duration, ease: [0.23, 1, 0.32, 1] });
    return () => controls.stop();
  }, [value, inView, reduce, mv, duration]);

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}
