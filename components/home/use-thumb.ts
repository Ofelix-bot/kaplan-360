"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * The sliding highlight of a segmented control: the selected segment's position and width go on the
 * bar as CSS variables, and a transition moves the highlight from wherever it is now (so a quick
 * second tap re-targets mid-flight). It snaps into place the first time, without animating.
 */
export function useThumb<T extends HTMLElement>(selected: unknown) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const place = () => {
      const on = bar.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!on) return;
      bar.style.setProperty("--thumb-x", `${on.offsetLeft}px`);
      bar.style.setProperty("--thumb-w", `${on.offsetWidth}px`);
      bar.classList.add("has-thumb");
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(bar);
    const frame = requestAnimationFrame(() => bar.classList.add("thumb-ready"));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [selected]);
  return ref;
}
