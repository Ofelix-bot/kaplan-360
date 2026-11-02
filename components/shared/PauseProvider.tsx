"use client";

import { useEffect } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

// The site's loops (the two particle canvases, the #why chats, the bento tiles, the receipts ticker, Kappy) stop only
// when the system asks for reduced motion. The visitor-facing "Pause animations" switch was removed on 2026-11-02:
// animations always play otherwise. `usePaused()` reads false in the static HTML and during hydration, so the markup
// matches. The provider mirrors the state on <html data-paused> for CSS loops.

/** True when the system asks for reduced motion; false on the server and at hydration. */
export function usePaused(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** Mounted once in the root layout: keeps <html data-paused> in step for CSS-driven loops. */
export function PauseProvider({ children }: { children: React.ReactNode }) {
  const paused = usePaused();
  useEffect(() => {
    const root = document.documentElement;
    if (paused) root.dataset.paused = "true";
    else delete root.dataset.paused;
  }, [paused]);
  return <>{children}</>;
}
