"use client";

import { useState, type KeyboardEvent } from "react";
import { ArrowUpRightIcon, BookOpenIcon, ChevronLeftIcon, ChevronRightIcon, GlobeIcon, TextSearchIcon } from "lucide-react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DURATION, REVEAL, transitions } from "@/lib/motion";
import type { ReceiptView } from "@/lib/receipts/model";
import { useReceiptDrawer, type ReceiptDrawerOpen } from "@/lib/receipts/store";
import { Quote, ShotFrame } from "./Quote";
import { FOCUS, NUDGE, PICKED, R, useDay, useMatchLine, useViewText } from "./text";

// The one receipt drawer (decisions Q18; review: right-side on every screen size). It shows the page's photo
// with the sentence highlighted, or a drawn page with the sentence when it was not photographed; the check's
// steps Read → Picked out → Matched; and, for a group, previous / next between its receipts. ReceiptHost
// mounts it once for the whole site; pages never mount it themselves.

/** The page: its photo when there is one, else a drawn page with the quote highlighted. */
function PageView({ view, host }: { view: ReceiptView; host: string | null }) {
  const t = useT();
  if (view.shot) {
    return (
      <figure className="flex flex-col gap-3">
        <ShotFrame shot={view.shot} sizes="(max-width: 640px) 100vw, 448px" className="rounded-lg border" priority />
        {view.quote && (
          <figcaption className="text-[0.95rem] leading-relaxed font-medium text-pretty">
            <Quote text={view.quote} mark={view.mark} />
          </figcaption>
        )}
      </figure>
    );
  }
  if (!view.quote) return null;
  return (
    <figure className="overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center gap-2 border-b bg-background/70 px-3 py-2 text-xs text-muted-foreground">
        <GlobeIcon aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate" lang="en">
          {host ?? ""}
        </span>
        <span className="shrink-0">{t(R.notPhotographed)}</span>
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-4">
        <span aria-hidden className="h-2 w-10/12 rounded-full bg-foreground/8" />
        <span aria-hidden className="h-2 w-7/12 rounded-full bg-foreground/8" />
        <figcaption className="rounded-md bg-background px-3 py-2.5 text-[0.95rem] leading-relaxed font-medium text-pretty shadow-xs ring-1 ring-foreground/10">
          <Quote text={view.quote} mark={view.mark} />
        </figcaption>
        <span aria-hidden className="h-2 w-11/12 rounded-full bg-foreground/8" />
        <span aria-hidden className="h-2 w-5/12 rounded-full bg-foreground/8" />
      </div>
    </figure>
  );
}

