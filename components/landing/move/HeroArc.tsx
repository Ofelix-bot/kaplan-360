"use client";

import { useEffect, useRef, useState } from "react";

// /move's hero: a lit ring around the slogan, matched to the user's mock (2026-11-01, then three design
// reviews). A tilted ellipse whose major axis runs from just past the screen's left edge (never more than
// 1.8em before the slogan; 0.92em above the block's centre) to just past the second line's full stop
// (0.1em after it, 0.6em below the centre), so the ring passes under the stop and turns beyond it. Its
// lowest point is 2.5em below the centre, its outer edge at least max(24px, 3% of the screen's height)
// above the amber dash. The band is the space between two ellipses that share their ends but not their
// centres: 0.265em at the front, 0.17em at the sides, a hairline at the back; the back fades out along a
// sloping edge. Its brightness follows the mock: it fades in from the screen's left edge, brightens toward
// the right and fades through the turn past the full stop. On phones (under 640px) the ring runs off both
// sides, deeper and with a minimum thickness. A soft grey-lavender band, no glow, a faint sheen on the
// inner edge. Everything is measured from the slogan as laid out (offsets, which ignore the entrance's
// transforms) and redrawn when the hero or the window resizes or the fonts arrive. Over the dots, under
// the words; decorative.

type Ring = {
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** Tilt of the major axis, degrees (clockwise: the right end lower). */
  deg: number;
  a: number;
  b: number;
  /** Band thickness at the front (bottom), the sides and the back (top). */
  front: number;
  side: number;
  back: number;
  /** The screen's left edge in the column's coordinates, and the screen's width. */
  edge: number;
  vw: number;
  /** Brightness along the ring, in the column's x: [x, opacity] stops, left to right. */
  stops: [number, number][];
};

/** Offset of `el` from `root` (one of its offset parents), ignoring transforms. */
function offset(el: HTMLElement, root: HTMLElement) {
  let x = 0,
    y = 0;
  for (let e: HTMLElement | null = el; e && e !== root; e = e.offsetParent as HTMLElement | null) {
    x += e.offsetLeft;
    y += e.offsetTop;
  }
  return { x, y };
}

/** One ellipse of the band, `p` across it: 0 its inner edge, 1 its outer edge (fractions beyond widen it). */
function edge(r: Ring, p: number) {
  const rx = r.a - r.side / 2 + p * r.side;
  const bottom = r.b - r.front / 2 + p * r.front;
  const top = -(r.b - r.back / 2 + p * r.back);
  const cy = (bottom + top) / 2;
  const ry = (bottom - top) / 2;
  return `M${-rx} ${cy}A${rx} ${ry} 0 1 0 ${rx} ${cy}A${rx} ${ry} 0 1 0 ${-rx} ${cy}Z`;
}

/** The band between `p0` and `p1` (even-odd: the space between the two ellipses). */
const band = (r: Ring, p0: number, p1: number) => edge(r, p1) + edge(r, p0);

/**
 * The back's fade, in the ring's frame: fully shown below the line y = c − k·x, gone 0.2b above it. The line
 * sits 0.15b below the left end and 0.3b above the right end.
 */
function fadeAxis(r: Ring) {
  const k = (0.1 * r.b) / r.a,
    c = 0.05 * r.b,
    w = 0.25 * r.b;
  const n = Math.hypot(k, 1);
  return { x1: (-w * k) / n, y1: c - w / n, x2: 0, y2: c };
}

