"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { useT } from "@/components/i18n/I18nProvider";
import { StillChip } from "@/components/shared/StatusChip";
import { ART_SIDE, ROAD_ACCENT, type Road, type RoadCard, type RoadId, type RoadExtra } from "@/content/roads.en";
import { ReceiptChip } from "../receipts";
import { mountScene, toStage, type PinKey, type SceneModule, type StageLayout } from "./engine";

// One road on the homepage: the text column (eyebrow, title, line, an optional rule, the extras
// disclosure, the link) beside the road's pixel art (./engine, ./scenes/<road>.ts) with its three
// numbered cards. As in the v2 prototypes: from 900px the art sits beside the text (Work and Qualify on
// the left, Study and Gap on the right); where the art is shown at about 2 CSS px per pixel or more,
// the cards float over it with elbow leader lines to numbered pins; narrower, the art is cropped,
// the pins stay on it and the cards are listed under it. Each card's chip opens the homepage's
// receipts (./receipts.tsx). Without a scene, or before the script runs, the cards are a plain list.
// Until the engine sizes the canvas, its box is held from the server render (reserve()), so the page
// below doesn't move when the art mounts.
// /move shows each road as its own screen (./RoadCard.tsx RoadScreen), which reuses Card and ExtrasList
// from here in its drawer; RoadSection itself is no longer mounted and stays for a rollback.

const KEYS: PinKey[] = ["1", "2", "3"];

type Seg = readonly [number, number, number, number];
type Geo = { pins: (readonly [number, number])[]; dots: (readonly [number, number])[]; lines: Seg[]; padBottom: number; padTop: number };

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Where a card sits over the art, CSS px from the canvas's top-left (wide layout). */
function cardBox(scene: SceneModule, k: PinKey, lay: StageLayout) {
  const place = scene.cards?.[k];
  if (!place) return null;
  return { x: Math.round(place.x * lay.scale), y: Math.round(place.y * lay.scale), w: place.w ?? scene.cardWidth ?? 200, leader: place.leader ?? "auto" };
}

/**
 * The canvas's box before the engine runs, as the engine's fit (fitView) will set it: on a host under
 * 480 CSS px, the full width and the crop's height at 2 CSS px per pixel; wider, the whole art at up to
 * 2 CSS px per pixel. A container query on the host picks one.
 */
function reserve(scene: SceneModule): React.CSSProperties {
  const W = scene.logicalW,
    H = scene.logicalH;
  return {
    "--road-ph-h": `${2 * Math.min(H, scene.crop?.h ?? H)}px`,
    "--road-ph-ar": `${W} / ${H}`,
    "--road-ph-w": `${2 * W}px`,
  } as React.CSSProperties;
}

/**
 * Whether the cards will go over the art on a host of 704 CSS px or more: the engine shows the whole
 * art there at 2 CSS px per pixel, which is over every scene's overlayMinScale. The container query
 * that uses this is written for 352 px wide art, the width of all four scenes.
 */
const overlayLikely = (scene?: SceneModule) => !!scene?.cards && scene.logicalW === 352 && (scene.overlayMinScale ?? 1.9) <= 2;