/** The check, as three steps: when it was read, what was picked out, how it was matched. */
function Steps({ view }: { view: ReceiptView }) {
  const t = useT();
  const day = useDay();
  const match = useMatchLine()(view);
  const MatchIcon = match.icon;
  const steps = [
    { key: "read", icon: BookOpenIcon, label: t(R.stepRead), value: view.read ? day(view.read) : null },
    { key: "picked", icon: TextSearchIcon, label: t(R.stepPicked), value: view.where ?? t(PICKED[view.quoteKind]) },
    { key: "matched", icon: MatchIcon, label: t(R.stepMatched), value: match.label, checked: match.checked },
  ];
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <li key={s.key} className="relative flex gap-3 pb-3.5 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-[0.8125rem] w-px bg-border" />}
            <span
              aria-hidden
              className={cn(
                "relative flex size-[1.625rem] shrink-0 items-center justify-center rounded-full border bg-background",
                s.checked && "border-success/40 text-success",
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-col pt-0.5 text-sm leading-snug">
              <span className="font-medium">{s.label}</span>
              {s.value && <span className="break-words text-muted-foreground">{s.value}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One receipt in full. "drawer": the page (photo or drawn page), the steps, the source's lines, the note and
 * "Open the page". "card": the same inside a card, the photo edge to edge and no drawn page (no card in a card).
 */
export function ReceiptFull({ view, frame = "drawer", withPhoto = true }: { view: ReceiptView; frame?: "drawer" | "card"; withPhoto?: boolean }) {
  const t = useT();
  const day = useDay();
  const text = useViewText()(view);
  const card = frame === "card";
  const shown = withPhoto ? view : { ...view, shot: null };
  return (
    <div className="flex flex-col">
      {card && shown.shot && <ShotFrame shot={shown.shot} sizes="(max-width: 640px) 100vw, 420px" className="border-b" />}
      <div className={cn("flex flex-col gap-4", card ? "p-3.5" : "p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]")}>
        {card && text.context && <p className="text-xs text-muted-foreground">{text.context}</p>}
        {card ? (
          view.quote ? (
            <blockquote className="text-[0.95rem] leading-relaxed font-medium text-pretty">
              <Quote text={view.quote} mark={view.mark} />
            </blockquote>
          ) : view.kind === "rule" ? (
            <p className="text-[0.95rem] leading-relaxed font-medium text-pretty" lang={text.lang.title}>
              {text.title}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("No quote here. We only quote pages we have read ourselves.")}</p>
          )
        ) : view.kind === "rule" ? (
          <p className="text-[0.95rem] leading-relaxed font-medium text-pretty" lang={text.lang.title}>
            {text.title}
          </p>
        ) : (
          <PageView view={shown} host={view.host} />
        )}
        <Steps view={view} />
        <div className="flex flex-col gap-0.5 border-t pt-3.5 text-xs leading-snug text-muted-foreground">
          <p className="font-medium text-foreground" lang={text.lang.publisher}>
            {text.publisher}
          </p>
          {view.kind !== "rule" && (
            <p className="break-words" lang={text.lang.title}>
              {text.title}
            </p>
          )}
          {view.published && <p>{t(R.published, { date: day(view.published) })}</p>}
          {view.read && <p>{t(R.read, { date: day(view.read) })}</p>}
        </div>
        {text.note && (
          <p className="text-sm text-pretty" lang={text.lang.note}>
            {text.note}
          </p>
        )}
        {view.url && (
          <a
            href={view.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium underline decoration-border underline-offset-4 hover:decoration-foreground", FOCUS, NUDGE)}
          >
            {t(R.open)}
            <ArrowUpRightIcon aria-hidden className="size-4" />
          </a>
        )}
      </div>
    </div>
  );
}

const STEP_BUTTON = cn(
  "inline-flex size-8 items-center justify-center rounded-lg border bg-background hover:bg-muted active:translate-y-px disabled:pointer-events-none disabled:opacity-40 motion-reduce:active:translate-y-0",
  FOCUS,
);

export function ReceiptDrawer() {
  const t = useT();
  const text = useViewText();
  const reduce = useReducedMotion();
  const open = useReceiptDrawer((s) => s.open);
  const close = useReceiptDrawer((s) => s.close);
  // Keep the last group while the sheet animates out, and the receipt in front per group.
  const [shown, setShown] = useState<ReceiptDrawerOpen | null>(open);
  const [index, setIndex] = useState(open?.focus ?? 0);
  if (open && open !== shown) {
    setShown(open);
    setIndex(open.focus);
  }
  const group = open ?? shown;
  const views = group?.views ?? [];
  const i = Math.min(index, Math.max(0, views.length - 1));
  const view = views[i];
  const words = view ? text(view) : null;
  const title = group?.title ?? words?.context ?? words?.publisher ?? t(R.drawer);
  const many = views.length > 1;
  const go = (d: number) => setIndex((x) => Math.min(Math.max(0, x + d), views.length - 1));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!many || (e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
    if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
  };
  const closed = reduce ? { opacity: 0 } : { opacity: 0, x: "2.5rem" };
  return (
    <Sheet open={!!open} onOpenChange={(o) => !o && close()}>
      <SheetContent
        side="right"
        onKeyDown={onKeyDown}
        className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        render={(renderProps, state) => (
          <motion.div
            {...(renderProps as HTMLMotionProps<"div">)}
            initial={closed}
            animate={state.open ? { opacity: 1, x: 0 } : closed}
            transition={reduce ? { duration: DURATION.base, ease: "linear" } : transitions.ui}
          />
        )}
      >
        <SheetHeader className="gap-1 border-b p-4 pr-12">
          <p className="text-xs font-medium text-muted-foreground">{t(R.drawer)}</p>
          <SheetTitle className="text-lg leading-snug text-balance">{title}</SheetTitle>
          {words && title !== words.publisher && (
            <SheetDescription className="text-xs" lang={words.lang.publisher}>
              {words.publisher}
            </SheetDescription>
          )}
          {many && (
            <div className="flex items-center gap-2 pt-2">
              <button type="button" className={STEP_BUTTON} onClick={() => go(-1)} disabled={i === 0} aria-label={t(R.prev)}>
                <ChevronLeftIcon aria-hidden className="size-4" />
              </button>
              <span className="min-w-12 text-center text-xs text-muted-foreground tabular-nums" aria-live="polite">
                {t(R.position, { i: i + 1, n: views.length })}
              </span>
              <button type="button" className={STEP_BUTTON} onClick={() => go(1)} disabled={i === views.length - 1} aria-label={t(R.next)}>
                <ChevronRightIcon aria-hidden className="size-4" />
              </button>
            </div>
          )}
        </SheetHeader>
        {view && (
          <motion.div
            key={view.id}
            initial={reduce ? false : { opacity: 0, y: REVEAL.y / 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transitions.ui}
          >
            <ReceiptFull view={view} />
          </motion.div>
        )}
      </SheetContent>
    </Sheet>
  );
}
