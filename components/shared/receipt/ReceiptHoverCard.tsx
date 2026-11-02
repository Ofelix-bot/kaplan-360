"use client";

import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { PopoverContent } from "@/components/ui/popover";
import { DURATION, transitions } from "@/lib/motion";
import type { ReceiptView } from "@/lib/receipts/model";
import { Quote } from "./Quote";
import { FOCUS, NUDGE, R, useDay, useMatchLine, useViewText } from "./text";

// The receipt card a footnote opens on hover or tap (decisions Q18): the quote with its value highlighted;
// publisher, title, published date and read date on their own lines; the match line; "Open the page" (a new
// tab) and "View the page" (the drawer). Arrows are icons, never glyphs.

export function ReceiptHoverCard({ view, onView, className }: { view: ReceiptView; onView?: () => void; className?: string }) {
  const t = useT();
  const day = useDay();
  const text = useViewText()(view);
  const match = useMatchLine()(view);
  const MatchIcon = match.icon;
  const isRule = view.kind === "rule";
  const body = view.quote ? null : isRule ? text.title : (text.context ?? text.title);
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="border-b px-4 pt-3.5 pb-3">
        {view.quote ? (
          <p className="text-sm leading-relaxed font-medium text-pretty">
            <Quote text={view.quote} mark={view.mark} />
          </p>
        ) : (
          <p className="text-sm leading-relaxed font-medium text-pretty" lang={body === text.title ? text.lang.title : undefined}>
            {body}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-4 py-3 text-xs leading-snug text-muted-foreground">
        <p className="font-medium text-foreground" lang={text.lang.publisher}>
          {text.publisher}
        </p>
        {!isRule && (view.quote || body !== text.title) && (
          <p className="break-words" lang={text.lang.title}>
            {text.title}
          </p>
        )}
        {view.published && <p>{t(R.published, { date: day(view.published) })}</p>}
        {view.read && <p>{t(R.read, { date: day(view.read) })}</p>}
        <p className={cn("mt-1.5 inline-flex items-center gap-1.5 font-medium", match.checked ? "text-success" : "text-foreground")}>
          <MatchIcon aria-hidden className="size-3.5 shrink-0" />
          {match.label}
        </p>
      </div>
      {(view.url || onView) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5 text-xs font-medium">
          {view.url && (
            <a href={view.url} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1 rounded-sm underline decoration-border underline-offset-4 hover:decoration-foreground", FOCUS, NUDGE)}>
              {t(R.open)}
              <ArrowUpRightIcon aria-hidden className="size-3.5" />
            </a>
          )}
          {onView && (
            <button type="button" onClick={onView} className={cn("inline-flex items-center gap-1 rounded-sm underline decoration-border underline-offset-4 hover:decoration-foreground", FOCUS, NUDGE)}>
              {t(R.view)}
              <ArrowRightIcon aria-hidden className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The popover that carries a ReceiptHoverCard: opacity and transform only, 550ms on the UI curve
 * (var(--motion-ui)); opacity alone under reduced motion.
 */
export function ReceiptHoverPopup({ view, onView }: { view: ReceiptView; onView?: () => void }) {
  const reduce = useReducedMotion();
  const closed = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 4 };
  const open = reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 };
  return (
    <PopoverContent
      side="top"
      sideOffset={6}
      className="w-80 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-xl p-0 shadow-xl"
      render={(renderProps, state) => (
        <motion.div
          {...(renderProps as HTMLMotionProps<"div">)}
          initial={closed}
          animate={state.open ? open : closed}
          transition={reduce ? { duration: DURATION.base, ease: "linear" } : transitions.ui}
        />
      )}
    >
      <ReceiptHoverCard view={view} onView={onView} />
    </PopoverContent>
  );
}
