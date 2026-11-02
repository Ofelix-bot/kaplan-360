"use client";

import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Ticker } from "@/components/shared/Ticker";
import { RECEIPTS_MOVE } from "@/content/move.en";
import type { Receipt } from "@/lib/home/receipts";
import { useHome } from "@/lib/home/store";
import { ALL_RECEIPTS, checkedOn, Quote, useDay, useSourceName } from "../receipts";

// /move#receipts: official sentences behind the page's numbers, one at a time in a ticker
// (components/shared/Ticker: every 4.2s, held while hovered, focused, off screen or paused). Each
// shows the source, the claim on the site it backs (RECEIPTS_MOVE.items), the quote with its
// highlight, the page's host and the day that receipt was read, so the dates differ from item to item.
// A click opens it in the receipts sheet. Only the current item has words: its neighbours are drawn as
// bars (Sliver), and move.css (.mv-ticker) cuts the strip just past the current item, so the next one
// shows as a narrow decorative edge.

/** The 12 receipts in RECEIPTS_MOVE's order (fixed: the user's order, 2026-11-01), each with its claim. */
const BY_ID = new Map(ALL_RECEIPTS.map((r) => [r.id, r]));
const ITEMS: Receipt[] = RECEIPTS_MOVE.items.map((i) => BY_ID.get(i.id)).filter((r): r is Receipt => !!r?.quote);
const CLAIM = new Map<string, string>(RECEIPTS_MOVE.items.map((i) => [i.id, i.claim]));

export function ReceiptsTicker() {
  const t = useT();
  const day = useDay();
  const source = useSourceName();
  const showReceipts = useHome((s) => s.showReceipts);

  return (
    <section id="receipts" aria-labelledby="receipts-title" className="scroll-mt-16 bg-(--land-tint) py-20 sm:py-28">
      <div className="home-wrap">
        <h2 id="receipts-title" className="m-0 min-w-0 font-heading text-[clamp(30px,3.6vw,52px)] [font-stretch:var(--display-stretch)] leading-[1.1] font-bold tracking-[-0.02em] text-balance wrap-break-word">
          {t(RECEIPTS_MOVE.title)}
        </h2>
        <Ticker
          label={RECEIPTS_MOVE.label}
          items={ITEMS}
          className="mv-ticker mt-12 sm:mt-14"
          render={(r, active) =>
            active ? (
              <button
                type="button"
                onClick={() => showReceipts([r.id], t(r.context))}
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-3.5 rounded-xl border-0 bg-transparent p-0 text-left text-(--text) [font-family:inherit]",
                  "outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring) focus-visible:outline-solid",
                )}
              >
                <span className="flex flex-col gap-1">
                  <span className="text-[13px] font-bold text-(--muted)">{source(r.source).label}</span>
                  {CLAIM.get(r.id) ? <span className="text-[14px] leading-snug text-pretty text-(--land-body)">{t(CLAIM.get(r.id) ?? "")}</span> : null}
                </span>
                <Quote text={r.quote ?? ""} mark={r.mark} className="font-heading text-[clamp(22px,2.8vw,38px)] [font-stretch:var(--display-stretch)] leading-[1.22] font-bold tracking-[-0.01em] text-pretty" />
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-(--land-body)">
                  <span>{r.host}</span>
                  <span>{t(RECEIPTS_MOVE.read, { date: day(checkedOn(r)) })}</span>
                </span>
              </button>
            ) : (
              <Sliver />
            )
          }
        />
      </div>
    </section>
  );
}

/** A neighbour in the strip: the shape of a receipt (source, three lines of quote, the host and date), no words. */
function Sliver() {
  const bar = "block rounded-full bg-(--muted)";
  return (
    <span aria-hidden className="flex flex-col gap-3.5">
      <span className={cn(bar, "h-3 w-28")} />
      <span className="flex flex-col gap-3">
        <span className={cn(bar, "h-[clamp(18px,2.2vw,30px)] w-full")} />
        <span className={cn(bar, "h-[clamp(18px,2.2vw,30px)] w-11/12")} />
        <span className={cn(bar, "h-[clamp(18px,2.2vw,30px)] w-2/3")} />
      </span>
      <span className={cn(bar, "h-3 w-48")} />
    </span>
  );
}
