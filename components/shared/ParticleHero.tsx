"use client";

import { useEffect, useRef } from "react";
import { cn } from "cn";
import { usePaused } from "./PauseProvider";

// The site's dark hero ground, shared by / and /move: deep indigo, Kaplan indigo rising from below,
// a soft amber light, and a field of dots on a slowly moving wave seen in perspective (a 3D sine
// surface projected onto a canvas; moved here from /insights' InsightsHero unchanged in behaviour).
// Indigo and purple dots, amber on the crests, fainter and smaller with distance. One
// requestAnimationFrame loop, run only while the hero is on screen, the tab is visible and the
// site's pause is off; sized for the device pixel ratio (at most 2). With reduced motion it draws
// one still frame. The dot colours are read from --hero-dot-1..3 and --accent when it mounts.
// While the hero sits under the site header, <html data-header="hero"> (else "page").

/** Dot colours, low to high on the wave: deep indigo, the dark-mode chart purple, lavender, amber. */
const FALLBACK = ["#4d409e", "#8576e6", "#b9adff", "#ffb547"];
const TOKENS = ["--hero-dot-1", "--hero-dot-2", "--hero-dot-3", "--accent"];
const ALPHAS = [0.22, 0.42, 0.62, 0.85];
const Z_NEAR = 1;
const Z_FAR = 9;

function height(x: number, z: number, t: number) {
  return 0.3 * Math.sin(0.85 * x + 0.6 * t) * Math.cos(0.5 * z - 0.4 * t) + 0.12 * Math.sin(1.6 * x - 1.2 * z + 0.9 * t);
}

function draw(ctx: CanvasRenderingContext2D, colours: string[], w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const phone = w < 640;
  const cols = phone ? 70 : 120;
  const rows = phone ? 32 : 44;
  const fx = w * (phone ? 0.75 : 0.5);
  const fy = h * 0.5;
  const horizon = h * 0.36;
  const cam = 1.1;
  const size = Math.min(1.25, Math.max(0.75, w / 1200));
  // One path per colour and alpha: 16 fills a frame however many dots.
  const paths = colours.map(() => ALPHAS.map(() => new Path2D()));
  for (let r = 0; r < rows; r++) {
    const z = Z_NEAR + ((Z_FAR - Z_NEAR) * r) / (rows - 1);
    const depth = 1 - (z - Z_NEAR) / (Z_FAR - Z_NEAR);
    const a = Math.min(ALPHAS.length - 1, Math.floor(depth * depth * ALPHAS.length));
    const rad = Math.max(0.55, ((2.3 * size) / Math.pow(z, 0.8)) * (phone ? 0.85 : 1));
    for (let c = 0; c < cols; c++) {
      const x = -4.5 + (9 * c) / (cols - 1);
      const sx = w / 2 + (x * fx) / z;
      if (sx < -4 || sx > w + 4) continue;
      const y = height(x, z, t);
      const sy = horizon + ((cam - y) * fy) / z;
      if (sy > h + 4) continue;
      // -0.42..0.42 to 0..1; the top few per cent are amber.
      const n = (y + 0.42) / 0.84;
      const k = n > 0.9 ? 3 : n > 0.62 ? 2 : n > 0.32 ? 1 : 0;
      const p = paths[k][a];
      p.moveTo(sx + rad, sy);
      p.arc(sx, sy, k === 3 ? rad * 1.15 : rad, 0, Math.PI * 2);
    }
  }
  for (let k = 0; k < colours.length; k++) {
    ctx.fillStyle = colours[k];
    for (let a = 0; a < ALPHAS.length; a++) {
      ctx.globalAlpha = ALPHAS[a];
      ctx.fill(paths[k][a]);
    }
  }
  ctx.globalAlpha = 1;
}

/** The dot colours from the tokens, each falling back to its hex. */
function readColours(el: Element) {
  const css = getComputedStyle(el);
  return TOKENS.map((name, i) => css.getPropertyValue(name).trim() || FALLBACK[i]);
}

type Wave = { stop: () => void; pause: (paused: boolean) => void };

