// The pixel engine behind the four roads' art (components/landing/roads). Ported from the v2
// prototypes (scratchpad four-roads/_tools/<road>-v2/scene.js), where each scene carried its own copy
// of these helpers: one 2:1 isometric projection (1 world unit = 2px across, 1px down; z in px), flat
// fills on whole pixels, sprites drawn once to small canvases, and a stage that shows the art at a
// whole-number scale with smoothing off, so every logical pixel is a square of device pixels.
//
// A scene (scenes/<road>.ts) implements SceneModule. The stage draws it into a buffer of
// logicalW × logicalH, then copies the visible part (all of it, or the crop on narrow widths) onto
// the canvas. runLoop animates only while the canvas is on screen and the tab is visible; with
// prefers-reduced-motion it draws one still frame at finalT. No dependencies; browser only (call
// from effects, never at module load, since sprites need document).

// ---------- types ----------

export type Point = readonly [number, number];
export type Point3 = readonly [number, number, number];
/** Top, left face, right face. */
export type Tones = readonly [string, string, string];
export type PinKey = "1" | "2" | "3";
export type Rect = { x: number; y: number; w: number; h: number };

/** A small canvas with its anchor (the pixel that lands on the point it is blitted at). */
export type Sprite = { c: HTMLCanvasElement; ax: number; ay: number };

/** Where a card sits over the art (wide layout only), in logical px, top-left corner. */
export type CardPlacement = {
  x: number;
  y: number;
  /** Card width in CSS px; defaults to the scene's cardWidth. */
  w?: number;
  /**
   * How the leader leaves the card. "auto": from the side facing the pin, then a 45° leg (or straight
   * down/up when the pin is above or below the card). "vertical": from the top or bottom edge
   * whenever the pin is above or below the card. "hv": along the card's first line, then straight
   * down or up to the pin.
   */
  leader?: "auto" | "vertical" | "hv";
};

/**
 * One road's art. Coordinates are logical px of the art (0..logicalW, 0..logicalH) unless noted.
 * Everything a scene needs at runtime comes through `engine`; build sprites and layers in init.
 */
export interface SceneModule {
  logicalW: number;
  logicalH: number;
  /** Loop length, seconds. */
  period: number;
  /** The still frame for reduced motion, seconds. */
  finalT: number;
  /** Where each card's pin points. */
  anchors: Record<PinKey, Point>;
  /** Called every frame with the buffer's context (logicalW × logicalH, already cleared), t in [0, period). */
  draw(ctx: CanvasRenderingContext2D, t: number, engine: Engine): void;
  /**
   * The part to keep on narrow widths. The view is centred on this rect, as wide as fits (up to
   * logicalW) and, below 480 CSS px of width, rect.h tall (the full height above that). Without it,
   * the centre of the art is kept.
   */
  crop?: Rect;
  /**
   * Never crop: the whole art at the largest whole number of device px per pixel that fits the host
   * (and maxH), down to 1. For a scene whose every part carries the point (/move's #problem).
   */
  whole?: boolean;

  /** The art's description for screen readers (a translation key; English). */
  label?: string;
  /** Projection origin for the painter (the prototypes' OX0, OY0). Default: [logicalW / 2, logicalH / 3]. */
  origin?: Point;
  /** Once, before the first frame: build sprites and pre-drawn layers with engine.p. */
  init?(engine: Engine): void;
  /** Pins when the view is cropped shorter than the art (the prototypes' panchors). Default: anchors. */
  cropAnchors?: Record<PinKey, Point>;
  /** Narrow layout: how far each pin sits from its anchor, CSS px (a short leader joins them). */
  pinOffsets?: Record<PinKey, Point>;
  /** Wide layout: the same, for pins that would cover the prop they name. Default: on the anchor. */
  overlayPinOffsets?: Partial<Record<PinKey, Point>>;
  /** Wide layout: where the cards sit. Without it, the cards are listed under the art at every width. */
  cards?: Record<PinKey, CardPlacement>;
  /** Default card width, CSS px (prototypes: 184 to 240). */
  cardWidth?: number;
  /** Cards go over the art from this scale (CSS px per logical px) up. Default 1.9. */
  overlayMinScale?: number;
}

