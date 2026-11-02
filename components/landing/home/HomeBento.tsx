"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { ArrowSquare } from "@/components/shared/ArrowSquare";
import { ExpandCard } from "@/components/shared/ExpandCard";
import { PauseToggle, usePaused } from "@/components/shared/PauseProvider";
import { DRAFT } from "@/content/draft";
import { HOME } from "@/content/home.en";
import { CARDS, OPENER, type App } from "@/content/landing.en";
import { WHO } from "@/content/move.en";
import type { CoreExample, CoreModel } from "@/lib/home/core-example";
import { exampleHref, openExampleNow } from "@/lib/example-link";
import { ReceiptChip, useDay } from "../receipts";
import { ChatsVisual } from "./tiles/ChatsVisual";
import { CoreVisual } from "./tiles/CoreVisual";
import { DoorsVisual } from "./tiles/DoorsVisual";
import { DotsVisual } from "./tiles/DotsVisual";
import { FormVisual } from "./tiles/FormVisual";
import { GradsVisual } from "./tiles/GradsVisual";
import { ScanVisual } from "./tiles/ScanVisual";

// "Why Kaplan 360++": seven tiles on ExpandCard (components/shared), as the 2026-11-02 board has them, in
// three columns: The problem it solves across the grid (its three questions always shown, the chats on
// the right); Every option (two columns) and Programme scoring; the core algorithm (two columns, two rows:
// the match rate, lib/admit-model.ts) beside How AI is used and Kaplan's graduates (teal); Your privacy
// across the grid. One column under 900px. Every figure comes from data: the pages read and their date
// (lib/changes.ts), the programme count and its date (lib/data/results.ts getProgrammeCount), the worked
// example's match rate and the model's size (lib/home/core-example.ts), the graduates from their receipts
// (content/move.en.ts WHO). The pictures loop in CSS (globals.css .hb-*); they hold while the bento is
// off screen, and show their final frame when the site's pause is on or with reduced motion.
// The earlier tiles' pictures (the receipt, the pipeline, CSCSE) stay in ./tiles, unused.

const H = DRAFT.home;

/** Who sends the Opener's message in app `app` (content/landing.en.ts OPENER). */
const sender = (app: App): string => OPENER.chats.find((x) => x.app === app)?.sender ?? "";
const TILE = HOME.tiles;
/** Wide tiles: the picture fills the right of the tile, the words keep the left (written out whole, for Tailwind). */
const WIDE = "[@media(hover:hover)]:motion-safe:min-[900px]:[&>div:first-child]:top-0 [@media(hover:hover)]:motion-safe:min-[900px]:[&>div:first-child]:h-full";
const WIDE_PROBLEM = "[@media(hover:hover)]:motion-safe:min-[900px]:[&>div:first-child]:left-[56%] [@media(hover:hover)]:motion-safe:min-[900px]:[&>div:nth-child(2)]:max-w-[56%]";
const WIDE_LOOK = "[@media(hover:hover)]:motion-safe:min-[900px]:[&>div:first-child]:left-[36%] [@media(hover:hover)]:motion-safe:min-[900px]:[&>div:nth-child(2)]:max-w-[42%]";
const WIDE_PRIVACY = "[@media(hover:hover)]:motion-safe:min-[900px]:[&>div:first-child]:left-[50%] [@media(hover:hover)]:motion-safe:min-[900px]:[&>div:nth-child(2)]:max-w-[48%]";

type Props = {
  /** Every page and API read behind the site, and the latest read's date (lib/read-count.ts). */
  reads: { n: number; date: string };
  /** Programme scoring: the programmes /results lists and the newest date their pages were checked. */
  programmes: { n: number; checked: string | null } | null;
  /** The core algorithm: the worked example's match rate, and the model's size. */
  core: CoreExample | null;
  model: CoreModel;
};

