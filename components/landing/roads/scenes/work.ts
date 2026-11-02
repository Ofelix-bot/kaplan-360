import { msg } from "@/lib/i18n/translate";
import {
  BASE,
  RAMPS,
  SHADOW,
  ioc,
  keyframes,
  hsh,
  mod,
  ocu,
  pickFade,
  seg,
  trap,
  type Engine,
  type Painter,
  type Point,
  type Point3,
  type SceneModule,
  type Sprite,
  type Tones,
} from "../engine";

// Road 1 · Work: isometric pixel diorama of a CBD corner. Ported from the v2 prototype
// (scratchpad four-roads/_tools/work-v2/scene.js) pixel for pixel: a student lifts an orange skill
// block from a pallet and slots it into the empty socket of a purple job wall; the main tower lights up
// floor by floor while cars and people move through the crossing. 1 world unit = 2px across / 1px down; z in px.

const W = 352,
  H = 428,
  T = 6,
  OX0 = 144,
  OY0 = 244;

const K = {
  ...BASE,
  winL: "#56607a",
  winR: "#3d455a",
  dGlass: "#5a6878",
  cGlassL: "#c3d0dc",
  cGlassR: "#8a9bad",
  cSpL: "#e9edf1",
  cSpR: "#b5c0cb",
  aGlassL: "#c5b2ea",
  aGlassR: "#8a6cc4",
  aSpL: "#efe9f8",
  aSpR: "#c4b7e0",
  aMulL: "#a88fd8",
  aMulR: "#6c4fa8",
  oL: RAMPS.work[0],
  oM: RAMPS.work[1],
  oD: RAMPS.work[2],
  litL: "#ffdca2",
  litR: "#f2b06a",
  litM: "#e8995a",
  amb: "#f0b03a",
  grn: "#4fbf6a",
  off: "#3a3644",
  hL: "#f3ead9",
  hM: "#e2d3b8",
  hR: "#c4b08f",
  hW: "#7a6656",
  tiL: "#d9a283",
  tiM: "#c4876a",
  tiD: "#9d6650",
  tiE: "#7d5040",
  spA: "#9c84cc",
  spAR: "#6f56a6",
} as const;
const SHC = SHADOW;
const GREY: Tones = [K.w1, K.g1, K.g2],
  GREY2: Tones = [K.g1, K.g2, K.g3],
  DARK: Tones = [K.g2, K.g3, K.g4];

// ---------- world data ----------

// Main tower: modelled on Marina Bay Financial Centre Tower 2 (architecture only, no signage).
// Scale: diorama storey pitch 4 px = 4 m -> 1 px per metre up; 1 plan unit ~ 2.45 m.
// The real tower has 50 storeys (occupied top 219.7 m, crown screen to 245 m), taller than the frame: the
// diorama's is shortened to fit it, at the same storey pitch, to 32 storeys = 3 in the podium (z 0..14) +
// 29 tower floors (z 14..141); the glass crown screen keeps its 25 m and runs on to 166. Its top is cut on a
// slant (measured from photos: ~11 m down one face, ~2.6 m along the other), drawn as 12 m down the right
// face and 3 m along the left face. Footprint ~44 m square (GFA 95,662 m2 / 50 floors). A lower interlocking
// volume tops out at 168 m on the real tower; scaled with the shaft, at 107 here (1 px above its last floor).
type Plan = { x: number; y: number; w: number; d: number };
const TW: Plan = { x: 6, y: 4, w: 18, d: 18 },
  TL = { x: 14, y: 12, w: 13, d: 14, h: 107 },
  ZB = 14,
  ZOCC = 141,
  ZTOP = 166,
  NF = 29,
  FLOORS = NF,
  SLY = 12 / 18,
  SLX = 3 / 18,
  ZDECK = 150;
/** Floor k's base height (k = 0..NF). */
const fz = (k: number) => ZB + Math.floor((k * (ZOCC - ZB)) / NF + 0.5);
/** The crown's sloped top: 166 at the right corner (x1, y0), 154 at the front corner, 151 at the left. */
const crownZ = (x: number, y: number) => ZTOP - (y - TW.y) * SLY - (TW.x + TW.w - x) * SLX;
/** A face strip (u0..u1 along the face, z0..z1) clipped to z <= h, h linear from h0 at u0 to h1 at u1. */
function cut(u0: number, u1: number, z0: number, z1: number, h0: number, h1: number) {
  const R: Point[] = [
      [u0, z0],
      [u1, z0],
      [u1, z1],
      [u0, z1],
    ],
    o: Point[] = [];
  const F = (q: Point) => h0 + ((q[0] - u0) * (h1 - h0)) / (u1 - u0) - q[1];
  for (let i = 0; i < 4; i++) {
    const a = R[i],
      b = R[(i + 1) % 4],
      fa = F(a),
      fb = F(b);
    if (fa >= 0) o.push(a);
    if (fa >= 0 !== fb >= 0) {
      const s = fa / (fa - fb);
      o.push([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]);
    }
  }
  return o;
}
/** Floor k is inside the lower volume. */
const inL = (k: number) => fz(k + 1) <= TL.h;
const hx = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
/** Colour a → b at f, as an rgb() string. */
function mix(a: string, b: string, f: number) {
  const A = hx(a),
    B = hx(b);
  return "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * f)).join(",") + ")";
}
// glass sets: [left lo, left hi, right lo, right hi, sunshade L, sunshade R, mullion L, mullion R]
const GM = ["#7c8fb8", "#aab8d6", "#53658f", "#6f80a8", "#d3dbea", "#97a5c2", "#6a7ca6", "#46567d"] as const;
const GL = ["#62759f", "#7f90b5", "#40507a", "#56668e", "#b7c2da", "#7e8db0", "#55678f", "#36446a"] as const;

// job frame (briefcase-shaped wall) with one socket: x20..23, z7..13, front face y=39
const FR = { x: 14, y: 36, w: 15, d: 3 },
  SK = { x: 20, y: 36.5, z: 7 },
  FF = 39;

