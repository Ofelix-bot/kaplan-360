"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { usePaused } from "@/components/shared/PauseProvider";
import { CHECK, SPLIT } from "../timings";
import { appear, sec, useKeys, useLoop, walk } from "../use-clock";

// The pictures. 01 Break it down's (ThreeRoads): after graduation one road branches into three, Work,
// Study and Gap, each end named; the old six-way Branching (one branch per kind of door) stays beside
// it. Each road draws over 1.4s in its generation and undraws while the picture is hidden. Given a
// `clock` it runs on it; with `loop` it runs its own 14s loop while on screen and the site's pause is
// off; with neither it is drawn and still. `highlight` brings one branch and its end forward and dims
// the rest. Colours: --branch-ink (else --brand-ink) and --branch-fill (else --land-tint), so a
// coloured card can set its own. 02 Bring it together's, once on that section's clock: six roads narrow
// to one and the two outer ones fade on the way.

const L = SPLIT.loop;
const RESET = [sec(L, SPLIT.reset[0]), sec(L, SPLIT.reset[1])] as const;
const [G1, G2, G3] = SPLIT.generations;
const ROWS = [22, 60, 98, 142, 180, 218];
/** The moment everything is drawn: where a still picture rests. */
const DRAWN = sec(L, SPLIT.hold);
/** How far back the branches that aren't highlighted sit. */
const DIM = 0.28;

const BRANCHES = [
  "M220 60C300 60 300 22 380 22",
  "M220 60H380",
  "M220 60C300 60 300 98 380 98",
  "M220 180C300 180 300 142 380 142",
  "M220 180H380",
  "M220 180C300 180 300 218 380 218",
];

type Clock = { clock: MotionValue<number> };

/** The three ends of ThreeRoads, top to bottom (Work, Study, Gap). */
const THREE = [
  { d: "M150 120C215 120 215 44 280 44", y: 44 },
  { d: "M150 120H280", y: 120 },
  { d: "M150 120C215 120 215 196 280 196", y: 196 },
];

