"use client";

import { useEffect, useRef } from "react";
import { CheckIcon, ClockIcon } from "lucide-react";
import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { useT } from "@/components/i18n/I18nProvider";
import { ArrowSquare } from "@/components/shared/ArrowSquare";
import { usePaused } from "@/components/shared/PauseProvider";
import { ART_SIDE, ROAD_ACCENT, type Road, type RoadId } from "@/content/roads.en";
import { DRAWER, ROAD_CHECKS } from "@/content/move.en";
import { exampleHref, openExampleNow } from "@/lib/example-link";
import { DoorList, Kicker } from "../distance/CardsB";
import { DrawerPart, MoveDrawer } from "../move/MoveDrawer";
import { Overline } from "../move/Overline";
import { ReceiptChip } from "../receipts";
import { mountScene, type SceneModule } from "./engine";
import { Card, ExtrasList } from "./RoadSection";

// One road on /move, one screen: the road's pixel scene (./engine, ./scenes/<road>.ts) beside its name,
// its one big number (the road's first card) with the label and receipt chip, and "Read more". The
// drawer (../move/MoveDrawer.tsx) holds the rest: Work's line with its receipt, the road's other figures, any further group (Gap's
// pass windows), its rule, the extras (roles in demand, more figures, kinds of proof) and the doors of
// 01 that belong to this road (../distance/CardsB.tsx DoorList). From 900px the art takes its side
// (ART_SIDE: Work and Gap on the left, Study on the right); narrower, it sits under the text. The
// canvas's box is held from the server render (aspect ratio and width from the scene), so a /move#work
// link lands where the screen ends up. The loop stops off screen and when the tab is hidden (engine) and
// holds its frame under the site's "Pause animations" or reduced motion (usePaused).

/** The tallest the art is shown, CSS px (Work is cut to it around its crop). */
const MAX_H = 520;

/** The canvas's box before the engine runs: the scene at 2 CSS px per pixel, no taller than MAX_H. */
function reserve(scene: SceneModule): React.CSSProperties {
  const W = scene.logicalW,
    H = Math.min(scene.logicalH, MAX_H / 2);
  return { "--rc-ar": `${W} / ${H}`, "--rc-w": `${2 * W}px` } as React.CSSProperties;
}

/** `checks`: the English page's text (RoadChecks) in place of the big number and its drawer; the art then comes first on narrow screens. */
export function RoadScreen({ road, scene, onLaidOut, checks = false }: { road: Road; scene: SceneModule; onLaidOut?: (road: RoadId) => void; checks?: boolean }) {
  const t = useT();
  const paused = usePaused();
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const loop = useRef<ReturnType<typeof mountScene>["loop"] | null>(null);
  const pausedRef = useRef(paused);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvas.current || !host.current) return;
    let first = true;
    const m = mountScene(
      canvas.current,
      host.current,
      scene,
      () => {
        // The engine has sized the canvas: the reserved box gives way to it.
        box.current?.setAttribute("data-ready", "");
        if (first) {
          first = false;
          onLaidOut?.(road.id);
        }
      },
      { maxH: MAX_H, paused: pausedRef.current },
    );
    loop.current = m.loop;
    return () => {
      loop.current = null;
      m.destroy();
    };
  }, [scene, onLaidOut, road.id]);

  useEffect(() => {
    pausedRef.current = paused;
    loop.current?.setPaused(paused);
  }, [paused]);

  const accent = ROAD_ACCENT[road.id];
  const vars = { "--road-ink": accent.ink, "--road-mid": accent.mid } as React.CSSProperties;
  const [lead, ...rest] = road.cards;
  const value = t(lead.value);
  // A trailing "(…)" is shown smaller, as on the cards.
  const m = /^(.*?)\s*(\(.*\))$/.exec(value);
  const label = t(lead.label);
  const title = t(road.title);
  const artLeft = ART_SIDE[road.id] === "left";

  return (
    <section id={road.id} aria-labelledby={`${road.id}-title`} className="scroll-mt-16 py-16 sm:py-24" style={vars}>
      <div className={cn("home-wrap grid items-center gap-10 min-[900px]:gap-14", artLeft ? "min-[900px]:grid-cols-[minmax(0,704px)_minmax(0,1fr)]" : "min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,704px)]")}>
        {/* Text first in reading order; from 900px the art takes its side. */}
        {checks ? (
          <RoadChecks road={road} title={title} />
        ) : (
        <div className="flex min-w-0 flex-col">
          <Kicker className="text-(--road-ink) dark:text-(--road-mid)">
            <span aria-hidden>{t(road.eyebrow)}</span>
          </Kicker>
          <h3 id={`${road.id}-title`} tabIndex={-1} className="m-0 font-heading text-[clamp(44px,5vw,72px)] [font-stretch:var(--display-stretch)] leading-[1] font-extrabold tracking-[-0.02em] outline-none">
            {title}
          </h3>
          <span aria-hidden className="mt-5 block h-[5px] w-12 bg-(--road-mid)" />
          <p className="m-0 mt-6 font-heading text-[clamp(48px,6vw,96px)] [font-stretch:var(--display-stretch)] leading-[0.95] font-extrabold tracking-[-0.03em] text-(--road-ink) tabular-nums dark:text-(--road-mid)">
            {m ? m[1] : value}
            {m && <small className="mt-2 block font-sans text-[15px] font-medium tracking-normal text-muted-foreground">{m[2]}</small>}
          </p>
          <p className="m-0 mt-2 text-[17px] leading-snug font-semibold text-pretty">{label}</p>
          <ReceiptChip ids={[...lead.receipts, ...(lead.stillToCheck?.receipts ?? [])]} title={label} className="mt-2" />
          <MoveDrawer trigger={t(DRAWER.more)} eyebrow={t(road.eyebrow)} title={title} style={vars} className="mt-6">
            <RoadDrawer road={road} rest={rest} />
          </MoveDrawer>
        </div>
        )}

        <figure className={cn("m-0 min-w-0", artLeft && "min-[900px]:order-first", checks && "order-first", checks && !artLeft && "min-[900px]:order-last")}>
          <div ref={host} className="flex w-full justify-center">
            <div ref={box} style={reserve(scene)} className="aspect-(--rc-ar) w-full max-w-(--rc-w) data-ready:aspect-auto data-ready:w-auto data-ready:max-w-none">
              {/* The engine sets the canvas's size. */}
              <canvas ref={canvas} role="img" aria-label={scene.label ? t(scene.label) : undefined} className="block h-0 w-0 [image-rendering:pixelated]" />
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}

