"use client";

import { useEffect, useRef } from "react";

/**
 * A number that counts up the first time it scrolls into view and then glides to each new value
 * (a tab change). The server renders the final value; reduced motion shows values without counting.
 */
export default function AnimatedNumber({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = format(value);
      shown.current = value;
      return;
    }
    const run = () => {
      const from = shown.current ?? 0;
      const start = performance.now();
      const duration = shown.current === null ? 700 : 450;
      el.style.opacity = "";
      cancelAnimationFrame(frame.current);
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const v = from + (value - from) * (1 - Math.pow(1 - p, 3));
        el.textContent = format(p < 1 ? v : value);
        shown.current = p < 1 ? v : value;
        if (p < 1) frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    };
    if (shown.current !== null) {
      run();
      return () => cancelAnimationFrame(frame.current);
    }
    // First time: hidden (never a wrong "0") until it is on screen, then counts up.
    el.style.opacity = "0";
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame.current);
      el.style.opacity = "";
    };
    // format is a pure formatter passed inline; the value drives the animation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true" className="tabular">
        {format(value)}
      </span>
      <span className="visually-hidden">{format(value)}</span>
    </span>
  );
}
