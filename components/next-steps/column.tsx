"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Card } from "@/components/ui/card";
import { CENTRE_ID, COLUMN_RAIL_X, COLUMN_SIZE, roadId, type Measure, type Road, type RoadKey, type Tree } from "@/lib/next-steps";
import { transitions } from "@/lib/motion";
import { Appear, BUTTON, CARD, CentreCard, DIM, ENTER_SHIFT, enterTransition, LAYER_DELAY, LeafCard, useDimmed, useMap, type CentreView } from "./nodes";
import { FADE } from "./ring";
import { ROAD_ICON, roadVars, TILE, useSay } from "./roads";

// The phone tree (under 800 px): the centre on top, the three groups (./groups.ts) down a rail on the
// left, each a heading that opens and closes its leaves (all closed at first; each on its own). A closed heading
// shows one small ring per leaf, drawn only: the figures are in the leaves. Opening grows the road's
// height and brings its leaves in one after another (LAYER_DELAY apart); with reduced motion it opens
// and closes at once. Lines are elbows with a rounded corner, in the colour of the road they lead to.

const S = COLUMN_SIZE;
const CORNER = 8;
/** The rail under a road, for its leaves: half a tile in from the road's left edge. */
const LEAF_RAIL = S.roadIndent + 12;
/** A closed heading's rings, px. */
const MINI = 18;

/** An elbow from a rail at `x` (from `top`) down to `y`, then right to `to`. */
const elbow = (x: number, top: number, y: number, to: number) => `M ${x} ${top} V ${y - CORNER} Q ${x} ${y} ${x + CORNER} ${y} H ${to}`;

/** A leaf's middle, from the top of its road's leaves. */
const leafMid = (i: number) => S.gap + i * (S.gap + S.leaf) + S.leaf / 2;

/** An elbow in the road's colour: drawn in with the load motion (`delay`: on opening, after the leaves above it). */
function Line({ id, d, road, layer, delay }: { id: string; d: string; road: RoadKey; layer: 1 | 2; delay?: number }) {
  const m = useMap();
  const dim = useDimmed(id);
  const draw = delay !== undefined && !m.reduce;
  return (
    <motion.path
      key={m.reduce ? "still" : "moving"}
      d={d}
      fill="none"
      stroke={`var(--road-${road})`}
      strokeWidth={2}
      strokeLinecap="round"
      initial={draw || !(m.reduce || m.played) ? { pathLength: 0 } : false}
      animate={{ pathLength: 1, opacity: dim ? DIM : 1 }}
      transition={draw ? { ...transitions.enter, delay } : enterTransition(layer, m.played, m.reduce)}
    />
  );
}

/** The left rail on through a road's block, down to the next road (whose colour it carries). */
function Through({ next }: { next: RoadKey }) {
  const m = useMap();
  const dim = useDimmed(`${CENTRE_ID}>${roadId(next)}`);
  return (
    <motion.span
      key={m.reduce ? "still" : "moving"}
      aria-hidden
      className="pointer-events-none absolute top-0 bottom-0 w-0.5 origin-top rounded-full"
      style={{ left: COLUMN_RAIL_X - 1, background: `var(--road-${next})` }}
      initial={m.reduce || m.played ? false : { scaleY: 0 }}
      animate={{ scaleY: 1, opacity: dim ? DIM : 1 }}
      transition={enterTransition(1, m.played, m.reduce)}
    />
  );
}

/** A leaf's measure on a closed heading: the ring alone, a neutral dot for a yes/no fact, a dashed circle for one not collected. */
function MiniMark({ m }: { m: Measure }) {
  if (m.kind === "ring") {
    const stroke = 3;
    const r = (MINI - stroke) / 2;
    const c = 2 * Math.PI * r;
    const fill = Math.max(0, Math.min(1, m.value / m.max));
    return (
      <svg width={MINI} height={MINI} viewBox={`0 0 ${MINI} ${MINI}`} className="shrink-0 -rotate-90">
        <circle cx={MINI / 2} cy={MINI / 2} r={r} fill="none" stroke="var(--land-line)" strokeWidth={stroke} />
        {fill > 0 && <circle cx={MINI / 2} cy={MINI / 2} r={r} fill="none" stroke="var(--r)" strokeWidth={stroke} strokeLinecap={fill < 1 ? "round" : "butt"} strokeDasharray={`${c * fill} ${c}`} />}
      </svg>
    );
  }
  if (m.kind === "badge")
    return (
      <span className="flex shrink-0 items-center justify-center" style={{ width: MINI, height: MINI }}>
        <span className="size-2 rounded-full bg-muted-foreground" />
      </span>
    );
  return <span className="shrink-0 rounded-full border-2 border-dashed border-(--land-line)" style={{ width: MINI, height: MINI }} />;
}

