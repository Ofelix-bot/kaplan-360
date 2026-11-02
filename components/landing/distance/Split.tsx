"use client";

import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { LOOK as COPY } from "@/content/landing.en";
import { Eyebrow } from "../Eyebrow";
import { Settle } from "../Settle";
import { ThreeRoads } from "./PathsA";

// 01 · Break it down (/move#look): after graduation, three roads. The step, the heading and its one line
// on the left; on the right the picture of one road branching into Work, Study and Gap (./PathsA.tsx
// ThreeRoads), on its 14s loop while on screen (held by the site's pause; drawn and still with reduced
// motion). The roads' own screens follow (components/landing/roads); the six doors this section once
// showed as cards now sit in their road's drawer (./CardsB.tsx DoorList). With JS off the picture is
// drawn (NOSCRIPT).

/** JS off: the picture drawn, every end and name shown. */
const NOSCRIPT = "<style>.move-page [data-branch] :is(path,circle,text){opacity:1!important;stroke-dasharray:none!important;transform:none!important}</style>";

/** `sub`: the line under the heading (the English page has its own, and a wider measure for it); `stepClassName`: the step number's colour. */
export function LookSection({ sub = COPY.body, stepClassName, subClassName = "max-w-[30rem]" }: { sub?: string; stepClassName?: string; subClassName?: string }) {
  const t = useT();
  return (
    <section id="look" aria-labelledby="look-title" className="scroll-mt-16 bg-(--land-ground) py-20 sm:py-28">
      <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT }} />
      <div className="home-wrap grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-14">
        <Settle className="flex min-w-0 flex-col gap-3">
          <Eyebrow step={COPY.step} stepClassName={stepClassName} />
          <h2 id="look-title" className="m-0 min-w-0 font-heading text-[clamp(40px,5.6vw,88px)] [font-stretch:var(--display-stretch)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance wrap-break-word">
            {t(COPY.title)}
          </h2>
          <p className={cn("m-0 mt-2 font-heading text-[20px] [font-stretch:var(--display-stretch)] leading-snug font-bold text-balance break-keep text-(--brand-ink) sm:text-[24px]", subClassName)}>{t(sub)}</p>
        </Settle>
        <div data-branch className="relative aspect-[5/3] w-full max-w-[520px] justify-self-center text-(--text) md:justify-self-end">
          <ThreeRoads roads={COPY.roads.map((r) => t(r))} start={t(COPY.start)} label={t(COPY.figure)} loop />
        </div>
      </div>
    </section>
  );
}