export function HomeBento({ reads, programmes, core, model }: Props) {
  const t = useT();
  const day = useDay();
  const locale = useIntlLocale();
  const paused = usePaused();
  // Running, holding off screen, or still (paused or reduced motion): read by globals.css (.hb[data-hb]).
  const grid = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = grid.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const num = (n: number) => n.toLocaleString(locale);

  const top = WHO.bars[WHO.bars.length - 1];
  const gradIds = WHO.bars.flatMap((b) => b.receipts);

  const caption = (text: string) => <span className="mt-2 block text-[13px] leading-5 opacity-85">{text}</span>;

  return (
    <section aria-labelledby="why-title" className="home-wrap py-[clamp(56px,8vw,112px)]">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <h2 id="why-title" className="m-0 min-w-0 font-heading text-[clamp(28px,3.4vw,44px)] [font-stretch:var(--display-stretch)] leading-[1.05] font-extrabold tracking-[-0.02em] wrap-break-word text-(--text)">
          {t(HOME.bento.title)}
        </h2>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <PauseToggle className="text-(--muted)" />
          <Link
            href="/move"
            className="inline-flex min-h-11 items-center gap-3 rounded-md font-bold text-(--text) no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring) focus-visible:outline-solid"
          >
            {t(HOME.bento.more)}
            <ArrowSquare />
          </Link>
        </div>
      </div>

      <div
        ref={grid}
        data-hb={paused ? "still" : onScreen ? "run" : "hold"}
        className={cn(
          "hb mt-7 grid grid-cols-1 gap-6",
          "min-[900px]:grid-cols-[repeat(3,minmax(0,1fr))] min-[900px]:auto-rows-[minmax(340px,auto)]",
          // Each tile is as tall as its row (300px) or its words; on one column a little taller, for the picture.
          "[&>article]:min-h-[360px] min-[900px]:[&>article]:min-h-0",
        )}
      >
        <ExpandCard
          tone="night"
          // Across the grid: the words and the three questions on the left, the chats centred on the right.
          className={cn("min-[900px]:col-span-3 [&_h3]:text-[clamp(24px,2.5vw,36px)] [&_h3]:leading-[1.12] [&>div:first-child]:h-auto", WIDE, WIDE_PROBLEM)}
          label={t(TILE.problem.label)}
          title={t(TILE.thinking.title)}
          body={
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {TILE.problem.items.map((item, i) => (
                <li key={item.q} className="flex items-start gap-3.5 text-[15px] leading-[1.5] sm:text-[16px]">
                  <span aria-hidden className="mt-px flex size-7 shrink-0 items-center justify-center rounded-full bg-(--accent) text-[13px] font-bold text-(--accent-text)">
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-pretty">
                    <b className="font-bold">{t(item.q)}</b> <span className="opacity-80">{t(item.a)}</span>
                  </span>
                </li>
              ))}
            </ol>
          }
          visual={
            <ChatsVisual
              chats={[
                { who: t(sender("wechat")), text: t(H.visual.mum) },
                { who: t(sender("whatsapp")), text: t(H.visual.kelvin) },
                { who: t(sender("linkedin")), text: t(H.visual.daniel) },
              ]}
              reply={{ who: sender("kaplan"), text: t(OPENER.chats.find((c) => c.app === "kaplan")?.message ?? "") }}
              centred
            />
          }
          description={<p className="m-0">{t(H.hover.problem)}</p>}
          cta={{ href: "/move", label: t(H.cta.thinking) }}
        />
        <ExpandCard
          tone="brand"
          className={cn("min-[900px]:col-span-2", WIDE, WIDE_LOOK)}
          label={t(TILE.look.label)}
          title={t(TILE.look.title)}
          visual={<DoorsVisual doors={CARDS.rows.map((r) => t(r.kind))} />}
          description={<p className="m-0 max-w-[520px]">{t(H.hover.look)}</p>}
          cta={{ href: exampleHref("/next-steps"), label: t(H.cta.look), onClick: () => openExampleNow("arjun") }}
        />
        <ExpandCard
          tone="night"
          label={t(TILE.scoring.label)}
          title={programmes && programmes.n > 0 ? t(TILE.scoring.title, { n: num(programmes.n) }) : t(TILE.scoring.titleNone)}
          visual={<DotsVisual />}
          description={
            <>
              <p className="m-0">{t(H.hover.scoring)}</p>
              {programmes?.checked && caption(t(H.caption.scoring, { date: day(programmes.checked) }))}
            </>
          }
          cta={{ href: exampleHref("/results"), label: t(H.cta.scoring), onClick: () => openExampleNow("arjun") }}
        />
        <ExpandCard
          tone="night2"
          // Tall: the picture takes the lower 74% (not 56%), so it starts under the title and the tile reads as one piece;
          // under 900px it sits in the flow, under the words (it is taller than the tile's lower half there).
          className="min-[900px]:col-span-2 min-[900px]:row-span-2 [&>div:first-child]:h-auto max-[899px]:[&>div:first-child]:static [&_h3]:text-[clamp(24px,2.6vw,36px)] [&_h3]:leading-[1.12] [&_h3]:max-w-[620px] [@media(hover:hover)]:motion-safe:min-[900px]:[&>div:first-child]:h-[74%]"
          label={t(TILE.core.label)}
          title={t(TILE.core.title)}
          visual={
            <CoreVisual
              inputs={H.visual.inputs.map((s) => t(s))}
              rate={core?.rate ?? null}
              band={core?.band ?? null}
              bandLabel={core ? t(H.visual.bands[core.band]) : ""}
              rateLabel={t(H.visual.matchRate)}
              example={t(H.visual.example)}
              note={t(H.visual.admits, { admits: num(model.admits), programmes: num(model.admitProgrammes) })}
            />
          }
          description={<p className="m-0 max-w-[620px]">{t(H.hover.core, { observed: num(model.observed) })}</p>}
          cta={{ href: exampleHref("/results"), label: t(H.cta.core), onClick: () => openExampleNow("arjun") }}
        />
        <ExpandCard
          tone="night"
          // Its title runs to four lines in a third-width tile: the picture keeps to the lower 44% to stay clear of it.
          className="[@media(hover:hover)]:motion-safe:min-[900px]:[&>div:first-child]:h-[44%]"
          label={t(TILE.ai.label)}
          title={t(TILE.ai.title)}
          visual={
            <ScanVisual
              found={[H.visual.fees, H.visual.entry, H.visual.deadlines]}
              missing={H.visual.notOnPage}
              note={t(H.visual.reads, { n: num(reads.n), date: day(reads.date) })}
            />
          }
          description={<p className="m-0">{t(H.hover.ai)}</p>}
          cta={{ href: "/declaration", label: t(H.cta.ai) }}
        />
        <ExpandCard
          tone="teal"
          // The figure makes the title tall: the bars keep to the lower 44%.
          className="max-[899px]:[&>div:first-child]:static max-[899px]:[&>div:first-child]:h-[200px] [@media(hover:hover)]:motion-safe:min-[900px]:[&>div:first-child]:h-[44%]"
          label={t(TILE.grads.label)}
          title={t.rich(WHO.title, { big: (c) => <span className="mb-1 block text-[clamp(34px,3vw,44px)] leading-[0.95] font-extrabold tracking-[-0.02em] whitespace-nowrap tabular-nums">{c}</span> }, { n: top.n.toLocaleString(locale) })}
          visual={<GradsVisual bars={WHO.bars.map((b) => ({ value: b.value, n: b.n, year: b.year }))} />}
          description={
            <>
              <p className="m-0">{t(H.hover.grads)}</p>
              {caption(t(WHO.axis))}
            </>
          }
          extra={<ReceiptChip ids={gradIds} tone="brand" title={t(WHO.caption)} />}
        />
        <ExpandCard
          tone="amber"
          className={cn("min-[900px]:col-span-3", WIDE, WIDE_PRIVACY)}
          label={t(TILE.privacy.label)}
          title={t(TILE.privacy.title)}
          visual={<FormVisual sentence={t(H.visual.sentence)} />}
          description={<p className="m-0">{t(H.hover.privacy)}</p>}
          cta={{ href: "/declaration#answers", label: t(H.cta.privacy) }}
        />
      </div>
    </section>
  );
}
