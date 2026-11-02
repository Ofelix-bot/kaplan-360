"use client";

import Link from "@/components/i18n/Link";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { CLOSING as COPY } from "@/content/landing.en";
import { DECIDE } from "@/content/move.en";
import { getReadCount } from "@/lib/read-count";
import { Eyebrow } from "../Eyebrow";
import { InfoTip } from "../move/InfoTip";
import { DrawerPart, MoveDrawer } from "../move/MoveDrawer";
import { Settle } from "../Settle";
import { useDay } from "../receipts";

// Step 03 · Lay it out on the Chinese pages (/zh-hans/move#decide; the English page has
// ../move/LayItOut.tsx): the map of your roads and the month-by-month timeline. On the left, an inset card in the brand colour with every page and API read behind the site and
// their dates (data/raw/read-count.json), and a small link to how we count them (/declaration#built). On the
// right, the step, the heading with an info tip on what the step gives you (../move/InfoTip.tsx; the
// pages figure has one on what holds every number) and the "Coming next" drawer (CV wording help and
// email updates, both planned). The way on is the closing band after it
// (../move/StartBand.tsx), the page's only call to action.

/**
 * The inset card in the brand colour: every page and API read behind the site, from the first read to the
 * latest, with a link to how we count them. `tip`: the info tip on what holds every number (the English
 * page's Sources says it in its steps, so leaves it out).
 */
export function PagesCard({ tip = true }: { tip?: boolean }) {
  const t = useT();
  const day = useDay();
  const locale = useIntlLocale();
  const reads = getReadCount();
  return (
    <div className="on-dark relative isolate flex min-h-[360px] flex-col justify-end overflow-hidden rounded-3xl bg-(--tile-brand) p-8 text-white sm:min-h-[440px] sm:p-12">
      {/* A road through the card, with one stop on it: decorative. */}
      <svg aria-hidden viewBox="0 0 640 520" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 -z-10 size-full">
        {/* Across the card's empty top third, clear of the figure. */}
        <path d="M-20 40 C 180 160, 380 170, 680 150" fill="none" stroke="var(--accent)" strokeWidth={2.5} />
        <circle cx={262} cy={138} r={8} fill="var(--tile-brand)" stroke="var(--accent)" strokeWidth={2.5} />
      </svg>
      {/* Six figures and a separator: sized to fit the card's width at every breakpoint. */}
      <p className="m-0 font-heading text-[clamp(56px,7.4vw,112px)] [font-stretch:var(--display-stretch)] leading-[0.85] font-extrabold tracking-[-0.03em] whitespace-nowrap tabular-nums">
        {reads.total.toLocaleString(locale)}
      </p>
      <p className="m-0 mt-4 flex items-center gap-1 text-[17px] text-pretty text-(--land-night-body) sm:text-lg">
        {t(DECIDE.reads, { from: day(reads.first), to: day(reads.latest) })}
        {tip && <InfoTip label={t(DECIDE.sources)} text={t(DECIDE.receipts)} tone="night" />}
      </p>
      <Link
        href="/declaration#built"
        className="mt-3 w-fit rounded-sm text-[13px] font-semibold text-(--land-night-body) underline decoration-current/40 underline-offset-4 outline-none hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid"
      >
        {t(DECIDE.count)}
      </Link>
    </div>
  );
}

export function DecideSection() {
  const t = useT();

  return (
    <section id="decide" aria-labelledby="decide-title" className="scroll-mt-16 bg-(--land-ground) py-20 sm:py-28">
      <div className="home-wrap grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-stretch md:gap-14">
        <PagesCard />

        <div className="flex flex-col justify-center py-4 md:py-10">
          <Settle className="flex flex-col gap-4">
            <Eyebrow step={COPY.step} />
            <div className="flex items-center gap-2">
              <h2 id="decide-title" className="m-0 min-w-0 font-heading text-[clamp(40px,5.6vw,88px)] [font-stretch:var(--display-stretch)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance wrap-break-word">
                {t(COPY.title)}
              </h2>
              <InfoTip label={t(DECIDE.about)} text={t(DECIDE.body)} side="bottom" />
            </div>
            <p className="m-0 mt-2 max-w-[30rem] font-heading text-[20px] [font-stretch:var(--display-stretch)] leading-snug font-bold text-balance text-(--brand-ink) sm:text-[24px]">{t(DECIDE.sub)}</p>
          </Settle>
          {/* The trigger and its status tag; the tag drops under the trigger where they don't fit side by side. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <MoveDrawer trigger={t(DECIDE.next.trigger)} title={t(DECIDE.next.title)}>
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {DECIDE.next.items.map((item) => (
                <li key={item.title}>
                  <DrawerPart>
                    <p className="m-0 flex flex-wrap items-center gap-2 text-[15px] font-bold">
                      {t(item.title)}
                      <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[12px] font-medium text-muted-foreground">{t(DECIDE.next.planned)}</span>
                    </p>
                    <p className="m-0 text-[13px] leading-snug text-pretty text-muted-foreground">{t(item.body)}</p>
                  </DrawerPart>
                </li>
              ))}
            </ul>
          </MoveDrawer>
          <span className="rounded-full bg-(--land-tint) px-2.5 py-0.5 text-[12px] leading-5 font-medium text-(--muted) select-none">{t(DECIDE.next.soon)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