// ---------- palette ----------

/** The base colours every road's scene shares (each scene adds its own on top: { ...BASE, ... }). */
export const BASE = {
  bg: "#f6f4ef",
  slabT: "#e6e2da",
  slabL: "#d2cdc3",
  slabR: "#b5afa4",
  pave: "#e3dfd7",
  pave2: "#dcd8cf",
  curb: "#f2f0ea",
  road: "#8f8d97",
  road2: "#86848e",
  mark: "#f4f2ec",
  grass: "#b4d68b",
  grass2: "#a5cd78",
  grassS: "#86ad5f",
  tL: "#9fd26c",
  tM: "#6aae4b",
  tD: "#44803a",
  trunk: "#7c6a57",
  w0: "#fbfaf7",
  w1: "#efede8",
  g1: "#e2dfd8",
  g2: "#cbc7bf",
  g3: "#aaa5ac",
  g4: "#7b7783",
  g5: "#55515f",
  ink: "#1f1a2b",
  pL: "#b29ae0",
  pM: "#5f2ea0",
  pD: "#391763",
  woodT: "#dcc7a2",
  woodL: "#c2a77e",
  woodR: "#9d855f",
  glow: "#fff3cf",
  red: "#d9533f",
} as const;

/** Each road's ramp (light, mid, dark), as in the prototypes. */
export const RAMPS = {
  work: ["#f7c79a", "#e3803a", "#a4521c"],
  study: ["#f7da8a", "#dda634", "#9a7116"],
  qualify: ["#f2a58f", "#d65a41", "#963222"],
  gap: ["#ead0a4", "#c69a5c", "#8a6334"],
  purple: ["#b29ae0", "#5f2ea0", "#391763"],
} as const satisfies Record<string, Tones>;

/** Cast shadows and sprite shadows. */
export const SHADOW = "rgba(52,40,78,0.17)";
/** Contact lines where a box meets the ground. */
export const CONTACT = "rgba(60,52,70,0.38)";
/** 4×4 ordered dither, for fades without alpha. */
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

// ---------- timing ----------

