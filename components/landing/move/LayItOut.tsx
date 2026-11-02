"use client";

import { useT } from "@/components/i18n/I18nProvider";
import { CLOSING as COPY } from "@/content/landing.en";
import { DECIDE, PLANNED, ROAD_CHECKS } from "@/content/move.en";
import { Eyebrow } from "../Eyebrow";
import { Settle } from "../Settle";

// 03 · Lay it out on the English /move (#decide): the step, the heading and its line on the left; on the
// right a card with what is planned (a map of your roads, the timeline, taking it away) and "Coming soon".
// The pages card that sat here is in Sources now (./SourcesSection.tsx).

export function LayItOut() {
  const t = useT();
  return (
    <section id="decide" aria-labelledby="decide-title" className="scroll-mt-16 bg-(--land-ground) py-20 sm:py-28">
      <div className="home-wrap grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,480px)] md:items-center md:gap-14">
        <Settle className="flex min-w-0 flex-col gap-4">
          <Eyebrow step={COPY.step} stepClassName="text-(--accent-ink)" />
          <h2 id="decide-title" className="m-0 min-w-0 font-heading text-[clamp(40px,5.6vw,88px)] [font-stretch:var(--display-stretch)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance wrap-break-word">
            {t(COPY.title)}
          </h2>
          <p className="m-0 mt-2 max-w-[36rem] font-heading text-[20px] [font-stretch:var(--display-stretch)] leading-snug font-bold text-balance text-(--brand-ink) sm:text-[24px]">{t(DECIDE.sub)}</p>
        </Settle>
        <div className="min-w-0 rounded-3xl border border-solid border-(--land-line) bg-(--land-card) p-7 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="m-0 font-heading text-[22px] [font-stretch:var(--display-stretch)] leading-tight font-bold sm:text-[24px]">{t(PLANNED.title)}</h3>
            <span className="rounded-full bg-(--land-check-bg) px-3 py-1 text-[12px] leading-5 font-semibold text-(--land-check)">{t(ROAD_CHECKS.soon)}</span>
          </div>
          <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
            {PLANNED.items.map((item) => (
              <li key={item} className="flex gap-3 text-[16px] leading-[1.6] text-pretty text-(--land-body)">
                <span aria-hidden className="mt-[9px] size-2 shrink-0 rounded-full bg-[#c9c1ec]" />
                {t(item)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
