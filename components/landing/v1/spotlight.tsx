"use client";

import { useRef } from "react";

/**
 * A soft light that follows the pointer across a card, brightest on the card's edge. The card needs
 * `relative` and spreads the handlers; the light is two layers written to directly (no state, no
 * re-render). Mouse and trackpad only.
 */
export function useSpotlight() {
  const fill = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || !fill.current || !edge.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const at = `${Math.round(e.clientX - r.left)}px ${Math.round(e.clientY - r.top)}px`;
    fill.current.style.background = `radial-gradient(380px circle at ${at}, color-mix(in oklab, var(--color-primary) 9%, transparent), transparent 70%)`;
    edge.current.style.background = `radial-gradient(240px circle at ${at}, color-mix(in oklab, var(--color-primary) 55%, transparent), transparent 70%)`;
    fill.current.style.opacity = "1";
    edge.current.style.opacity = "1";
  };
  const onPointerLeave = () => {
    if (fill.current) fill.current.style.opacity = "0";
    if (edge.current) edge.current.style.opacity = "0";
  };

  const overlay = (
    <>
      <div ref={fill} aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300" />
      {/* The same light, masked to a 1px ring: the card's edge lights up near the pointer. */}
      <div
        ref={edge}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] p-px opacity-0 transition-opacity duration-300 [mask-composite:exclude] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)]"
      />
    </>
  );

  return { onPointerMove, onPointerLeave, overlay };
}
