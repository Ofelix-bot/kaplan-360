"use client";

import { useEffect, useRef } from "react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { mountScene } from "@/components/landing/roads/engine";
import { usePaused } from "@/components/shared/PauseProvider";
import { Fn } from "@/components/shared/receipt";
import { DRAFT } from "@/content/draft";
import type { ReceiptView } from "@/lib/receipts/model";
import { levelsScene } from "./art/levels-scene";

// What "Level 3/6" on a skill means (2026-11-02), between the hot roles and their sources: on the left the
// pixel pyramid (./art/levels-scene.ts, on the /move scenes' engine: it runs only on screen, holds under
// "Pause animations", shows its final frame with reduced motion); on the right the six levels, 6 at the top
// as on the pyramid, each with SWDA's own words for it (the Responsibility column of the general descriptors
// for TSC proficiency levels) and the complexity it names. The section's ReceiptSection lists LEVELS_RECEIPT.

const C = DRAFT.careers.levels;

export const LEVELS_RECEIPT: ReceiptView = {
  id: "swda-tsc-levels",
  kind: "official",
  quote:
    "6 Accountable for significant area of work, strategy or overall direction … Complex · 5 Accountable for achieving assigned objectives, decisions made by self and others … Complex · 4 Work under broad direction Hold accountability for performance of self and others … Less routine · 3 Work under broad direction May hold some accountability for performance of others, in addition to self … Less routine · 2 Work with some supervision … Routine · 1 Work under direct supervision … Routine",
  mark: [],
  quoteKind: "table-text",
  publisher: "SkillsFuture Singapore (SSG)",
  title: "Skills Framework for Social Service: General Descriptors for Technical Skills and Competencies (TSCs)",
  published: "Jan 2019",
  read: "2026-11-02",
  url: "https://sasw.org.sg/wp-content/uploads/2024/01/Skills-Framework-for-Social-Service.pdf",
  host: "sasw.org.sg",
  where: "p. 99, Responsibility and Complexity columns",
  shot: null,
  match: "word-for-word",
  note: "SSG's guide as hosted by the Singapore Association of Social Workers: skillsfuture.gov.sg answers automated reads with a check page. Every Skills Framework guide prints the same table.",
};

/** Level 6 at the top, as on the pyramid: SWDA's words and the complexity it names. */
const ROWS = [
  { n: 6, words: C.l6, complexity: C.complex, swatch: "#5f2ea0" },
  { n: 5, words: C.l5, complexity: C.complex, swatch: "#6f45b6" },
  { n: 4, words: C.l4, complexity: C.lessRoutine, swatch: "#8f6fcf" },
  { n: 3, words: C.l3, complexity: C.lessRoutine, swatch: "#b29ae0" },
  { n: 2, words: C.l2, complexity: C.routine, swatch: "#c7b8ef" },
  { n: 1, words: C.l1, complexity: C.routine, swatch: "#dcd2f6" },
] as const;

/** The pyramid's tallest on screen, CSS px: its 192 px at 2 CSS px a pixel. */
const ART_MAX_H = 384;

function LevelsArt({ className }: { className?: string }) {
  const t = useT();
  const paused = usePaused();
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const loop = useRef<ReturnType<typeof mountScene>["loop"] | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    if (!canvas.current || !host.current) return;
    const m = mountScene(canvas.current, host.current, levelsScene, () => box.current?.setAttribute("data-ready", ""), { maxH: ART_MAX_H, paused: pausedRef.current });
    loop.current = m.loop;
    return () => {
      loop.current = null;
      m.destroy();
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    loop.current?.setPaused(paused);
  }, [paused]);

  const reserve = { "--lv-ar": `${levelsScene.logicalW} / ${levelsScene.logicalH}`, "--lv-w": `${2 * levelsScene.logicalW}px` } as React.CSSProperties;
  return (
    <figure className={cn("m-0 min-w-0", className)}>
      <div ref={host} className="flex w-full justify-center">
        <div ref={box} style={reserve} className="relative aspect-(--lv-ar) w-full max-w-(--lv-w) data-ready:aspect-auto data-ready:w-auto data-ready:max-w-none">
          {/* The engine sets the canvas's size. */}
          <canvas ref={canvas} role="img" aria-label={t(C.figure)} className="block h-0 w-0 [image-rendering:pixelated]" />
        </div>
      </div>
    </figure>
  );
}

export function SkillLevels({ className }: { className?: string }) {
  const t = useT();
  return (
    <section aria-labelledby="cr-levels-title" className={cn("grid items-center gap-8 rounded-2xl bg-(--land-card) p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-10", className)}>
      <LevelsArt />
      <div className="flex min-w-0 flex-col gap-4">
        <h3 id="cr-levels-title" className="m-0 font-heading text-[clamp(20px,2vw,26px)] [font-stretch:var(--display-stretch)] leading-[1.15] font-bold text-(--text)">
          {t(C.title)}
          <Fn id={LEVELS_RECEIPT.id} />
        </h3>
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
          {ROWS.map((r) => (
            <li key={r.n} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap text-(--text) tabular-nums">
                <span aria-hidden className="size-2.5 rounded-sm" style={{ background: r.swatch }} />
                {t(C.level, { n: r.n })}
              </span>
              <span className="text-[14px] leading-snug text-(--land-body)">
                {t(r.words)} <span className="text-[12px] font-medium whitespace-nowrap text-(--text)">· {t(r.complexity)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
