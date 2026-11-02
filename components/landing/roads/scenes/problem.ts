import { PROBLEM } from "@/content/move.en";
import {
  BASE,
  RAMPS,
  SHADOW,
  hsh,
  ioc,
  keyframes,
  mod,
  ocu,
  pickFade,
  seg,
  type Engine,
  type Painter,
  type Point,
  type Point3,
  type SceneModule,
  type Sprite,
  type Tones,
} from "../engine";

// /move's #problem: an isometric pixel diorama in the roads' style (the Work scene's palette and sprites).
// On the left a small campus with its gate; far right a cluster of CBD towers over a purple job wall
// with three EMPTY sockets (the Work scene's socket, before anyone has a block to slot in); between
// them a paved path that is unfinished in the middle: tiles missing, a blank signpost at the edge.
// Story (10 s loop): a student walks out of the gate with a diploma scroll while the towers light up
// floor by floor in the distance; they stop at the edge of the missing stretch and a pixel "?" pops
// above their head; the empty sockets blink; then two nudges, graphic only: a phone bubble pops from
// their pocket (the parents' call) with a small hop forward, and a roadside billboard flashes (agents
// and ads) with another small push. They end at the gap, looking at the towers. Pins: 1 the campus,
// 2 the towers, 3 the gap. 1 world unit = 2px across / 1px down; z in px. The background is not
// painted (the stage clears it). Shown whole at every width (whole: the engine never crops it).

const W = 352,
  H = 260,
  T = 10,
  OX0 = 100,
  OY0 = 64;

const K = {
  ...BASE,
  winL: "#56607a",
  winR: "#3d455a",
  dGlass: "#5a6878",
  oL: RAMPS.work[0],
  oM: RAMPS.work[1],
  oD: RAMPS.work[2],
  sL: RAMPS.study[0],
  sM: RAMPS.study[1],
  sD: RAMPS.study[2],
  litL: "#ffdca2",
  litR: "#f2b06a",
  amb: "#f0b03a",
  hL: "#f3ead9",
  hM: "#e2d3b8",
  hR: "#c4b08f",
  hW: "#7a6656",
  tiL: "#d9a283",
  tiM: "#c4876a",
  tiD: "#9d6650",
  tiE: "#7d5040",
  dirt: "#a88a66",
  dirtL: "#9c7f5c",
  dirtR: "#8a6e4e",
  grout: "#d3cec4",
} as const;
const SHC = SHADOW;
const GREY: Tones = [K.w1, K.g1, K.g2],
  GREY2: Tones = [K.g1, K.g2, K.g3],
  DARK: Tones = [K.g2, K.g3, K.g4];

// ---------- world data ----------

// The slab: x 0..116, y 0..40. The campus lot is x 0..24, the path x 24..81 (y 24..30), the CBD x 70..116.
const SX = 116,
  SY = 40;
type Plan = { x: number; y: number; w: number; d: number };
// campus hall (gabled, its entrance on the +x face) and its gate on the path
const HALL = { x: 4, y: 18, w: 16, d: 18, h: 22, ridge: 36 };
// path tiles (3 × 3) in two rows; the missing ones make the unfinished stretch, x 48..69
const PX0 = 24,
  PX1 = 81,
  ROWS = [24, 27] as const;
const MISSING = new Set(["48,24", "51,24", "51,27", "54,24", "57,24", "57,27", "60,27", "63,24", "63,27", "66,27"]);
const gone = (i: number, j: number) => MISSING.has(`${i},${j}`);
// the job wall (podium) with its three empty sockets on the front face (y 22), z 3..9
const PD = { x: 78, y: 6, w: 20, d: 16, h: 12 },
  FW = PD.y + PD.d,
  SOCKETS = [80, 85.5, 91] as const;
// towers: A (Work's glass, on the podium), B (pale glass, behind), C (white offices, in front)
const TA: Plan = { x: 81, y: 8, w: 12, d: 12 },
  ZA = 12,
  NA = 24,
  TB: Plan = { x: 99, y: 2, w: 10, d: 10 },
  ZB = 6,
  NB = 18;