// traffic: main road green [5.9, 3.2+T), amber [3.2,3.5), red [3.5,5.9); cross green [3.7,5.4), amber [5.4,5.7)
const mainLight = (t: number) => (t >= 3.2 && t < 3.5 ? "a" : t >= 3.5 && t < 5.9 ? "r" : "g");
const crossLight = (t: number) => (t >= 3.7 && t < 5.4 ? "g" : t >= 5.4 && t < 5.7 ? "a" : "r");
const VX = 130 / T;
// queue car: at stop position from ta to td (td may exceed T), drives a loop of length L in between
function queuePos(t: number, ta: number, td: number, L: number) {
  let tt = t;
  while (tt < td - T) tt += T;
  while (tt >= td) tt -= T; // tt in [td-T, td)
  if (tt >= ta - T && tt < ta) return trap((tt - (td - T)) / (T - (td - ta))) * L;
  return 0; // distance travelled since departure
}
type Main = { dir: 1 | -1; y: number; stop?: number; ta?: number; td?: number; te?: number; c?: number; bus?: 1 };
const MAIN: Main[] = [
  { dir: 1, y: 54.5, stop: 51, ta: 3.95, td: 6.05, c: 1 },
  { dir: 1, y: 54.5, stop: 45.5, ta: 4.5, td: 6.35, c: 3 },
  { dir: -1, y: 48.5, stop: 74.5, ta: 3.85, td: 6.15, c: 0 },
  { dir: 1, y: 57.5, te: 5.93, bus: 1 },
  { dir: 1, y: 57.5, te: 0.95, c: 2 },
  { dir: 1, y: 57.5, te: 1.95, c: 0 },
  { dir: -1, y: 51.5, te: 0.25, c: 4 },
  { dir: -1, y: 51.5, te: 1.45, c: 1 },
];
function mainX(m: Main, t: number) {
  let x: number;
  if (m.te != null) x = m.dir > 0 ? 56 + VX * (t - m.te) : 74 - VX * (t - m.te);
  else x = (m.stop ?? 0) + m.dir * queuePos(t, m.ta ?? 0, m.td ?? 0, 130);
  return mod(x + 15, 130) - 15;
}
type Cross = { dir: 1 | -1; x: number; stop: number; ta: number; td: number; c: number };
const CROSS: Cross[] = [
  { dir: 1, x: 63, stop: 36.5, ta: 1.0, td: 3.8, c: 2 },
  { dir: -1, x: 69, stop: 62.5, ta: 1.6, td: 3.95, c: 0 },
];
const crossY = (m: Cross, t: number) => mod(m.stop + m.dir * queuePos(t, m.ta, m.td, 98) + 15, 98) - 15;
// pedestrians: keyframes [t,x,y]; visible from first to last key (times may pass T)
type Ped = { c: number; k: (readonly [number, number, number])[] };
const PEDS: Ped[] = [
  { c: 0, k: [[0.6, 47.5, 30.6], [2.9, 58.5, 46], [3.8, 59, 46.5], [5.35, 59, 61.5], [5.75, 56.5, 63.4]] },
  { c: 1, k: [[3.55, 56.5, 63.4], [3.8, 59.6, 61.6], [5.35, 59.6, 46.6], [7.6, 48.2, 30.6]] },
  { c: 3, k: [[0.05, 85, 42.6], [1.3, 74, 44], [1.35, 73.6, 44], [2.9, 60.2, 43.6], [5.3, 47, 30.6]] },
  { c: 4, k: [[3.0, 58.5, 46.4], [4.6, 48, 30.8]] },
  { c: 5, k: [[0, 95, 45.5], [3.2, 77, 45.2], [3.9, 77, 45.2]] },
  { c: 2, k: [[2.2, 77, 45.6], [6.0, 99, 46]] },
  { c: 1, k: [[0, 23.5, 62.2], [6, 23.5, 62.2]] },
  { c: 4, k: [[0, 25, 62.4], [6, 25, 62.4]] },
  { c: 0, k: [[0, 9, 40.6], [6, 9, 40.6]] },
  { c: 5, k: [[0, 10.5, 41.2], [6, 10.5, 41.2]] },
];
const TREES: Point3[] = [
  [44, 45.5, 0], [50, 45.5, 0], [56, 45.5, 0], [78, 45.5, 0], [84, 45.5, 0], [90, 45.5, 0], [96, 45.5, 0],
  [4, 65.5, 1], [12, 65.5, 1], [20, 65.5, 1], [28, 65.5, 1], [36, 65.5, 1], [46, 65.5, 1], [80, 65.5, 1], [88, 65.5, 1], [96, 65.5, 1],
  [98, 40, 1], [98, 30, 1], [98, 20, 1], [76, 12, 1], [76, 20, 1],
];
const LAMPS: Point[] = [[6, 46.5], [51, 46.5], [86, 46.5], [8, 61.6], [32, 61.6], [82, 61.6], [94, 61.6], [60.5, 30], [60.5, 14], [73.5, 30], [73.5, 14]];
const POLES = [
  { x: 61, y: 46.5, m: 1 },
  { x: 73, y: 61.5, m: 1 },
  { x: 73, y: 46.5, m: 0 },
  { x: 61, y: 61.5, m: 0 },
];

// ---------- hero: figure + skill block ----------
const PAL_F = [34.5, 43.5] as const,
  PUSH_F = [21.5, 43.5] as const;
type Hero = {
  pose: string;
  fx: number;
  fy: number;
  bx: number;
  by: number;
  bz: number;
  behind: boolean;
  seated: number;
  slot?: number;
  fadeOut: number;
  fadeIn: number;
};
function hero(t: number): Hero {
  const r: Hero = { pose: "backS", fx: PAL_F[0], fy: PAL_F[1], bx: 33, by: 38.5, bz: 1, behind: true, seated: 0, fadeOut: 0, fadeIn: 1 };
  let dir = [PUSH_F[0] - PAL_F[0], PUSH_F[1] - PAL_F[1]];
  const dl = Math.hypot(dir[0], dir[1]);
  dir = [dir[0] / dl, dir[1] / dl];
  if (t < 0.35) {
    r.pose = "backS";
  } else if (t < 0.85) {
    const a = seg(t, 0.35, 0.85);
    r.pose = a < 0.55 ? "crouch" : "squash";
  } else if (t < 1.25) {
    const l = ocu(seg(t, 0.85, 1.25));
    r.pose = l < 0.4 ? "crouch" : "backS";
    r.bz = 1 + 6 * l;
    r.by = 38.5 + 1 * l;
  } else if (t < 2.3) {
    const w = ioc(seg(t, 1.25, 2.3)),
      tu = seg(t, 1.25, 1.4),
      tb = seg(t, 2.15, 2.3);
    r.fx = PAL_F[0] + (PUSH_F[0] - PAL_F[0]) * w;
    r.fy = PAL_F[1] + (PUSH_F[1] - PAL_F[1]) * w;
    const ox_ = dir[0] * 2.6 * (tu - tb),
      oy_ = -2.5 + (dir[1] * 2.6 + 2.5) * (tu - tb);
    r.bx = r.fx - 1.5 + ox_;
    r.by = r.fy - 1.5 + oy_;
    r.bz = 7;
    r.pose = tb > 0.5 ? "backS" : Math.floor(t * 7) % 2 ? "walkAL" : "walkBL";
    r.behind = tb > 0.5;
    if (tu < 1 && tb === 0) r.behind = tu < 0.5;
  } else if (t < 2.95) {
    const p = seg(t, 2.3, 2.7),
      s = seg(t, 2.7, 2.95);
    r.fx = PUSH_F[0];
    r.fy = PUSH_F[1] - 1.2 * ocu(p) + 0.4 * s;
    r.pose = "push";
    const d = p < 1 ? -3 * ocu(p) : -3 - 0.5 * Math.sin(Math.PI * s); // overshoot 0.5 unit (1px) after contact
    r.bx = 20;
    r.by = 39.5 + d;
    r.bz = 7;
    r.slot = 1;
    r.behind = true;
  } else if (t < 4.55) {
    r.fx = PUSH_F[0];
    r.fy = PUSH_F[1] - 0.8;
    r.pose = "backS";
    r.seated = 1;
  } else if (t < 5.45) {
    const b = ioc(seg(t, 4.55, 5.45));
    r.fx = PUSH_F[0] + (PAL_F[0] - PUSH_F[0]) * b;
    r.fy = PUSH_F[1] - 0.8 + (PAL_F[1] - PUSH_F[1] + 0.8) * b;
    r.pose = Math.floor(t * 7) % 2 ? "walkA" : "walkB";
    r.seated = 1;
  } else {
    r.pose = "backS";
    r.seated = 1;
  }
  if (t >= 5.3) {
    r.fadeOut = seg(t, 5.3, 5.85);
    r.fadeIn = seg(t, 5.3, 5.85);
  }
  return r;
}
/** Floors lit: 0..FLOORS. */
function lit(t: number) {
  if (t < 2.8) return 0;
  if (t < 4.2) return Math.floor(FLOORS * seg(t, 2.8, 4.2) + 0.0001);
  if (t < 5.2) return FLOORS;
  if (t < 5.75) return Math.ceil(FLOORS * (1 - seg(t, 5.2, 5.75)));
  return 0;
}

// ---------- art (built in init: sprites need document) ----------