/**
 * The English page's text beside a road (2026-11-02 brief): its label in the road's colour, its name, one
 * line, "Kaplan 360++ checks" over three checks (a tick on a pale violet disc; a grey clock and "Coming
 * soon" for one not built yet), and the way on: words and the amber square arrow, as on the homepage.
 */
function RoadChecks({ road, title }: { road: Road; title: string }) {
  const t = useT();
  const c = ROAD_CHECKS.roads[road.id as keyof typeof ROAD_CHECKS.roads];
  if (!c) return null;
  const link = c.link as { label: string; href: string; example?: string };
  return (
    <div className="flex min-w-0 flex-col">
      <Kicker className="text-(--road-ink) dark:text-(--road-mid)">
        <span aria-hidden>{t(road.eyebrow)}</span>
      </Kicker>
      <h3 id={`${road.id}-title`} tabIndex={-1} className="m-0 font-heading text-[clamp(44px,5vw,64px)] [font-stretch:var(--display-stretch)] leading-[1] font-extrabold tracking-[-0.02em] outline-none">
        {title}
      </h3>
      <p className="m-0 mt-5 max-w-[30em] text-[18px] leading-[1.6] font-semibold text-pretty text-(--text) sm:text-[20px]">{t(c.line)}</p>
      <Overline as="h4" className="mt-8">
        {t(ROAD_CHECKS.title)}
      </Overline>
      <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
        {c.checks.map((item, i) => {
          const soon = c.soon.includes(i);
          return (
            <li key={item} className="flex gap-3 text-[16px] leading-[1.6] text-pretty text-(--land-body) sm:text-[17px]">
              <span aria-hidden className={cn("mt-[3px] inline-flex size-[22px] shrink-0 items-center justify-center rounded-full", soon ? "text-(--muted)" : "bg-(--land-tint) text-(--brand-ink)")}>
                {soon ? <ClockIcon size={14} strokeWidth={2} /> : <CheckIcon size={14} strokeWidth={2.5} />}
              </span>
              <span className="min-w-0">
                {t(item)}
                {soon && (
                  <span className="mt-1.5 block">
                    <span className="inline-block rounded-full bg-(--land-check-bg) px-2.5 py-0.5 text-[12px] leading-5 font-semibold text-(--land-check)">{t(ROAD_CHECKS.soon)}</span>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href={link.example ? exampleHref(link.href, link.example) : link.href}
        onClick={() => {
          if (link.example) openExampleNow(link.example);
        }}
        className="mt-8 inline-flex min-h-11 w-fit items-center gap-4 rounded-md text-[17px] font-bold text-(--text) no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--focus-ring) focus-visible:outline-solid"
      >
        {t(link.label)}
        <ArrowSquare className="size-10" />
      </Link>
    </div>
  );
}

/** What the road's screen leaves out: its other figures, any further group, its rule, its extras and its doors. */
function RoadDrawer({ road, rest }: { road: Road; rest: Road["cards"] }) {
  const t = useT();
  const extras = road.extras.filter((e) => !e.blockedUntil);
  return (
    <>
      {road.lineReceipts?.length ? (
        <DrawerPart>
          <p className="m-0 text-[15px] leading-snug text-pretty">{t(road.line)}</p>
          <ReceiptChip ids={road.lineReceipts} title={t(road.line)} />
        </DrawerPart>
      ) : null}
      {rest.length > 0 && (
        <DrawerPart>
          <ol aria-label={t("Facts")} className="m-0 grid list-none gap-3 p-0">
            {rest.map((c, i) => (
              <Card key={i} n={i + 2} card={c} plain />
            ))}
          </ol>
        </DrawerPart>
      )}
      {road.groups?.map((g) => (
        <DrawerPart key={g.title} title={t(g.title)}>
          <ol className="m-0 grid list-none gap-3 p-0">
            {g.cards.map((c, i) => (
              <Card key={i} n={i + 1} card={c} plain />
            ))}
          </ol>
        </DrawerPart>
      ))}
      {road.note && (
        <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className={cn("text-pretty", road.note.own && "rounded-full border border-dashed border-border px-2.5 py-0.5")}>{t(road.note.text)}</span>
          {road.note.receipts.length > 0 && <ReceiptChip ids={road.note.receipts} title={t(road.note.text)} />}
        </p>
      )}
      {extras.length > 0 && road.extrasTitle && (
        <DrawerPart title={t(road.extrasTitle)}>
          <ExtrasList items={extras} />
        </DrawerPart>
      )}
      <DoorList road={road.id} />
    </>
  );
}