/** Floor k of a tower starting at z0 (pitch 4). */
const fz = (z0: number, k: number) => z0 + 4 * k;
// billboard (ad face on y 10.6, x 54..68, z 14..27) and the blank signpost at the gap's edge
const BB = { x: 54, y: 9.6, w: 14, z: 14, h: 13 },
  BF = BB.y + 1;
const hx = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
/** Colour a → b at f, as an rgb() string. */
function mix(a: string, b: string, f: number) {
  const A = hx(a),
    B = hx(b);
  return "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * f)).join(",") + ")";
}
// glass sets: [left lo, left hi, right lo, right hi, sunshade L, sunshade R, mullion L, mullion R]
const GA = ["#7c8fb8", "#aab8d6", "#53658f", "#6f80a8", "#d3dbea", "#97a5c2", "#6a7ca6", "#46567d"] as const;
const GB = ["#a9b8c8", "#c9d5e0", "#7d8ea2", "#9aaabb", "#e9edf1", "#b5c0cb", "#8f9fb2", "#64758a"] as const;

const TREES_BACK: Point[] = [[28, 12], [36, 5], [44, 15], [72, 9], [3, 6], [12, 4]];
const TREES_FRONT: Point[] = [[30, 36], [40, 37.5], [58, 36], [68, 37.5], [82, 38], [96, 38.5], [110, 37], [8, 38.5]];
const LAMPS_BACK: Point[] = [[34, 22.8], [72, 22.8]];
const LAMPS_FRONT: Point[] = [[44, 31.4], [76, 31.4]];
// plaza walkers: keyframes [t, x, y] (times may pass T)
const PEDS: { c: number; k: (readonly [number, number, number])[] }[] = [
  { c: 1, k: [[0, 74, 33.5], [9.5, 101, 33.5]] },
  { c: 3, k: [[2.5, 106, 35.2], [11, 79, 35.2]] },
  { c: 0, k: [[5, 88, 25], [8.5, 88, 25]] },
];

// ---------- timeline ----------
const IN = [0, 0.4] as const, // fades in at the hall's door
  WALK = [0.4, 3.0] as const,
  LIGHT_A = [1.2, 2.8] as const,
  LIGHT_B = [1.5, 3.0] as const,
  ASK = 3.1, // the "?" pops
  BLINK = [3.6, 5.2] as const, // the sockets blink fast, then pulse
  CALL = [5.2, 6.4] as const, // the phone bubble
  HOP = [5.45, 5.8] as const,
  AD = [6.6, 7.4] as const, // the billboard flashes
  PUSH = [7.0, 7.3] as const,
  OUT = [9.2, 9.7] as const; // fades out, lights off
const DOOR_X = 21.5,
  STOP_X = 46.5,
  HOP_X = 48,
  EDGE_X = 49.5,
  FY = 28;

