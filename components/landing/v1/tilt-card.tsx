"use client";

import { useRef } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cn } from "cn";

/**
 * A card that tilts in 3D towards the pointer, with a soft light where the pointer is. Mouse and
 * trackpad only; flat for touch and for reduced motion.
 */
export function TiltCard({ children, className, max = 7 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 170, damping: 18 });
  const ry = useSpring(0, { stiffness: 170, damping: 18 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(0);
  const glare = useSpring(0, { stiffness: 200, damping: 30 });
  const light = useMotionTemplate`radial-gradient(420px circle at ${gx}% ${gy}%, rgb(255 255 255 / 0.16), transparent 60%)`;

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 2 * max);
    rx.set(-(py - 0.5) * 2 * max);
    gx.set(px * 100);
    gy.set(py * 100);
    glare.set(1);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
    glare.set(0);
  };

  return (
    <div className="[perspective:1000px]">
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={reset}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className={cn("relative will-change-transform", className)}
      >
        {children}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: light, opacity: glare }} />
      </motion.div>
    </div>
  );
}