/** Clamp to [0, 1]. */
export const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Progress of t through [a, b], clamped. */
export const seg = (t: number, a: number, b: number) => cl((t - a) / (b - a));
/** Ease in-out, quadratic. */
export const ioc = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
/** Ease in-out, cubic. */
export const ic3 = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
/** Ease out, cubic. */
export const ocu = (p: number) => {
  const q = 1 - p;
  return 1 - q * q * q;
};
/** Ease in with a pull back first (anticipation). */
export const inBack = (p: number, s = 1.4) => p * p * ((s + 1) * p - s);
/** Modulo that stays positive. */
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** Trapezoid velocity: accelerate over the first 16%, cruise, decelerate over the last 16%. */
export const trap = (u: number) => {
  const a = 0.16,
    v = 1 / (1 - a);
  if (u < a) return (v * u * u) / (2 * a);
  if (u > 1 - a) return 1 - (v * (1 - u) * (1 - u)) / (2 * a);
  return v * (a / 2 + u - a);
};
/** A stable pseudo-random number in [0, 1) for a pair of numbers. */
export const hsh = (a: number, b: number) => {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export const ease = {
  linear: (p: number) => p,
  inBack: (p: number, s = 1.70158) => p * p * ((s + 1) * p - s),
  outCubic: ocu,
  outBack: (p: number, s = 1.70158) => {
    const q = p - 1;
    return 1 + q * q * ((s + 1) * q + s);
  },
  inOutSine: (p: number) => -(Math.cos(Math.PI * p) - 1) / 2,
  inOutQuad: ioc,
  inOutCubic: ic3,
  /** Reaches dist at p = 1 and overshoots by at most maxPx (1 by default) on the way. */
  settle: (p: number, dist: number, maxPx = 1) => dist * ocu(p) + Math.sign(dist || 1) * Math.min(1, maxPx) * Math.sin(Math.PI * p),
};

const BEAT_NAMES = ["anticipation", "exertion", "followThrough", "return"] as const;
const BEAT_EASE = [ease.inBack, ease.outCubic, ease.outBack, ease.inOutSine];

/** Where t falls in a four-beat action [anticipation, exertion, follow-through, return] (seconds each), looping. */
export function beats(t: number, d: readonly [number, number, number, number]) {
  const total = d[0] + d[1] + d[2] + d[3];
  let tt = mod(t, total),
    i = 0;
  while (i < 3 && tt >= d[i]) {
    tt -= d[i];
    i++;
  }
  const p = d[i] ? Math.min(1, tt / d[i]) : 1;
  return { beat: i, name: BEAT_NAMES[i], p, e: BEAT_EASE[i](p), total };
}

/**
 * Keyframed position: k = [[t, x, y], …] in seconds, looping over period. Null outside the keys
 * (after wrapping t below the first key). f is the walk frame (0/1), 1 when standing still.
 */
export function keyframes(k: readonly (readonly [number, number, number])[], t: number, period: number, fps = 6) {
  const t0 = k[0][0],
    t1 = k[k.length - 1][0],
    tt = t < t0 ? t + period : t;
  if (tt > t1) return null;
  for (let i = 0; i < k.length - 1; i++)
    if (tt <= k[i + 1][0]) {
      const u = (tt - k[i][0]) / (k[i + 1][0] - k[i][0]);
      const moving = k[i + 1][1] !== k[i][1] || k[i + 1][2] !== k[i][2];
      return { x: k[i][1] + (k[i + 1][1] - k[i][1]) * u, y: k[i][2] + (k[i + 1][2] - k[i][2]) * u, f: moving ? Math.floor(tt * fps + 0.5) % 2 : 1 };
    }
  return null;
}

// ---------- painter ----------

/** A new canvas of w × h (browser only). */
export function mk(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const ctx2d = (c: HTMLCanvasElement) => {
  const g = c.getContext("2d");
  if (!g) throw new Error("2D canvas unavailable");
  g.imageSmoothingEnabled = false;
  return g;
};

/**
 * The prototypes' drawing helpers on one mutable target: g (the context drawn into) and the
 * projection origin (ox, oy). Methods read the current target when called, so they can be
 * destructured: const { P, box, blit } = engine.p.
 */
export type Painter = ReturnType<typeof createPainter>;

export function createPainter(g: CanvasRenderingContext2D, ox: number, oy: number) {
  const S = {
    g,
    ox,
    oy,
    /** Point the painter at a canvas (smoothing off) and return it. */
    on(c: HTMLCanvasElement) {
      S.g = ctx2d(c);
      return c;
    },
    /** Draw fn into canvas c with the origin at (ox, oy), then restore the previous target. */
    withTarget(c: HTMLCanvasElement, ox2: number, oy2: number, fn: () => void) {
      const sg = S.g,
        sx = S.ox,
        sy = S.oy;
      S.on(c);
      S.ox = ox2;
      S.oy = oy2;
      try {
        fn();
      } finally {
        S.g = sg;
        S.ox = sx;
        S.oy = sy;
      }
      return c;
    },
    /** World (x, y, z) to logical px: +x right-down, +y left-down, +z up. */
    P(x: number, y: number, z = 0): [number, number] {
      return [S.ox + 2 * (x - y), S.oy + x + y - z];
    },
    /** Same as P, for a [x, y, z] triple. */
    pt(a: Point3): [number, number] {
      return S.P(a[0], a[1], a[2]);
    },
    /** Fill a convex polygon by columns, on whole pixels. */
    poly(p: readonly Point[], c: string) {
      const n = p.length;
      let mn = 1e9,
        mx = -1e9;
      for (let i = 0; i < n; i++) {
        if (p[i][0] < mn) mn = p[i][0];
        if (p[i][0] > mx) mx = p[i][0];
      }
      const g2 = S.g;
      g2.fillStyle = c;
      for (let x = Math.floor(mn); x < Math.ceil(mx); x++) {
        const xc = x + 0.5;
        let lo = 1e9,
          hi = -1e9;
        for (let i = 0; i < n; i++) {
          const a = p[i],
            b = p[(i + 1) % n];
          if ((a[0] <= xc && b[0] > xc) || (b[0] <= xc && a[0] > xc)) {
            const y = a[1] + ((xc - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
            if (y < lo) lo = y;
            if (y > hi) hi = y;
          }
        }
        if (hi > lo) {
          const r0 = Math.ceil(lo - 0.5),
            r1 = Math.ceil(hi - 0.5);
          if (r1 > r0) g2.fillRect(x, r0, 1, r1 - r0);
        }
      }
    },
    /** One pixel. */
    px(x: number, y: number, c: string) {
      S.g.fillStyle = c;
      S.g.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    },
    /** A 1px Bresenham line in logical px. */
    line(x0: number, y0: number, x1: number, y1: number, c: string) {
      x0 = Math.round(x0);
      y0 = Math.round(y0);
      x1 = Math.round(x1);
      y1 = Math.round(y1);
      const g2 = S.g;
      g2.fillStyle = c;
      const dx = Math.abs(x1 - x0),
        dy = -Math.abs(y1 - y0),
        sx = x0 < x1 ? 1 : -1,
        sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) {
        g2.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) {
          e += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          e += dx;
          y0 += sy;
        }
      }
    },
    /** A line between two world points, drawn 1px up (on the face, not under it). */
    wl(a: Point3, b: Point3, c: string) {
      const p = S.P(a[0], a[1], a[2]),
        q = S.P(b[0], b[1], b[2]);
      S.line(p[0], p[1] - 1, q[0], q[1] - 1, c);
    },
    /** A wall facing +y (left on screen): x0..x1 at y, z0..z1. */
    fl(x0: number, x1: number, y: number, z0: number, z1: number, c: string) {
      S.poly([S.P(x0, y, z0), S.P(x1, y, z0), S.P(x1, y, z1), S.P(x0, y, z1)], c);
    },
    /** A wall facing +x (right on screen): y0..y1 at x, z0..z1. */
    fr(y0: number, y1: number, x: number, z0: number, z1: number, c: string) {
      S.poly([S.P(x, y0, z0), S.P(x, y1, z0), S.P(x, y1, z1), S.P(x, y0, z1)], c);
    },
    /** A flat top: x0..x1 × y0..y1 at height z. */
    tp(x0: number, y0: number, x1: number, y1: number, z: number, c: string) {
      S.poly([S.P(x0, y0, z), S.P(x1, y0, z), S.P(x1, y1, z), S.P(x0, y1, z)], c);
    },
    /** A box: left face t[1], right face t[2], top t[0]. */
    box(x: number, y: number, z: number, w: number, d: number, h: number, t: Tones) {
      S.fl(x, x + w, y + d, z, z + h, t[1]);
      S.fr(y, y + d, x + w, z, z + h, t[2]);
      S.tp(x, y, x + w, y + d, z + h, t[0]);
    },
    /** Convex hull of screen points. */
    hull(p: readonly Point[]): Point[] {
      const s = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cr = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo: Point[] = [],
        up: Point[] = [];
      for (let i = 0; i < s.length; i++) {
        while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], s[i]) <= 0) lo.pop();
        lo.push(s[i]);
      }
      for (let i = s.length - 1; i >= 0; i--) {
        while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], s[i]) <= 0) up.pop();
        up.push(s[i]);
      }
      return lo.slice(0, -1).concat(up.slice(0, -1));
    },
    /**
     * A box's cast shadow toward the lower right, in solid black: draw shadows into their own layer,
     * mask it to the ground and composite it at low alpha (as the prototypes' buildLayers do).
     */
    shadow(x: number, y: number, w: number, d: number, h: number, z = 0) {
      const a = 0.34 * h,
        b = 0.07 * h,
        pts: Point[] = [];
      for (const q of [
        [x, y],
        [x + w, y],
        [x + w, y + d],
        [x, y + d],
      ] as const) {
        pts.push(S.P(q[0], q[1], z));
        pts.push(S.P(q[0] + a, q[1] + b, z));
      }
      S.poly(S.hull(pts), "#000");
    },
    /** The dark line where a box's front edges meet the ground. */
    contact(x: number, y: number, w: number, d: number, z: number) {
      const a = S.P(x, y + d, z),
        b = S.P(x + w, y + d, z),
        e = S.P(x + w, y, z);
      S.line(a[0], a[1], b[0] - 1, b[1], CONTACT);
      S.line(b[0], b[1], e[0], e[1], CONTACT);
    },
    /** Draw fn into a new w × h canvas with the origin at (ax, ay): a sprite anchored there. */
    sprite(w: number, h: number, ax: number, ay: number, fn: () => void): Sprite {
      const c = mk(w, h);
      S.withTarget(c, ax, ay, fn);
      return { c, ax, ay };
    },
    /** Draw a sprite with its anchor on (x, y), on whole pixels. */
    blit(s: Sprite, x: number, y: number) {
      S.g.drawImage(s.c, Math.round(x) - s.ax, Math.round(y) - s.ay);
    },
    /** A sprite with a share lv (0..1) of its pixels dithered away. */
    faded(s: Sprite, lv: number): Sprite {
      const c = mk(s.c.width, s.c.height),
        cg = ctx2d(c);
      cg.drawImage(s.c, 0, 0);
      const d = cg.getImageData(0, 0, c.width, c.height);
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) if (BAYER[(y & 3) * 4 + (x & 3)] < lv * 16) d.data[(y * c.width + x) * 4 + 3] = 0;
      cg.putImageData(d, 0, 0);
      return { c, ax: s.ax, ay: s.ay };
    },
    /** [sprite, 25%, 50%, 75% faded]: pick one with pickFade. */
    fades(s: Sprite): Sprite[] {
      return [s, S.faded(s, 0.25), S.faded(s, 0.5), S.faded(s, 0.75)];
    },
    /** A string sprite: one character per pixel ("." is empty), coloured by map, with an optional 1px outline. Anchor bottom-centre. */
    pix(rows: readonly string[], map: Record<string, string>, outline?: string): Sprite {
      const h = rows.length;
      let w = 0;
      for (const r of rows) w = Math.max(w, r.length);
      const m = outline ? 1 : 0,
        c = mk(w + 2 * m, h + 2 * m),
        cg = ctx2d(c);
      const at = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < rows[y].length && rows[y][x] !== ".";
      for (let j = 0; j < h; j++)
        for (let i = 0; i < rows[j].length; i++) {
          const k = rows[j][i];
          if (k !== ".") {
            cg.fillStyle = map[k];
            cg.fillRect(i + m, j + m, 1, 1);
          }
        }
      if (outline) {
        cg.fillStyle = outline;
        for (let j = -1; j <= h; j++)
          for (let i = -1; i <= w; i++) if (!at(i, j) && (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1))) cg.fillRect(i + m, j + m, 1, 1);
      }
      return { c, ax: Math.floor((w + 2 * m) / 2), ay: h + m };
    },
    /** A sprite mirrored left to right (anchor mirrored too). */
    flip(s: Sprite): Sprite {
      const c = mk(s.c.width, s.c.height),
        cg = ctx2d(c);
      cg.translate(c.width, 0);
      cg.scale(-1, 1);
      cg.drawImage(s.c, 0, 0);
      return { c, ax: c.width - 1 - s.ax, ay: s.ay };
    },
    /** Add a 1px outline in colour c around a sprite's opaque pixels, in place. */
    outl<T extends { c: HTMLCanvasElement }>(sp: T, c: string): T {
      const cg = ctx2d(sp.c),
        w = sp.c.width,
        h = sp.c.height,
        d = cg.getImageData(0, 0, w, h).data;
      const A = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
      cg.fillStyle = c;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!A(x, y) && (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1))) cg.fillRect(x, y, 1, 1);
      return sp;
    },
  };
  return S;
}

