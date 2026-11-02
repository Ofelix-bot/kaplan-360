"use client";

import { useId } from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { useReceiptDrawer } from "@/lib/receipts/store";
import { useReceiptSection } from "./ReceiptSection";
import { FOCUS, R, useDay, useViewText } from "./text";

// The numbered sources at the end of a section (decisions Q18; review: one at the end of EVERY section).
// The numerals are the section's footnote numerals. Each item opens the drawer at its receipt; the arrow
// opens the page itself in a new tab. Inside .on-dark (the night bands) the muted lines take the band's
// body colour, since the light muted grey is about 2.6:1 there: globals.css sets --receipt-muted and the
// hover pair on .on-dark, and the .ui muted tokens stand in everywhere else.

const MUTED = "text-[color:var(--receipt-muted,var(--color-muted-foreground))]";

export function SourceList({ className }: { className?: string }) {
  const t = useT();
  const day = useDay();
  const text = useViewText();
  const section = useReceiptSection();
  const show = useReceiptDrawer((s) => s.show);
  const headingId = useId();
  if (!section || !section.views.length) return null;
  return (
    <div className={cn("mt-8 border-t pt-4", className)}>
      <p id={headingId} className={cn("mb-2 text-xs font-medium", MUTED)}>
        {t(R.sources)}
      </p>
      <ol aria-labelledby={headingId} className="grid gap-x-6 gap-y-1 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        {section.views.map((v, i) => {
          const w = text(v);
          const date = v.published ? t(R.published, { date: day(v.published) }) : v.read ? t(R.read, { date: day(v.read) }) : null;
          return (
            <li key={v.id} className="flex min-w-0 items-start gap-1">
              <button
                type="button"
                onClick={() => show(section.views, i, section.title)}
                className={cn("group flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-md py-1.5 pr-1 text-left text-xs leading-snug", FOCUS)}
              >
                <span aria-hidden className="mt-px inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-[0.3rem] bg-current/10 px-1 font-semibold tabular-nums group-hover:bg-current/20">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="sr-only">{t(R.source, { n: i + 1, publisher: w.publisher, title: w.title })}</span>
                  <span aria-hidden className="font-medium group-hover:underline group-hover:underline-offset-4" lang={w.lang.publisher}>
                    {w.publisher}
                  </span>
                  <span aria-hidden className={cn("line-clamp-2 break-words", MUTED)} lang={w.lang.title}>
                    {w.title}
                  </span>
                  {date && <span className={MUTED}>{date}</span>}
                </span>
              </button>
              {v.url && (
                <a
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t(R.open)}
                  className={cn(
                    "mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md",
                    MUTED,
                    "hover:bg-[color:var(--receipt-hover,var(--color-muted))] hover:text-[color:var(--receipt-hover-ink,var(--color-foreground))]",
                    FOCUS,
                  )}
                >
                  <ArrowUpRightIcon aria-hidden className="size-3.5" />
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
