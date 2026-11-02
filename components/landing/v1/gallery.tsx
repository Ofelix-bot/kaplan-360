"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon, NewspaperIcon, UserRoundSearchIcon, XIcon } from "lucide-react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Dialog, DialogBackdrop, DialogClose, DialogPopup, DialogPortal, DialogTitle, DialogViewport } from "@/components/ui/dialog";
import { RECEIPTS, type Receipt } from "@/lib/home/receipts";
import { useHome } from "@/lib/home/store";
import { checkedOn, Quote, ReceiptCard, shotOf, ShotImage, useDay, useSourceName } from "../receipts";

// Every receipt on the page as a strip to drag through (it keeps moving a little after a flick, and
// stops at the ends). A photo opens large, growing out of its place in the strip; the arrows and the
// keyboard move the strip too.

const CARD = 300;
const GAP = 16;

// Photos first, then the quotes we could only check as text, then reports and pages read by a person.
const ORDER = Object.values(RECEIPTS).sort((a, b) => Number(!!shotOf(b.id)) - Number(!!shotOf(a.id)) || (a.kind === "official" ? 0 : 1) - (b.kind === "official" ? 0 : 1));

export function ReceiptGallery() {
  const t = useT();
  const reduce = useReducedMotion();
  const lightbox = useHome((s) => s.lightbox);
  const setLightbox = useHome((s) => s.setLightbox);
  const view = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const x = useMotionValue(0);
  const [limit, setLimit] = useState(0);
  const dragged = useRef(false);

  useEffect(() => {
    const measure = () => {
      if (view.current && track.current) setLimit(Math.max(0, track.current.scrollWidth - view.current.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (view.current) ro.observe(view.current);
    return () => ro.disconnect();
  }, []);

  const moveTo = (to: number) => {
    const clamped = Math.min(0, Math.max(-limit, to));
    if (reduce) x.set(clamped);
    else animate(x, clamped, { type: "spring", stiffness: 260, damping: 34 });
  };
  const open = lightbox ? RECEIPTS[lightbox] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-lg font-semibold">{t("Every receipt on this page")}</h3>
          <p className="text-sm text-white/70">{t("Each sentence photographed on its official page, highlighted by us. Drag the strip, or use the arrows.")}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label={t("Earlier receipts")} onClick={() => moveTo(x.get() + (CARD + GAP) * 2)} className="grid size-9 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
            <ChevronLeftIcon aria-hidden className="size-4" />
          </button>
          <button type="button" aria-label={t("Later receipts")} onClick={() => moveTo(x.get() - (CARD + GAP) * 2)} className="grid size-9 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
            <ChevronRightIcon aria-hidden className="size-4" />
          </button>
        </div>
      </div>
      <div ref={view} className="-mx-4 overflow-hidden px-4 sm:mx-0 sm:px-0">
        <motion.ul
          ref={track}
          drag="x"
          style={{ x }}
          dragConstraints={{ left: -limit, right: 0 }}
          dragElastic={0.08}
          dragTransition={{ power: 0.25, timeConstant: 220, bounceStiffness: 300, bounceDamping: 32 }}
          onDragStart={() => (dragged.current = true)}
          onDragEnd={() => setTimeout(() => (dragged.current = false), 0)}
          className="flex w-max cursor-grab gap-4 active:cursor-grabbing"
          aria-label={t("Receipts")}
        >
          {ORDER.map((r) => (
            <li key={r.id} className="shrink-0" style={{ width: CARD }}>
              <Thumb
                receipt={r}
                onOpen={() => !dragged.current && setLightbox(r.id)}
                onFocus={(el) => {
                  // Keyboard: bring the focused card into view.
                  const v = view.current?.getBoundingClientRect();
                  const c = el.getBoundingClientRect();
                  if (!v) return;
                  if (c.left < v.left) moveTo(x.get() + (v.left - c.left) + GAP);
                  else if (c.right > v.right) moveTo(x.get() - (c.right - v.right) - GAP);
                }}
              />
            </li>
          ))}
        </motion.ul>
      </div>
      <Lightbox receipt={open} onClose={() => setLightbox(null)} />
    </div>
  );
}

function Thumb({ receipt: r, onOpen, onFocus }: { receipt: Receipt; onOpen: () => void; onFocus: (el: HTMLElement) => void }) {
  const t = useT();
  const day = useDay();
  const source = useSourceName();
  const shot = shotOf(r.id);
  const Icon = r.kind === "person" ? UserRoundSearchIcon : r.kind === "reported" ? NewspaperIcon : FileTextIcon;
  return (
    <button
      type="button"
      onClick={onOpen}
      onFocus={(e) => onFocus(e.currentTarget)}
      onDragStart={(e) => e.preventDefault()}
      className="group/t flex h-full w-full flex-col overflow-hidden rounded-2xl bg-card text-left text-card-foreground shadow-[0_14px_40px_-18px_rgb(0_0_0/0.6)] outline-none select-none focus-visible:ring-3 focus-visible:ring-amber"
    >
      <motion.div layoutId={`shot-${r.id}`} className="relative h-36 overflow-hidden border-b bg-muted">
        {shot ? (
          <ShotImage id={r.id} sizes="300px" className="h-full [&_img]:pointer-events-none" />
        ) : (
          <div className="flex h-full flex-col justify-center gap-2 p-4">
            <Icon aria-hidden className="size-4 text-muted-foreground" />
            {r.quote ? (
              <p className="line-clamp-3 text-sm leading-snug font-medium">
                <Quote text={r.quote} mark={r.mark} />
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t(r.kind === "person" ? "Read by a counsellor" : "A report of the notice")}</p>
            )}
          </div>
        )}
      </motion.div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <span className="text-xs font-semibold text-primary">{source(r.source).label}</span>
        <span className="line-clamp-2 text-sm font-medium">{t(r.context)}</span>
        <span className="mt-auto pt-1 text-xs text-muted-foreground">
          {r.host} · {day(checkedOn(r))}
        </span>
      </div>
    </button>
  );
}

/** One receipt, large: its photo grows out of the strip into the middle of the screen. */
function Lightbox({ receipt, onClose }: { receipt: Receipt | null; onClose: () => void }) {
  const t = useT();
  const reduce = useReducedMotion();
  // AnimatePresence keeps the last rendering while the lightbox closes.
  const r = receipt;
  const shot = r ? shotOf(r.id) : null;
  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {r && (
          <DialogPortal keepMounted>
            <DialogBackdrop render={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />} />
            <DialogViewport>
              <DialogPopup
                className="max-w-3xl overflow-hidden bg-transparent shadow-none ring-0"
                render={<motion.div initial={{ opacity: 0.999 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.2 } }} />}
              >
                <DialogTitle className="sr-only">{t(r.context)}</DialogTitle>
                <div className="flex flex-col gap-3">
                  <div className="flex justify-end">
                    <DialogClose aria-label={t("Close")} className="grid size-9 place-items-center rounded-full bg-white/90 text-brand shadow transition-colors hover:bg-white">
                      <XIcon aria-hidden className="size-4" />
                    </DialogClose>
                  </div>
                  <motion.div
                    layoutId={reduce ? undefined : `shot-${r.id}`}
                    transition={{ type: "spring", duration: 0.45, bounce: 0.1 }}
                    className={cn("overflow-hidden rounded-2xl bg-card shadow-2xl", !shot && "p-5")}
                  >
                    {shot ? <ShotImage id={r.id} sizes="(max-width: 768px) 100vw, 768px" priority /> : r.quote ? <Quote text={r.quote} mark={r.mark} className="text-lg font-medium" /> : null}
                  </motion.div>
                  <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: reduce ? 0 : 0.15 }}>
                    <ReceiptCard receipt={r} withPhoto={false} />
                  </motion.div>
                </div>
              </DialogPopup>
            </DialogViewport>
          </DialogPortal>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