/** From fades(): the full sprite at lv ≥ 1, nothing at lv ≤ 0, else the nearest dithered step. */
export const pickFade = (F: readonly Sprite[], lv: number) => (lv >= 1 ? F[0] : lv <= 0 ? null : F[lv < 0.375 ? 3 : lv < 0.625 ? 2 : 1]);

// ---------- stage ----------

/** What a scene's draw and init receive. */
export interface Engine {
  /** The painter, pointed at the frame's buffer with the scene's origin at the start of every draw. */
  p: Painter;
  w: number;
  h: number;
  period: number;
  /** The part of the art on screen. */
  view: Readonly<Rect>;
  reduced: boolean;
  /** A new canvas (for layers and sprites). */
  mk: typeof mk;
}

/** How the stage is showing the art, for laying the cards out over it. */
export type StageLayout = {
  /** CSS px per logical px. */
  scale: number;
  view: Rect;
  /** The view is narrower or shorter than the art. */
  cropped: boolean;
  /** Cards go over the art (else they are listed under it). */
  overlay: boolean;
  /** The canvas's CSS size. */
  width: number;
  height: number;
};

export type Stage = {
  readonly canvas: HTMLCanvasElement;
  readonly scene: SceneModule;
  readonly engine: Engine;
  layout: StageLayout;
  /** Re-measure the host and resize the canvas. */
  fit(): void;
  /** Draw the frame at t and show it. */
  render(t: number): void;
  destroy(): void;
};