/** Pins, leader lines and the room the cards need below the canvas. */
function geometry(scene: SceneModule, lay: StageLayout, heights: number[]): Geo {
  const A = lay.cropped && lay.view.h < scene.logicalH && scene.cropAnchors ? scene.cropAnchors : scene.anchors;
  const pins: Geo["pins"] = [],
    dots: Geo["dots"] = [],
    lines: Seg[] = [];
  let bottom = 0,
    top = 0;
  KEYS.forEach((k, i) => {
    const [ax, ay] = toStage(A[k], lay);
    const box = lay.overlay ? cardBox(scene, k, lay) : null;
    if (!box) {
      // Narrow: the pin beside its anchor, joined by a short leader, inside the canvas.
      const off = scene.pinOffsets?.[k] ?? [0, 0];
      const px = clamp(ax + off[0], 9, lay.width - 9),
        py = clamp(ay + off[1], 9, lay.height - 9);
      pins.push([px, py]);
      if (Math.abs(px - ax) + Math.abs(py - ay) > 1) {
        lines.push([ax, ay, px, py]);
        dots.push([ax, ay]);
      }
      return;
    }
    const o = scene.overlayPinOffsets?.[k];
    const bx = ax + (o?.[0] ?? 0),
      by = ay + (o?.[1] ?? 0);
    pins.push([bx, by]);
    if (o && (o[0] || o[1])) {
      lines.push([bx, by, ax, ay]);
      dots.push([ax, ay]);
    }
    const { x, y, w } = box,
      h = heights[i] ?? 0;
    bottom = Math.max(bottom, y + h);
    top = Math.min(top, y, by - 9);
    const above = by < y,
      below = by > y + h,
      beside = bx > x + w || bx < x;
    const straight = () => {
      const ex = clamp(bx, x + 14, x + w - 14);
      lines.push([ex, above ? y : y + h, bx, by]);
    };
    const elbow = () => {
      // A horizontal run from the card's edge, then one 45° leg to the pin.
      const ex = bx > x + w ? x + w : x,
        ey = clamp(by, y + 12, y + h - 12),
        dv = Math.abs(by - ey),
        sg = bx > ex ? 1 : -1;
      let kx = bx - sg * dv;
      if (sg * (kx - ex) < 8) kx = ex + sg * 8;
      if (dv < 1) lines.push([ex, ey, bx, by]);
      else lines.push([ex, ey, kx, ey], [kx, ey, bx, by]);
    };
    if (box.leader === "hv" && bx > x + w) {
      const ey = y + 18;
      lines.push([x + w, ey, bx, ey]);
      if (Math.abs(by - ey) > 1) lines.push([bx, ey, bx, by]);
    } else if (box.leader === "vertical" && (above || below)) straight();
    else if (beside) elbow();
    else if (above || below) straight();
  });
  // Cards placed above the canvas need room above it too, or they run into the text column's link in
  // the one-column layout (applied below 900px only; side by side, the centred columns absorb it).
  return {
    pins,
    dots,
    lines,
    padBottom: lay.overlay ? Math.max(0, Math.ceil(bottom - lay.height)) : 0,
    padTop: lay.overlay && top < 0 ? Math.ceil(-top) + 16 : 0,
  };
}

/**
 * `variant="insights"` (/insights): the road opens like a chapter, with its word as a large heading, an
 * accent rule and its line as the lead, in place of the eyebrow, title and line; the section sits under
 * the page's sticky bar, so it stops lower when scrolled to, and a rule separates it from the last road.
 */
