"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeftIcon, ArrowRightIcon, PauseIcon, PlayIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { usePaused } from "./PauseProvider";

// A news-style strip: one item at a time, the next sliding in every `interval` ms (4.2s) on the UI
// curve. It holds while hovered or focused, off screen, in a hidden tab, and while the site's pause
// is on (which also covers reduced motion: there it starts held and only fades). Pause, previous
// and next buttons; the pause button is aria-pressed. The current item is fully opaque; its
// neighbours show as clipped, blurred previews only, hidden from assistive tech and from focus.
// Only a change the visitor asked for is announced (aria-live polite then, off while it runs).

const BUTTON =
  "grid size-12 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-(--text) p-0 text-(--land-ground) transition-opacity duration-200 hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) focus-visible:outline-solid motion-reduce:transition-none";

export function Ticker<T>({
  items,
  render,
  interval = 4200,
  label,
  className,
}: {
  items: T[];
  render: (item: T, active: boolean) => ReactNode;
  interval?: number;
  /** The region's name, an English message (translated here). */
  label: string;
  className?: string;
}) {
  const t = useT();
  const paused = usePaused();
  const root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  // The visitor's own pause or play, for as long as the site's pause stays as it was then.
  const [choice, setChoice] = useState<{ stop: boolean; under: boolean } | null>(null);
  const [held, setHeld] = useState({ hover: false, focus: false });
  const [onScreen, setOnScreen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [announce, setAnnounce] = useState(false);

  const n = items.length;
  const current = n ? index % n : 0;
  const stopped = choice && choice.under === paused ? choice.stop : paused;
  const running = n > 1 && !stopped && !held.hover && !held.focus && onScreen && !hidden;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    const onVisible = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // One timeout per item, so a manual step starts the wait again.
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => {
      setAnnounce(false);
      setIndex((i) => (i + 1) % n);
    }, interval);
    return () => window.clearTimeout(id);
  }, [running, current, interval, n]);

  const go = (step: number) => {
    if (!n) return;
    setAnnounce(true);
    setIndex((i) => (((i + step) % n) + n) % n);
  };

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label={t(label)}
      className={cn("overflow-x-clip [--ticker-gap:48px] [--ticker-w:min(760px,84vw)]", className)}
      onPointerEnter={() => setHeld((h) => ({ ...h, hover: true }))}
      onPointerLeave={() => setHeld((h) => ({ ...h, hover: false }))}
      onFocus={() => setHeld((h) => ({ ...h, focus: true }))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld((h) => ({ ...h, focus: false }));
      }}
    >
      <div aria-live={announce ? "polite" : "off"} aria-atomic="false">
        <ul
          className="m-0 flex list-none gap-(--ticker-gap) p-0 transition-transform duration-(--motion-ui-dur) ease-(--motion-ui) motion-reduce:transition-none"
          style={{ transform: `translateX(calc(${-current} * (var(--ticker-w) + var(--ticker-gap))))` } as CSSProperties}
        >
          {items.map((item, i) => {
            const on = i === current;
            return (
              <li
                key={i}
                aria-roledescription="slide"
                aria-label={t("{n} of {total}", { n: i + 1, total: n })}
                aria-hidden={on ? undefined : true}
                inert={!on}
                className={cn(
                  "m-0 w-(--ticker-w) shrink-0 transition-[opacity,filter] duration-(--motion-ui-dur) ease-(--motion-ui)",
                  // A neighbour is a shape, not something to read: faded, blurred and masked at its edges.
                  !on && "pointer-events-none opacity-30 blur-[3px] select-none [mask-image:linear-gradient(90deg,transparent,#000_20%,#000_80%,transparent)]",
                )}
              >
                {render(item, on)}
              </li>
            );
          })}
        </ul>
      </div>

      {n > 1 && (
        <div className="mt-12 flex items-center justify-between gap-4">
          <button
            type="button"
            aria-pressed={stopped}
            aria-label={t("Pause")}
            onClick={() => setChoice({ stop: !stopped, under: paused })}
            className={BUTTON}
          >
            {stopped ? <PlayIcon aria-hidden className="size-4" /> : <PauseIcon aria-hidden className="size-4" />}
          </button>
          <span className="text-sm text-(--muted) tabular-nums">{t("{n} of {total}", { n: current + 1, total: n })}</span>
          <div className="flex gap-3">
            <button type="button" aria-label={t("Previous")} onClick={() => go(-1)} className={BUTTON}>
              <ArrowLeftIcon aria-hidden className="size-[18px]" />
            </button>
            <button type="button" aria-label={t("Next")} onClick={() => go(1)} className={BUTTON}>
              <ArrowRightIcon aria-hidden className="size-[18px]" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