const DEFAULT_OVERLAY_MIN = 1.9;
/** Below this host width (CSS px) a cropped view is cut to the crop's height. */
const SHORT_BELOW = 480;

/**
 * The prototypes' fit. Full art at k device px per logical px (at most about 2 CSS px), when k is at
 * least 1.5 CSS px; otherwise a crop at about 2 CSS px. The CSS size is trimmed to whole CSS px so the
 * browser never resamples the bitmap. With `maxH` (CSS px), a view taller than that is cut to it,
 * centred on the crop's middle (the art's middle without a crop); without it nothing changes. A scene
 * with `whole` is never cropped: it is shown at a smaller whole scale instead (down to 1 device px).
 */
export function fitView(scene: SceneModule, avail: number, dpr: number, maxH?: number): { k: number; view: Rect; cropped: boolean } {
  const W = scene.logicalW,
    H = scene.logicalH,
    cap = Math.max(2, Math.round(2 * dpr));
  let k = Math.max(1, Math.min(Math.floor((avail * dpr) / W), cap));
  let view: Rect = { x: 0, y: 0, w: W, h: H },
    cropped = false;
  if (scene.whole) {
    // Smaller pixels rather than a cut: step the scale down until the art is no taller than maxH.
    while (maxH && maxH > 0 && k > 1 && (H * k) / dpr > maxH) k--;
  } else if (k < 1.5 * dpr) {
    cropped = true;
    k = cap;
    const c = scene.crop ?? { x: 0, y: 0, w: W, h: H };
    const fx = c.x + c.w / 2,
      fy = c.y + c.h / 2;
    const vw = Math.max(1, Math.min(W, Math.floor((avail * dpr) / k))),
      vh = avail >= SHORT_BELOW ? H : Math.min(H, c.h);
    view = { x: Math.max(0, Math.min(W - vw, Math.round(fx - vw / 2))), y: Math.max(0, Math.min(H - vh, Math.round(fy - vh / 2))), w: vw, h: vh };
  }
  if (!scene.whole && maxH && maxH > 0 && (view.h * k) / dpr > maxH) {
    cropped = true;
    const c = scene.crop ?? { x: 0, y: 0, w: W, h: H };
    const fy = c.y + c.h / 2,
      vh = Math.max(1, Math.floor((maxH * dpr) / k));
    view = { ...view, y: Math.max(0, Math.min(H - vh, Math.round(fy - vh / 2))), h: vh };
  }
  const whole = (n: number) => {
    for (let m = n; m > n - 4 && m > 0; m--) if (Math.abs((m * k) / dpr - Math.round((m * k) / dpr)) < 1e-6) return m;
    return 0;
  };
  const tw = whole(view.w),
    th = whole(view.h);
  if (tw && th) view = { ...view, w: tw, h: th };
  return { k, view, cropped };
}