export function HeroArc() {
  const svg = useRef<SVGSVGElement>(null);
  const [ring, setRing] = useState<Ring | null>(null);

  useEffect(() => {
    const el = svg.current;
    const root = el?.parentElement;
    if (!el || !root) return;
    const draw = () => {
      const block = root.querySelector<HTMLElement>('[data-arc="block"]');
      const start = root.querySelector<HTMLElement>('[data-arc="start"]');
      const end = root.querySelector<HTMLElement>('[data-arc="end"]');
      const dash = root.querySelector<HTMLElement>(".mv-side > span");
      const title = block?.querySelector("h1");
      if (!block || !start || !end || !dash || !title) return;
      const f = parseFloat(getComputedStyle(title).fontSize);
      const vw = document.documentElement.clientWidth;
      // The screen's left edge in the column's coordinates (the column is centred past --max).
      const screenLeft = -root.getBoundingClientRect().left;
      // The block's top is at 40% of the first screen and it is pulled up by half its height: its centre.
      const yc = block.offsetTop;
      const vh = yc / 0.4;
      const x1 = offset(start, root).x;
      const x2 = offset(end, root).x + end.offsetWidth;
      // Phones: the full stop sits at the screen's edge, with no room to turn; the ring runs off both sides.
      const narrow = vw < 640;
      // The major axis's ends: just past the screen's left edge (or further out, where the slogan starts
      // nearer the edge, but never more than 1.8em before it on wide screens), and just past the full stop.
      const ax = narrow ? screenLeft - 0.06 * vw : Math.max(Math.min(x1 - 0.92 * f, screenLeft - 0.006 * vw), x1 - 1.8 * f),
        ay = yc - 0.92 * f;
      const bx = narrow ? screenLeft + 1.06 * vw : x2 + 0.1 * f,
        by = yc + 0.6 * f;
      const cx = (ax + bx) / 2,
        cy = (ay + by) / 2;
      const a = Math.hypot(bx - ax, by - ay) / 2;
      const t = Math.atan2(by - ay, bx - ax);
      const front = Math.max(0.265 * f, narrow ? 11 : 0);
      const side = Math.max(0.17 * f, narrow ? 7 : 0);
      // The lowest point: 2.5em under the centre (on phones at least 17% of the screen), its outer edge at
      // least max(24px, 3% of the screen's height) above the dash.
      const want = yc + Math.max(2.5 * f, narrow ? 0.17 * vh : 0);
      const lowest = Math.min(want, offset(dash, root).y - Math.max(24, 0.03 * vh) - front / 2);
      const dy = lowest - cy;
      const b = Math.sqrt(Math.max(0, (dy * dy - a * a * Math.sin(t) ** 2) / Math.cos(t) ** 2));
      // Brightness along the ring, as on the mock: it fades in from the screen's edge, brightens toward the
      // right and, past the full stop, fades through the turn (on phones it fades out toward the right edge).
      const left = screenLeft + 0.01 * vw;
      const stops: [number, number][] = narrow
        ? [[left, 0], [screenLeft + 0.055 * vw, 0.62], [x1 + 2 * f, 0.7], [screenLeft + 0.8 * vw, 1], [screenLeft + vw, 0.3]]
        : [[left, 0], [screenLeft + 0.055 * vw, 0.62], [x1 + 2 * f, 0.65], [(x1 + x2) / 2, 0.88], [x2 - 0.6 * f, 1], [x2 - 0.4 * f, 0.63], [x2 - 0.17 * f, 0.33], [x2 + 0.05 * f, 0.2], [x2 + 0.35 * f, 0.12]];
      // Keep the stops in order where a short slogan or a narrow screen brings them together.
      for (let i = 1; i < stops.length; i++) stops[i][0] = Math.max(stops[i][0], stops[i - 1][0] + 1);
      setRing({ w: root.offsetWidth, h: root.offsetHeight, cx, cy, deg: (t * 180) / Math.PI, a, b, front, side, back: 0.03 * f, edge: screenLeft, vw, stops });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(root);
    const title = root.querySelector("h1");
    if (title) ro.observe(title);
    // Past --max the column keeps its size and only moves: the window's own resize keeps the ends right.
    window.addEventListener("resize", draw);
    document.fonts?.ready.then(draw);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, []);

  const r = ring;
  return (
    <svg
      ref={svg}
      aria-hidden="true"
      className="mv-arc pointer-events-none absolute inset-0 size-full overflow-visible"
      viewBox={r ? `0 0 ${r.w} ${r.h}` : undefined}
      preserveAspectRatio="none"
    >
      {r && r.b > r.front && (
        <>
          <defs>
            {/* In the column's frame: the brightness along the ring (Ring.stops). */}
            <linearGradient id="mv-arc-edge" gradientUnits="userSpaceOnUse" x1={r.stops[0][0]} y1={0} x2={r.stops[r.stops.length - 1][0]} y2={0}>
              {r.stops.map(([x, o], i) => (
                <stop key={i} offset={(x - r.stops[0][0]) / (r.stops[r.stops.length - 1][0] - r.stops[0][0])} stopColor="#fff" stopOpacity={o} />
              ))}
            </linearGradient>
            <mask id="mv-arc-edge-mask" maskUnits="userSpaceOnUse" x={r.edge - r.vw} y={-r.h} width={3 * r.vw} height={3 * r.h}>
              <rect x={r.edge - r.vw} y={-r.h} width={3 * r.vw} height={3 * r.h} fill="url(#mv-arc-edge)" />
            </mask>
          </defs>
          <g mask="url(#mv-arc-edge-mask)">
            <g transform={`translate(${r.cx} ${r.cy}) rotate(${r.deg})`}>
              <defs>
                {/* In the ring's own frame: the front whole, the back fading out along a sloping edge. */}
                <linearGradient id="mv-arc-fade" gradientUnits="userSpaceOnUse" {...fadeAxis(r)}>
                  <stop offset={0} stopColor="#fff" stopOpacity={0} />
                  <stop offset={1} stopColor="#fff" stopOpacity={1} />
                </linearGradient>
                <mask id="mv-arc-mask" maskUnits="userSpaceOnUse" x={-2 * r.a} y={-2 * r.b} width={4 * r.a} height={4 * r.b}>
                  <rect x={-2 * r.a} y={-2 * r.b} width={4 * r.a} height={4 * r.b} fill="url(#mv-arc-fade)" />
                </mask>
                <filter id="mv-arc-soft" filterUnits="userSpaceOnUse" x={-r.a - 40} y={-r.b - 40} width={2 * r.a + 80} height={2 * r.b + 80}>
                  <feGaussianBlur stdDeviation={0.8} />
                </filter>
              </defs>
              <g mask="url(#mv-arc-mask)">
                <path d={band(r, 0, 1)} fillRule="evenodd" fill="#A39BD8" fillOpacity={0.88} filter="url(#mv-arc-soft)" />
                <path d={band(r, 0.15, 0.45)} fillRule="evenodd" fill="#E2DBFF" fillOpacity={0.16} filter="url(#mv-arc-soft)" />
              </g>
            </g>
          </g>
        </>
      )}
    </svg>
  );
}
