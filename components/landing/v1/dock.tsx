"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { cn } from "cn";

// A row of tiles that swell as the pointer passes over them, the nearest most, pushing their
// neighbours aside (a magnifying dock). Keyboard focus swells a tile the same way. Each tile is a
// button; its name shows above it while it is magnified.

const BASE = 44;
const PEAK = 76;
const REACH = 140;

export type DockItem = { id: string; label: string; monogram: string; caption: string; tone?: "official" | "reported" | "person" };

export function Dock({ items, onPick, className }: { items: DockItem[]; onPick: (id: string) => void; className?: string }) {
  const mouseX = useMotionValue(Infinity);
  return (
    <div
      onPointerMove={(e) => e.pointerType === "mouse" && mouseX.set(e.clientX)}
      onPointerLeave={() => mouseX.set(Infinity)}
      className={cn("mx-auto flex h-[92px] w-fit max-w-full items-end gap-2 overflow-x-auto rounded-2xl bg-white/6 px-3 pb-3 ring-1 ring-white/12 [scrollbar-width:none]", className)}
    >
      {items.map((item) => (
        <Tile key={item.id} item={item} mouseX={mouseX} onPick={onPick} />
      ))}
    </div>
  );
}

function Tile({ item, mouseX, onPick }: { item: DockItem; mouseX: MotionValue<number>; onPick: (id: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const distance = useTransform(mouseX, (x) => {
    const r = ref.current?.getBoundingClientRect();
    return r ? x - (r.left + r.width / 2) : Infinity;
  });
  const target = useTransform(distance, [-REACH, 0, REACH], [BASE, PEAK, BASE]);
  const size = useSpring(target, { mass: 0.12, stiffness: 180, damping: 14 });
  const label = useTransform(size, [BASE, PEAK], [0, 1]);
  const lift = useTransform(size, [BASE, PEAK], [6, 0]);

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={() => onPick(item.id)}
      onFocus={() => {
        const r = ref.current?.getBoundingClientRect();
        if (r) mouseX.set(r.left + r.width / 2);
      }}
      onBlur={() => mouseX.set(Infinity)}
      aria-label={`${item.label}: ${item.caption}`}
      style={reduce ? { width: BASE, height: BASE } : { width: size, height: size }}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-[28%] font-heading text-[0.7rem] font-semibold tracking-tight shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-amber/70",
        item.tone === "reported" ? "bg-white/85 text-brand" : item.tone === "person" ? "bg-[#cdc6ff] text-brand" : "bg-white text-brand",
      )}
    >
      <span className="pointer-events-none select-none">{item.monogram}</span>
      <motion.span
        aria-hidden
        style={{ opacity: label, y: lift }}
        className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-white px-2 py-1 font-sans text-[0.7rem] font-medium whitespace-nowrap text-brand shadow-md"
      >
        {item.label}
        <span className="ml-1 text-brand/60">{item.caption}</span>
      </motion.span>
    </motion.button>
  );
}