/**
 * The art on a canvas, sized to its host's content width. Calls onLayout after every fit (and once
 * at the start). Does not animate: see runLoop.
 */
export function createStage(opts: {
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  scene: SceneModule;
  onLayout?: (l: StageLayout) => void;
  /** At most this many CSS px tall (see fitView). Default: no limit. */
  maxH?: number;
}): Stage {
  const { canvas, host, scene, onLayout, maxH } = opts;
  const W = scene.logicalW,
    H = scene.logicalH;
  const out = ctx2d(canvas);
  const buf = mk(W, H),
    bg = ctx2d(buf);
  const [ox, oy] = scene.origin ?? [Math.round(W / 2), Math.round(H / 3)];
  const p = createPainter(bg, ox, oy);
  const reducedMq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const engine: Engine = { p, w: W, h: H, period: scene.period, view: { x: 0, y: 0, w: W, h: H }, reduced: !!reducedMq?.matches, mk };
  let last = 0;

  const render = (t: number) => {
    last = t;
    p.g = bg;
    p.ox = ox;
    p.oy = oy;
    bg.setTransform(1, 0, 0, 1, 0, 0);
    bg.globalAlpha = 1;
    bg.globalCompositeOperation = "source-over";
    bg.imageSmoothingEnabled = false;
    bg.clearRect(0, 0, W, H);
    engine.reduced = !!reducedMq?.matches;
    scene.draw(bg, mod(t, scene.period), engine);
    const v = engine.view;
    out.imageSmoothingEnabled = false;
    out.clearRect(0, 0, canvas.width, canvas.height);
    out.drawImage(buf, v.x, v.y, v.w, v.h, 0, 0, canvas.width, canvas.height);
  };

  const stage: Stage = {
    canvas,
    scene,
    engine,
    layout: { scale: 1, view: { x: 0, y: 0, w: W, h: H }, cropped: false, overlay: false, width: W, height: H },
    fit() {
      const cs = getComputedStyle(host);
      const avail = host.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (avail <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      const { k, view, cropped } = fitView(scene, avail, dpr, maxH);
      if (canvas.width !== view.w * k || canvas.height !== view.h * k) {
        canvas.width = view.w * k;
        canvas.height = view.h * k;
      }
      const width = (view.w * k) / dpr,
        height = (view.h * k) / dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const scale = k / dpr;
      engine.view = view;
      stage.layout = { scale, view, cropped, overlay: !cropped && !!scene.cards && scale >= (scene.overlayMinScale ?? DEFAULT_OVERLAY_MIN), width, height };
      render(last);
      onLayout?.(stage.layout);
    },
    render,
    destroy() {
      ro?.disconnect();
      dprMq?.removeEventListener("change", onDpr);
    },
  };

  scene.init?.(engine);
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => stage.fit()) : null;
  ro?.observe(host);
  // A page zoom or a move to another screen changes the device pixel ratio.
  let dprMq: MediaQueryList | null = null;
  const onDpr = () => {
    dprMq?.removeEventListener("change", onDpr);
    dprMq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprMq.addEventListener("change", onDpr);
    stage.fit();
  };
  if (typeof matchMedia === "function") {
    dprMq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprMq.addEventListener("change", onDpr);
  }
  stage.fit();
  return stage;
}

