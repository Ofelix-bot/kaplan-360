"use client";

import { Fragment, useEffect, useRef } from "react";
import { motion, useInView } from "motion/react";
import { cn } from "cn";
import { useIntlLocale, useLocale, useT } from "@/components/i18n/I18nProvider";
import { usePaused } from "@/components/shared/PauseProvider";
import { chatOf } from "@/content/landing.en";
import { NOISE, PROBLEM, WHO, WHY } from "@/content/move.en";
import { ChatCard } from "../opener/Chats";
import { InfoTip } from "./InfoTip";
import { Overline } from "./Overline";
import { DrawerPart, MoveDrawer } from "./MoveDrawer";
import { ReceiptChip } from "../receipts";
import { mountScene, type PinKey } from "../roads/engine";
import { problem } from "../roads/scenes/problem";
import { Settle } from "../Settle";
import { appear, useReduce, walk } from "../use-clock";

// /move's three screens between the line under the hero and 01 Break it down, each one screen on the
// light ground: Who it's for (#why: Kaplan's graduates, cumulative, as bars that grow), The problem
// (#problem: a pixel scene on the roads' engine: a student leaves campus for the office towers and stops
// where the path is unfinished, nudged on by a call and an ad; ../roads/scenes/problem.ts) and What they
// go on (#noise: the MRT ad, the agent and the feed, with the thesis as evidence). Every figure has its
// receipt chip; each bar has its receipt's year under it and the chart a one-line caption. No eyebrows: the
// thesis behind screen 3 is in its "Sources" drawer (./MoveDrawer.tsx), where the receipt chips still open
// the receipts. With reduced motion everything is at its
// end (the scene on its final frame); without scripts the bars are shown ([data-still], MovePage's
// noscript) and the scene's canvas stays empty, as the roads'.

/** Each screen's heading: the page's display size. */
function Title({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className={cn("m-0 min-w-0 font-heading text-[clamp(32px,4.4vw,64px)] [font-stretch:var(--display-stretch)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance break-keep wrap-break-word", className)}>
      {children}
    </h2>
  );
}

const SCREEN = "scroll-mt-16 bg-(--land-ground) py-20 sm:max-[899px]:py-28 min-[900px]:py-12 min-[900px]:flex min-[900px]:min-h-[calc(100svh-var(--header-h)-var(--band-h,44px))] min-[900px]:items-center";

// ── Screen 1 · Who it's for ─────────────────────────────────────────────────────────────────────────────

/** Bar i grows over GROW seconds, STEP seconds after the one before, once half the chart is in view. */
const GROW = 0.9;
const STEP = 0.55;
const TOP = Math.max(...WHO.bars.map((b) => b.n));

