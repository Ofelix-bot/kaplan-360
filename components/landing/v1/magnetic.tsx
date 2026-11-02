"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cn } from "cn";

/**
 * A button that leans towards the pointer when it comes near, and springs back when it leaves. Only
 * with a mouse or trackpad; still for touch and for reduced motion. The wrapper's padding is the
 * "near" zone, so the layout doesn't move.
 */
export function Magnetic({ children, strength = 0.3, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.5 });

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <span className={cn("-m-5 inline-flex p-5", className)} onPointerMove={onMove} onPointerLeave={reset}>
      <motion.span ref={ref} className="inline-flex" style={{ x: sx, y: sy }}>
        {children}
      </motion.span>
    </span>
  );
}
