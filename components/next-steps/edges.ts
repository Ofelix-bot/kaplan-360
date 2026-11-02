import type { Layout, LayoutNode } from "@/lib/next-steps";

// The radial map's edges as smooth cubic béziers between node sides, worked out from the engine's
// layout (lib/next-steps/layout.ts) rather than from handles: for each edge, every pair of sides (at
// the side's middle, or the middle of the stretch the two nodes share) is tried, a curve leaving and
// entering at right angles to its sides; the shortest that passes through no other node wins. Pure and
// deterministic, like the layout.

type Pt = { x: number; y: number };
type Side = "top" | "bottom" | "left" | "right";
const SIDES: Side[] = ["top", "bottom", "left", "right"];
const NORMAL: Record<Side, Pt> = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
/** An edge shorter than this reads as two touching nodes: avoided when a longer one is clear. */
const SHORT = 24;
const SAMPLES = 32;
/** The span two nodes must share for the straight line across a narrow gap (the centre and its roads). */
const SHARED = 40;

/** The points a side offers: its middle, and the middle of the span it shares with `other`. */
function anchors(n: LayoutNode, side: Side, other: LayoutNode): Pt[] {
  const vertical = side === "top" || side === "bottom";
  const [a0, a1, b0, b1] = vertical ? [n.x, n.x + n.width, other.x, other.x + other.width] : [n.y, n.y + n.height, other.y, other.y + other.height];
  const fixed = side === "top" ? n.y : side === "bottom" ? n.y + n.height : side === "left" ? n.x : n.x + n.width;
  const along = [(a0 + a1) / 2];
  const lo = Math.max(a0, b0);
  const hi = Math.min(a1, b1);
  if (hi - lo > 0) along.push((lo + hi) / 2);
  return along.map((v) => (vertical ? { x: v, y: fixed } : { x: fixed, y: v }));
}

const cubic = (p: Pt[], t: number): Pt => {
  const u = 1 - t;
  const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x, y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y };
};

const inside = (q: Pt, n: LayoutNode, inset: number) => q.x > n.x + inset && q.x < n.x + n.width - inset && q.y > n.y + inset && q.y < n.y + n.height - inset;

/** A straight line across the gap when two nodes sit within SHORT of each other and share SHARED px or more across. */
function touching(a: LayoutNode, b: LayoutNode): string | null {
  const lo = Math.max(a.x, b.x);
  const hi = Math.min(a.x + a.width, b.x + b.width);
  const top = a.y + a.height <= b.y ? [a.y + a.height, b.y] : b.y + b.height <= a.y ? [a.y, b.y + b.height] : null;
  if (hi - lo >= SHARED && top && Math.abs(top[1] - top[0]) < SHORT) return `M ${(lo + hi) / 2} ${top[0]} L ${(lo + hi) / 2} ${top[1]}`;
  return null;
}

/** Every edge's SVG path, by edge id. */
export function edgePaths(layout: Layout): Record<string, string> {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const out: Record<string, string> = {};
  for (const e of layout.edges) {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    // Nodes that nearly touch and share a span: a short straight line across the gap.
    const straight = touching(a, b);
    if (straight) {
      out[e.id] = straight;
      continue;
    }
    let best: { score: number; d: string } | null = null;
    for (const sa of SIDES)
      for (const sb of SIDES)
        for (const p0 of anchors(a, sa, b))
          for (const p3 of anchors(b, sb, a)) {
            const dx = p3.x - p0.x;
            const dy = p3.y - p0.y;
            // Leave and enter each side outward, never back through the node.
            if (NORMAL[sa].x * dx + NORMAL[sa].y * dy <= 0 || NORMAL[sb].x * -dx + NORMAL[sb].y * -dy <= 0) continue;
            const len = Math.hypot(dx, dy);
            const k = 0.45 * len;
            const p = [p0, { x: p0.x + NORMAL[sa].x * k, y: p0.y + NORMAL[sa].y * k }, { x: p3.x + NORMAL[sb].x * k, y: p3.y + NORMAL[sb].y * k }, p3];
            let hits = 0;
            let arc = 0;
            let prev = p0;
            for (let i = 1; i <= SAMPLES; i++) {
              const q = cubic(p, i / SAMPLES);
              arc += Math.hypot(q.x - prev.x, q.y - prev.y);
              prev = q;
              if (i < SAMPLES && layout.nodes.some((n) => inside(q, n, n === a || n === b ? 1 : -2))) hits++;
            }
            const score = hits * 1000 + arc + (arc < SHORT ? 200 : 0);
            if (!best || score < best.score) best = { score, d: `M ${p0.x} ${p0.y} C ${p[1].x} ${p[1].y}, ${p[2].x} ${p[2].y}, ${p3.x} ${p3.y}` };
          }
    out[e.id] = best?.d ?? `M ${a.x + a.width / 2} ${a.y + a.height / 2} L ${b.x + b.width / 2} ${b.y + b.height / 2}`;
  }
  return out;
}

/** The unit vector from a node's parent to it (its entrance moves along it). */
export function outward(layout: Layout): Record<string, Pt> {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const out: Record<string, Pt> = {};
  for (const e of layout.edges) {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    const dx = b.x + b.width / 2 - (a.x + a.width / 2);
    const dy = b.y + b.height / 2 - (a.y + a.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    out[e.to] = { x: dx / len, y: dy / len };
  }
  return out;
}
