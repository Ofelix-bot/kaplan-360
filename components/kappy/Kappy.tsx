"use client";

import { useEffect, useRef, type CSSProperties, type Ref, type RefObject } from "react";
import { cn } from "cn";
import sprite from "@/lib/kappy/sprite.json";
import { gridPaths, KappyEngine, type Accessory, type Face, type KappyInfo, type Pose } from "./engine";
import css from "./kappy.module.css";

// Kappy in React: an empty element the engine (engine.ts) draws into once mounted, so the server HTML holds only its
// box. Pass `ref` to drive it (set, say, showTool, flash, light, celebrate…), `bubble` for where its lines go, and
// `still` with `pose` for a frame that doesn't move. Size: `scale`, or --kappy-scale on any ancestor (default 3).

type Props = {
  ref?: Ref<KappyEngine | null>;
  scale?: number;
  acc?: Accessory;
  still?: boolean;
  pose?: Pose;
  bubble?: RefObject<HTMLDivElement | null>;
  /** Said on a click; null for a wave only. */
  poke?: string | null;
  /** The accessible name of the button around an interactive Kappy. */
  label?: string;
  onChange?: (info: KappyInfo) => void;
  onClick?: () => void;
  /** Hidden but keeping its place (a Kappy that split into two). */
  away?: boolean;
  className?: string;
};

function assign<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

export function Kappy({ ref, scale, acc, still = false, pose, bubble, poke = null, label = "Kappy", onChange, onClick, away = false, className }: Props) {
  const el = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<KappyEngine | null>(null);
  const latest = useRef({ onChange, poke });
  useEffect(() => {
    latest.current = { onChange, poke };
  });

  useEffect(() => {
    if (!el.current) return;
    const engine = new KappyEngine(el.current, {
      still,
      acc,
      get poke() {
        return latest.current.poke;
      },
      onChange: (info) => latest.current.onChange?.(info),
    });
    engine.bubble = bubble?.current ?? null;
    if (pose) engine.pose(pose);
    engineRef.current = engine;
    assign(ref, engine);
    return () => {
      engine.destroy();
      engineRef.current = null;
      assign(ref, null);
    };
    // The engine is made once per mount; pose and accessory are fixed for a Kappy's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = scale ? ({ "--kappy-scale": scale } as CSSProperties) : undefined;
  const box = <span ref={el} className={css.kappy} data-acc={acc} style={style} />;
  if (still) return <span className={cn(away && css.away, className)}>{box}</span>;
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(css.hit, away && css.away, className)}
      onClick={() => {
        engineRef.current?.poke();
        onClick?.();
      }}
    >
      {box}
    </button>
  );
}

/** A speech bubble Kappy types into. tail: which side points at Kappy. */
export function KappyBubble({ ref, tail = "left", empty = false, className, children }: { ref?: Ref<HTMLDivElement>; tail?: "left" | "up" | "down"; empty?: boolean; className?: string; children?: React.ReactNode }) {
  return (
    <div ref={ref} className={cn(css.bubble, className)} data-tail={tail === "left" ? undefined : tail} data-empty={empty ? "" : undefined}>
      <span data-vis aria-hidden="true" />
      <span data-sr className={css.sr} aria-live="polite" />
      {children}
    </div>
  );
}

/** One of the chest screen's icons or faces (16 x 10), in the current text colour. */
export function KappyIcon({ name, className }: { name: Face; className?: string }) {
  return (
    <svg viewBox="0 0 16 10" className={className} shapeRendering="crispEdges" aria-hidden="true">
      {gridPaths(sprite.faces[name], 0, 0, false, "").map((p) => (
        <path key={p.d} d={p.d} fill="currentColor" />
      ))}
    </svg>
  );
}