/** Builds the sprites and pre-drawn layers on the painter, and returns the per-frame draw. */
function build(p: Painter, mk: Engine["mk"]) {
  const { on, P, poly, px, wl, fl, fr, tp, box, shadow, contact, sprite, blit, pix, flip, outl, fades } = p;

  // ---------- sprites ----------
  const TREE_B = pix(
    ["....aaa....", "..aaaaabb..", ".aaaaaabbb.", "aaaaaabbbbc", "aaaabbbbbcc", ".aabbbbbcc.", "..bbbbccc..", "....ccc....", ".....t.....", ".....t....."],
    { a: K.tL, b: K.tM, c: K.tD, t: K.trunk },
  );
  const TREE_S = pix(["..aa...", ".aaabb.", "aaabbbc", ".abbbcc", "..bcc..", "...t..."], { a: K.tL, b: K.tM, c: K.tD, t: K.trunk });
  const TSH = sprite(12, 4, 2, 1, () => {
    p.g.fillStyle = SHC;
    p.g.fillRect(1, 0, 9, 1);
    p.g.fillRect(0, 1, 10, 1);
    p.g.fillRect(2, 2, 6, 1);
  });
  const LAMP = sprite(6, 14, 2, 12, () => {
    p.g.fillStyle = K.g4;
    p.g.fillRect(2, 2, 1, 10);
    p.g.fillRect(3, 1, 2, 1);
    p.g.fillStyle = K.w0;
    p.g.fillRect(4, 2, 1, 1);
  });
  const SHELTER = sprite(26, 20, 8, 6, () => {
    box(0, 0, 0, 7, 2, 1, GREY2);
    box(0, 1.5, 1, 0.5, 0.5, 6, DARK);
    box(6.5, 1.5, 1, 0.5, 0.5, 6, DARK);
    fl(0.5, 6.5, 0.5, 1, 6, "rgba(170,190,205,.55)");
    box(-0.5, -0.5, 7, 8, 3, 1, [K.w0, K.g2, K.g3]);
    box(5, 0, 1, 1.5, 0.6, 5, [K.w1, K.g2, K.g3]);
  });
  const BUS = sprite(30, 16, 5, 9, () => {
    poly([P(0.5, 0.4, 0), P(9.5, 0.4, 0), P(9.5, 2.4, 0), P(0.5, 2.4, 0)], SHC);
    box(0, 0, 0, 9, 2, 6, [K.w0, "#e6e3dc", "#c3beb6"]);
    fl(0.5, 8.5, 2, 3, 5, "#3b4255");
    fr(0.3, 1.7, 9, 3, 5, "#2c3242");
    fl(0, 9, 2, 1, 2, K.g2);
    fl(1, 1.8, 2, 0, 1, K.ink);
    fl(7, 7.8, 2, 0, 1, K.ink);
  });
  const FIGMAP = { h: "#2b2233", s: "#f1c6a0", p: "#7a4fc4", q: "#5f2ea0", d: "#2f3447", k: "#1f1a2b", w: "#ffffff" };
  const HD = ["...hhh...", "..hhhhh..", "..hssss..", "..sksks..", "...sss..."],
    HB = ["...hhh...", "..hhhhh..", "..hhhhh..", "..hhhhh..", "...sss..."];
  const TOR = ["..ppppp..", ".qpppppq.", ".qpppppq.", ".qpppppq.", ".s.ppp.s.", "..ddddd.."];
  const LS = ["..dd.dd..", "..dd.dd..", "..kk.kk.."],
    LA_ = [".dd...dd.", ".dd...dd.", ".kk...kk."],
    LB_ = ["...ddd...", "...ddd...", "...kkk..."];
  const FIG: Record<string, string[]> = {
    stand: HD.concat(TOR, LS),
    walkA: HD.concat(TOR, LA_),
    walkB: HD.concat(TOR, LB_),
    backS: HB.concat(TOR, LS),
    backA: HB.concat(TOR, LA_),
    backB: HB.concat(TOR, LB_),
    crouch: HB.concat(["..ppppp..", ".ppppppp.", "sqpppppqs", "..ddddd..", ".ddd.ddd.", ".dd...dd.", ".kk...kk."]),
    squash: ["...hhh...", "..hhhhh..", "..hhhhh..", "..sssss..", ".ppppppp.", "ppppppppp", "sqpppppqs", ".ddddddd.", ".dd...dd.", ".dd...dd.", ".kk...kk."],
    push: [
      "...hhh....",
      "..hhhhh...",
      "..hhhhh...",
      "..hhhhh...",
      "...sss....",
      "..ppppp...",
      ".pppppqqss",
      ".qppppp...",
      ".qppppp...",
      "..ppp.....",
      "..ddddd...",
      "..dd.dd...",
      "..dd..dd..",
      "..kk..kk..",
    ],
  };
  const FS: Record<string, Sprite> = {};
  for (const k of Object.keys(FIG)) {
    FS[k] = pix(FIG[k], FIGMAP, K.ink);
    FS[k + "L"] = flip(FS[k]);
  }
  const FSH = sprite(14, 5, 7, 2, () => {
    p.g.fillStyle = SHC;
    p.g.fillRect(2, 1, 11, 1);
    p.g.fillRect(1, 2, 11, 1);
    p.g.fillRect(3, 3, 7, 1);
  });
  // skill block 3x3x6 with a white plus on the front
  const BLK = outl(
    sprite(20, 24, 8, 15, () => {
      box(0, 0, 0, 3, 3, 6, [K.oL, K.oM, K.oD]);
      const c = P(1.5, 3, 3),
        r = "#fff3e4";
      wl([0, 3, 6], [3, 3, 6], r);
      wl([3, 0, 6], [3, 3, 6], r);
      px(c[0] - 1, c[1] - 1, "#fff");
      px(c[0] - 1, c[1], "#fff");
      px(c[0] - 2, c[1], "#fff");
      px(c[0], c[1], "#fff");
      px(c[0] - 1, c[1] + 1, "#fff");
    }),
    K.ink,
  );
  const BLKF = fades(BLK);
  const PED_C = ["#ffffff", "#8d9bb3", "#6a6672", "#b8b2c2", "#9cb38f", "#c4a597"];
  const PED = PED_C.map((c) => {
    const m = { k: "#2b2233", s: "#f1c6a0", c, d: "#3a3f52" };
    return [pix([".k.", ".s.", "ccc", ".c.", "d.d"], m), pix([".k.", ".s.", "ccc", ".c.", ".d."], m)];
  });
  const CARC: Tones[] = [
    [K.w0, "#e3e0d9", "#c3beb6"],
    ["#b3bfcf", "#94a2b5", "#76849a"],
    ["#d3c2b6", "#b8a597", "#958375"],
    ["#8f8c96", "#77747f", "#5f5c68"],
    ["#c9ccc4", "#adb1a8", "#8e9289"],
  ];
  const carX = (t: Tones) =>
    sprite(16, 12, 5, 5, () => {
      poly([P(0.5, 0.4, 0), P(4.5, 0.4, 0), P(4.5, 2.4, 0), P(0.5, 2.4, 0)], SHC);
      box(0, 0, 0, 4, 2, 2, t);
      box(1, 0, 2, 2, 2, 2, [t[0], "#3b4255", "#2c3242"]);
      tp(1, 0, 3, 2, 4, t[0]);
    });
  const carY = (t: Tones) =>
    sprite(16, 12, 9, 5, () => {
      poly([P(0.4, 0.5, 0), P(2.4, 0.5, 0), P(2.4, 4.5, 0), P(0.4, 4.5, 0)], SHC);
      box(0, 0, 0, 2, 4, 2, t);
      box(0, 1, 2, 2, 2, 2, [t[0], "#3b4255", "#2c3242"]);
      tp(0, 1, 2, 3, 4, t[0]);
    });
  const CX = CARC.map(carX),
    CY = CARC.map(carY);
  const POLE = sprite(6, 16, 2, 14, () => {
    p.g.fillStyle = K.g5;
    p.g.fillRect(2, 3, 1, 11);
  });

  // ---------- world ----------
  /** Floor k of a volume B in glass set C: glazed with its sunshade (dark), or its lit windows. */
  function band(k: number, isLit: boolean, B: Plan, C: readonly string[]) {
    const z0 = fz(k),
      z1 = fz(k + 1),
      gh = z1 - z0 - 1,
      X0 = B.x,
      X1 = B.x + B.w,
      Y0 = B.y,
      Y1 = B.y + B.d,
      f = k / NF;
    if (!isLit) {
      fl(X0, X1, Y1, z0, z1 - 1, mix(C[0], C[1], f));
      fr(Y0, Y1, X1, z0, z1 - 1, mix(C[2], C[3], f));
      fl(X0, X1, Y1, z1 - 1, z1, C[4]);
      fr(Y0, Y1, X1, z1 - 1, z1, C[5]);
    } else {
      for (let i = X0; i < X1; i += 2) if (hsh(i + 3 * B.x, k) < 0.8) fl(i, Math.min(i + 2, X1), Y1, z0, z0 + gh, K.litL);
      for (let i = Y0; i < Y1; i += 2) if (hsh(k, i + 3 * B.y) < 0.8) fr(i, Math.min(i + 2, Y1), X1, z0, z0 + gh, K.litR);
    }
    for (let i = X0 + 2; i < X1; i += 2) wl([i, Y1, z0], [i, Y1, z0 + gh - 1], C[6]);
    for (let i = Y0 + 2; i < Y1; i += 2) wl([X1, i, z0], [X1, i, z0 + gh - 1], C[7]);
  }
  // crown: the glass screen continues the shaft from the occupied top (ZOCC) to the sloped cut (crownZ).
  // Inside it a plain roof deck (ZDECK) with grey plant boxes; on the high side the screen stands proud of the
  // deck, so its inner faces show. Drawn back to front: inner faces, deck, plant, then the outer glass (which
  // hides the deck behind the low front edge), then the screen's top and a light rim on both sloped edges.
  function crown() {
    const X0 = TW.x,
      X1 = TW.x + TW.w,
      Y0 = TW.y,
      Y1 = TW.y + TW.d,
      cz = crownZ,
      zf = cz(X1, Y1),
      zl = cz(X0, Y1),
      pf = (ZOCC - ZB) / NF;
    const faceL = (a: number, b: number, c: string) => {
      const q = cut(X0, X1, a, b, zl, zf);
      if (q.length > 2) poly(q.map((v) => P(v[0], Y1, v[1])), c);
    };
    const faceR = (a: number, b: number, c: string) => {
      const q = cut(Y0, Y1, a, b, ZTOP, zf);
      if (q.length > 2) poly(q.map((v) => P(X1, v[0], v[1])), c);
    };
    // inside: the screen's inner faces on the high side (back and left), the deck, mechanical plant
    poly([P(X0 + 1, Y0 + 1, ZDECK), P(X1 - 1, Y0 + 1, ZDECK), P(X1 - 1, Y0 + 1, cz(X1 - 1, Y0 + 1)), P(X0 + 1, Y0 + 1, cz(X0 + 1, Y0 + 1))], "#b4c0da");
    for (let i = X0 + 3; i < X1 - 1; i += 2) wl([i, Y0 + 1, ZDECK], [i, Y0 + 1, cz(i, Y0 + 1) - 1], "#a2afcc");
    poly([P(X0 + 1, Y0 + 1, ZDECK), P(X0 + 1, Y1 - 1, ZDECK), P(X0 + 1, Y1 - 1, cz(X0 + 1, Y1 - 1)), P(X0 + 1, Y0 + 1, cz(X0 + 1, Y0 + 1))], "#8f9dbf");
    for (let i = Y0 + 3; i < Y1 - 1; i += 2) wl([X0 + 1, i, ZDECK], [X0 + 1, i, cz(X0 + 1, i) - 1], "#8290b3");
    tp(X0 + 1, Y0 + 1, X1 - 1, Y1 - 1, ZDECK, "#b3b6be");
    for (let e = Y0 + 4; e < Y1 - 1; e += 4) wl([X0 + 1, e, ZDECK], [X1 - 1, e, ZDECK], "#a7aab3");
    box(X0 + 3, Y0 + 3, ZDECK, 6, 4, 4, GREY2);
    for (let i = X0 + 4; i < X0 + 9; i += 1) wl([i, Y0 + 7, ZDECK + 1], [i, Y0 + 7, ZDECK + 3], K.g4);
    box(X0 + 10, Y0 + 8, ZDECK, 3, 3, 3, [K.g1, K.g2, K.g3]);
    box(X0 + 3, Y0 + 10, ZDECK, 3, 3, 2, DARK);
    // outer glass, floor by floor, cut by the slope
    for (let j = 0; ; j++) {
      const z0 = ZOCC + Math.round(j * pf);
      if (z0 >= ZTOP) break;
      const z1 = Math.min(ZTOP, ZOCC + Math.round((j + 1) * pf)),
        f = Math.min(1, (z0 - ZOCC) / (ZTOP - ZOCC));
      faceL(z0, z1, mix(GM[1], "#c9d3e7", 0.45 * f));
      faceR(z0, z1, mix(GM[3], "#8d9cbf", 0.45 * f));
      if (z1 < ZTOP) {
        faceL(z1 - 1, z1, GM[4]);
        faceR(z1 - 1, z1, GM[5]);
      }
    }
    for (let i = X0 + 2; i < X1; i += 2) wl([i, Y1, ZOCC], [i, Y1, cz(i, Y1) - 1], "#8d9dc2");
    for (let i = Y0 + 2; i < Y1; i += 2) wl([X1, i, ZOCC], [X1, i, cz(X1, i) - 1], "#56688f");
    // the screen's top, 1 unit thick, following the slope; then 1 px light rims on both sloped outer edges
    poly([P(X0, Y0, cz(X0, Y0)), P(X1, Y0, ZTOP), P(X1, Y0 + 1, cz(X1, Y0 + 1)), P(X0, Y0 + 1, cz(X0, Y0 + 1))], "#dfe6f2");
    poly([P(X0, Y0, cz(X0, Y0)), P(X0 + 1, Y0, cz(X0 + 1, Y0)), P(X0 + 1, Y1, cz(X0 + 1, Y1)), P(X0, Y1, zl)], "#dfe6f2");
    poly([P(X1 - 1, Y0, cz(X1 - 1, Y0)), P(X1, Y0, ZTOP), P(X1, Y1, zf), P(X1 - 1, Y1, cz(X1 - 1, Y1))], "#d3dbea");
    poly([P(X0, Y1 - 1, cz(X0, Y1 - 1)), P(X1, Y1 - 1, cz(X1, Y1 - 1)), P(X1, Y1, zf), P(X0, Y1, zl)], "#e8edf6");
    wl([X0, Y1, zl], [X1, Y1, zf], "#f6f8fc");
    wl([X1, Y0 + 0.5, cz(X1, Y0 + 0.5)], [X1, Y1, zf], "#eef2f8");
    wl([X1, Y1, ZB], [X1, Y1, zf], "#e6ebf4");
  }
  function towerA() {
    fl(TW.x, TW.x + TW.w, TW.y + TW.d, ZB, ZOCC, GM[0]);
    fr(TW.y, TW.y + TW.d, TW.x + TW.w, ZB, ZOCC, GM[2]);
    contact(TW.x, TW.y, TW.w, TW.d, ZB);
    for (let k = 0; k < NF; k++) band(k, false, TW, GM);
    crown();
  }
  // lower interlocking volume: its own layer so it can be laid back over the main shaft's lit windows
  function towerL() {
    const X0 = TL.x,
      X1 = TL.x + TL.w,
      Y0 = TL.y,
      Y1 = TL.y + TL.d,
      h = TL.h;
    fl(X0, X1, Y1, ZB, h, GL[0]);
    fr(Y0, Y1, X1, ZB, h, GL[2]);
    contact(X0, Y0, TL.w, TL.d, ZB);
    for (let k = 0; inL(k); k++) band(k, false, TL, GL);
    fl(X0, X1, Y1, h, h + 2, "#8d9cbd");
    fr(Y0, Y1, X1, h, h + 2, "#5d6c90");
    tp(X0, TW.y + TW.d, X1, Y1, h + 2, "#d5dae4");
    tp(TW.x + TW.w, Y0, X1, TW.y + TW.d, h + 2, "#d5dae4");
    wl([X0, Y1, h + 2], [X1, Y1, h + 2], "#eef1f6");
    wl([X1, Y0, h + 2], [X1, Y1, h + 2], "#c3cad8");
    box(18, 23, h + 2, 3, 2, 2, GREY2);
    box(24.6, 15, h + 2, 1.6, 3, 2, GREY2);
    wl([X1, Y1, ZB], [X1, Y1, h + 2], "#a7b4cf");
  }
  function rails(x: number, y: number, w: number, d: number, z: number, back: boolean) {
    const c = K.g3;
    if (back) {
      wl([x, y, z + 3], [x + w, y, z + 3], c);
      wl([x, y, z + 3], [x, y + d, z + 3], c);
      for (let i = x; i <= x + w; i += 2) wl([i, y, z], [i, y, z + 3], c);
      for (let i = y; i <= y + d; i += 2) wl([x, i, z], [x, i, z + 3], c);
    } else {
      wl([x, y + d, z + 3], [x + w, y + d, z + 3], c);
      wl([x + w, y, z + 3], [x + w, y + d, z + 3], c);
      for (let i = x; i <= x + w; i += 2) wl([i, y + d, z], [i, y + d, z + 3], c);
      for (let i = y; i <= y + d; i += 2) wl([x + w, i, z], [x + w, i, z + 3], c);
    }
  }
  function drum(cx: number, cy: number, r: number, z0: number, z1: number) {
    const c = P(cx, cy, 0),
      a = 2 * Math.SQRT2 * r,
      b = Math.SQRT2 * r;
    for (let X = Math.ceil(c[0] - a); X < Math.floor(c[0] + a); X++) {
      const u = (X + 0.5 - c[0]) / a;
      if (u <= -1 || u >= 1) continue;
      const yo = b * Math.sqrt(1 - u * u);
      const col = u < -0.6 ? "#e2e9ef" : u < -0.15 ? K.cGlassL : u < 0.4 ? "#a7b6c5" : K.cGlassR;
      const y0 = Math.round(c[1] - z1 + yo),
        y1 = Math.round(c[1] - z0 + yo),
        yc = Math.round(c[1] - z1 - yo);
      p.g.fillStyle = col;
      p.g.fillRect(X, y0, 1, y1 - y0);
      for (let z = z0 + 4; z < z1 - 1; z += 4) px(X, c[1] - z + yo, u < 0.4 ? "#f4f6f8" : "#c9d2db");
      if ((X - Math.round(c[0])) % 3 === 0) for (let yy = y0 + 1; yy < y1; yy++) if (((yy - y0) & 3) !== 0) px(X, yy, u < 0.4 ? "#b4c2cf" : "#7a8b9c");
      p.g.fillStyle = K.g1;
      p.g.fillRect(X, yc, 1, Math.max(1, y0 - yc));
      px(X, y0, K.w0);
      px(X, yc, K.g2);
    }
  }
  function towerB() {
    const x = 32,
      y = 8,
      w = 20,
      d = 16,
      z = 14,
      h = 66;
    box(x, y, z, w, d, h - z, [K.w1, "#e4e1da", "#bdb8b0"]);
    contact(x, y, w, d, z);
    for (let k = 0; k < 11; k++) {
      const z0 = 17 + 4 * k;
      if (k % 4 === 1) {
        fl(x, x + w, y + d, z0 - 1, z0 + 3, "#d3cfc7");
        fr(y, y + d, x + w, z0 - 1, z0 + 3, "#a8a39b");
        continue;
      }
      for (let i = x + 1; i < x + w - 1; i += 2) fl(i, i + 1, y + d, z0, z0 + 2, K.winL);
      for (let i = y + 1; i < y + d - 1; i += 2) fr(i, i + 1, x + w, z0, z0 + 2, K.winR);
    }
    fl(40.5, 42, y + d, 15, 62, K.g2);
    fr(15.5, 17, x + w, 15, 62, "#a8a39b");
    fl(x, x + w, y + d, h - 4, h, K.w0);
    fr(y, y + d, x + w, h - 4, h, K.g2);
    rails(x, y, w, d, h, true);
    box(35, 11, h, 10, 8, 7, GREY2);
    for (let i = 36; i < 45; i += 2) wl([i, 19, h + 1], [i, 19, h + 5], K.g4);
    box(46, 11, h, 3, 3, 3, GREY);
    rails(x, y, w, d, h, false);
    drum(50, 22, 3.6, 14, 71);
  }
  function rim(c: string) {
    const f = FF;
    fl(19, 24, f, 6, 7, c);
    fl(19, 24, f, 13, 14, c);
    fl(19, 20, f, 6, 14, c);
    fl(23, 24, f, 6, 14, c);
  }
  function frame() {
    const x = FR.x,
      y = FR.y,
      w = FR.w,
      d = FR.d,
      f = y + d;
    box(13, 35.5, 0, 17, 4, 1, GREY);
    contact(13, 35.5, 17, 4, 0);
    box(x, y, 1, w, d, 18, [K.w0, K.g1, K.g2]);
    const cols = [
        [14.75, 16.75],
        [17.25, 18.75],
        [24.25, 25.75],
        [26.25, 28.25],
      ],
      rows = [
        [2, 6],
        [7, 13],
        [14, 18],
      ];
    for (let i = 0; i < cols.length; i++)
      for (let j = 0; j < rows.length; j++) {
        fl(cols[i][0], cols[i][1], f, rows[j][0], rows[j][1], K.pM);
        fl(cols[i][0], cols[i][1], f, rows[j][1] - 1, rows[j][1], K.pL);
      }
    for (const r of [
      [2, 5],
      [15, 18],
    ]) {
      fl(20, 23, f, r[0], r[1], K.pM);
      fl(20, 23, f, r[1] - 1, r[1], K.pL);
    }
    box(18, 37, 19, 1, 1, 3, GREY2);
    box(24, 37, 19, 1, 1, 3, GREY2);
    box(18, 37, 22, 7, 1, 1, GREY2);
    // socket recess: dark interior, orange rim
    const sg = p.g,
      rc = on(mk(W, H));
    fl(SK.x, SK.x + 3, f, SK.z, SK.z + 6, "#2a1d3a");
    fl(SK.x, SK.x + 3, SK.y, SK.z, SK.z + 6, "#2a1d3a");
    tp(SK.x, SK.y, SK.x + 3, f, SK.z, "#4a3263");
    fr(SK.y, f, SK.x, SK.z, SK.z + 6, "#1f1530");
    const mm = on(mk(W, H));
    fl(SK.x, SK.x + 3, f, SK.z, SK.z + 6, "#000");
    on(rc);
    p.g.globalCompositeOperation = "destination-in";
    p.g.drawImage(mm, 0, 0);
    p.g = sg;
    p.g.drawImage(rc, 0, 0);
    rim(K.oM);
  }
  function pallet() {
    box(32, 37, 0, 5, 5, 1, [K.woodT, K.woodL, K.woodR]);
    for (let i = 33; i < 37; i += 1.5) wl([i, 37, 1], [i, 42, 1], K.woodL);
    box(38.5, 37, 0, 3, 3, 4, DARK); // spare crates
    box(38.5, 37, 4, 3, 3, 4, GREY2);
  }
  function podium() {
    const x = 4,
      y = 4,
      w = 54,
      d = 26,
      h = 14;
    box(x, y, 0, w, d, h, [K.g1, "#e9e6e0", "#c2bdb4"]);
    contact(x, y, w, d, 0);
    fl(x, x + w, y + d, 0, 5, K.dGlass);
    for (let i = x; i <= x + w; i += 6) fl(i, i + 1, y + d, 0, 5, K.w1);
    fr(y, y + d, x + w, 0, 5, "#46525f");
    for (let i = y; i <= y + d; i += 6) fr(i, i + 1, x + w, 0, 5, K.g2);
    fl(46, 49, y + d, 0, 4, "#8796a6"); // door
    fl(x, x + w, y + d, 5, 6, K.g2);
    fr(y, y + d, x + w, 5, 6, K.g3);
    for (let i = x + 1; i < x + w - 1; i += 2) {
      if (i >= 32 && i < 52) continue;
      fl(i, i + 1, y + d, 8, 11, K.winL);
    }
    for (let i = y + 1; i < y + d - 1; i += 2) fr(i, i + 1, x + w, 8, 11, K.winR);
    fl(32, 52, y + d, 5, 14, K.pM);
    fl(33, 51, y + d, 9, 11, K.pL);
    fl(33, 51, y + d, 10, 11, "#efe9f8");
    tp(x + 1, y + 1, x + w - 1, y + d - 1, h, "#d9d6cf");
    fl(x, x + w, y + d, 13, 14, K.w0);
  }
  function towerC() {
    const x = 78,
      y = 4,
      w = 16,
      d = 16,
      h = 78;
    box(x, y, 0, w, d, h, [K.w1, K.cSpL, K.cSpR]);
    contact(x, y, w, d, 0);
    fl(x, x + w, y + d, 0, 8, K.dGlass);
    fr(y, y + d, x + w, 0, 8, "#46525f");
    for (let k = 0; k < 17; k++) {
      const z0 = 10 + 4 * k;
      if (z0 + 3 > h - 2) break;
      if (k % 4 === 3) {
        fl(x, x + w, y + d, z0, z0 + 3, "#d8dce0");
        fr(y, y + d, x + w, z0, z0 + 3, "#a3acb6");
        continue;
      }
      fl(x + 0.5, x + w - 0.5, y + d, z0, z0 + 3, K.cGlassL);
      fr(y + 0.5, y + d - 0.5, x + w, z0, z0 + 3, K.cGlassR);
    }
    for (let i = x + 2; i < x + w; i += 3) fl(i, i + 0.5, y + d, 8, h - 2, K.w0);
    for (let i = y + 2; i < y + d; i += 3) fr(i, i + 0.5, x + w, 8, h - 2, K.g1);
    fl(x, x + w, y + d, h - 2, h, K.w0);
    fr(y, y + d, x + w, h - 2, h, K.g2);
    tp(x, y, x + w, y + d, h, K.g1);
    // stepped crown
    const u = 80,
      v = 6,
      uw = 12;
    box(u, v, h, uw, uw, 10, [K.w1, K.cSpL, K.cSpR]);
    fl(u + 0.5, u + uw - 0.5, v + uw, h + 2, h + 8, K.cGlassL);
    fr(v + 0.5, v + uw - 0.5, u + uw, h + 2, h + 8, K.cGlassR);
    for (let i = u + 2; i < u + uw; i += 2) wl([i, v + uw, h + 2], [i, v + uw, h + 7], K.w0);
    for (let i = v + 2; i < v + uw; i += 2) wl([u + uw, i, h + 2], [u + uw, i, h + 7], K.g1);
    tp(u + 1, v + 1, u + uw - 1, v + uw - 1, h + 10, K.g1);
    for (let i = u; i <= u + uw; i += 2) wl([i, v + uw, h + 10], [i, v + uw, h + 15], K.g3);
    for (let i = v; i <= v + uw; i += 2) wl([u + uw, i, h + 10], [u + uw, i, h + 15], K.g3);
    wl([u, v + uw, h + 15], [u + uw, v + uw, h + 15], K.g3);
    wl([u + uw, v, h + 15], [u + uw, v + uw, h + 15], K.g3);
    box(83, 9, h + 10, 5, 4, 4, GREY2);
    wl([86, 12, h + 10], [86, 12, h + 24], K.g4);
    px(P(86, 12, h + 25)[0], P(86, 12, h + 25)[1] - 1, K.red);
    // lobby canopy
    box(81.2, 22.6, 0, 0.5, 0.5, 8, DARK);
    box(90.3, 22.6, 0, 0.5, 0.5, 8, DARK);
    box(80.5, 20, 8, 11, 3.4, 1, [K.w0, K.g1, K.g2]);
    fl(80.5, 91.5, 23.4, 7.5, 8, K.g3);
  }
  function lowB() {
    const x = 80,
      y = 28,
      w = 16,
      d = 14,
      h = 10,
      e = 0.6,
      X0 = x - e,
      X1 = x + w + e,
      Y0 = y - e,
      Y1 = y + d + e,
      rz = h + 7,
      RY = y + d / 2,
      R0 = x + d / 2,
      R1 = x + w - d / 2;
    box(x, y, 0, w, d, h, [K.hL, K.hM, K.hR]);
    contact(x, y, w, d, 0);
    fl(x, x + w, y + d, 0, 1, K.hR);
    fr(y, y + d, x + w, 0, 1, "#a8946f");
    for (let i = x + 1.5; i < x + w - 1; i += 2.5) {
      fl(i, i + 1, y + d, 1.5, 5.5, K.hW);
      fl(i + 0.25, i + 0.75, y + d, 5.5, 6, K.hW);
    }
    for (let i = y + 1.5; i < y + d - 1; i += 2.5) {
      fr(i, i + 1, x + w, 1.5, 5.5, "#5f4f43");
      fr(i + 0.25, i + 0.75, x + w, 5.5, 6, "#5f4f43");
    }
    fl(x, x + w, y + d, 7.5, 8.5, K.w0);
    fr(y, y + d, x + w, 7.5, 8.5, K.hM);
    fl(85, 91, y + d, 0, 4, "#6b5a4c");
    box(84.5, y + d, 4, 7, 1, 1, [K.w0, K.hL, K.hM]);
    // hip roof: back faces first, then front faces
    poly([P(X0, Y0, h), P(X1, Y0, h), P(R1, RY, rz), P(R0, RY, rz)], K.tiL);
    poly([P(X0, Y0, h), P(X0, Y1, h), P(R0, RY, rz)], K.tiL);
    poly([P(X0, Y1, h), P(X1, Y1, h), P(R1, RY, rz), P(R0, RY, rz)], K.tiM);
    poly([P(X1, Y0, h), P(X1, Y1, h), P(R1, RY, rz)], K.tiD);
    for (let i = 1; i < 7; i += 2) {
      const f = i / 7;
      wl([X0 + (R0 - X0) * f, Y1 + (RY - Y1) * f, h + 7 * f], [X1 + (R1 - X1) * f, Y1 + (RY - Y1) * f, h + 7 * f], K.tiD);
      wl([X1 + (R1 - X1) * f, Y0 + (RY - Y0) * f, h + 7 * f], [X1 + (R1 - X1) * f, Y1 + (RY - Y1) * f, h + 7 * f], K.tiE);
    }
    wl([X0, Y1, h], [R0, RY, rz], K.tiE);
    wl([X1, Y1, h], [R1, RY, rz], K.tiE);
    wl([R0, RY, rz], [R1, RY, rz], K.tiE);
    wl([X0, Y1, h], [X1, Y1, h], K.tiE);
    wl([X1, Y0, h], [X1, Y1, h], K.tiE);
  }
  const KIOSK = sprite(24, 22, 10, 8, () => {
    const x = 0,
      y = 0;
    box(x, y, 0, 5, 3, 1, GREY2);
    box(x, y + 0.5, 1, 0.5, 0.5, 5, DARK);
    box(x + 4.5, y + 0.5, 1, 0.5, 0.5, 5, DARK);
    box(x - 0.5, y, 6, 6, 3.5, 1, [K.w0, K.g2, K.g3]);
    fr(y + 0.5, y + 3, 5, 1, 3, "#3b3448");
  });

  function slotDraw(front: number) {
    const dpt = front - FF;
    if (dpt > 0.01) box(20, FF, 7, 3, dpt, 6, [K.oL, K.oM, K.oD]);
    else fl(20, 23, FF, 7, 13, K.oM);
    fl(20, 23, front, 12, 13, K.oL);
    const c = P(21.5, front, 10);
    px(c[0] - 1, c[1] - 2, "#fff");
    px(c[0] - 1, c[1] - 1, "#fff");
    px(c[0] - 2, c[1] - 1, "#fff");
    px(c[0], c[1] - 1, "#fff");
    px(c[0] - 1, c[1], "#fff");
  }
  const SEATF = fades(sprite(22, 22, 46, -42, () => slotDraw(FF + 0.5)));
  function seatDraw(lv: number) {
    const q = P(0, 0, 0),
      s = pickFade(SEATF, lv);
    if (s) blit(s, q[0], q[1]);
  }
  function blkDraw(x: number, y: number, z: number, lv: number) {
    const q = P(x, y, z),
      s = pickFade(BLKF, lv);
    if (s) blit(s, q[0], q[1]);
  }

  // ---------- layers ----------
  const mask = on(mk(W, H));
  tp(0, 0, 100, 68, 0, "#000");
  // The two tower volumes' shadows are cut short where they reach the cross road (here) and the podium's
  // east edge (on the podium roof, below); both volumes are still taller than those caps.
  const sh = on(mk(W, H));
  shadow(4, 4, 54, 26, 14);
  shadow(6, 4, 18, 18, 110);
  shadow(14, 12, 13, 14, 100);
  shadow(32, 8, 20, 16, 66);
  shadow(78, 4, 16, 16, 78);
  shadow(80, 6, 12, 12, 96);
  shadow(80, 28, 16, 14, 15);
  shadow(13, 35.5, 17, 4, 22);
  shadow(32, 37, 5, 5, 1);
  shadow(38.5, 37, 3, 3, 8);
  p.g.globalCompositeOperation = "destination-in";
  p.g.drawImage(mask, 0, 0);
  p.g.globalCompositeOperation = "source-over";
  const LA = on(mk(W, H));
  tp(0, 0, 100, 68, 0, K.pave);
  fl(0, 100, 68, -7, 0, K.slabL);
  fr(0, 68, 100, -7, 0, K.slabR);
  fl(0, 62, 68, -1, 0, K.grassS);
  fl(72, 100, 68, -1, 0, K.grassS);
  fr(63, 68, 100, -1, 0, "#6f9450");
  fr(0, 4, 100, -1, 0, "#6f9450");
  for (let i = 0; i < 60; i += 4) for (let j = 30; j < 44; j += 4) if (((i + j) / 4) % 2) tp(i, j, i + 4, j + 4, 0, K.pave2);
  for (let i = 74; i < 100; i += 4) for (let j = 24; j < 44; j += 4) if (((i + j) / 4) % 2) tp(i, j, i + 4, j + 4, 0, K.pave2);
  p.g.globalAlpha = 0.5;
  tp(12, 37, 41, 47, 0, "#f1dcc0");
  tp(14, 35, 39, 37, 0, "#f1dcc0");
  p.g.globalAlpha = 1;
  tp(74, 0, 100, 4, 0, K.grass);
  tp(96, 4, 100, 44, 0, K.grass);
  tp(74, 4, 78, 24, 0, K.grass);
  tp(0, 63, 62, 68, 0, K.grass);
  tp(72, 63, 100, 68, 0, K.grass);
  for (let i = 2; i < 62; i += 8) tp(i, 64, i + 4, 67, 0, K.grass2);
  for (let i = 76; i < 100; i += 8) tp(i, 64, i + 4, 67, 0, K.grass2);
  tp(0, 47, 62, 48, 0, K.curb);
  tp(72, 47, 100, 48, 0, K.curb);
  tp(0, 60, 62, 61, 0, K.curb);
  tp(72, 60, 100, 61, 0, K.curb);
  tp(61, 0, 62, 47, 0, K.curb);
  tp(72, 0, 73, 47, 0, K.curb);
  tp(61, 61, 62, 68, 0, K.curb);
  tp(72, 61, 73, 68, 0, K.curb);
  tp(0, 48, 100, 60, 0, K.road);
  tp(62, 0, 72, 68, 0, K.road);
  tp(62, 48, 72, 60, 0, K.road2);
  for (let i = 0; i < 100; i += 6) {
    if (i + 3 > 56 && i < 74) continue;
    tp(i, 50.5, i + 3, 51.5, 0, K.mark);
    tp(i, 56.5, i + 3, 57.5, 0, K.mark);
  }
  tp(0, 53.5, 56, 54.5, 0, K.mark);
  tp(74, 53.5, 100, 54.5, 0, K.mark);
  for (let j = 48.5; j < 60; j += 2) tp(57, j, 60.5, j + 1, 0, K.mark);
  for (let i = 62.5; i < 72; i += 2) tp(i, 42, i + 1, 45.5, 0, K.mark);
  tp(55, 54, 56, 60, 0, K.mark);
  tp(73, 48, 74, 54, 0, K.mark);
  tp(62, 40, 67, 41, 0, K.mark);
  tp(67, 61, 72, 62, 0, K.mark);
  for (let j = 2; j < 40; j += 5) tp(66.5, j, 67.5, j + 2.5, 0, K.mark);
  for (let j = 62; j < 68; j += 5) tp(66.5, j, 67.5, j + 2, 0, K.mark);
  p.g.globalAlpha = 0.21;
  p.g.drawImage(sh, 0, 0);
  p.g.globalAlpha = 1;
  podium();
  const rs = on(mk(W, H));
  shadow(6, 4, 18, 18, 90, 14);
  shadow(14, 12, 13, 14, 90, 14);
  shadow(32, 8, 20, 16, 52, 14);
  shadow(48, 20, 4, 4, 57, 14);
  const rm = on(mk(W, H));
  tp(4, 4, 58, 30, 14, "#000");
  on(rs);
  p.g.globalCompositeOperation = "destination-in";
  p.g.drawImage(rm, 0, 0);
  p.g.globalCompositeOperation = "source-over";
  on(LA);
  p.g.globalAlpha = 0.2;
  p.g.drawImage(rs, 0, 0);
  p.g.globalAlpha = 1;
  towerA();
  const LL = on(mk(W, H));
  towerL();
  on(LA);
  p.g.drawImage(LL, 0, 0);
  const LB = on(mk(W, H));
  towerB();
  for (const q of [
    [9, 26],
    [19, 26],
    [30, 26],
    [37, 26.5],
    [44, 26],
    [51, 26.5],
  ] as const) {
    const s = P(q[0], q[1], 14);
    blit(TSH, s[0], s[1]);
    blit(TREE_B, s[0], s[1]);
  }
  frame();
  pallet();
  // planters + benches on the plaza
  box(6, 38, 0, 4, 2, 2, [K.grass, K.g1, K.g2]);
  box(6, 41, 0, 4, 1, 1, [K.woodT, K.woodL, K.woodR]);
  box(44, 34, 0, 6, 2, 2, [K.grass, K.g1, K.g2]);
  const LC = on(mk(W, H));
  towerC();
  lowB();

  // ---------- frame ----------
  return function drawFrame(t: number) {
    const g = p.g;
    g.drawImage(LA, 0, 0);
    const n = lit(t);
    if (n > 0) {
      for (let k = 0; k < n; k++) band(k, true, TW, GM);
      g.drawImage(LL, 0, 0);
      for (let k = 0; k < n && inL(k); k++) band(k, true, TL, GL);
    }
    g.drawImage(LB, 0, 0);
    const h = hero(t),
      tv = mod(t + 0.0123, T); // tv: ambient clock, offset so no position sits on a rounding tie at the seam
    // cross-road cars (behind the back-right block)
    for (const m of CROSS) {
      const y = crossY(m, tv);
      if (y < 0 || y > 64) continue;
      const q = P(m.x, y, 0);
      blit(CY[m.c], q[0], q[1]);
    }
    g.drawImage(LC, 0, 0);
    const L: { k: number; f: () => void }[] = [];
    for (const q of TREES)
      L.push({
        k: q[0] + q[1],
        f: () => {
          const s = P(q[0], q[1], 0);
          blit(TSH, s[0], s[1]);
          blit(q[2] ? TREE_S : TREE_B, s[0], s[1]);
        },
      });
    for (const m of MAIN) {
      const x = mainX(m, tv),
        ln = m.bus ? 9 : 4;
      if (x < 0 || x > 100 - ln) continue;
      L.push({
        k: x + ln / 2 + m.y + 1,
        f: () => {
          const s = P(x, m.y, 0);
          blit(m.bus ? BUS : CX[m.c ?? 0], s[0], s[1]);
        },
      });
    }
    for (const q of LAMPS)
      L.push({
        k: q[0] + q[1],
        f: () => {
          const s = P(q[0], q[1], 0);
          blit(LAMP, s[0], s[1]);
        },
      });
    L.push({
      k: 22 + 62.5,
      f: () => {
        const s = P(19, 61.2, 0);
        blit(SHELTER, s[0], s[1]);
      },
    });
    for (const pd of PEDS) {
      const q = keyframes(pd.k, tv, T);
      if (!q) continue;
      L.push({
        k: q.x + q.y,
        f: () => {
          const s = P(q.x, q.y, 0);
          blit(PED[pd.c][q.f], s[0], s[1]);
        },
      });
    }
    for (const o of POLES)
      L.push({
        k: o.x + o.y,
        f: () => {
          const s = P(o.x, o.y, 0);
          blit(POLE, s[0], s[1]);
          const st = o.m ? mainLight(tv) : crossLight(tv);
          const x = Math.round(s[0]),
            y = Math.round(s[1]) - 14;
          g.fillStyle = K.ink;
          g.fillRect(x - 1, y - 1, 3, 5);
          px(x, y, st === "r" ? K.red : K.off);
          px(x, y + 1, st === "a" ? K.amb : K.off);
          px(x, y + 2, st === "g" ? K.grn : K.off);
        },
      });
    L.push({
      k: 52.5 + 65.5,
      f: () => {
        const s = P(52, 64, 0);
        blit(KIOSK, s[0], s[1]);
      },
    });
    L.push({
      k: h.fx + h.fy,
      f: () => {
        const fp = P(h.fx, h.fy, 0),
          nb = !h.seated && !h.slot;
        if (h.slot) slotDraw(h.by + 3);
        if (t >= 2.7 && t < 2.84) {
          rim(K.glow);
          const q = P(21.5, FF, 14);
          px(q[0] - 1, q[1] - 3, K.glow);
          px(q[0] + 5, q[1] - 1, K.glow);
          px(q[0] - 7, q[1] - 1, K.glow);
        }
        if (h.seated) seatDraw(1 - h.fadeOut);
        if (t >= 5.3) blkDraw(33, 38.5, 1, h.fadeIn);
        if (nb && h.behind) blkDraw(h.bx, h.by, h.bz, 1);
        blit(FSH, fp[0], fp[1]);
        blit(FS[h.pose], fp[0], fp[1]);
        if (nb && !h.behind) blkDraw(h.bx, h.by, h.bz, 1);
      },
    });
    L.sort((a, b) => a.k - b.k);
    for (const e of L) e.f();
  };
}