/** A road's heading: a button that opens and closes its leaves, with their rings while closed and a chevron. */
function RoadHeading({ road, open, controls, onToggle }: { road: Road; open: boolean; controls: string; onToggle: () => void }) {
  const t = useT();
  const say = useSay();
  const m = useMap();
  const id = roadId(road.key);
  const on = m.selected.road === road.key;
  const Icon = ROAD_ICON[road.key];
  return (
    <Card style={roadVars(road.key)} className={cn(CARD, on && "shadow-[inset_0_0_0_2px_var(--r)]")}>
      <button
        type="button"
        className={cn(BUTTON, "gap-2.5 px-3")}
        aria-expanded={open}
        aria-controls={controls}
        data-node={id}
        onClick={onToggle}
        onFocus={() => m.setFocused(id)}
        onBlur={() => m.setFocused(null)}
      >
        <span aria-hidden className={cn(TILE, FADE, "size-10 rounded-xl")}>
          <Icon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 text-sm leading-tight font-bold">{say(road.name)}</span>
          <span className="text-xs text-muted-foreground">{t("{n} roads", { n: road.leaves.length })}</span>
        </span>
        {!open && (
          <span aria-hidden className={cn(FADE, "flex shrink-0 items-center gap-1")}>
            {road.leaves.map((l) => (
              <MiniMark key={l.id} m={l.measure} />
            ))}
          </span>
        )}
        <ChevronDownIcon aria-hidden className={cn("size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out", open && "rotate-180")} />
      </button>
    </Card>
  );
}

/** A leaf coming in as its road opens: the i-th after the leaves above it; dimmed like the map's nodes. */
function Reveal({ id, i, children }: { id: string; i: number; children: ReactNode }) {
  const m = useMap();
  const dim = useDimmed(id);
  return (
    <motion.div
      className="h-full w-full"
      initial={m.reduce ? false : { opacity: 0, scale: 0.92, x: -ENTER_SHIFT }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={m.reduce ? { duration: 0 } : { ...transitions.enter, delay: i * LAYER_DELAY }}
    >
      <div data-dim={dim ? "" : undefined} className="group/node h-full w-full">
        {children}
      </div>
    </motion.div>
  );
}

function RoadBlock({ road, next, open, onToggle }: { road: Road; next: RoadKey | null; open: boolean; onToggle: () => void }) {
  const m = useMap();
  const id = roadId(road.key);
  const region = `column-${road.key}`;
  const height = road.leaves.length * (S.gap + S.leaf);
  return (
    <div className="relative" style={{ marginTop: S.roadGap }}>
      {next && <Through next={next} />}
      <svg aria-hidden className="pointer-events-none absolute left-0 overflow-visible" style={{ top: -S.roadGap }} width={S.roadIndent} height={S.roadGap + S.road / 2}>
        <Line id={`${CENTRE_ID}>${id}`} d={elbow(COLUMN_RAIL_X, 0, S.roadGap + S.road / 2, S.roadIndent)} road={road.key} layer={1} />
      </svg>
      <div style={{ marginLeft: S.roadIndent, height: S.road }}>
        <Appear id={id} layer={1} shift={{ x: ENTER_SHIFT, y: 0 }}>
          <RoadHeading road={road} open={open} controls={region} onToggle={onToggle} />
        </Appear>
      </div>
      <div id={region}>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="leaves"
              // Room for the cards' hover growth and focus ring, which the height motion would clip.
              className="relative -mr-2 overflow-hidden pr-2"
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0, opacity: 0 }}
              transition={m.reduce ? { duration: 0 } : transitions.move}
            >
              <svg aria-hidden className="pointer-events-none absolute top-0 left-0 overflow-visible" width={S.leafIndent} height={height}>
                {road.leaves.map((l, i) => (
                  <Line key={l.id} id={`${id}>${l.id}`} d={elbow(LEAF_RAIL, 0, leafMid(i), S.leafIndent)} road={road.key} layer={2} delay={i * LAYER_DELAY} />
                ))}
              </svg>
              {road.leaves.map((l, i) => (
                <div key={l.id} style={{ marginTop: S.gap, marginLeft: S.leafIndent, height: S.leaf }}>
                  <Reveal id={l.id} i={i}>
                    <LeafCard leaf={l} compact />
                  </Reveal>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function ColumnTree({ tree, centre }: { tree: Tree; centre: CentreView }) {
  const t = useT();
  const m = useMap();
  const [shown, setShown] = useState<ReadonlySet<RoadKey>>(() => new Set());
  // The road of a leaf whose panel is open stays open.
  const isOpen = (k: RoadKey) => shown.has(k) || (m.open && m.selected.road === k);
  const toggle = (k: RoadKey) =>
    setShown((s) => {
      const n = new Set(s);
      if (isOpen(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  return (
    <div role="group" aria-label={t("Map of your roads")} className="w-full">
      <div style={{ height: S.centre }}>
        <Appear id={CENTRE_ID} layer={0} shift={{ x: 0, y: 0 }}>
          <CentreCard view={centre} />
        </Appear>
      </div>
      {tree.roads.map((r, i) => (
        <RoadBlock key={r.key} road={r} next={tree.roads[i + 1]?.key ?? null} open={isOpen(r.key)} onToggle={() => toggle(r.key)} />
      ))}
    </div>
  );
}

/** The centre alone, where the tree will put it: shown while the scores load. */
export function ColumnWaiting({ centre }: { centre: CentreView }) {
  const t = useT();
  return (
    <div aria-busy="true" style={{ height: S.centre }}>
      <p role="status" className="sr-only">
        {t("Loading programmes")}
      </p>
      <CentreCard view={centre} />
    </div>
  );
}