type Hero = { x: number; z: number; pose: string; lv: number };
function hero(t: number): Hero {
  const r: Hero = { x: DOOR_X, z: 0, pose: "stand", lv: 1 };
  if (t < IN[1]) {
    r.lv = seg(t, IN[0], IN[1]);
  } else if (t < WALK[1]) {
    r.x = DOOR_X + (STOP_X - DOOR_X) * ioc(seg(t, WALK[0], WALK[1]));
    r.pose = Math.floor(t * 7) % 2 ? "walkA" : "walkB";
  } else if (t < HOP[0]) {
    r.x = STOP_X;
  } else if (t < HOP[1]) {
    const s = seg(t, HOP[0], HOP[1]);
    r.x = STOP_X + (HOP_X - STOP_X) * s;
    r.z = Math.round(4 * Math.sin(Math.PI * s));
    r.pose = "backS";
  } else if (t < PUSH[0]) {
    r.x = HOP_X;
    if (t < HOP[1] + 0.15) r.pose = "squash";
  } else if (t < PUSH[1]) {
    r.x = HOP_X + (EDGE_X - HOP_X) * ocu(seg(t, PUSH[0], PUSH[1]));
    r.pose = "walkB";
  } else {
    r.x = EDGE_X;
    if (t < PUSH[1] + 0.12) r.pose = "squash";
  }
  if (t >= OUT[0]) r.lv = 1 - seg(t, OUT[0], OUT[1]);
  return r;
}
/** Floors lit out of n, from s0 to s1 on the way up, all off over OUT. */
function lit(t: number, n: number, w: readonly [number, number]) {
  if (t < w[0]) return 0;
  if (t < w[1]) return Math.floor(n * seg(t, w[0], w[1]) + 0.0001);
  if (t < OUT[0]) return n;
  if (t < OUT[1]) return Math.ceil(n * (1 - seg(t, OUT[0], OUT[1])));
  return 0;
}
/** The sockets' rims: orange; blinking fast over BLINK, then a short pulse every second until OUT. */
function rimLit(t: number): 0 | 1 | 2 {
  if (t >= BLINK[0] && t < BLINK[1]) return Math.floor((t - BLINK[0]) / 0.2) % 2 ? 0 : 2;
  if (t >= BLINK[1] && t < OUT[0]) return t % 1 < 0.25 ? 2 : 1;
  return 1;
}

// ---------- art (built in init: sprites need document) ----------