/** Each stage's built art (sprites, layers, per-frame draw), keyed by its engine. */
const built = new WeakMap<Engine, (t: number) => void>();
const ready = (engine: Engine) => {
  let f = built.get(engine);
  if (!f) {
    f = build(engine.p, engine.mk);
    built.set(engine, f);
  }
  return f;
};

/** The prototype's projection, for the anchors (P at OX0, OY0). */
const at = (x: number, y: number, z: number): Point => [OX0 + 2 * (x - y), OY0 + x + y - z];

export const work: SceneModule = {
  logicalW: W,
  logicalH: H,
  period: T,
  finalT: 4.45,
  origin: [OX0, OY0],
  label: msg(
    "Pixel diorama of a city corner: a student lifts an orange skill block from a pallet and slots it into the empty socket of a purple job wall; the office tower behind lights up floor by floor while cars and people move through the crossing.",
  ),
  // Card order as content/roads.en.ts: 1 the crossing, 2 the main tower's upper floors, 3 the job wall's socket.
  // Pin 3 sits on the job wall's west edge at z 12, below the podium's west tip (logical 92, 264..278).
  // Pin 2 sits on the main tower's left face at z 126, upper floors above the lower volume (top at 109).
  anchors: { "1": at(60.5, 64.5, 0), "2": at(9, 22, 126), "3": at(14, 39, 12) },
  cropAnchors: { "1": at(58.5, 57, 0), "2": at(9, 22, 126), "3": at(14, 39, 12) },
  pinOffsets: { "1": [-16, -10], "2": [-13, -9], "3": [-13, -10] },
  // The prototype's FOC (135, 185) moved down 20 with the shortened tower: the view is centred on (135, 205),
  // 362 tall when short (the crown at y 91 through the pallet and the crossing at y 365). /move cuts it to
  // 260 around that centre (y 75..335): the crown 16 px below its top edge, the pallet and the figure whole.
  crop: { x: 0, y: 24, w: 270, h: 362 },
  // Card 1 as in the prototype (the site's cards are about 124 CSS px tall against 94); card 2 moved down 70 with
  // pin 2 (logical 118, 149), so its leader still runs level from 13 px below its top edge. Card 3 is 160
  // CSS px wide (80 px, still 124 tall in every language) and sits at y 219, wholly on the empty ground left of the
  // podium: its leader runs 8 CSS px from the right edge at y 275, then one 45° leg to pin 3 (94, 285), over
  // bare paving only; the podium's west tip is at x 92, y 264..278. Taller (152), the leader is level at y 285.
  cards: { "1": { x: 0, y: 370 }, "2": { x: 0, y: 136 }, "3": { x: 0, y: 219, w: 160 } },
  cardWidth: 200,
  init(engine: Engine) {
    ready(engine);
  },
  draw(ctx: CanvasRenderingContext2D, t: number, engine: Engine) {
    const f = ready(engine);
    // build() leaves the painter on its last layer; the frame always goes to the buffer.
    engine.p.g = ctx;
    f(mod(t, T));
  },
};

export default work;