export function WhoSection() {
  const t = useT();
  const reduce = useReduce();
  const chart = useRef<HTMLDivElement>(null);
  const inView = useInView(chart, { once: true, amount: 0.5 });
  const go = reduce || inView;
  const ids = WHO.bars.flatMap((b) => b.receipts);
  const locale = useIntlLocale();
  const [b1, b2, b3] = WHO.bars;
  const figure = t(WHO.figure, { y1: b1.year, v1: b1.value, y2: b2.year, v2: b2.value, y3: b3.year, v3: b3.value });

  return (
    <section id="why" aria-labelledby="why-title" className={SCREEN}>
      <div className="home-wrap grid w-full gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-14">
        <Settle className="flex min-w-0 flex-col gap-4">
          {/* The figure large, in the highlighted bar's indigo; the words around it a smaller line, so the
              heading stays a compact block beside the chart (the whole sentence at display size ran to
              five lines). */}
          <h2
            id="why-title"
            className="m-0 min-w-0 font-heading text-[clamp(24px,2.6vw,38px)] [font-stretch:var(--display-stretch)] leading-[1.15] font-bold tracking-[-0.01em] text-balance break-keep wrap-break-word"
          >
            {t.rich(
              WHO.title,
              {
                big: (c) => (
                  <span className="my-1 block text-[clamp(48px,6.4vw,96px)] leading-[0.95] font-extrabold tracking-[-0.02em] text-(--brand-ink) tabular-nums">
                    {c}
                  </span>
                ),
              },
              { n: TOP.toLocaleString(locale) },
            )}
          </h2>
        </Settle>

        <figure className="m-0 flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
          <div ref={chart} role="img" aria-label={figure} className="grid h-[300px] grid-cols-[repeat(3,minmax(0,1fr))] items-end gap-3 border-0 border-b-2 border-solid border-(--land-line) sm:gap-6">
            {WHO.bars.map((b, i) => {
              const last = i === WHO.bars.length - 1;
              const delay = reduce ? 0 : i * STEP;
              return (
                <div key={b.value} aria-hidden className="flex h-full min-w-0 flex-col items-center justify-end gap-3">
                  <motion.span
                    data-still
                    className={cn("font-heading text-[clamp(14px,1.3vw,19px)] [font-stretch:var(--display-stretch)] leading-none font-semibold whitespace-nowrap tabular-nums", last ? "text-(--brand-ink)" : "text-(--muted)")}
                    initial={{ opacity: 0 }}
                    animate={go ? { opacity: 1 } : undefined}
                    transition={reduce ? { duration: 0 } : { duration: 0.4, delay: delay + GROW * 0.6, ease: appear }}
                  >
                    {b.value}
                  </motion.span>
                  <motion.span
                    data-still
                    className={cn("block w-full max-w-[160px] origin-bottom rounded-t-xl", last ? "bg-(--brand)" : "bg-(--land-tint) ring-1 ring-(--land-line) ring-inset")}
                    style={{ height: `${(b.n / TOP) * 78}%` }}
                    initial={{ scaleY: 0 }}
                    animate={go ? { scaleY: 1 } : undefined}
                    transition={reduce ? { duration: 0 } : { duration: GROW, delay, ease: walk }}
                  />
                </div>
              );
            })}
          </div>
          {/* The x-axis: each bar's year, under the baseline (the chart's label already says them). */}
          <div aria-hidden className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 sm:gap-6">
            {WHO.bars.map((b) => (
              <span key={b.year} className="text-center text-[13px] leading-5 font-medium text-(--muted) tabular-nums">
                {b.year}
              </span>
            ))}
          </div>
          </div>
          <figcaption className="flex flex-col items-start gap-2">
            <span className="text-[14px] leading-5 text-(--muted)">{t(WHO.axis)}</span>
            <span className="flex items-center gap-1">
              <ReceiptChip ids={ids} title={t(WHO.caption)} />
              <InfoTip label={t(WHO.about)} text={t(WHO.caption)} />
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

// ── Screen 2 · The problem ──────────────────────────────────────────────────────────────────────────────

/** A heading's "\n": a line break from 1100px, a plain space (the heading balances itself) below that. */
function lines(text: string) {
  return text.split("\n").map((part, i) => (
    <Fragment key={i}>
      {i > 0 && (
        <>
          <br className="max-[1099px]:hidden" />{" "}
        </>
      )}
      {part}
    </Fragment>
  ));
}

/** The tallest the picture is shown, CSS px: its 260 px at 2 CSS px per pixel, as the roads' screens. */
const ART_MAX_H = 520;
const PINS: PinKey[] = ["1", "2", "3"];

export function ProblemSection() {
  const t = useT();
  return (
    <section id="problem" aria-labelledby="problem-title" className={SCREEN}>
      {/* From 1100px, as screen 3: the heading runs across the top at the display size, in its two lines
          (too wide for a column beside the picture's full 704px); under it the body on the left, straight
          under the heading, and the picture on the right, their tops level. Stacked below that (heading,
          picture, body). The heading's size keeps its longer line ("at someone else’s pace.", 14.5em)
          inside the content width. */}
      <div className="home-wrap grid w-full gap-8 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,704px)] min-[1100px]:grid-rows-[auto_auto] min-[1100px]:items-start min-[1100px]:gap-x-14 min-[1100px]:gap-y-8">
        <Settle className="flex min-w-0 flex-col gap-4 min-[1100px]:col-span-2 min-[1100px]:row-start-1">
          <h2 id="problem-title" className="m-0 min-w-0 font-heading text-[clamp(32px,4.4vw,64px)] [font-stretch:var(--display-stretch)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance wrap-break-word">
            {lines(t(PROBLEM.title))}
          </h2>
        </Settle>
        <ProblemArt className="min-[1100px]:col-start-2 min-[1100px]:row-start-2" />
        <p className="m-0 max-w-[36ch] text-[18px] leading-[1.55] text-balance break-keep text-(--land-body) min-[1100px]:col-start-1 min-[1100px]:row-start-2 min-[1100px]:self-center min-[1100px]:text-[22px] min-[1100px]:leading-[1.5]">{t(PROBLEM.body)}</p>
      </div>
    </section>
  );
}

/**
 * The English page's Why (#why): the same scene and words as The problem, laid out as the 2026-11-02
 * brief has it: "Why", the heading and its line on the left, the picture on the right (from 1100px; under
 * the words below that). The heading's line break is the column's own.
 */
export function WhySection() {
  const t = useT();
  return (
    <section id="why" aria-labelledby="why-title" className={SCREEN}>
      <div className="home-wrap grid w-full items-center gap-10 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,560px)] min-[1100px]:gap-12">
        <Settle className="flex min-w-0 flex-col gap-5">
          <Overline>{t(WHY.eyebrow)}</Overline>
          <h2 id="why-title" className="m-0 min-w-0 font-heading text-[clamp(30px,3.6vw,52px)] [font-stretch:var(--display-stretch)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance wrap-break-word">
            {t(PROBLEM.title).replaceAll("\n", " ")}
          </h2>
          <p className="m-0 mt-2 max-w-[36ch] text-[18px] leading-[1.6] text-pretty text-(--land-body) min-[1100px]:text-[20px]">{t(PROBLEM.body)}</p>
        </Settle>
        <ProblemArt />
      </div>
    </section>
  );
}

/**
 * The picture: the pixel scene (../roads/scenes/problem.ts) on the roads' engine, always whole (smaller
 * pixels on narrow screens, never a crop), with its three one-word tags over it. Each tag sits at the
 * scene's card point, on the far side from its pin, joined to the pin by a straight leader; the tags
 * and leaders are placed in shares of the art's size, so they hold at any scale. As the roads' screens:
 * the loop runs only on screen, holds its frame under "Pause animations", and with reduced motion
 * shows the scene's final frame; without scripts the canvas stays empty and the tags stay hidden.
 */
function ProblemArt({ className }: { className?: string }) {
  const t = useT();
  const paused = usePaused();
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const loop = useRef<ReturnType<typeof mountScene>["loop"] | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    if (!canvas.current || !host.current) return;
    // The engine has sized the canvas: the reserved box gives way to it and the tags show.
    const m = mountScene(canvas.current, host.current, problem, () => box.current?.setAttribute("data-ready", ""), { maxH: ART_MAX_H, paused: pausedRef.current });
    loop.current = m.loop;
    return () => {
      loop.current = null;
      m.destroy();
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    loop.current?.setPaused(paused);
  }, [paused]);

  const W = problem.logicalW,
    H = problem.logicalH;
  const at = (x: number, y: number) => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` });
  const reserve = { "--pa-ar": `${W} / ${H}`, "--pa-w": `${2 * W}px` } as React.CSSProperties;

  return (
    <figure className={cn("m-0 min-w-0", className)}>
      <div ref={host} className="flex w-full justify-center">
        <div ref={box} style={reserve} className="group relative aspect-(--pa-ar) w-full max-w-(--pa-w) data-ready:aspect-auto data-ready:w-auto data-ready:max-w-none">
          {/* The engine sets the canvas's size. */}
          <canvas ref={canvas} role="img" aria-label={t(PROBLEM.figure)} className="block h-0 w-0 [image-rendering:pixelated]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-data-ready:opacity-100 motion-reduce:transition-none">
            <svg className="absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              {PINS.map((k) => {
                const a = problem.anchors[k],
                  c = problem.cards?.[k];
                return c ? <line key={k} x1={c.x} y1={c.y} x2={a[0]} y2={a[1]} stroke="var(--brand-ink)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> : null;
              })}
            </svg>
            {PINS.map((k, i) => {
              const a = problem.anchors[k],
                c = problem.cards?.[k];
              if (!c) return null;
              return (
                <Fragment key={k}>
                  <span className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--brand-ink) ring-2 ring-white" style={at(a[0], a[1])} />
                  <span
                    className={cn(
                      "absolute -translate-x-1/2 rounded-full border-[1.5px] border-(--brand-ink) bg-white px-2.5 py-1 font-heading text-[13px] leading-none font-extrabold whitespace-nowrap text-(--brand-ink) shadow-[0_2px_8px_rgba(31,26,43,0.16)] sm:px-3 sm:text-[15px]",
                      a[1] > c.y ? "-translate-y-full" : undefined,
                    )}
                    style={at(c.x, c.y)}
                  >
                    {t(PROBLEM.tags[i])}
                  </span>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </figure>
  );
}

// ── Screen 3 · What they go on ──────────────────────────────────────────────────────────────────────────

const NOISE_CARDS = [chatOf("mrt"), chatOf("whatsapp"), chatOf("xhs")];

export function NoiseSection() {
  const t = useT();
  const locale = useLocale();
  const reduce = useReduce();
  return (
    <section id="noise" aria-labelledby="noise-title" className={SCREEN}>
      <div className="home-wrap flex w-full flex-col gap-10">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <Settle className="flex min-w-0 flex-col gap-4">
            <Title id="noise-title" className="min-[900px]:max-w-[8.4em]">{t(NOISE.title)}</Title>
          </Settle>
          <MoveDrawer trigger={t(NOISE.evidence)} icon="info" title={t(NOISE.evidence)} description={t(NOISE.source)} className="md:mb-3">
            <DrawerPart>
              <ul className="m-0 flex list-none flex-col p-0">
                {NOISE.items.map((item) => (
                  <li key={item.text} className="flex flex-col items-start gap-2 border-0 border-t border-solid border-border py-3 text-[15px] leading-snug text-pretty first:border-t-0 first:pt-0">
                    <span>{t(item.text)}</span>
                    <ReceiptChip ids={item.receipts} title={t(item.text)} />
                  </li>
                ))}
              </ul>
            </DrawerPart>
          </MoveDrawer>
        </div>
        <ul className="m-0 grid list-none items-start gap-5 p-0 md:grid-cols-3 md:items-center">
          {NOISE_CARDS.map((chat, i) => (
            <motion.li
              key={chat.app}
              data-still
              className="max-w-[340px] min-w-0"
              initial={{ opacity: 0, y: 16 }}
              animate={reduce ? { opacity: 1, y: 0 } : undefined}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={reduce ? { duration: 0 } : { duration: 0.6, delay: i * 0.15, ease: appear }}
            >
              <ChatCard chat={chat} />
              {/* The feed's posts are Chinese on every page; English pages say what they are, under the card. */}
              {chat.app === "xhs" && locale === "en" && <p className="m-0 mt-3 text-[14px] leading-5 text-pretty text-(--muted)">{t(NOISE.feed)}</p>}
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
