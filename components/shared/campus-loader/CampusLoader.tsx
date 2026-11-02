"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { usePaused } from "@/components/shared/PauseProvider";
import type { CampusScene } from "./scene";

// The site's loading picture: Kaplan City Campus @ Wilkie Edge as a moving pixel scene (./scene.js),
// above the loading line and the campus's name. The line is there at once, as before; the scene comes in
// only when loading takes longer than DELAY, and its script is fetched only then, so a quick load
// shows no flash and costs nothing. It holds its frame under the site's pause and with reduced motion
// (usePaused). Styles: globals.css .campus-loader (every page has them, whether or not it loads ui.css).

const DELAY = 300;

export function CampusLoader({ label, className }: { label: string; className?: string }) {
  const t = useT();
  const paused = usePaused();
  const [shown, setShown] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<CampusScene | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    const id = setTimeout(() => setShown(true), DELAY);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!shown || !el) return;
    let gone = false;
    void import("./scene").then(({ mountCampus }) => {
      if (!gone) scene.current = mountCampus(el, { paused: pausedRef.current });
    });
    return () => {
      gone = true;
      scene.current?.destroy();
      scene.current = null;
    };
  }, [shown]);

  useEffect(() => {
    pausedRef.current = paused;
    scene.current?.setPaused(paused);
  }, [paused]);

  return (
    <div aria-busy="true" className={cn("campus-loader", className)} data-shown={shown || undefined}>
      <canvas ref={canvas} aria-hidden className="campus-loader-scene" />
      <p role="status" className="campus-loader-label">
        {label}
      </p>
      <p aria-hidden className="campus-loader-place">
        {t("Kaplan City Campus @ Wilkie Edge · 8 Wilkie Road")}
      </p>
    </div>
  );
}