export function RoadSection({
  road,
  scene,
  onLaidOut,
  variant = "home",
}: {
  road: Road;
  scene?: SceneModule;
  onLaidOut?: (road: RoadId) => void;
  variant?: "home" | "insights";
}) {
  const insights = variant === "insights";
  const t = useT();
  const accent = ROAD_ACCENT[road.id];
  const artLeft = ART_SIDE[road.id] === "left";
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cardEls = useRef<(HTMLLIElement | null)[]>([]);
  const [lay, setLay] = useState<StageLayout | null>(null);
  const [heights, setHeights] = useState<number[]>([]);

  useEffect(() => {
    if (!scene || !canvas.current || !host.current) return;
    const m = mountScene(canvas.current, host.current, scene, (l) => setLay({ ...l, view: { ...l.view } }));
    return () => m.destroy();
  }, [scene]);

  const overlay = !!scene && !!lay?.overlay;

  // Tell the page once this road has its final height: the canvas sized and, over the art, the cards measured.
  useEffect(() => {
    if (lay && (!overlay || heights.length)) onLaidOut?.(road.id);
  }, [lay, overlay, heights, onLaidOut, road.id]);

  // The leaders end on the cards' edges: measure the cards over the art (again when fonts load or the
  // language changes their height).
  useEffect(() => {
    if (!overlay || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(() => setHeights(KEYS.map((_, i) => cardEls.current[i]?.offsetHeight ?? 0)));
    cardEls.current.forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [overlay]);

  const geo = scene && lay ? geometry(scene, lay, heights) : null;
  const pinSize = overlay ? "size-[18px] text-[10px]" : "size-3.5 text-[8.5px]";
  const extras = road.extras.filter((e) => !e.blockedUntil);

  const cards = (
    <ol
      aria-label={t("Facts")}
      className={cn(
        overlay ? "absolute top-0 left-0 size-0" : "mt-3.5 grid gap-2 min-[700px]:mx-auto min-[700px]:max-w-[360px]",
        // Before the engine runs: where the cards will float over the art, the list under it takes no room.
        !lay && overlayLikely(scene) && "@min-[704px]:hidden",
      )}
    >
      {road.cards.map((c, i) => {
        const box = overlay && scene && lay ? cardBox(scene, KEYS[i], lay) : null;
        return (
          <Card
            key={i}
            ref={(el) => {
              cardEls.current[i] = el;
            }}
            n={i + 1}
            card={c}
            className={box ? "absolute z-[3]" : undefined}
            style={box ? { left: box.x, top: box.y, width: box.w } : undefined}
          />
        );
      })}
    </ol>
  );

  return (
    <section
      id={road.id}
      aria-labelledby={`${road.id}-title`}
      className={cn(
        "px-4 py-10 min-[700px]:px-8 min-[700px]:py-14 min-[900px]:px-6 min-[900px]:py-16 min-[1280px]:px-12 min-[1280px]:py-20",
        // html's scroll-padding-top (80px) plus this clears the header and the sticky bar (124px).
        insights ? "scroll-mt-12 border-t border-(--land-line)" : "scroll-mt-20",
      )}
      style={{ "--road-ink": accent.ink, "--road-mid": accent.mid } as React.CSSProperties}
    >
      <div
        className={cn(
          "mx-auto grid max-w-[1320px] grid-cols-1 items-center gap-6 min-[900px]:gap-x-8 min-[1280px]:gap-x-14",
          artLeft ? "min-[900px]:grid-cols-[minmax(0,1fr)_clamp(240px,30vw,420px)]" : "min-[900px]:grid-cols-[clamp(240px,30vw,420px)_minmax(0,1fr)]",
        )}
      >
        {/* Text first in reading order; from 900px the art takes its side. */}
        <div className="flex min-w-0 flex-col min-[700px]:mx-auto min-[700px]:w-full min-[700px]:max-w-[440px] min-[900px]:mx-0">
          {insights ? (
            <>
              <h2
                id={`${road.id}-title`}
                tabIndex={-1}
                className="font-heading text-[clamp(48px,6.4vw,84px)] leading-[0.95] font-bold tracking-[-0.03em] outline-none"
              >
                {t(road.title)}
              </h2>
              <span aria-hidden className="mt-5 block h-[5px] w-12 bg-(--road-mid)" />
              <p className="mt-4 max-w-[36ch] text-lg leading-snug text-pretty text-(--land-body) min-[1280px]:text-xl">{t(road.line)}</p>
              {road.lineReceipts?.length ? <ReceiptChip ids={road.lineReceipts} title={t(road.line)} className="mt-3" /> : null}
            </>
          ) : (
            <>
              <p className="text-xs font-semibold tracking-[0.08em] text-(--road-ink) uppercase dark:text-(--road-mid)">{t(road.eyebrow)}</p>
              <h2 id={`${road.id}-title`} tabIndex={-1} className="mt-1.5 font-heading outline-none text-[34px] leading-[1.1] font-bold tracking-[-0.02em] min-[700px]:text-[40px] min-[1280px]:text-[48px]">
                {t(road.title)}
              </h2>
              <p className="mt-2 max-w-[36ch] text-[15px] leading-normal text-pretty text-(--land-body) sm:text-lg">{t(road.line)}</p>
              {road.lineReceipts?.length ? <ReceiptChip ids={road.lineReceipts} title={t(road.line)} className="mt-2" /> : null}
            </>
          )}
          {road.note && (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium">
              <span className={cn(road.note.own && "rounded-full border border-dashed border-foreground/30 px-2.5 py-0.5")}>{t(road.note.text)}</span>
              {road.note.receipts.length > 0 && <ReceiptChip ids={road.note.receipts} title={t(road.note.text)} />}
            </p>
          )}
          {extras.length > 0 && road.extrasTitle && <Extras title={`${t(road.extrasTitle)} (${extras.length})`} items={extras} />}
          {road.link && (
            <Link
              href={road.link.href}
              className="group mt-5 inline-flex w-fit items-center gap-1.5 border-b-2 border-(--road-mid) pb-px text-[15px] font-semibold text-(--brand-ink) outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t(road.link.label)}
              <ArrowRightIcon aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          )}
        </div>

        <figure className={cn("m-0 min-w-0", artLeft && "min-[900px]:order-first")}>
          <div ref={host} className="@container min-w-0">
            {scene ? (
              <div
                className={cn("relative mx-auto w-fit max-w-full", geo?.padTop && "max-[900px]:pt-(--road-pad-top)")}
                style={{ paddingBottom: geo?.padBottom || undefined, ...(geo?.padTop ? { "--road-pad-top": `${geo.padTop}px` } : null) } as React.CSSProperties}
              >
                <div
                  className={cn("relative", !lay && "h-(--road-ph-h) w-[100cqw] @min-[480px]:aspect-(--road-ph-ar) @min-[480px]:h-auto @min-[480px]:max-w-(--road-ph-w)")}
                  style={lay ? undefined : reserve(scene)}
                >
                  {/* The engine sets the canvas's size; until it runs, the box above holds its room. */}
                  <canvas ref={canvas} role="img" aria-label={scene.label ? t(scene.label) : undefined} className="block h-0 w-0 [image-rendering:pixelated]" />
                  {geo && lay && (
                    <>
                      <svg aria-hidden className="pointer-events-none absolute top-0 left-0 z-[2] overflow-visible" width={lay.width} height={lay.height}>
                        {geo.lines.map(([x0, y0, x1, y1], i) => (
                          <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--road-mid)" strokeWidth={1} strokeOpacity={0.9} />
                        ))}
                        {geo.dots.map(([x, y], i) => (
                          <circle key={i} cx={x} cy={y} r={2} fill="var(--road-ink)" />
                        ))}
                      </svg>
                      {geo.pins.map(([x, y], i) => (
                        <span
                          key={i}
                          aria-hidden
                          className={cn(
                            "pointer-events-none absolute z-[5] flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-(--road-mid) bg-white leading-none font-bold text-(--road-ink) tabular-nums shadow-[0_1px_3px_rgba(31,26,43,0.18)]",
                            pinSize,
                          )}
                          style={{ left: x, top: y }}
                        >
                          {i + 1}
                        </span>
                      ))}
                    </>
                  )}
                  {overlay && cards}
                </div>
              </div>
            ) : null}
            {!overlay && cards}
          </div>
        </figure>
      </div>
    </section>
  );
}

/**
 * One of the three facts: number, figure, label, a part still to check, and the receipts chip.
 * `plain`: no box of its own (inside a card, as on /move's road cards), a hairline above instead.
 */
export function Card({
  ref,
  n,
  card,
  plain,
  className,
  style,
}: {
  ref?: React.Ref<HTMLLIElement>;
  n: number;
  card: RoadCard;
  plain?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const t = useT();
  const value = t(card.value);
  const m = /^(.*?)\s*(\(.*\))$/.exec(value);
  const label = t(card.label);
  const ids = [...card.receipts, ...(card.stillToCheck?.receipts ?? [])];
  return (
    <li
      ref={ref}
      style={style}
      className={cn(
        "flex min-w-0 items-start gap-2.5",
        plain ? "border-t border-(--land-line) pt-3" : "rounded-xl border border-border bg-(--land-card) px-3 py-2.5 shadow-[0_4px_14px_rgba(31,26,43,0.07)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-(--road-mid) bg-white text-[10px] leading-none font-bold text-(--road-ink) tabular-nums"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("leading-tight font-bold tracking-[-0.01em] text-(--road-ink) tabular-nums dark:text-(--road-mid)", value.length > 18 ? "text-base" : "text-xl")}>
          {m ? m[1] : value}
          {m && <small className="ml-1 text-[11.5px] font-medium tracking-normal text-muted-foreground">{m[2]}</small>}
        </span>
        <span className="text-[13px] leading-snug">{label}</span>
        {card.sub && <span className="text-xs text-muted-foreground">{t(card.sub)}</span>}
        {card.stillToCheck && <StillChip label={card.stillToCheck.label} className="mt-1" />}
        <ReceiptChip ids={ids} title={label} className="mt-1.5" />
      </div>
    </li>
  );
}

/** The extras under the line: closed by default, one row per figure or kind of proof. */
export function Extras({ title, items, className }: { title: string; items: RoadExtra[]; className?: string }) {
  return (
    <details className={cn("group mt-5 border-t border-(--land-line)", className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {title}
        <PlusIcon aria-hidden className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none" />
      </summary>
      <ExtrasList items={items} />
    </details>
  );
}

/** The extras' rows (also /move's road drawers, where they are always open). */
export function ExtrasList({ items }: { items: RoadExtra[] }) {
  const t = useT();
  return (
    <ul className="flex flex-col">
      {items.map((e, i) => {
        const label = t(e.label);
        return (
          <li key={i} className="flex flex-col gap-0.5 border-t border-(--land-line) py-2.5">
            <span className="text-sm font-semibold">{label}</span>
            {e.value && <span className="text-base font-bold text-(--road-ink) tabular-nums dark:text-(--road-mid)">{t(e.value)}</span>}
            {e.sub && <span className="text-[13px] text-muted-foreground text-pretty">{t(e.sub)}</span>}
            {(e.detail || e.add) && (
              <span className="text-[13px] text-muted-foreground text-pretty">
                {e.detail && t(e.detail)} {e.add && <b className="font-semibold text-foreground">{t(e.add)}</b>}
              </span>
            )}
            {e.figure && (
              <span className="text-[13px] text-muted-foreground">
                {t(e.figure.label)}: <b className="font-semibold text-(--road-ink) tabular-nums dark:text-(--road-mid)">{e.figure.value}</b>
                {e.figure.sub && ` · ${t(e.figure.sub)}`}
              </span>
            )}
            {e.receipts.length > 0 && <ReceiptChip ids={e.receipts} title={label} className="mt-1" />}
          </li>
        );
      })}
    </ul>
  );
}