// ---------- loop ----------

export type Loop = {
  /** Whether reduced motion is on (the still frame is showing). */
  reduced(): boolean;
  /** Show the frame at t (stays until the loop next runs). */
  draw(t: number): void;
  /** Hold the current frame (the site's "Pause animations"), or carry on from it. */
  setPaused(paused: boolean): void;
  stop(): void;
};

/**
 * Animate a stage: only while its canvas is on screen and the tab is visible; with
 * prefers-reduced-motion, one still frame at finalT (and back to moving if the setting changes).
 * Frame steps are capped at 0.1s, so a stalled tab resumes where it left off.
 */
export function runLoop(stage: Stage, opts: { period?: number; finalT?: number; paused?: boolean } = {}): Loop {
  const period = opts.period ?? stage.scene.period,
    finalT = opts.finalT ?? stage.scene.finalT;
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  let visible = false,
    raf = 0,
    last = 0,
    t = 0,
    dead = false,
    paused = !!opts.paused;
  const reduced = () => !!mq?.matches;
  const ok = () => !dead && !paused && visible && !document.hidden && !reduced();
  const frame = (now: number) => {
    raf = 0;
    if (!ok()) {
      last = 0;
      return;
    }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    t = mod(t + dt, period);
    stage.render(t);
    raf = requestAnimationFrame(frame);
  };
  const update = () => {
    if (dead) return;
    if (reduced()) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      stage.render(finalT);
      return;
    }
    if (ok() && !raf) {
      last = 0;
      raf = requestAnimationFrame(frame);
    } else if (!ok() && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
  };
  const target = stage.canvas;
  const io =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver((es) => {
          visible = es[es.length - 1].isIntersecting;
          update();
        })
      : null;
  if (io) io.observe(target);
  else visible = true;
  document.addEventListener("visibilitychange", update);
  mq?.addEventListener("change", update);
  stage.render(reduced() ? finalT : 0);
  update();
  return {
    reduced,
    draw(tt: number) {
      t = mod(tt, period);
      stage.render(t);
    },
    setPaused(p: boolean) {
      if (paused === p) return;
      paused = p;
      update();
    },
    stop() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      io?.disconnect();
      document.removeEventListener("visibilitychange", update);
      mq?.removeEventListener("change", update);
    },
  };
}

/**
 * Stage + loop on a canvas: what RoadSection and RoadCard use. Returns a cleanup that stops both.
 * onLayout runs after every fit. `opts.maxH` caps the canvas's CSS height (fitView); `opts.paused`
 * starts the loop held (loop.setPaused changes it later).
 */
export function mountScene(
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  scene: SceneModule,
  onLayout?: (l: StageLayout) => void,
  opts: { maxH?: number; paused?: boolean } = {},
) {
  const stage = createStage({ canvas, host, scene, onLayout, maxH: opts.maxH });
  const loop = runLoop(stage, { paused: opts.paused });
  return {
    stage,
    loop,
    destroy() {
      loop.stop();
      stage.destroy();
    },
  };
}

/** An anchor in the stage's CSS px, for the layout's view and scale. */
export const toStage = (a: Point, l: Pick<StageLayout, "view" | "scale">): [number, number] => [(a[0] - l.view.x) * l.scale, (a[1] - l.view.y) * l.scale];