/** Runs the wave on a canvas; returns its cleanup and the site pause's switch. */
function startWave(el: HTMLCanvasElement): Wave {
  const ctx = el.getContext("2d");
  if (!ctx) return { stop: () => {}, pause: () => {} };
  const colours = readColours(el);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let w = 0,
    h = 0,
    raf = 0,
    onScreen = true,
    paused = false,
    clock = 0,
    last = 0;

  const frame = (now: number) => {
    raf = 0;
    if (last) clock += Math.min(64, now - last) / 1000;
    last = now;
    draw(ctx, colours, w, h, clock);
    schedule();
  };
  const schedule = () => {
    if (raf || reduce.matches || paused || !onScreen || document.hidden) return;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };
  const still = () => draw(ctx, colours, w, h, clock || 2);

  const resize = () => {
    const box = el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = box.width;
    h = box.height;
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    still();
  };
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(el);
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen) schedule();
    else stop();
  });
  io.observe(el);
  const onVisible = () => (document.hidden ? stop() : schedule());
  const onReduce = () => {
    if (reduce.matches) {
      stop();
      still();
    } else schedule();
  };
  document.addEventListener("visibilitychange", onVisible);
  reduce.addEventListener("change", onReduce);
  schedule();
  return {
    stop: () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      reduce.removeEventListener("change", onReduce);
    },
    pause: (p) => {
      paused = p;
      if (p) stop();
      else schedule();
    },
  };
}

/** The header's height in px (--header-h), for the strip the header covers. */
function headerHeight() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h"));
  return Number.isFinite(v) && v > 0 ? v : 68;
}

/** Sets <html data-header> to "hero" while `el` overlaps the header band, "page" otherwise. */
function watchHeader(el: HTMLElement) {
  const root = document.documentElement;
  let io: IntersectionObserver | null = null;
  const observe = () => {
    io?.disconnect();
    const strip = headerHeight();
    // The root shrunk to the band the header covers at the top of the viewport.
    io = new IntersectionObserver(([e]) => (root.dataset.header = e.isIntersecting ? "hero" : "page"), {
      rootMargin: `0px 0px ${-Math.max(0, window.innerHeight - strip)}px 0px`,
    });
    io.observe(el);
  };
  observe();
  window.addEventListener("resize", observe);
  return () => {
    io?.disconnect();
    window.removeEventListener("resize", observe);
    root.dataset.header = "page";
  };
}

const SCRIM = {
  // Words on the left (/move): as on /insights.
  left: "bg-[radial-gradient(60%_55%_at_18%_45%,var(--hero-scrim),transparent_75%),radial-gradient(45%_40%_at_85%_88%,var(--hero-scrim),transparent_80%)]",
  // The homepage's PLAN ahead and its route, across the middle of the hero.
  home: "bg-[radial-gradient(70%_60%_at_32%_48%,var(--hero-scrim),transparent_78%),radial-gradient(50%_40%_at_80%_92%,var(--hero-scrim),transparent_80%)]",
} as const;

export function ParticleHero({
  as: Tag = "section",
  id,
  className,
  scrim,
  children,
  "aria-labelledby": labelledBy,
}: {
  as?: "section" | "div";
  id?: string;
  className?: string;
  scrim: "left" | "home";
  children: React.ReactNode;
  "aria-labelledby"?: string;
}) {
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wave = useRef<Wave | null>(null);
  const paused = usePaused();

  useEffect(() => {
    if (!canvas.current) return;
    const w = startWave(canvas.current);
    wave.current = w;
    return () => {
      w.stop();
      wave.current = null;
    };
  }, []);

  useEffect(() => {
    wave.current?.pause(paused);
  }, [paused]);

  useEffect(() => (root.current ? watchHeader(root.current) : undefined), []);

  return (
    <Tag
      ref={root as React.RefObject<HTMLDivElement>}
      id={id}
      aria-labelledby={labelledBy}
      className={cn("on-dark relative isolate overflow-hidden bg-(--hero-top) text-white", className)}
    >
      <div aria-hidden className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,var(--hero-top)_0%,var(--hero-mid)_55%,var(--hero-base)_100%)]" />
      <div aria-hidden className="absolute -right-[20%] -bottom-[40%] -z-20 size-[70vmax] rounded-full bg-[radial-gradient(closest-side,var(--hero-glow),transparent_70%)]" />
      <canvas ref={canvas} aria-hidden className="absolute inset-0 -z-10 block size-full" />
      {/* Keeps the words readable over the dots. */}
      <div aria-hidden className={cn("absolute inset-0 -z-10", SCRIM[scrim])} />
      {children}
    </Tag>
  );
}
