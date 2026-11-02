"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Seam } from "@/components/shared/Seam";
import { ReceiptSection, SourceList } from "@/components/shared/receipt";
import { DRAFT } from "@/content/draft";
import { fromFact, type ReceiptView } from "@/lib/receipts/model";
import type { IndustryFull, IndustryNowStat, Region } from "@/lib/careers/types";
import { pickRegion, useCareersRegion } from "./RegionToggle";
import { Stat } from "./Stat";

// "<Industry> now" (Q12, Q17, C3, C4): the page's one dark band, full width on --land-night with .on-dark,
// joined to the light ground by a seam before and after. Up to four receipted figures of the chosen region
// (only sentence, table-row and xlsx-row facts reach career_industry_now, C4). A region with fewer than four
// shrinks the grid and says why; nothing is ever filled in, and a region's view never borrows Singapore's
// figures. With no figure at all for the region shown, the band is left out. The section's sources follow
// the stats. Changing region crossfades the grid (opacity only); the first render and reduced motion show
// the figures at once, so nothing waits on scripts.

const C = DRAFT.careers;

/** Columns from md up, one per stat; phones show two by two. */
const COLS: Record<number, string> = {
  1: "grid-cols-1 md:max-w-[360px]",
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

/** Which regions have at least one figure for this industry. Singapore is always offered. */
export function regionsOf(industry: Pick<IndustryFull, "now">): Record<Region, boolean> {
  return {
    singapore: true,
    "asia-pacific": (industry.now["asia-pacific"]?.length ?? 0) > 0,
    global: (industry.now.global?.length ?? 0) > 0,
  };
}

/**
 * Two dark rings (the 2026-11-02 board) that sweep down from the lead into the night band, the second one fainter:
 * they start a little above the seam and sink into the band's own colour, so their foot vanishes into it. Drawn
 * over the seam, decorative; the strokes keep their width however the box stretches.
 */
function NightRing() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 390"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(var(--seam-h)+clamp(72px,11vw,160px))] w-full overflow-visible text-(--land-night)"
    >
      <path d="M-10 8 C280 260 580 380 800 386 C1080 388 1310 240 1450 104" fill="none" stroke="currentColor" strokeWidth={2.5} strokeOpacity={0.55} vectorEffect="non-scaling-stroke" />
      <path d="M-10 60 C260 300 560 394 780 392 C1060 388 1300 250 1450 122" fill="none" stroke="currentColor" strokeWidth={6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function IndustryNow({ industry, receipts }: { industry: IndustryFull; receipts: Record<string, ReceiptView> }) {
  const t = useT();
  const reduce = useReducedMotion();
  const chosen = useCareersRegion((s) => s.region);
  const region = pickRegion(chosen, regionsOf(industry));
  const stats: IndustryNowStat[] = [...(industry.now[region] ?? [])].sort((a, b) => a.slot - b.slot).slice(0, 4);
  if (stats.length === 0) return null;

  const views = stats.map((s) => receipts[s.factId] ?? fromFact(s.fact));
  // Outside Singapore, the region as the reports print it ("Southeast Asia"), once.
  const printed = region === "singapore" ? [] : [...new Set(stats.map((s) => s.fact.regionLabel).filter((l): l is string => !!l))];
  const titleId = `cr-now-${industry.id}`;
  const sectionTitle = t(C.now.title, { industry: industry.short });

  return (
    <>
      <div className="relative">
        <Seam from="var(--land-ground)" to="var(--land-night)" />
        <NightRing />
      </div>
      <section aria-labelledby={titleId} className="on-dark bg-(--land-night) py-16 text-(--land-night-ink) sm:py-24">
        <div className="home-wrap">
          <ReceiptSection receipts={views} title={sectionTitle}>
            <h2 id={titleId} className="m-0 min-w-0 font-heading text-[clamp(26px,3vw,40px)] [font-stretch:var(--display-stretch)] leading-[1.1] font-bold tracking-[-0.01em] text-balance wrap-break-word">
              {t.rich(C.now.title, {}, { industry: <span lang="en">{industry.short}</span> })}
            </h2>
            {printed.length > 0 && (
              <p className="m-0 mt-3 text-[15px] leading-[1.5] text-pretty text-(--land-night-body)">{t(C.region.asPrinted, { label: printed.join(", ") })}.</p>
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.ul
                key={region}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.24, ease: "easeOut" }}
                className={cn("m-0 mt-12 grid list-none gap-x-8 gap-y-12 p-0 sm:mt-14 md:gap-x-10", COLS[stats.length])}
              >
                {stats.map((s) => (
                  <Stat key={`${s.region}-${s.slot}`} stat={s} />
                ))}
              </motion.ul>
            </AnimatePresence>
            <SourceList className="mt-14" />
          </ReceiptSection>
        </div>
      </section>
      <Seam from="var(--land-night)" to="var(--land-ground)" />
    </>
  );
}
