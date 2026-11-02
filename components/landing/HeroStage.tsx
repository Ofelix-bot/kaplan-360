"use client";

import { useEffect, useRef } from "react";

// The homepage's hero, at the top of the page: its CSS intro (.hero-motion, globals.css) plays once on
// load. When it has played (about 4.1s) the class comes off, so the hero rests on its final frame: a page
// that Activity hid and shows again (display: none and back would restart every CSS animation) doesn't
// replay it. Keyboard focus coming into the hero shows the final frame at once. The header's colour over
// the hero is set by components/shared/ParticleHero (data-header on <html>).

/** The intro's end: the subtitle's ring and the route line are the last parts (globals.css, 3300ms + 700ms). */
const INTRO_MS = 4100;

export function HeroStage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  /** When this hero first mounted (ms, performance.now); kept while Activity hides the page. */
  const started = useRef<number | null>(null);

  const showWhole = () => {
    // The final frame is the hero's CSS without .hero-motion.
    ref.current?.querySelector(".hero-motion")?.classList.remove("hero-motion");
  };

  useEffect(() => {
    const now = performance.now();
    started.current ??= now;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const left = reduce ? 0 : INTRO_MS - (now - started.current);
    if (left <= 0) {
      showWhole();
      return;
    }
    const id = window.setTimeout(showWhole, left);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div ref={ref} onFocus={showWhole} className="hero-stage">
      {children}
    </div>
  );
}