/** Builds the sprites and pre-drawn layers on the painter, and returns the per-frame draw. */
function build(p: Painter, mk: Engine["mk"]) {
  const { on, P, poly, px, wl, fl, fr, tp, box, shadow, contact, sprite, blit, pix, flip, outl, fades } = p;

  // ---------- sprites (as the Work scene's) ----------
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
    squash: ["...hhh...", "..hhhhh..", "..hssss..", "..sksks..", ".ppppppp.", "ppppppppp", "sqpppppqs", ".ddddddd.", ".dd...dd.", ".dd...dd.", ".kk...kk."],
  };
  const FS: Record<string, Sprite> = {};
  for (const k of Object.keys(FIG)) FS[k] = pix(FIG[k], FIGMAP, K.ink);
  const STANDF = fades(FS.stand);
  const FSH = sprite(14, 5, 7, 2, () => {
    p.g.fillStyle = SHC;
    p.g.fillRect(2, 1, 11, 1);
    p.g.fillRect(1, 2, 11, 1);
    p.g.fillRect(3, 3, 7, 1);
  });
  // the diploma: a white scroll with a red ribbon, held at the hand
  const SCROLL = pix(["...ww", "..wrw", ".wrw.", "ww..."], { w: "#ffffff", r: K.red }, K.ink);
  // the "?" over the head, white-edged so it reads on the sky and the towers
  const ASKS = fades(outl(pix([".pppp.", "pp..pp", "....pp", "...pp.", "..pp..", "......", "..pp.."], { p: K.pM }), "#ffffff"));
  // the parents' call: a speech bubble with a buzzing phone
  const CALLS = fades(
    pix(
      ["wwwwwwwwwww", "wwwwkkkwwww", "wwawkgkwaww", "wawwkgkwwaw", "wwawkgkwaww", "wwwwkkkwwww", "wwwwwwwwwww", "........ww.", ".........w."],
      { w: "#ffffff", k: K.ink, g: "#4fbf6a", a: K.amb },
      K.ink,
    ),
  );
  const PED_C = ["#ffffff", "#8d9bb3", "#6a6672", "#b8b2c2"];
  const PED = PED_C.map((c) => {
    const m = { k: "#2b2233", s: "#f1c6a0", c, d: "#3a3f52" };
    return [pix([".k.", ".s.", "ccc", ".c.", "d.d"], m), pix([".k.", ".s.", "ccc", ".c.", ".d."], m)];
  });
  const PEDL = PED.map((f) => f.map(flip));

  // ---------- world ----------
  function hall() {
    const { x, y, w, d, h, ridge } = HALL,
      X1 = x + w,
      Y1 = y + d,
      RY = y + d / 2;
    box(x, y, 0, w, d, h, [K.hL, K.hM, K.hR]);
    contact(x, y, w, d, 0);
    // front (y 36): two rows of windows under a cornice
    for (let i = x + 1.5; i < X1 - 1; i += 3) {
      fl(i, i + 1.5, Y1, 3, 8, K.hW);
      fl(i, i + 1.5, Y1, 12, 17, K.hW);
    }
    fl(x, X1, Y1, h - 2, h - 1, K.w0);
    // entrance face (x 20): a portico of columns, the door on the path's line, steps
    fr(y, Y1, X1, 0, 1, "#a8946f");
    for (let j = y + 1; j < Y1 - 1; j += 3) fr(j, j + 1, X1, 1, h - 3, K.w0);
    fr(FY - 2, FY + 1, X1, 1, 8, "#6b5a4c");
    fr(y, Y1, X1, h - 3, h - 1, K.w0);
    box(X1, FY - 3.5, 0, 1.5, 6, 1, [K.w0, K.hL, K.hM]);
    // gabled roof, ridge along x; the gable on the entrance face
    poly([P(x, y, h), P(X1, y, h), P(X1, RY, ridge), P(x, RY, ridge)], K.tiL);
    poly([P(x, Y1, h), P(X1, Y1, h), P(X1, RY, ridge), P(x, RY, ridge)], K.tiM);
    for (let i = 1; i < 4; i++) {
      const f = i / 4;
      wl([x, Y1 + (RY - Y1) * f, h + (ridge - h) * f], [X1, Y1 + (RY - Y1) * f, h + (ridge - h) * f], K.tiD);
    }
    poly([P(X1, y, h), P(X1, Y1, h), P(X1, RY, ridge)], K.hL);
    poly([P(X1, y + 3, h + 1), P(X1, Y1 - 3, h + 1), P(X1, RY, ridge - 3)], K.hM);
    px(P(X1, RY, h + 5)[0] - 1, P(X1, RY, h + 5)[1] - 1, K.sM);
    wl([x, Y1, h], [x, RY, ridge], K.tiE);
    wl([X1, Y1, h], [X1, RY, ridge], K.tiE);
    wl([X1, y, h], [X1, RY, ridge], K.tiE);
    wl([x, RY, ridge], [X1, RY, ridge], K.tiE);
  }
  const GATE: Tones = [K.w0, K.hL, K.hM];
  function gateBack() {
    box(24, 22, 0, 1, 1, 16, GATE);
  }
  function gateFront() {
    box(24, 31, 0, 1, 1, 16, GATE);
    box(23.5, 21.5, 16, 2, 11, 2.5, [K.sL, K.sD, K.sM]);
    fr(26, 27, 25.5, 16.5, 18, K.w0);
  }
  function path() {
    // the holes first (sunken earth, with walls where a tile or the kerb stands behind), then the tiles
    for (let i = PX0; i < PX1; i += 3)
      for (const j of ROWS) {
        if (!gone(i, j)) continue;
        tp(i, j, i + 3, j + 3, -2, K.dirt);
        if (i === PX0 || !gone(i - 3, j)) fr(j, j + 3, i, -2, 0, K.dirtR);
        if (j === ROWS[0] || !gone(i, j - 3)) fl(i, i + 3, j, -2, 0, K.dirtL);
        const q = P(i + 1.5, j + 1.5, -2);
        if (hsh(i, j) < 0.6) px(q[0] + Math.round(hsh(j, i) * 4 - 2), q[1], K.dirtR);
        if (hsh(j, i + 1) < 0.5) px(q[0] + 2, q[1] + 1, "#c4a883");
      }
    for (let i = PX0; i < PX1; i += 3)
      for (const j of ROWS) {
        if (gone(i, j)) continue;
        tp(i, j, i + 3, j + 3, 0, ((i - PX0) / 3 + (j - ROWS[0]) / 3) % 2 ? K.pave2 : K.pave);
      }
    for (let i = PX0 + 3; i < PX1; i += 3) if (!gone(i, 24) && !gone(i - 3, 24)) wl([i, 24, 0], [i, 27, 0], K.grout);
    // kerbs; the front one (and a strip of verge) again over the holes' floors
    tp(PX0, 23.5, PX1, 24, 0, K.curb);
    tp(PX0, 30, PX1, 30.5, 0, K.curb);
    tp(PX0, 30.5, 70, 32, 0, K.grass);
  }
  function signpost() {
    box(53, 22.6, 0, 0.6, 0.6, 15, DARK);
    // a blank finger sign pointing on along the path: white, no words
    fl(51, 57, 22.9, 10.5, 14.5, K.w0);
    poly([P(57, 22.9, 10.5), P(58.5, 22.9, 12.5), P(57, 22.9, 14.5)], K.w0);
    wl([51, 22.9, 10.5], [57, 22.9, 10.5], K.g2);
    wl([57, 22.9, 10.5], [58.5, 22.9, 12.5], K.g2);
    fr(22.4, 22.9, 51, 10.5, 14.5, K.g1);
  }
  function billboardFrame() {
    box(57, BB.y + 0.2, 0, 0.8, 0.8, BB.z, DARK);
    box(65, BB.y + 0.2, 0, 0.8, 0.8, BB.z, DARK);
    box(BB.x, BB.y, BB.z, BB.w, 1, BB.h, [K.g1, K.g3, K.g2]);
  }
  /** The ad on the billboard's face: shapes only. Flashing: bright, the burst grows, light spills round it. */
  function adFace(t: number) {
    const x0 = BB.x + 1,
      x1 = BB.x + BB.w - 1,
      z0 = BB.z + 1,
      z1 = BB.z + BB.h - 1;
    const on = t >= AD[0] && t < AD[1],
      f = on ? Math.floor((t - AD[0]) / 0.1) % 2 : 0;
    fl(x0, x1, BF, z0, z1, on ? (f ? "#ffffff" : K.glow) : K.pM);
    const c = on && f ? K.red : K.oM;
    fl(57, 61, BF, 17, 24, c);
    fl(58, 60, BF, 16, 25, c);
    if (on) fl(56, 62, BF, 18, 23, c);
    fl(62, 66, BF, 22, 23, on ? K.pM : "#ffffff");
    fl(62, 65, BF, 19, 20, on ? K.pL : "#d9cdf0");
    if (on) {
      const r = f ? 2 : 3;
      for (const [x, z] of [
        [BB.x - r, z1 + r],
        [BB.x + BB.w + r, z1 + r],
        [BB.x + BB.w / 2, z1 + r + 2],
        [BB.x - r - 1, z0 + 5],
        [BB.x + BB.w + r + 1, z0 + 5],
      ] as const) {
        const q = P(x, BF, z);
        px(q[0], q[1], K.amb);
        px(q[0] + 1, q[1], f ? K.glow : K.amb);
      }
    }
  }
  function podium() {
    const { x, y, w, d, h } = PD,
      X1 = x + w;
    box(x, y, 0, w, d, h, ["#d9d6cf", K.pM, "#c2bdb4"]);
    contact(x, y, w, d, 0);
    fl(x, X1, FW, 0, 1, K.pD);
    fl(x, X1, FW, h - 1, h, K.pL);
    for (const s of SOCKETS) {
      // the socket's recess: dark inside, a darker lip at its top and left
      fl(s, s + 3, FW, 3, 9, "#2a1d3a");
      fl(s, s + 3, FW, 8, 9, "#1f1530");
      fl(s, s + 0.5, FW, 3, 9, "#1f1530");
    }
    for (const sx of [x + 1, SOCKETS[1] - 1.25, SOCKETS[2] - 1.25, X1 - 2]) wl([sx + 0.5, FW, 1], [sx + 0.5, FW, h - 1], "#7a52b8");
    fr(y + 2, y + 6, X1, 0, 5, "#8796a6");
    tp(x + 0.5, y + 0.5, X1 - 0.5, FW - 0.5, h, "#d9d6cf");
  }
  /** The rims of the empty sockets (rimLit: 0 dim, 1 orange, 2 glowing with a few sparks). */
  function rims(v: 0 | 1 | 2) {
    const c = v === 2 ? K.glow : v === 1 ? K.oM : "#6b4a2a";
    for (const s of SOCKETS) {
      fl(s - 1, s + 4, FW, 2, 3, c);
      fl(s - 1, s + 4, FW, 9, 10, c);
      fl(s - 1, s, FW, 2, 10, c);
      fl(s + 3, s + 4, FW, 2, 10, c);
      if (v === 2) {
        const q = P(s + 1.5, FW, 10);
        px(q[0] - 1, q[1] - 3, K.glow);
        px(q[0] + 4, q[1] - 1, K.glow);
        px(q[0] - 6, q[1] - 1, K.glow);
      }
    }
  }
  /** Floor k of tower B in glass set C, z0..z1: glazed with its sunshade (dark), or its lit windows. */
  function band(B: Plan, C: readonly string[], z0: number, z1: number, k: number, n: number, isLit: boolean) {
    const gh = z1 - z0 - 1,
      X0 = B.x,
      X1 = B.x + B.w,
      Y0 = B.y,
      Y1 = B.y + B.d,
      f = k / n;
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
  function towerA() {
    const top = fz(ZA, NA);
    fl(TA.x, TA.x + TA.w, TA.y + TA.d, ZA, top, GA[0]);
    fr(TA.y, TA.y + TA.d, TA.x + TA.w, ZA, top, GA[2]);
    contact(TA.x, TA.y, TA.w, TA.d, ZA);
    for (let k = 0; k < NA; k++) band(TA, GA, fz(ZA, k), fz(ZA, k + 1), k, NA, false);
    // the roof: a parapet, plant and a mast
    box(TA.x, TA.y, top, TA.w, TA.d, 3, ["#c9d1e0", "#dfe6f2", "#9fadcb"]);
    tp(TA.x + 1, TA.y + 1, TA.x + TA.w - 1, TA.y + TA.d - 1, top + 3, "#b3b6be");
    box(TA.x + 3, TA.y + 3, top + 3, 5, 4, 3, GREY2);
    box(TA.x + 8, TA.y + 7, top + 3, 2, 2, 4, GREY);
    wl([TA.x + 9, TA.y + 8, top + 7], [TA.x + 9, TA.y + 8, top + 13], K.g4);
    wl([TA.x + TA.w, TA.y + TA.d, ZA], [TA.x + TA.w, TA.y + TA.d, top + 3], "#e6ebf4");
  }
  function towerB() {
    const top = fz(ZB, NB),
      X1 = TB.x + TB.w,
      Y1 = TB.y + TB.d;
    box(TB.x, TB.y, 0, TB.w, TB.d, top, [K.w1, GB[0], GB[2]]);
    contact(TB.x, TB.y, TB.w, TB.d, 0);
    fl(TB.x, X1, Y1, 0, ZB, K.dGlass);
    fr(TB.y, Y1, X1, 0, ZB, "#46525f");
    for (let k = 0; k < NB; k++) band(TB, GB, fz(ZB, k), fz(ZB, k + 1), k, NB, false);
    box(TB.x, TB.y, top, TB.w, TB.d, 2, [K.g1, K.w0, K.g2]);
    box(TB.x + 2, TB.y + 2, top + 2, 6, 6, 6, [K.w1, "#e9edf1", "#b5c0cb"]);
    wl([TB.x + 5, TB.y + 5, top + 8], [TB.x + 5, TB.y + 5, top + 18], K.g4);
    const q = P(TB.x + 5, TB.y + 5, top + 19);
    px(q[0], q[1] - 1, K.red);
  }
  function towerC() {
    const x = 104,
      y = 20,
      w = 8,
      d = 10,
      h = 44;
    box(x, y, 0, w, d, h, [K.w1, "#e4e1da", "#bdb8b0"]);
    contact(x, y, w, d, 0);
    fl(x, x + w, y + d, 0, 4, K.dGlass);
    fr(y, y + d, x + w, 0, 4, "#46525f");
    for (let k = 0; k < 9; k++) {
      const z0 = 7 + 4 * k;
      if (z0 + 2 > h - 3) break;
      for (let i = x + 1; i < x + w - 1; i += 2) fl(i, i + 1, y + d, z0, z0 + 2, K.winL);
      for (let i = y + 1; i < y + d - 1; i += 2) fr(i, i + 1, x + w, z0, z0 + 2, K.winR);
    }
    fl(x, x + w, y + d, h - 3, h, K.w0);
    fr(y, y + d, x + w, h - 3, h, K.g2);
    box(x + 2, y + 3, h, 4, 4, 3, GREY2);
  }

  // ---------- layers ----------
  const mask = on(mk(W, H));
  tp(0, 0, SX, SY, 0, "#000");
  const sh = on(mk(W, H));
  shadow(HALL.x, HALL.y, HALL.w, HALL.d, 30);
  shadow(BB.x, BB.y, BB.w, 1, BB.z + BB.h);
  shadow(PD.x, PD.y, PD.w, PD.d, 40);
  shadow(TB.x, TB.y, TB.w, TB.d, 60);
  shadow(104, 20, 8, 10, 44);
  p.g.globalCompositeOperation = "destination-in";
  p.g.drawImage(mask, 0, 0);
  p.g.globalCompositeOperation = "source-over";
  // LA: the ground, the path and everything behind the student
  const LA = on(mk(W, H));
  tp(0, 0, SX, SY, 0, K.grass);
  fl(0, SX, SY, -6, 0, K.slabL);
  fr(0, SY, SX, -6, 0, K.slabR);
  fl(0, SX, SY, -1, 0, K.grassS);
  fr(0, SY, SX, -1, 0, "#6f9450");
  tp(0, 15, 24, 39, 0, K.pave);
  for (let i = 0; i < 24; i += 4) for (let j = 15; j < 39; j += 4) if (((i + j + 1) / 4) % 2 < 1) tp(i, j, i + 4, Math.min(j + 4, 39), 0, K.pave2);
  tp(70, 0, SX, SY - 1, 0, K.pave);
  for (let i = 70; i < SX; i += 4) for (let j = 0; j < SY - 1; j += 4) if (((i + j) / 4) % 2) tp(i, j, i + 4, Math.min(j + 4, SY - 1), 0, K.pave2);
  for (let i = 26; i < 68; i += 8) tp(i, 34, i + 4, 38, 0, K.grass2);
  for (let i = 28; i < 68; i += 10) tp(i, 4, i + 4, 8, 0, K.grass2);
  p.g.globalAlpha = 0.21;
  p.g.drawImage(sh, 0, 0);
  p.g.globalAlpha = 1;
  path();
  for (const q of TREES_BACK) {
    const s = P(q[0], q[1], 0);
    blit(TSH, s[0], s[1]);
    blit(TREE_B, s[0], s[1]);
  }
  billboardFrame();
  for (const q of LAMPS_BACK) {
    const s = P(q[0], q[1], 0);
    blit(LAMP, s[0], s[1]);
  }
  signpost();
  hall();
  gateBack();
  podium();
  towerA();
  towerB();
  // LC: the white offices in front of both towers (laid back over their lit windows)
  const LC = on(mk(W, H));
  towerC();
  // LF: in front of the path (the gate's front pillar and lintel, the front verge)
  const LF = on(mk(W, H));
  gateFront();
  const front: { k: number; f: () => void }[] = [];
  for (const q of TREES_FRONT)
    front.push({
      k: q[0] + q[1],
      f: () => {
        const s = P(q[0], q[1], 0);
        blit(TSH, s[0], s[1]);
        blit(TREE_S, s[0], s[1]);
      },
    });
  for (const q of LAMPS_FRONT)
    front.push({
      k: q[0] + q[1],
      f: () => {
        const s = P(q[0], q[1], 0);
        blit(LAMP, s[0], s[1]);
      },
    });
  front.sort((a, b) => a.k - b.k).forEach((e) => e.f());

  // ---------- frame ----------
  return function drawFrame(t: number) {
    const g = p.g;
    g.drawImage(LA, 0, 0);
    const na = lit(t, NA, LIGHT_A),
      nb = lit(t, NB, LIGHT_B);
    for (let k = 0; k < na; k++) band(TA, GA, fz(ZA, k), fz(ZA, k + 1), k, NA, true);
    for (let k = 0; k < nb; k++) band(TB, GB, fz(ZB, k), fz(ZB, k + 1), k, NB, true);
    rims(rimLit(t));
    adFace(t);
    g.drawImage(LC, 0, 0);
    // plaza walkers, in front of the towers
    for (const pd of PEDS) {
      const q = keyframes(pd.k, t, T);
      if (!q) continue;
      const s = P(q.x, q.y, 0),
        back = pd.k[pd.k.length - 1][1] < pd.k[0][1];
      blit((back ? PEDL : PED)[pd.c][q.f], s[0], s[1]);
    }
    // the student, with the scroll at the hand
    const h = hero(t),
      fp = P(h.x, FY, 0),
      body = h.lv >= 1 ? FS[h.pose] : pickFade(STANDF, h.lv);
    if (h.lv > 0.5) blit(FSH, fp[0], fp[1]);
    if (body) {
      blit(body, fp[0], fp[1] - h.z);
      if (h.lv >= 1) blit(SCROLL, fp[0] + 5, fp[1] - h.z - 3);
    }
    g.drawImage(LF, 0, 0);
    // the "?" pops over the head and stays; the phone bubble rises from the pocket and buzzes
    if (t >= ASK && h.lv > 0) {
      const a = seg(t, ASK, ASK + 0.15),
        rise = Math.round(3 * ocu(a) + Math.sin(Math.PI * seg(t, ASK + 0.15, ASK + 0.35)));
      const s = pickFade(ASKS, Math.min(a * 1.5, h.lv));
      if (s) blit(s, fp[0], fp[1] - h.z - 17 - rise);
    }
    if (t >= CALL[0] && t < CALL[1]) {
      const a = ocu(seg(t, CALL[0], CALL[0] + 0.25)),
        bx = fp[0] - 4 - 8 * a + (Math.floor(t * 14) % 2),
        by = fp[1] - h.z - 6 - 14 * a;
      const s = pickFade(CALLS, Math.min(a * 2, 1 - seg(t, CALL[1] - 0.2, CALL[1])));
      if (s) blit(s, bx, by);
    }
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

/** The projection at the scene's origin, for the anchors (no canvas needed). */
const at = (x: number, y: number, z: number): Point => [OX0 + 2 * (x - y), OY0 + x + y - z];
const A1: Point3 = [HALL.x + HALL.w / 2, HALL.y + HALL.d / 2, HALL.ridge],
  A2: Point3 = [TA.x + 6, TA.y + 6, fz(ZA, NA) + 3],
  A3: Point3 = [58, 27, 0];

export const problem: SceneModule = {
  logicalW: W,
  logicalH: H,
  period: T,
  // standing at the gap, the "?" up, every floor lit, the sockets glowing
  finalT: 8.1,
  origin: [OX0, OY0],
  whole: true,
  label: PROBLEM.figure,
  // Pins: 1 the campus hall's ridge, 2 the tallest tower's roof, 3 the middle of the missing stretch.
  anchors: { "1": at(...A1), "2": at(...A2), "3": at(...A3) },
  // Each tag is short; x, y is where its leader leaves it, straight above or below the pin
  // (MoveScreens' ProblemArt puts the tag on the far side of that point).
  cards: { "1": { x: at(...A1)[0], y: 34, leader: "vertical" }, "2": { x: at(...A2)[0], y: 28, leader: "vertical" }, "3": { x: at(...A3)[0], y: 190, leader: "vertical" } },
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

export default problem;