/** 01 Break it down: from graduation, the three roads, each end named (`roads`, top to bottom). */
export function ThreeRoads({ roads, label, start, loop = false }: { roads: readonly string[]; label: string; start?: string; loop?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const paused = usePaused();
  const inView = useInView(ref);
  const own = useLoop(L, loop && inView && !paused);
  const still = useMotionValue(DRAWN);
  const t = loop ? own.t : still;

  // Paused (by the visitor or reduced motion): rest on the drawn picture rather than mid-stroke.
  useEffect(() => {
    if (!loop) return;
    if (paused) own.hold(DRAWN);
    else own.release();
  }, [loop, paused, own]);

  const ink = "var(--branch-ink, var(--brand-ink))";
  return (
    <svg
      ref={ref}
      viewBox="0 0 400 240"
      role="img"
      aria-label={label}
      className="absolute inset-0 m-auto h-full w-full"
      fill="none"
      stroke={ink}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={22} cy={120} r={7} fill={ink} stroke="none" />
      {/* The start's name, under its dot (left edges lined up, so it stays inside the picture), smaller and
          lighter than the ends' names; there from the start, as the dot. */}
      {start && (
        <text aria-hidden x={15} y={138} dominantBaseline="hanging" fill="var(--muted)" stroke="none" className="text-[17px] font-semibold">
          {start}
        </text>
      )}
      <Road clock={t} d="M22 120H150" start={G1} />
      {THREE.map((r) => (
        <Road key={r.d} clock={t} d={r.d} start={G2} />
      ))}
      {THREE.map((r, i) => (
        <g key={r.y}>
          <End clock={t} cx={280} cy={r.y} r={7} start={SPLIT.endsLeft} fill="var(--branch-fill, var(--land-tint))" />
          <Name clock={t} x={296} y={r.y} start={SPLIT.endsLeft}>
            {roads[i]}
          </Name>
        </g>
      ))}
    </svg>
  );
}

/** A road's name beside its end: in with the end, gone again at the reset. Hidden from screen readers (the label says it). */
function Name({ clock, start, x, y, children }: Clock & { start: number; x: number; y: number; children: React.ReactNode }) {
  const opacity = useKeys(clock, [start, start + SPLIT.pop, RESET[0], RESET[1]], [0, 1, 1, 0], appear);
  return (
    <motion.text aria-hidden x={x} y={y} dominantBaseline="central" fill="currentColor" stroke="none" className="font-heading text-[26px] font-bold" style={{ opacity }}>
      {children}
    </motion.text>
  );
}

/** Left: from the degree you hold, every road it opens. Without `label` it is decorative (aria-hidden). */
export function Branching({ clock, label, loop = false, highlight }: { clock?: MotionValue<number>; label?: string; loop?: boolean; highlight?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const paused = usePaused();
  const inView = useInView(ref);
  const own = useLoop(L, loop && !clock && inView && !paused);
  const still = useMotionValue(DRAWN);
  const t = clock ?? (loop ? own.t : still);

  // Paused (by the visitor or reduced motion): rest on the drawn picture rather than mid-stroke.
  useEffect(() => {
    if (!loop || clock) return;
    if (paused) own.hold(DRAWN);
    else own.release();
  }, [loop, clock, paused, own]);

  const lit = highlight ?? -1;
  const upper = lit >= 0 && lit < 3;
  const lower = lit >= 3;
  const ink = "var(--branch-ink, var(--brand-ink))";
  return (
    <svg
      ref={ref}
      viewBox="0 0 400 240"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="absolute inset-0 m-auto h-full w-full"
      fill="none"
      stroke={ink}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={22} cy={120} r={7} fill={ink} stroke="none" />
      <Road clock={t} d="M22 120H120" start={G1} />
      <Road clock={t} d="M120 120C170 120 170 60 220 60" start={G2} dim={lit >= 0 && !upper} />
      <Road clock={t} d="M120 120C170 120 170 180 220 180" start={G2} dim={lit >= 0 && !lower} />
      {BRANCHES.map((d, i) => (
        <Road key={d} clock={t} d={d} start={G3} dim={lit >= 0 && i !== lit} />
      ))}
      {ROWS.map((y, i) => (
        <End key={y} clock={t} cx={380} cy={y} r={i === lit ? 8 : 5.5} start={SPLIT.endsLeft} fill={i === lit ? ink : "var(--branch-fill, var(--land-tint))"} dim={lit >= 0 && i !== lit} />
      ))}
    </svg>
  );
}

/** One road: draws from `start` (seconds), undraws at the reset; `dim` ones sit back. */
function Road({ clock, d, start, dim = false }: Clock & { d: string; start: number; dim?: boolean }) {
  const length = useKeys(clock, [start, start + SPLIT.draw, RESET[0], RESET[1]], [0, 1, 1, 0], [walk, (x) => x, appear]);
  // A round cap draws a dot even at length 0, so an undrawn road is hidden outright.
  const opacity = useTransform(length, (v) => (v > 0.001 ? (dim ? DIM : 1) : 0));
  return <motion.path d={d} style={{ pathLength: length, opacity }} />;
}

/** A road's end: pops in at `start` (seconds), gone again at the reset. */
function End({ clock, start, dim = false, ...circle }: Clock & { start: number; dim?: boolean } & React.SVGProps<SVGCircleElement>) {
  const shown = useKeys(clock, [start, start + SPLIT.pop, RESET[0], RESET[1]], [0, 1, 1, 0], appear);
  const opacity = useTransform(shown, (v) => (dim ? v * DIM : v));
  const scale = useKeys(clock, [start, start + SPLIT.pop, RESET[0], RESET[1]], [0.3, 1, 1, 0.3], appear);
  const { cx, cy, r, fill, stroke } = circle;
  return <motion.circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} className="origin-center [transform-box:fill-box]" style={{ opacity, scale }} />;
}

const [N1, N2] = CHECK.generations;

/** 02 Check: from every road an idea could take, the one that holds. Played once; it stays drawn. */
export function Narrowing({ clock, label }: Clock & { label: string }) {
  return (
    <svg viewBox="0 0 400 240" role="img" aria-label={label} className="absolute inset-0 m-auto h-full w-full" fill="none" stroke="var(--land-night-body)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      {ROWS.map((y, i) => (
        <NarrowRoad key={y} clock={clock} d={`M20 ${y}C100 ${y} 100 120 180 120`} start={N1} fades={i === 0 || i === ROWS.length - 1} />
      ))}
      <NarrowRoad clock={clock} d="M180 120H372" start={N2} />
      <NarrowEnd clock={clock} />
    </svg>
  );
}

/** One road of the narrowing: draws from `start` (seconds); `fades` ones drop back once drawn. */
function NarrowRoad({ clock, d, start, fades = false }: Clock & { d: string; start: number; fades?: boolean }) {
  const length = useKeys(clock, [start, start + CHECK.draw], [0, 1], walk);
  const dim = useKeys(clock, [...CHECK.fade], fades ? [1, CHECK.fadeTo] : [1, 1], appear);
  // As above, an undrawn road is hidden outright; both values are read every time.
  const opacity = useTransform(() => {
    const drawn = length.get() > 0.001;
    const v = dim.get();
    return drawn ? v : 0;
  });
  return <motion.path d={d} data-fades={fades || undefined} style={{ pathLength: length, opacity }} />;
}

/** Where the roads arrive: pops in at CHECK.end. */
function NarrowEnd({ clock }: Clock) {
  const opacity = useKeys(clock, [CHECK.end, CHECK.end + CHECK.pop], [0, 1], appear);
  const scale = useKeys(clock, [CHECK.end, CHECK.end + CHECK.pop], [0.3, 1], appear);
  return <motion.circle cx={372} cy={120} r={8} fill="var(--land-night-ink)" stroke="none" className="origin-center [transform-box:fill-box]" style={{ opacity, scale }} />;
}
