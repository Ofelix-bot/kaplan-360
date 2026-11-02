"use client";

import { useCallback, useEffect, useRef } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { ROADS, ROADS_SECTION, type RoadId } from "@/content/roads.en";
import type { SceneModule } from "./engine";
import { RoadScreen } from "./RoadCard";
import { gap } from "./scenes/gap";
import { study } from "./scenes/study";
import { work } from "./scenes/work";

// /move's roads section (#roads), right after 01 Break it down: one screen per road (./RoadCard.tsx
// RoadScreen: #work, #study, #gap). The section's heading, "Work. Study. Gap.", is for screen readers
// only: 01 names the three on screen. Each road's art is a scene module (./scenes/<road>.ts,
// implementing SceneModule in ./engine.ts); Qualify's scene stays on disk, no longer used (its content
// is Gap's now). Client side, since scenes are functions.
// A deep link (/move#gap) is scrolled to by the browser before the art mounts. The cards' boxes are
// held from the server render, and once every card's canvas is sized, the page scrolls to the link's
// target once more (sections above may have settled since), unless the visitor has scrolled.

const SCENES: Partial<Record<RoadId, SceneModule>> = { work, study, gap };
const MOUNTED = ROADS.filter((r) => SCENES[r.id]).length;

/** `checks`: the English page's text beside each road (what Kaplan 360++ checks on it, ./RoadCard.tsx RoadChecks). */
export function Roads({ checks = false }: { checks?: boolean }) {
  const t = useT();
  const done = useRef(new Set<RoadId>());
  const moved = useRef(false);

  useEffect(() => {
    const stop = () => {
      moved.current = true;
    };
    const kinds = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    kinds.forEach((k) => window.addEventListener(k, stop, { passive: true, once: true }));
    return () => kinds.forEach((k) => window.removeEventListener(k, stop));
  }, []);

  const onLaidOut = useCallback((road: RoadId) => {
    if (done.current.size === MOUNTED) return;
    done.current.add(road);
    if (done.current.size !== MOUNTED || moved.current || !location.hash) return;
    let id = location.hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {}
    const el = document.getElementById(id);
    // With the page's own scroll behaviour: the browser's smooth scroll to the link may still be running,
    // and a smooth scroll started now takes it over (an instant jump would be added to it).
    if (el && !moved.current) el.scrollIntoView({ block: "start" });
  }, []);

  return (
    <section id="roads" aria-labelledby="roads-title" className="scroll-mt-16 bg-(--land-ground) text-(--text)">
      <h2 id="roads-title" className="sr-only">
        {t(ROADS_SECTION.headline)}
      </h2>
      {ROADS.map((road) => {
        const scene = SCENES[road.id];
        return scene ? <RoadScreen key={road.id} road={road} scene={scene} onLaidOut={onLaidOut} checks={checks} /> : null;
      })}
    </section>
  );
}
