// Qualify road art: an isometric pixel diorama of an exam-board building (white terraced trays on a
// dark glass box). A student at a desk in the forecourt stamps a certificate and a badge pops onto a
// stack; candidates queue at the entrance, a taxi drops one off, and the street carries on around them.
// Ported from the v2 prototype (scratchpad four-roads/_tools/qualify-v2/scene.js) onto ../engine.ts,
// pixel for pixel: same palette, projection (origin 150, 100), layers, sprites and timing. The ground
// is not filled with the prototype's bg: the stage clears to transparent so the art sits on the page.

import { msg } from "@/lib/i18n/translate";
import {
  SHADOW,
  hsh,
  ioc,
  lerp,
  mod,
  pickFade,
  seg,
  trap,
  type Engine,
  type Painter,
  type PinKey,
  type Point,
  type SceneModule,
  type Sprite,
  type Tones,
} from "../engine";

const W = 352,
  H = 280,
  T = 6,
  OX0 = 150,
  OY0 = 100;

const K = {
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
  grass2: "#a9cf7e",
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
  tw: "#f4f3ee",
  tl: "#e4e2db",
  ts: "#c4c2bb",
  rec: "#8d8b88",
  recD: "#6c6a68",
  gl: "#7e8996",
  gd: "#4b5360",
  mul: "#b4bac2",
  mulD: "#8e959f",
  mesh: "#3a3d45",
  mesh2: "#474b55",
  lat: "#9a968f",
  latL: "#bdb9b0",
  latD: "#77736c",
  cr1: "#8fbf4f",
  cr2: "#4f7f35",
  fl: "#d8433a",
  wallC: "#ece8da",
  wallL: "#e0dbcb",
  wallR: "#c9c3b1",
  mural: "#3f7fc0",
  muralL: "#86b6e4",
  muralD: "#2c5d94",
  trk: "#c4524a",
  trkL: "#4a90d0",
  hdbT: "#f3f0e8",
  hdbL: "#ebe7dc",
  hdbR: "#d8d2c4",
  hdbW: "#cdc6b8",
  tiM: "#d49176",
  tiD: "#b8735a",
  aL: "#f2a58f",
  aM: "#d65a41",
  aD: "#963222",
  pL: "#b29ae0",
  pM: "#5f2ea0",
  pD: "#391763",
  woodT: "#dcc7a2",
  woodL: "#c2a77e",
  woodR: "#9d855f",
  glow: "#fff3cf",
  red: "#d9533f",
} as const;
const SHC = SHADOW;

const GREY: Tones = [K.w1, K.g1, K.g2],
  GREY2: Tones = [K.g1, K.g2, K.g3],
  DARK: Tones = [K.g2, K.g3, K.g4],
  TRAY: Tones = [K.tw, K.tl, K.ts],
  WALL: Tones = [K.wallC, K.wallL, K.wallR];

// ---------- world ----------
// A glass tower, B terrace body + trays, C low wing, D white core, P podium
const A = { x: 22, y: 6, w: 14, d: 13, h: 100 },
  BB = { x: 10, y: 19, x1: 32, y1: 32, z: 12, h: 79 },
  NT = 8,
  C = { x: 36, y: 6, w: 26, d: 12, h: 48 },
  D = { x: 6.5, y: 28.5, w: 3, d: 3, h: 108 },
  PD = { x: 8, y: 6, w: 28, d: 28, h: 12 };
const WY = 46,
  WX = 68,
  GA = 16,
  GB = 25;
const TP = [2, 4, 3, 4, 2, 4, 3, 1],
  TQ = [1, 3, 2, 4, 2, 4, 2, 0];

// right quarter: covered linkway from the HDB void deck to the bus stop, a playground and seating beside it
const LKX0 = 84.4,
  LKX1 = 87.6,
  LKY0 = 8,
  LKY1 = 45.8,
  PGX0 = 89.4,
  PGY0 = 18.6,
  PGX1 = 98.6,
  PGY1 = 31.4,
  SWX = 96.6,
  LKP = [10, 14, 18, 22, 26, 30, 34, 38, 42];

// ---------- hero placement ----------
// waist-high counter; the clerk stands right at its back edge (desk hides the legs), certificate within arm's reach to the right
const DX0 = 44.2,
  DX1 = 51.6,
  DY0 = 27.6,
  DY1 = 30.4,
  DC = [49.8, 29] as const,
  DZ = 6,
  PED_S = [54.4, 28.4] as const,
  PZ = 5,
  FPOS = [46.3, 27] as const;

// projection for values fixed at load (anchors), the same as the painter's P at the scene's origin
const P0 = (x: number, y: number, z = 0): Point => [OX0 + 2 * (x - y), OY0 + x + y - z];
// 1 badge stack (pedestal front), 2 terrace trays (left tip of the flower tray), 3 glass tower (exam board)
const ANCH: Record<PinKey, Point> = {
  "1": P0(PED_S[0], PED_S[1] + 1.5, 1),
  "2": P0(BB.x - 1, BB.y1 + TP[3], 46),
  "3": P0(A.x + A.w, A.y + 5, 80),
};

// ---------- runtime state (built in init: sprites need document) ----------

type Pose = "stand" | "blink" | "press";
type Item = { k: number; f: () => void };
type Built = {
  TREE_B: Sprite;
  TREE_S: Sprite;
  TREE_Y: Sprite;
  TREE_F: Sprite;
  TSH: Sprite;
  TSHS: Sprite;
  LAMP: Sprite;
  SHELTER: Sprite;
  FS: Record<Pose, Sprite>;
  CANDF: Sprite[][];
  PED: Sprite[][];
  JOG: Sprite[];
  CX: Sprite[];
  TAXI: Sprite;
  STAMP: Sprite;
  STAMPQ: Sprite;
  COIN: Sprite;
  COINT: Sprite;
  BADGE: Sprite[];
  KID: Sprite;
  LKWF: Sprite[][];
  SEALF: Sprite[];
  STK: HTMLCanvasElement;
  CL1: HTMLCanvasElement;
  CL2: HTMLCanvasElement;
  CBK: HTMLCanvasElement;
  CFR: HTMLCanvasElement;
  LA: HTMLCanvasElement;
};

let p!: Painter;
let S: Built | null = null;

const FIGMAP = { h: "#2b2233", s: "#f1c6a0", p: "#7a4fc4", q: "#5f2ea0", d: "#2f3447", k: "#1f1a2b", w: "#ffffff" };
// front-facing clerk, standing behind the desk: left arm hangs, the right sleeve is drawn per frame from the shoulder to the stamp handle
const HD = ["...hhh...", "..hhhhh..", "..hssss..", "..sksks..", "...sss..."],
  HDB = ["...hhh...", "..hhhhh..", "..hssss..", "..sssss..", "...sss..."];
const TOR1 = ["..ppppp..", ".qpppppq.", ".qppppp..", ".qppppp..", ".s.ppp...", "..ddddd.."];
const LS = ["..dd.dd..", "..dd.dd..", "..kk.kk.."];
const FIG: Record<Pose, string[]> = {
  stand: HD.concat(TOR1, LS),
  blink: HDB.concat(TOR1, LS),
  // press: head dips 1 px (eyes on the paper), torso 1 row shorter, feet on the same pixels
  press: ["...hhh...", "..hhhhh..", "..hhhhh..", "..sksks..", "...sss...", ".qpppppq.", ".qppppp..", ".qppppp..", ".s.ppp...", "..ddddd.."].concat(LS),
};
const PED_C = ["#8d9bb3", "#6a6672", "#b8b2c2", "#9cb38f", "#c4a597", "#ffffff"];
const CARC: Tones[] = [
  [K.w0, "#e3e0d9", "#c3beb6"],
  ["#b3bfcf", "#94a2b5", "#76849a"],
  ["#d3c2b6", "#b8a597", "#958375"],
  ["#8f8c96", "#77747f", "#5f5c68"],
  ["#c9ccc4", "#adb1a8", "#8e9289"],
];
const SMAP = { n: K.woodT, N: K.woodL, h: "#a27a4e", H: "#c69a63", a: K.aL, b: K.aM, d: K.aD };
const CMW = 44,
  CMH = 40,
  CMX = 22,
  CMY = 30;
const INK = [0x1f, 0x1a, 0x2b];

function carX(t: Tones) {
  const { sprite, poly, P, box, tp } = p;
  return sprite(16, 12, 5, 5, () => {
    poly([P(0.5, 0.4, 0), P(4.5, 0.4, 0), P(4.5, 2.4, 0), P(0.5, 2.4, 0)], SHC);
    box(0, 0, 0, 4, 2, 2, t);
    box(1, 0, 2, 2, 2, 2, [t[0], "#3b4255", "#2c3242"]);
    tp(1, 0, 3, 2, 4, t[0]);
  });
}

function buildSprites(engine: Engine): Omit<Built, "LA"> {
  const { pix, sprite, box, fl, fades, P, px } = p;
  const TM = { a: K.tL, b: K.tM, c: K.tD, t: K.trunk };
  const TREE_B = pix(["....aaa....", "..aaaaabb..", ".aaaaaabbb.", "aaaaaabbbbc", "aaaabbbbbcc", ".aabbbbbcc.", "..bbbbccc..", "....ccc....", ".....t.....", ".....t....."], TM);
  const TREE_S = pix(["..aa...", ".aaabb.", "aaabbbc", ".abbbcc", "..bcc..", "...t..."], TM);
  const TREE_Y = pix([".aa..", "aabb.", "abbbc", ".bcc.", "..t..", "..t..", "..t.."], TM); // slim young tree
  const TREE_F = pix([".aab.", "aabbc", ".bcc.", "..t..", "..t.."], { a: "#d9eaa8", b: "#a9cf72", c: "#7fae52", t: K.trunk }); // pale roof-garden tree
  const TSH = sprite(12, 4, 2, 1, () => {
    const g = p.g;
    g.fillStyle = SHC;
    g.fillRect(1, 0, 9, 1);
    g.fillRect(0, 1, 10, 1);
    g.fillRect(2, 2, 6, 1);
  });
  const TSHS = sprite(8, 3, 2, 1, () => {
    const g = p.g;
    g.fillStyle = SHC;
    g.fillRect(1, 0, 5, 1);
    g.fillRect(0, 1, 5, 1);
  });
  const LAMP = sprite(6, 14, 2, 12, () => {
    const g = p.g;
    g.fillStyle = K.g4;
    g.fillRect(2, 2, 1, 10);
    g.fillRect(3, 1, 2, 1);
    g.fillStyle = K.w0;
    g.fillRect(4, 2, 1, 1);
  });
  const SHELTER = sprite(26, 20, 8, 6, () => {
    box(0, 0, 0, 7, 2, 1, GREY2);
    box(0, 1.5, 1, 0.5, 0.5, 6, DARK);
    box(6.5, 1.5, 1, 0.5, 0.5, 6, DARK);
    fl(0.5, 6.5, 0.5, 1, 6, "rgba(170,190,205,.55)");
    box(-0.5, -0.5, 7, 8, 3, 1, [K.w0, K.g2, K.g3]);
    box(5, 0, 1, 1.5, 0.6, 5, [K.w1, K.g2, K.g3]);
  });
  // unoutlined body sprites; the clerk, arm and stamp are outlined together per frame (one silhouette, no ink between arm and torso)
  const FS = { stand: pix(FIG.stand, FIGMAP), blink: pix(FIG.blink, FIGMAP), press: pix(FIG.press, FIGMAP) };
  // candidates: white shirt, dark trousers, blue folder
  const PM = { k: "#2b2233", s: "#f1c6a0", c: "#ffffff", e: "#d9d6e0", d: "#3a3f52", f: "#4a74c4" };
  const CAND = [pix([".k..", ".s..", "ecf.", ".c..", "d.d."], PM), pix([".k..", ".s..", "ecf.", ".c..", ".d.."], PM)];
  const CANDF = CAND.map(fades);
  const PED = PED_C.map((c) => {
    const m = { k: "#2b2233", s: "#f1c6a0", c, d: "#3a3f52" };
    return [pix([".k.", ".s.", "ccc", ".c.", "d.d"], m), pix([".k.", ".s.", "ccc", ".c.", ".d."], m)];
  });
  const JM = { k: "#2b2233", s: "#f1c6a0", r: "#e3803a", d: "#2f3447" };
  const JOG = [pix([".k.", ".s.", "rrr", ".r.", "d.d"], JM), pix([".k.", ".s.", "rrr", ".r.", ".d."], JM)];
  const CX = CARC.map(carX);
  const TAXI = carX(["#f3f1ea", "#4b5d8c", "#3a4a74"]);
  // stamp: small pale-wood knob, dark wooden handle 2 px x 5, flat red die 6x3 with a darker base line (anchor = die bottom centre)
  const STAMP = pix(["..nn..", ".nNNn.", "..hH..", "..hH..", "..hH..", "aaaaaa", "dddddd"], SMAP);
  // impact frame: die squashed 1 px (wider, 2 rows)
  const STAMPQ = pix(["...nn...", "..nNNn..", "...hH...", "...hH...", "abbbbbba", "dddddddd"], SMAP);
  // badge coin (stack) + spin frames
  const COIN = pix(["..aaaaa..", ".abbbbba.", "abbbbbbba", "cabbbbbac", ".ccccccc."], { a: K.aL, b: K.aM, c: K.aD });
  const COINT = pix(["..aaaaa..", ".abbwbba.", "abbbbbbba", "cabbbbbac", ".ccccccc."], { a: K.aL, b: K.aM, c: K.aD, w: "#fff6e8" });
  const BADGE = [
    pix([".aaa.", "abwba", "abbba", "cbbbc", ".ccc."], { a: K.aL, b: K.aM, c: K.aD, w: "#fff6e8" }, K.ink),
    pix([".a.", "aba", "abb", "cbc", ".c."], { a: K.aL, b: K.aM, c: K.aD }, K.ink),
    pix(["a", "b", "b", "c", "c"], { a: K.aL, b: K.aM, c: K.aD }, K.ink),
  ];
  const KID = pix([".k.", ".s.", "yyy", ".y.", "d.d"], { k: "#2b2233", s: "#f1c6a0", y: "#f2c84b", d: "#3a3f52" });
  const LKWF = [fades(PED[0][0]), fades(PED[0][1])];
  const SEAL = sprite(10, 6, 5, 3, () => {
    const c = P(0, 0, 0);
    px(c[0] - 1, c[1] - 1, K.aM);
    px(c[0], c[1] - 1, K.aM);
    px(c[0] - 2, c[1], K.aM);
    px(c[0] + 1, c[1], K.aM);
    px(c[0] - 1, c[1] + 1, K.aM);
    px(c[0], c[1] + 1, K.aM);
    px(c[0] - 1, c[1], K.aL);
    px(c[0], c[1], K.aD);
  });
  const SEALF = fades(SEAL);
  const m = engine.mk;
  return {
    TREE_B,
    TREE_S,
    TREE_Y,
    TREE_F,
    TSH,
    TSHS,
    LAMP,
    SHELTER,
    FS,
    CANDF,
    PED,
    JOG,
    CX,
    TAXI,
    STAMP,
    STAMPQ,
    COIN,
    COINT,
    BADGE,
    KID,
    LKWF,
    SEALF,
    STK: m(24, 40),
    CL1: m(CMW, CMH),
    CL2: m(CMW, CMH),
    CBK: m(CMW, CMH),
    CFR: m(CMW, CMH),
  };
}

// ---------- static world (drawn once into the LA layer) ----------

function glassL(x0: number, x1: number, y: number, z0: number, z1: number) {
  const { fl } = p;
  fl(x0, x1, y, z0, z1, K.mul);
  for (let z = z0, j = 0; z < z1; z += 8, j++)
    for (let i = x0; i < x1; i += 2) {
      const v = hsh(i * 1.3, j * 2.1 + y);
      let c: string = v < 0.3 ? "#56616f" : v < 0.65 ? "#67727f" : v < 0.88 ? K.gl : "#97a2ae";
      if (z > z1 - 24 && v > 0.6) c = "#8c97a4";
      fl(i + 0.5, Math.min(i + 2, x1), y, z + 1, Math.min(z + 8, z1), c);
    }
}
function glassR(y0: number, y1: number, x: number, z0: number, z1: number) {
  const { fr } = p;
  fr(y0, y1, x, z0, z1, K.mulD);
  for (let z = z0, j = 0; z < z1; z += 8, j++)
    for (let i = y0; i < y1; i += 2) {
      const v = hsh(j * 1.7 + x, i * 0.9),
        c = v < 0.2 ? "#3d434e" : v < 0.6 ? K.gd : v < 0.85 ? "#58616f" : "#66707e";
      fr(i + 0.5, Math.min(i + 2, y1), x, z + 1, Math.min(z + 8, z1), c);
    }
}
function towerA() {
  const { fl, fr, tp, box, wl } = p;
  const x = A.x,
    y = A.y,
    w = A.w,
    d = A.d,
    h = A.h;
  glassL(x, x + w, y + d, PD.h, h - 2);
  glassR(y, y + d, x + w, PD.h, h - 2);
  fl(x, x + w, y + d, h - 2, h, K.g1);
  fr(y, y + d, x + w, h - 2, h, K.g3);
  tp(x, y, x + w, y + d, h, "#d6d3cc");
  tp(x + 0.6, y + 0.6, x + w - 0.6, y + d - 0.6, h, K.g2);
  box(x + 3, y + 3, h, 4, 3, 5, GREY2);
  for (let i = x + 3.5; i < x + 7; i += 1) wl([i, y + 6, h + 1], [i, y + 6, h + 4], K.g4);
  box(x + 8.5, y + 2, h, 2, 2, 3, GREY);
}
function core() {
  const { box, contact, wl, fl } = p;
  const x = D.x,
    y = D.y,
    w = D.w,
    d = D.d,
    h = D.h;
  box(x, y, 0, w, d, h, [K.w1, "#f1f0ec", "#cfccc4"]);
  contact(x, y, w, d, 0);
  for (let z = 14; z < h - 8; z += 16) {
    wl([x + 1.5, y + d, z], [x + 1.5, y + d, z + 9], "#6c6a68");
    wl([x + w, y + 1.5, z + 4], [x + w, y + 1.5, z + 12], "#8d8b88");
  }
  fl(x, x + w, y + d, h - 2, h, K.w0);
}
function podium() {
  const { box, contact, wl, fl, fr } = p;
  const x = PD.x,
    y = PD.y,
    w = PD.w,
    d = PD.d,
    h = PD.h,
    f = y + d;
  box(x, y, 0, w, d, h, ["#d9d6cf", "#3e4553", "#363c48"]);
  contact(x, y, w, d, 0);
  for (let i = x + 1; i < x + w; i += 1) wl([i, f, 0], [i, f, h - 3], i % 2 ? "#626b78" : "#9aa0a8");
  for (let i = y + 1; i < f; i += 1) wl([x + w, i, 0], [x + w, i, h - 3], i % 2 ? "#4f5764" : "#7d848f");
  fl(x, x + w, f, h - 3, h, K.g1);
  fr(y, f, x + w, h - 3, h, K.g3);
  // entrance recess + mural
  fl(17, 23, f, 0, 8, "#232833");
  fl(17.6, 22.4, f, 0, 7, "#3a4757");
  for (let i = 18.8; i < 22.4; i += 1.2) wl([i, f, 0], [i, f, 6], "#6f7f93");
  fr(f - 1.2, f, 17, 0, 8, "#1c2029");
  fl(10.6, 16.4, f, 1, 9, K.mural);
  for (let i = 0; i < 12; i++) {
    const u = 10.8 + hsh(i, 3) * 4.4,
      v = 1.5 + hsh(3, i) * 6;
    fl(u, u + 0.6, f, v, v + 1.5, i % 3 ? K.muralL : K.muralD);
  }
  box(16.4, f, 8, 7.2, 1.6, 0.8, [K.w0, K.w0, K.g2]);
}
function body() {
  const { fl, fr, tp } = p;
  const x = BB.x,
    y = BB.y,
    x1 = BB.x1,
    y1 = BB.y1,
    z0 = BB.z,
    z1 = BB.h;
  glassL(x, x1, y1, z0, z1);
  glassR(y, y1, x1, z0, z1);
  // recess shade: the band right under each tray is darkest
  for (let z = 18; z < z1; z += 9) {
    fl(x, x1, y1, z, z + 2, "#3f4651");
    fr(y, y1, x1, z, z + 2, "#353b45");
  }
  tp(x, y, x1, y1, z1, K.g2);
}
// creepers hang from the slab's lower edge in 2 px clumps, 2-5 px long, two-tone, irregular groups (40-60% of the edge)
function creepers(a0: number, a1: number, y: number, z: number, seed: number, side: number) {
  const { P, px } = p;
  let u = a0 + 0.5;
  while (u < a1 - 0.6) {
    const gw = 1 + Math.floor(hsh(seed, u * 2.3) * 2);
    if (hsh(u * 3.1 + seed, seed * 1.7) < 0.55) {
      for (let j = 0; j < gw && u + j < a1 - 0.4; j++) {
        const q = side ? P(y, u + j, z) : P(u + j, y, z);
        const n = 2 + Math.floor(hsh(seed + j * 3, u * 5.3) * 3),
          c0 = Math.round(q[0]) - (side ? 2 : 0),
          c1 = Math.round(q[1]);
        for (let k = 0; k < n; k++) {
          px(c0, c1 + k, k === n - 1 ? K.cr2 : side ? K.cr2 : K.cr1);
          if (k < n - 1) px(c0 + 1, c1 + k, k === n - 2 ? K.cr2 : side ? "#3f6a2b" : K.cr2);
        }
        if (!side) px(c0 + 1, c1, K.cr1);
      }
      u += gw + 1;
    } else u += 1;
  }
}
function tray(k: number, b: Omit<Built, "LA">) {
  const { box, fl, fr, tp, wl, P, line, px, blit } = p;
  const z = 16 + 9 * k,
    top = k === NT - 1,
    x0 = top ? BB.x + 1 : BB.x - 1,
    y0 = BB.y,
    x1 = BB.x1 + TQ[k],
    y1 = BB.y1 + TP[k];
  box(x0, y0, z, x1 - x0, y1 - y0, 2, TRAY);
  fl(x0, x1, y1, z, z + 1, K.ts);
  fr(y0, y1, x1, z, z + 1, "#aeaca5");
  // the tray top sits in the shade of the tray above; darkest against the glass tower
  if (!top) {
    tp(x0, y0, x1, y1, z + 2, K.rec);
    tp(BB.x1 - 1, y0, x1, y0 + 2.5, z + 2, K.recD);
    tp(x0, y0, x1, y0 + 1.2, z + 2, K.recD);
  } else roofGarden(x0, y0, x1, y1, z + 2);
  box(x0, y1 - 0.6, z + 2, x1 - x0, 0.6, 3, TRAY);
  box(x1 - 0.6, y0, z + 2, 0.6, y1 - y0 - 0.6, 3, TRAY);
  wl([x0, y1, z + 5], [x1, y1, z + 5], K.w0);
  wl([x1, y0, z + 5], [x1, y1, z + 5], K.w0);
  // crisp 1 px shadow line under the slab
  const a = P(x0, y1, z),
    bb = P(x1, y1, z),
    e = P(x1, y0, z);
  line(a[0], a[1], bb[0] - 1, bb[1], "#55524e");
  line(bb[0], bb[1], e[0], e[1], "#4a4845");
  if (k === 3) {
    for (let i = y0 + 0.5; i < y1; i += 0.5) {
      const r = P(x1, i, z + 6);
      px(r[0], r[1] - 1, (i * 2) % 2 ? K.cr2 : K.fl);
    }
    for (let i = x0 + 0.5; i < x1; i += 1) {
      const s = P(i, y1, z + 6);
      px(s[0], s[1] - 1, (i * 2) % 4 < 2 ? K.fl : K.cr2);
    }
  }
  creepers(x0, x1, y1, z, k * 11 + 1, 0);
  creepers(y0, y1, x1, z, k * 13 + 5, 1);
  if (k === 2 || k === 5) {
    const q = P(x0 + 3, y1 - 2, z + 2);
    blit(b.TREE_S, q[0], q[1]);
  }
  if (k === 4) {
    const q = P(x1 - 2, y0 + 3, z + 2);
    blit(b.TREE_Y, q[0], q[1]);
  }
}
// stepped top tray: parapet on all sides, planted beds, planter boxes, a timber deck strip
function roofGarden(x0: number, y0: number, x1: number, y1: number, z: number) {
  const { tp, box, P, px } = p;
  tp(x0, y0, x1, y1, z, K.g1);
  for (let i = x0 + 1; i < x1 - 1; i += 2) tp(i, y0 + 0.6, i + 0.25, y1 - 0.6, z, "#d6d2ca");
  tp(x0 + 0.6, y0 + 0.6, x1 - 0.6, y0 + 4.2, z, K.grass);
  tp(x0 + 0.6, y0 + 0.6, x1 - 0.6, y0 + 1.4, z, K.grassS);
  tp(x0 + 0.6, y0 + 4.2, x0 + 4, y1 - 0.6, z, K.grass2);
  tp(x0 + 5, y1 - 3.4, x1 - 1.5, y1 - 2.2, z, K.woodT);
  for (let i = x0 + 5.5; i < x1 - 1.5; i += 1) tp(i, y1 - 3.4, i + 0.15, y1 - 2.2, z, K.woodL);
  for (let i = x0 + 6; i < x1 - 3; i += 4.5) {
    box(i, y0 + 5.5, z, 2.6, 1.4, 2, [K.cr1, K.g1, K.g3]);
    box(i + 0.3, y0 + 5.7, z + 2, 2, 1, 1, [K.tL, K.tM, K.tD]);
  }
  box(x0, y0, z, x1 - x0, 0.6, 3, TRAY);
  box(x0, y0, z, 0.6, y1 - y0, 3, TRAY);
  for (let i = 0; i < 9; i++) {
    const q = P(x0 + 1 + hsh(i, 7) * (x1 - x0 - 2), y0 + 1 + hsh(7, i) * 2.6, z);
    px(q[0], q[1] - 1, i % 3 ? K.tD : K.fl);
  }
}
function wing() {
  const { box, fl, fr, wl, tp, P, px } = p;
  const x = C.x,
    y = C.y,
    w = C.w,
    d = C.d,
    h = C.h,
    f = y + d,
    e = x + w;
  box(x, y, 0, w - 1, d - 1, 10, ["#2e3139", "#2b2e36", "#24272e"]);
  fl(x, e - 1, f - 1, 0, 10, "#30343d");
  for (let i = x + 1; i < e - 1; i += 1) wl([i, f - 1, 0], [i, f - 1, 8], i % 2 ? "#4a5260" : "#3a404c");
  fl(x, e, f, 10, 48, K.lat);
  fr(y, f, e, 10, 48, "#85817a");
  for (let i = x + 1; i < e; i += 4) box(i, f - 0.8, 0, 0.8, 0.8, 10, [K.w1, "#dedbd3", "#b9b5ad"]);
  for (let i = y + 1; i < f; i += 4) box(e - 0.8, i, 0, 0.8, 0.8, 10, [K.w1, "#dedbd3", "#b9b5ad"]);
  // lattice row with window boxes (z 10..26)
  fl(x, e, f, 10, 12, K.w1);
  fr(y, f, e, 10, 12, K.g2);
  for (let z = 13; z < 26; z += 4) wl([x, f, z], [e, f, z], K.latD);
  for (let i = x + 0.5; i < e; i += 1) wl([i, f, 12], [i, f, 25], (i * 2) % 2 ? K.latL : K.latD);
  for (let i = x + 1.5; i < e - 1; i += 3) {
    const zz = 15 + ((i * 7) % 2) * 4;
    fl(i, i + 1.5, f, zz, zz + 3, "#5d6470");
    fl(i, i + 1.5, f, zz + 2, zz + 3, K.latL);
  }
  for (let i = y + 1; i < f; i += 1) wl([e, i, 12], [e, i, 25], i % 2 ? "#8d8981" : "#6c6862");
  // dark mesh band
  fl(x, e, f, 26, 46, K.mesh);
  fr(y, f, e, 26, 46, "#2f3238");
  for (let z = 27; z < 46; z += 2)
    for (let i = x + ((z >> 1) % 2 ? 0.5 : 0); i < e; i += 1) {
      const q = P(i, f, z);
      px(q[0], q[1] - 1, K.mesh2);
    }
  for (let z = 27; z < 46; z += 2)
    for (let i = y + 0.5; i < f; i += 1) {
      const q = P(e, i, z);
      px(q[0], q[1] - 1, "#3b3f47");
    }
  wl([x, f, 26], [e, f, 26], "#5a5e66");
  fl(x, e, f, 46, 48, K.w0);
  fr(y, f, e, 46, 48, K.g2);
  // roof garden
  tp(x, y, e, f, h, K.g1);
  tp(x + 0.6, y + 0.6, e - 0.6, f - 0.6, h, K.grass);
  tp(x + 1.5, y + 3, e - 2, y + 5, h, K.grass2);
  for (let i = x + 0.5; i < e; i += 1) {
    const r = P(i, f, h + 1);
    px(r[0], r[1] - 1, (i * 2) % 3 < 1 ? K.cr2 : K.fl);
  }
  wl([x, f, h + 3], [e, f, h + 3], "#d9dde2");
  wl([e, y, h + 3], [e, f, h + 3], "#d9dde2");
}
function roofTrees(b: Omit<Built, "LA">) {
  const { P, blit } = p;
  for (const q of [
    [40, 9],
    [46, 12.5],
    [51, 8.5],
    [57, 12],
  ]) {
    const r = P(q[0], q[1], C.h);
    blit(b.TREE_F, r[0], r[1]);
  }
  let r = P(28, 21.5, 81);
  blit(b.TREE_S, r[0], r[1]);
  r = P(14, 21.5, 81);
  blit(b.TREE_F, r[0], r[1]);
  r = P(20, 21, 81);
  blit(b.TREE_F, r[0], r[1]);
}
function hdb() {
  const { box, contact, wl, fl, fr } = p;
  const x = 80,
    y = 2,
    w = 18,
    d = 6,
    h = 50;
  box(x, y, 0, w, d, h, [K.hdbT, K.hdbL, K.hdbR]);
  contact(x, y, w, d, 0);
  for (let z = 6; z < h - 4; z += 6) {
    wl([x, y + d, z], [x + w, y + d, z], K.hdbW);
    for (let i = x + 1; i < x + w - 1; i += 2) fl(i, i + 1, y + d, z + 2, z + 4, i % 6 < 2 ? "#bfc7cf" : "#d3d8dd");
  }
  for (let z = 6; z < h - 4; z += 6) for (let i = y + 1; i < y + d; i += 2) fr(i, i + 1, x + w, z + 2, z + 4, "#bcc3ca");
  fl(x, x + w, y + d, 0, 4, "#c9c1ad");
  for (let i = x + 1; i < x + w; i += 2) fl(i, i + 0.6, y + d, 0, 4, K.hdbR);
  box(x + 2, y + 1, h, 5, 4, 4, [K.tiM, K.tiM, K.tiD]);
  box(x + 11, y + 1, h, 5, 4, 4, [K.tiM, K.tiM, K.tiD]);
}
function walls() {
  const { box, wl, fl } = p;
  const a0 = WY - 0.7,
    b0 = WX - 0.7;
  // front wall along y=WY with a gate gap GA..GB; right wall along x=WX
  const runX = (a: number, b: number) => {
    box(a, a0, 0, b - a, 0.7, 2, WALL);
    for (let i = a + 0.5; i < b; i += 0.5) wl([i, WY, 2], [i, WY, 5], (i * 2) % 2 ? "#9a96a0" : K.g4);
    wl([a, WY, 5], [b, WY, 5], K.g4);
    for (let i = a; i <= b - 0.5; i += 6) box(i, WY - 1, 0, 1, 1, 6, WALL);
    box(b - 1, WY - 1, 0, 1, 1, 6, WALL);
  };
  const runY = (a: number, b: number) => {
    box(b0, a, 0, 0.7, b - a, 2, WALL);
    for (let i = a + 0.5; i < b; i += 0.5) wl([WX, i, 2], [WX, i, 5], (i * 2) % 2 ? "#9a96a0" : K.g4);
    wl([WX, a, 5], [WX, b, 5], K.g4);
    for (let i = a; i <= b - 1; i += 6) box(WX - 1, i, 0, 1, 1, 6, WALL);
  };
  runY(1, WY - 1);
  runX(1, GA);
  runX(GB, WX);
  box(GA - 1.4, WY - 1.4, 0, 1.6, 1.6, 9, WALL);
  box(GB - 0.2, WY - 1.4, 0, 1.6, 1.6, 9, WALL);
  fl(GA - 1.2, GA, WY + 0.2, 3, 7, "#d8d2c0");
}
function rqGround() {
  const { tp } = p;
  tp(LKX0, LKY0, LKX1, LKY1, 0, K.curb);
  tp(LKX0 + 0.3, LKY0, LKX1 - 0.3, LKY1, 0, "#d9d4cb");
  for (let j = LKY0 + 1; j < LKY1; j += 1.5) tp(LKX0 + 0.3, j, LKX1 - 0.3, j + 0.3, 0, "#cec8be");
  tp(PGX0 - 0.4, PGY0 - 0.4, PGX1 + 0.4, PGY1 + 0.4, 0, K.curb);
  tp(PGX0, PGY0, PGX1, PGY1, 0, "#e7a888");
  tp(PGX0 + 1, PGY0 + 7, PGX0 + 5, PGY1 - 0.8, 0, "#9cc3e3");
  tp(PGX0 + 5.6, PGY0 + 1, PGX1 - 0.8, PGY0 + 3.4, 0, "#f0c98a");
  tp(LKX1, 32.8, PGX0 - 0.4, 34.2, 0, K.pave2);
}
function rqStatic() {
  const { fl, box, P, px, tp, wl, poly } = p;
  // void-deck opening under the HDB block where the linkway starts
  fl(LKX0, LKX1, LKY0, 0, 4, "#7c766c");
  fl(LKX0 + 0.4, LKX1 - 0.4, LKY0, 0, 3.4, "#5f5a52");
  // seating and planters along the outer side of the linkway
  for (const y of [12, 36.6]) {
    box(88, y, 0, 1.3, 3.4, 2, [K.grass2, K.g1, K.g2]);
    box(88.2, y + 0.3, 2, 0.9, 2.8, 1, [K.cr1, K.cr1, K.cr2]);
    for (let k = 0; k < 4; k++) {
      const q = P(88.5 + (k % 2) * 0.4, y + 0.5 + k * 0.8, 3);
      px(q[0], q[1] - 1, k % 2 ? K.fl : K.tD);
    }
  }
  box(88.2, 22.6, 0, 1, 2.6, 1, [K.woodT, K.woodL, K.woodR]);
  box(88.2, 41, 0, 1, 2.6, 1, [K.woodT, K.woodL, K.woodR]);
  for (const y of LKP) box(LKX0 + 0.2, y, 0, 0.5, 0.5, 9, [K.g2, K.g3, K.g4]);
  box(LKX0 - 0.2, LKY0, 9, LKX1 - LKX0 + 0.4, LKY1 - LKY0, 1, ["#cfd2d7", "#9aa0a8", "#7b8089"]);
  for (let i = LKY0 + 2; i < LKY1; i += 2) tp(LKX0, i, LKX1 + 0.2, i + 0.25, 10, "#bcc0c6");
  wl([LKX1 + 0.2, LKY0, 10], [LKX1 + 0.2, LKY1, 10], K.w0);
  wl([LKX0 - 0.2, LKY1, 10], [LKX1 + 0.2, LKY1, 10], K.w0);
  // play tower: four posts, yellow deck, red roof; blue slide down toward the viewer
  for (const q of [
    [91, 20],
    [93.3, 20],
    [91, 22.3],
    [93.3, 22.3],
  ])
    box(q[0], q[1], 0, 0.4, 0.4, 10, [K.g3, K.g4, K.g5]);
  box(90.9, 19.9, 5, 2.9, 2.9, 1, ["#f2c84b", "#d9ac2f", "#b38a1f"]);
  box(90.7, 19.7, 10, 3.3, 3.3, 1, [K.aL, K.aM, K.aD]);
  box(91.5, 20.5, 11, 1.7, 1.7, 1, [K.aL, K.aM, K.aD]);
  poly([P(91.6, 23.2, 6), P(93, 23.2, 6), P(93, 27.6, 0.4), P(91.6, 27.6, 0.4)], "#4a90d0");
  poly([P(93, 23.2, 6), P(93, 27.6, 0.4), P(93, 27.6, 0), P(93, 23.2, 5)], "#2f6aa6");
  wl([93, 23.2, 6.4], [93, 27.6, 0.8], "#86b6e4");
  // swing frame: A legs at both ends, beam along y
  for (const y of [21, 27.4]) box(SWX - 0.25, y - 0.25, 0, 0.5, 0.5, 8.6, [K.g3, K.g4, K.g5]);
  wl([SWX, 21, 8], [SWX, 27.4, 8], K.g5);
  wl([SWX, 21, 8.6], [SWX, 27.4, 8.6], K.g3);
}

function buildLayers(b: Omit<Built, "LA">, engine: Engine): HTMLCanvasElement {
  const { on, tp, fl, fr, shadow, P, blit, box } = p;
  const mk = engine.mk;
  const mask = on(mk(W, H));
  tp(0, 0, 100, 68, 0, "#000");
  const sh = on(mk(W, H));
  shadow(PD.x, PD.y, PD.w, PD.d, PD.h);
  shadow(A.x, A.y, A.w, A.d, A.h);
  shadow(BB.x - 1, BB.y, BB.x1 - BB.x + 5, BB.y1 - BB.y + 5, BB.h);
  shadow(C.x, C.y, C.w, C.d, C.h);
  shadow(D.x, D.y, D.w, D.d, D.h);
  shadow(80, 2, 18, 6, 50);
  shadow(84.2, 8, 3.6, 37.8, 10);
  shadow(90.8, 19.8, 2.9, 2.9, 11);
  shadow(1, WY - 1, WX - 1, 1, 6);
  shadow(WX - 1, 1, 1, WY - 2, 6);
  p.g.globalCompositeOperation = "destination-in";
  p.g.drawImage(mask, 0, 0);
  p.g.globalCompositeOperation = "source-over";
  const LA = on(mk(W, H));
  tp(0, 0, 100, 68, 0, K.pave);
  fl(0, 100, 68, -7, 0, K.slabL);
  fr(0, 68, 100, -7, 0, K.slabR);
  fl(0, 100, 68, -1, 0, K.grassS);
  fr(0, WY, 100, -1, 0, "#6f9450");
  fr(62, 68, 100, -1, 0, "#6f9450");
  // plot lawn with mowing stripes; right lawn
  tp(0, 0, WX, WY, 0, K.grass);
  for (let i = 2; i < WX; i += 8) tp(i, 0, i + 4, WY - 1, 0, K.grass2);
  tp(WX, 0, 100, WY, 0, K.grass);
  for (let j = 3; j < WY; j += 8) tp(76, j, 100, j + 4, 0, K.grass2);
  // building apron, forecourt paving, path to the gate, lawn path to the wing
  tp(7, 5, PD.x + PD.w + 1, PD.y + PD.d + 1, 0, K.pave2);
  tp(C.x, C.y + C.d, C.x + C.w, C.y + C.d + 1.5, 0, K.pave2);
  tp(10, 34, 42, WY - 0.7, 0, K.pave);
  for (let i = 10; i < 42; i += 2) for (let j = 34; j < WY - 1; j += 2) if (((i + j) / 2) % 2) tp(i, j, i + 2, j + 2, 0, K.pave2);
  tp(GA + 1.5, 34, GB - 1.5, WY, 0, "#ebe7df");
  tp(42, 36, 60, 38, 0, K.pave2);
  // hero pad: paved square on the lawn with a kerb, joined to the path
  tp(40.5, 24.5, 57, 35.5, 0, K.curb);
  tp(41, 25, 56.5, 35, 0, K.pave);
  for (let i = 41; i < 56; i += 2) for (let j = 25; j < 35; j += 2) if (((i + j - 1) / 2) % 2) tp(i, j, i + 2, j + 2, 0, K.pave2);
  tp(58, 19.5, 60, 38, 0, K.pave2);
  // park connector: rust track with a blue lane line, kerbs
  tp(70, 0, 75.5, WY, 0, K.trk);
  tp(72.6, 0, 73.1, WY, 0, K.trkL);
  tp(69.5, 0, 70, WY, 0, K.curb);
  tp(75.5, 0, 76, WY, 0, K.curb);
  // pavement, lay-by, road, far verge
  tp(0, WY, 100, 49, 0, K.pave);
  for (let i = 0; i < 100; i += 3) tp(i, WY, i + 0.5, 49, 0, K.pave2);
  tp(0, 49, 100, 62, 0, K.road);
  tp(10, 47.5, 36, 49, 0, K.road2);
  tp(10, 47, 36, 47.5, 0, K.curb);
  tp(0, 48.5, 10, 49, 0, K.curb);
  tp(36, 48.5, 100, 49, 0, K.curb);
  for (let i = 11; i < 35; i += 3) tp(i, 49, i + 1.5, 50, 0, "#e5c25a");
  for (let i = 0; i < 100; i += 6) {
    if (i + 3 > 77 && i < 83) continue;
    tp(i, 52, i + 3, 53, 0, K.mark);
    tp(i, 59, i + 3, 60, 0, K.mark);
  }
  tp(0, 55.5, 77, 56.5, 0, K.mark);
  tp(83, 55.5, 100, 56.5, 0, K.mark);
  for (let j = 49.5; j < 62; j += 2) tp(78, j, 82, j + 1, 0, K.mark);
  tp(0, 62, 100, 62.6, 0, K.curb);
  tp(0, 62.6, 100, 68, 0, K.grass);
  tp(0, 63.6, 100, 65.6, 0, K.pave);
  for (let i = 0; i < 100; i += 3) tp(i, 63.6, i + 0.5, 65.6, 0, K.pave2);
  rqGround();
  p.g.globalAlpha = 0.21;
  p.g.drawImage(sh, 0, 0);
  p.g.globalAlpha = 1;
  // back trees (behind everything)
  for (const q of [
    [3, 2, 0],
    [14, 2, 1],
    [66, 2, 1],
    [78, 12, 0],
    [78, 20, 1],
    [78, 30, 0],
    [96, 12, 0],
    [91, 13.5, 1],
    [81, 13, 1],
    [78, 40, 0],
  ]) {
    const r = P(q[0], q[1], 0);
    blit(b.TSH, r[0], r[1]);
    blit(q[2] ? b.TREE_S : b.TREE_B, r[0], r[1]);
  }
  hdb();
  rqStatic();
  podium();
  core();
  // roof shadow of the tower across the wing roof
  const rs = on(mk(W, H));
  shadow(A.x, A.y, A.w, A.d, A.h - C.h, C.h);
  const rm = on(mk(W, H));
  tp(C.x, C.y, C.x + C.w, C.y + C.d, C.h, "#000");
  on(rs);
  p.g.globalCompositeOperation = "destination-in";
  p.g.drawImage(rm, 0, 0);
  p.g.globalCompositeOperation = "source-over";
  on(LA);
  towerA();
  wing();
  p.g.globalAlpha = 0.22;
  p.g.drawImage(rs, 0, 0);
  p.g.globalAlpha = 1;
  body();
  for (let k = 0; k < NT; k++) tray(k, b);
  roofTrees(b);
  // lawn trees: slim young row along the base, larger at corners
  for (const q of [
    [3, 8, 2],
    [3, 20, 2],
    [2, 32, 0],
    [4, 42, 0],
    [46, 42, 1],
    [52, 42, 1],
    [64, 42, 0],
    [64, 32, 1],
    [64, 24, 1],
    [64, 14, 0],
    [50, 21, 3],
    [55, 22, 3],
    [40, 32, 3],
    [57, 33, 1],
    [12, 42.5, 3],
    [5, 36, 3],
  ]) {
    const r = P(q[0], q[1], 0);
    if (q[2] === 3) {
      blit(b.TSHS, r[0], r[1]);
      blit(b.TREE_Y, r[0], r[1]);
    } else {
      blit(b.TSH, r[0], r[1]);
      blit(q[2] === 1 ? b.TREE_S : b.TREE_B, r[0], r[1]);
    }
  }
  // forecourt planters + benches
  box(10.5, 35, 0, 4, 2, 2, [K.grass, K.g1, K.g2]);
  box(11, 35.3, 2, 3, 1, 1, [K.cr1, K.cr1, K.cr2]);
  box(38, 35, 0, 3, 2, 2, [K.grass, K.g1, K.g2]);
  box(38.4, 35.3, 2, 2, 1, 1, [K.cr1, K.cr1, K.cr2]);
  box(46, 39, 0, 4, 1, 1, [K.woodT, K.woodL, K.woodR]);
  box(54, 39, 0, 4, 1, 1, [K.woodT, K.woodL, K.woodR]);
  walls();
  return LA;
}

// ---------- timing ----------

function queuePos(t: number, ta: number, td: number, L: number) {
  let tt = t;
  while (tt < td - T) tt += T;
  while (tt >= td) tt -= T;
  if (tt >= ta - T && tt < ta) return trap((tt - (td - T)) / (T - (td - ta))) * L;
  return 0;
}
const VX = 130 / T;
// through traffic
const MAIN = [
  { dir: 1, y: 53.3, te: 0.4, c: 1 },
  { dir: 1, y: 53.3, te: 3.3, c: 3 },
  { dir: -1, y: 56.8, te: 1.1, c: 0 },
  { dir: -1, y: 56.8, te: 4.2, c: 4 },
  { dir: -1, y: 59.8, te: 2.4, c: 2 },
  { dir: -1, y: 59.8, te: 5.4, c: 1 },
];
const mainX = (m: (typeof MAIN)[number], t: number) => {
  const x = m.dir > 0 ? VX * (t - m.te) : 100 - VX * (t - m.te);
  return mod(x + 15, 130) - 15;
};
// drop-off taxi: kerb lane -> lay-by stop at x 18 (t 0.95..2.45) -> away
function taxi(t: number) {
  const s = queuePos(t, 0.95, 2.45, 130),
    x = mod(18 + s + 15, 130) - 15,
    d = Math.abs(x - 18),
    y = d < 8 ? 47.2 : d < 14 ? 47.2 + (49.6 - 47.2) * ioc((d - 8) / 6) : 49.6;
  return { x, y };
}
type Key = readonly (readonly [number, number, number])[];
// keyframed walk over T; also returns the wrapped time (fades read it)
function kf(k: Key, t: number) {
  const t0 = k[0][0],
    t1 = k[k.length - 1][0],
    tt = t < t0 ? t + T : t;
  if (tt > t1) return null;
  for (let i = 0; i < k.length - 1; i++)
    if (tt <= k[i + 1][0]) {
      const u = (tt - k[i][0]) / (k[i + 1][0] - k[i][0]);
      const mv = k[i + 1][1] !== k[i][1] || k[i + 1][2] !== k[i][2];
      return { x: k[i][1] + (k[i + 1][1] - k[i][1]) * u, y: k[i][2] + (k[i + 1][2] - k[i][2]) * u, f: mv ? Math.floor(tt * 6 + 0.5) % 2 : 1, tt };
    }
  return null;
}
const QX = 19;
// queue: front candidate goes in, others step up, the one from the taxi joins at the back
const QUEUE: { k: Key; fade?: readonly [number, number]; fadeIn?: readonly [number, number] }[] = [
  {
    k: [
      [0, QX, 36],
      [2.7, QX, 36],
      [3.25, QX, 34.4],
    ],
    fade: [3.0, 3.25],
  },
  {
    k: [
      [0, QX, 38],
      [3.3, QX, 38],
      [3.75, QX, 36],
      [6, QX, 36],
    ],
  },
  {
    k: [
      [0, QX, 40],
      [3.4, QX, 40],
      [3.85, QX, 38],
      [6, QX, 38],
    ],
  },
  {
    k: [
      [1.6, QX - 0.8, 46.6],
      [1.9, QX, 45.8],
      [4.6, QX, 40],
      [6, QX, 40],
    ],
    fadeIn: [1.6, 1.85],
  },
];
const PEDS: { c: number; k: Key }[] = [
  {
    c: 0,
    k: [
      [0.3, -1, 46.4],
      [5.9, 66, 46.4],
    ],
  },
  {
    c: 2,
    k: [
      [2.1, 100, 47.6],
      [7.6, 64, 47.6],
    ],
  },
  {
    c: 3,
    k: [
      [0, 80, 48.6],
      [2.2, 80, 63],
      [2.6, 86, 64.6],
      [5.5, 100, 64.6],
    ],
  },
  {
    c: 4,
    k: [
      [3.4, 44, 64.4],
      [6.6, 80, 64.6],
      [7.2, 80, 62.8],
      [9.0, 80, 48.6],
    ],
  },
  {
    c: 1,
    k: [
      [0, 92, 47.2],
      [6, 92, 47.2],
    ],
  },
  {
    c: 5,
    k: [
      [0, 93.4, 47.6],
      [6, 93.4, 47.6],
    ],
  },
];
const JOGGER: Key = [
  [0.5, 71.8, -1],
  [4.9, 71.8, 46.5],
];
const VTREES = [
  [44, 67, 0],
  [54, 67, 1],
  [64, 67, 0],
  [86, 67, 1],
  [96, 67, 0],
  [4, 67, 1],
  [14, 67, 0],
  [24, 67, 1],
  [34, 67, 0],
  [96, 40, 0],
  [98.5, 34, 1],
  [82, 44, 1],
];
const LAMPS = [
  [6, 48],
  [42, 48],
  [62, 48],
  [88, 48],
  [98, 48],
  [20, 63.2],
  [50, 63.2],
  [90, 63.2],
];
// resident walks from the void deck down the linkway to the bus stop
const LKW = {
  k: [
    [0.7, 86, 9],
    [4.9, 86, 45.4],
    [5.5, 88.8, 47.3],
  ] as Key,
  fadeIn: [0.7, 0.95],
  fade: [5.25, 5.5],
};

// ---------- moving parts ----------

function swing(t: number, L: Item[], b: Built) {
  const { P, wl, blit, line, box } = p;
  const a = 1.1 * Math.sin((2 * Math.PI * t) / 1.5);
  for (const q of [
    [23, 1],
    [25.4, 0],
  ]) {
    const y = q[0],
      bb = q[1] ? a : 0.25 * a;
    L.push({
      k: SWX + y + 0.6,
      f: () => {
        const s0 = P(SWX + bb, y - 0.4, 2.2),
          s1 = P(SWX + bb, y + 0.4, 2.2);
        wl([SWX, y - 0.4, 8], [SWX + bb, y - 0.4, 2.4], K.g4);
        wl([SWX, y + 0.4, 8], [SWX + bb, y + 0.4, 2.4], K.g4);
        if (q[1]) {
          const r = P(SWX + bb, y, 1.6);
          blit(b.KID, r[0], r[1]);
        }
        line(s0[0], s0[1] - 1, s1[0], s1[1] - 1, K.ink);
      },
    });
  }
  L.push({
    k: 95 + 29.6,
    f: () => {
      const r = P(95, 29.6, 0);
      blit(b.PED[3][1], r[0], r[1]);
    },
  });
  for (const y of LKP) L.push({ k: LKX1 - 0.2 + y + 0.5, f: () => box(LKX1 - 0.7, y, 0, 0.5, 0.5, 9, [K.g2, K.g3, K.g4]) });
}

// stamp offset in screen px from the certificate centre on the desk top (die bottom); pose of the figure
const S_REST = [1, 1],
  S_WIND = [6, -5],
  S_ARC = [1, -3];
function stampAt(t: number) {
  const r: { x: number; y: number; pose: Pose; sq: boolean } = { x: S_REST[0], y: S_REST[1], pose: "stand", sq: false };
  let a: number;
  if (t < 0.35) {
    /* rest */
  } else if (t < 1.05) {
    a = ioc(seg(t, 0.35, 1.05));
    r.x = lerp(S_REST[0], S_WIND[0], a);
    r.y = lerp(S_REST[1], S_WIND[1], a);
  } else if (t < 1.3) {
    r.x = S_WIND[0];
    r.y = S_WIND[1] - ioc(seg(t, 1.05, 1.3));
  } else if (t < 1.42) {
    a = seg(t, 1.3, 1.42);
    a = a * a;
    r.x = lerp(S_WIND[0], 0, a);
    r.y = lerp(S_WIND[1] - 1, 0, a);
    r.pose = a > 0.45 ? "press" : "stand";
  } else if (t < 1.72) {
    r.x = 0;
    r.y = 0;
    r.sq = t < 1.5;
    r.pose = "press";
  } else if (t < 2.05) {
    a = ioc(seg(t, 1.72, 2.05));
    r.x = lerp(0, S_ARC[0], a);
    r.y = lerp(0, S_ARC[1], a);
    r.pose = a < 0.3 ? "press" : "stand";
  } else if (t < 2.35) {
    a = ioc(seg(t, 2.05, 2.35));
    r.x = lerp(S_ARC[0], S_REST[0], a);
    r.y = lerp(S_ARC[1], S_REST[1], a);
  } else if (t >= 3.55 && t < 3.68) r.pose = "blink";
  r.x = Math.round(r.x);
  r.y = Math.round(r.y);
  return r;
}
const BL0 = 1.78,
  BL1 = 2.32,
  NC = 4;
function stackTop(): [number, number] {
  const c = p.P(PED_S[0], PED_S[1], PZ);
  return [Math.round(c[0]), Math.round(c[1]) - 2 * NC - 3];
}
function badgeFlight(t: number) {
  if (t < BL0 || t >= BL1) return null;
  const u = seg(t, BL0, BL1),
    a = p.P(DC[0], DC[1], DZ + 1),
    b = stackTop();
  return { x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u) - 6 * Math.sin(Math.PI * u), f: [0, 1, 2, 1][Math.floor(u * 8) % 4] };
}
function desk() {
  const { box, contact, wl, fl, fr, tp } = p;
  const x0 = DX0,
    x1 = DX1,
    y0 = DY0,
    y1 = DY1;
  box(x0, y0, 0, x1 - x0, y1 - y0, DZ, [K.woodT, K.woodL, K.woodR]);
  contact(x0, y0, x1 - x0, y1 - y0, 0);
  // modesty panel grooves, purple accent band, kick plinth and a crisp lit top edge
  for (let i = x0 + 1.2; i < x1 - 0.4; i += 1.2) wl([i, y1, 1], [i, y1, DZ - 2], "#b39769");
  fl(x0, x1, y1, DZ - 1, DZ, K.pM);
  fr(y0, y1, x1, DZ - 1, DZ, K.pD);
  fl(x0, x1, y1, 0, 0.6, K.pD);
  fr(y0, y1, x1, 0, 0.6, "#2a1149");
  wl([x0, y1, DZ + 1], [x1, y1, DZ + 1], "#f0e2c4");
  wl([x1, y0, DZ + 1], [x1, y1, DZ + 1], "#e4d2b0");
  // blank sheets waiting at the far end, ink pad near the hand
  tp(44.8, 28.9, 45.9, 30, DZ, "#d9d3e4");
  tp(44.8, 28.9, 45.9, 29.8, DZ + 1, "#ffffff");
  box(46.4, 29.5, DZ, 1.1, 0.8, 0.6, [K.aD, "#6b2418", "#55190f"]);
  // certificate: white sheet with a 1 px border and two text rules
  tp(DC[0] - 1.35, DC[1] - 0.95, DC[0] + 1.35, DC[1] + 0.95, DZ, "#9c94ad");
  tp(DC[0] - 1.05, DC[1] - 0.7, DC[0] + 1.05, DC[1] + 0.7, DZ, "#ffffff");
  wl([DC[0] - 0.6, DC[1] - 0.35, DZ], [DC[0] + 0.5, DC[1] - 0.35, DZ], "#cdc6da");
  wl([DC[0] - 0.2, DC[1] + 0.35, DZ], [DC[0] + 0.6, DC[1] + 0.35, DZ], "#cdc6da");
}
function pedestal() {
  const { box, fl, fr, contact, wl } = p;
  const x = PED_S[0],
    y = PED_S[1];
  box(x - 1.5, y - 1.5, 0, 3, 3, PZ, [K.g1, K.g2, K.g3]);
  fl(x - 1.5, x + 1.5, y + 1.5, PZ - 1, PZ, K.pM);
  fr(y - 1.5, y + 1.5, x + 1.5, PZ - 1, PZ, K.pD);
  contact(x - 1.5, y - 1.5, 3, 3, 0);
  wl([x - 1.5, y + 1.5, PZ + 1], [x + 1.5, y + 1.5, PZ + 1], K.w0);
}
function stack(b: Built, n: number, sink: number, squash: boolean) {
  const c = p.P(PED_S[0], PED_S[1], PZ),
    sg = p.g;
  p.on(b.STK);
  const g = p.g;
  g.clearRect(0, 0, 24, 40);
  const bx = 12,
    by = 30;
  for (let i = 0; i < n; i++) {
    const y = by - 2 * i + Math.round(sink) + (i === n - 1 && squash ? 1 : 0);
    const s = i === n - 1 ? b.COINT : b.COIN;
    g.drawImage(s.c, bx - 4, y - 3);
  }
  g.clearRect(0, by, 24, 40 - by);
  p.g = sg;
  p.g.drawImage(b.STK, Math.round(c[0]) - 12, Math.round(c[1]) - 30);
}
// clerk compositing: body (behind the desk) + sleeve, hand and stamp (in front), outlined as one silhouette
const c2d = (c: HTMLCanvasElement) => c.getContext("2d") as CanvasRenderingContext2D;
function clerk(b: Built, pose: Pose, bx: number, by: number, sq: boolean) {
  const g1 = c2d(b.CL1),
    g2 = c2d(b.CL2);
  g1.clearRect(0, 0, CMW, CMH);
  g2.clearRect(0, 0, CMW, CMH);
  const f = b.FS[pose];
  g1.drawImage(f.c, CMX - f.ax, CMY - f.ay);
  const st = sq ? b.STAMPQ : b.STAMP;
  g2.drawImage(st.c, bx - st.ax, by - st.ay);
  // sleeve: 2 px wide from the shoulder to the hand, then a 2x2 hand over the handle
  const sx = CMX + 3,
    sy = CMY - 8,
    hx = bx - 1,
    hy = by - (sq ? 4 : 5),
    dx = hx - sx,
    dy = hy - sy,
    n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  g2.fillStyle = FIGMAP.q;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(sx + (dx * i) / n),
      y = Math.round(sy + (dy * i) / n);
    if (Math.abs(dy) >= Math.abs(dx)) g2.fillRect(x, y, 2, 1);
    else g2.fillRect(x, y, 1, 2);
  }
  g2.fillStyle = FIGMAP.s;
  g2.fillRect(hx, hy, 2, 2);
  const d1 = g1.getImageData(0, 0, CMW, CMH),
    d2 = g2.getImageData(0, 0, CMW, CMH),
    Ad = d1.data,
    Bd = d2.data;
  const a1 = (x: number, y: number) => x >= 0 && y >= 0 && x < CMW && y < CMH && Ad[(y * CMW + x) * 4 + 3] > 0,
    a2 = (x: number, y: number) => x >= 0 && y >= 0 && x < CMW && y < CMH && Bd[(y * CMW + x) * 4 + 3] > 0;
  const r1: number[] = [],
    r2: number[] = [];
  for (let j = 0; j < CMH; j++)
    for (let i = 0; i < CMW; i++) {
      if (a1(i, j) || a2(i, j)) continue;
      const n2 = a2(i - 1, j) || a2(i + 1, j) || a2(i, j - 1) || a2(i, j + 1),
        n1 = a1(i - 1, j) || a1(i + 1, j) || a1(i, j - 1) || a1(i, j + 1);
      if (n2) r2.push(i, j);
      else if (n1) r1.push(i, j);
    }
  const put = (Dd: Uint8ClampedArray, R: number[], c: HTMLCanvasElement, img: ImageData) => {
    for (let k = 0; k < R.length; k += 2) {
      const o = (R[k + 1] * CMW + R[k]) * 4;
      Dd[o] = INK[0];
      Dd[o + 1] = INK[1];
      Dd[o + 2] = INK[2];
      Dd[o + 3] = 255;
    }
    c2d(c).putImageData(img, 0, 0);
  };
  // body pixels hidden under the stamp layer stay on the back canvas; the front canvas draws over them
  put(Ad, r1, b.CBK, d1);
  put(Bd, r2, b.CFR, d2);
}
function hero(t: number, L: Item[], b: Built) {
  const { P, blit, px } = p;
  const s = stampAt(t),
    fp = P(FPOS[0], FPOS[1], 0),
    fx = Math.round(fp[0]),
    fy = Math.round(fp[1]);
  L.push({
    k: DC[0] + DC[1],
    f: () => {
      // clerk first (behind the counter), then counter + mark, then the right arm over the desk, the stamp, and the hand on the handle
      const c = P(DC[0], DC[1], DZ),
        bx = Math.round(c[0]) + s.x,
        by = Math.round(c[1]) + s.y;
      clerk(b, s.pose, bx - fx + CMX, by - fy + CMY, s.sq);
      p.g.drawImage(b.CBK, fx - CMX, fy - CMY);
      desk();
      const sv = t >= 1.42 && t < 5.3 ? 1 : t >= 5.3 && t < 5.9 ? 1 - seg(t, 5.3, 5.9) : 0,
        sp = pickFade(b.SEALF, sv);
      if (sp) blit(sp, c[0], c[1]);
      p.g.drawImage(b.CFR, fx - CMX, fy - CMY);
      if (t >= 1.42 && t < 1.58) {
        const e = P(DC[0], DC[1], DZ + 1),
          r = t < 1.5 ? 7 : 9;
        for (const o of [
          [-r, 0],
          [r, 0],
          [-r + 2, -3],
          [r - 2, -3],
        ]) {
          px(e[0] + o[0], e[1] + o[1], K.glow);
          px(e[0] + o[0], e[1] + o[1] + 1, "#ffd27a");
        }
      }
    },
  });
  L.push({
    k: PED_S[0] + PED_S[1],
    f: () => {
      pedestal();
      const n = t >= BL1 ? NC + 1 : NC,
        sink = t >= 4.9 ? 2 * ioc(seg(t, 4.9, 5.5)) : 0;
      stack(b, n, sink, t >= BL1 && t < BL1 + 0.08);
      const fb = badgeFlight(t);
      if (fb) blit(b.BADGE[fb.f], fb.x, fb.y + 2);
      if (t >= BL1 && t < BL1 + 0.18) {
        const c = stackTop();
        px(c[0] - 7, c[1] + 2, K.glow);
        px(c[0] + 6, c[1] + 2, K.glow);
        px(c[0], c[1] - 4, K.glow);
      }
    },
  });
}

// ---------- the scene ----------

const qualify: SceneModule = {
  logicalW: W,
  logicalH: H,
  period: T,
  finalT: 3.0,
  origin: [OX0, OY0],
  // narrow widths keep the building, the desk and the queue (the prototype's focus 168, 148 and 170 px tall)
  crop: { x: 68, y: 63, w: 200, h: 170 },
  label: msg(
    "Pixel diorama of an exam-board building with white terraced trays on a dark glass tower: at a desk in the forecourt a student raises a big red stamp, presses a certificate and a badge pops onto a stack, while candidates with folders queue at the entrance and a taxi drops one off.",
  ),
  anchors: ANCH,
  pinOffsets: { "1": [14, 13], "2": [-13, -9], "3": [13, -10] },
  // card 2 is narrower so its leader runs flat through empty background to the tray tip
  cards: { "1": { x: 40, y: 236 }, "2": { x: 0, y: 75, w: 160 }, "3": { x: 252, y: 8 } },
  cardWidth: 184,

  init(engine) {
    p = engine.p;
    const sg = p.g,
      sx = p.ox,
      sy = p.oy;
    p.ox = OX0;
    p.oy = OY0;
    try {
      const b = buildSprites(engine);
      S = { ...b, LA: buildLayers(b, engine) };
    } finally {
      p.g = sg;
      p.ox = sx;
      p.oy = sy;
    }
  },

  draw(ctx, t, engine) {
    p = engine.p;
    if (!S) qualify.init?.(engine);
    const b = S;
    if (!b) return;
    const { P, blit } = p;
    p.g = ctx;
    ctx.drawImage(b.LA, 0, 0);
    const tv = mod(t + 0.0123, T),
      L: Item[] = [];
    hero(t, L, b);
    swing(tv, L, b);
    {
      const q = LKW,
        r = kf(q.k, tv);
      if (r) {
        let lv = 1;
        if (r.tt > q.fade[0]) lv = 1 - seg(r.tt, q.fade[0], q.fade[1]);
        if (r.tt < q.fadeIn[1]) lv = seg(r.tt, q.fadeIn[0], q.fadeIn[1]);
        const s = pickFade(b.LKWF[r.f], lv);
        if (s)
          L.push({
            k: r.x + r.y,
            f: () => {
              const a = P(r.x, r.y, 0);
              blit(s, a[0], a[1]);
            },
          });
      }
    }
    for (const q of QUEUE) {
      const r = kf(q.k, tv);
      if (!r) continue;
      let lv = 1;
      if (q.fade && r.tt > q.fade[0]) lv = 1 - seg(r.tt, q.fade[0], q.fade[1]);
      if (q.fadeIn && r.tt < q.fadeIn[1]) lv = seg(r.tt, q.fadeIn[0], q.fadeIn[1]);
      const s = pickFade(b.CANDF[r.f], lv);
      if (!s) continue;
      L.push({
        k: r.x + r.y,
        f: () => {
          const a = P(r.x, r.y, 0);
          blit(s, a[0], a[1]);
        },
      });
    }
    const tx = taxi(tv);
    if (tx.x > -1 && tx.x < 96)
      L.push({
        k: tx.x + 2 + tx.y + 1,
        f: () => {
          const a = P(tx.x, tx.y, 0);
          blit(b.TAXI, a[0], a[1]);
        },
      });
    for (const m of MAIN) {
      const x = mainX(m, tv);
      if (x < 0 || x > 96) continue;
      L.push({
        k: x + 2 + m.y + 1,
        f: () => {
          const a = P(x, m.y, 0);
          blit(b.CX[m.c], a[0], a[1]);
        },
      });
    }
    for (const pd of PEDS) {
      const q = kf(pd.k, tv);
      if (!q || q.x < 0 || q.x > 99) continue;
      L.push({
        k: q.x + q.y,
        f: () => {
          const a = P(q.x, q.y, 0);
          blit(b.PED[pd.c][q.f], a[0], a[1]);
        },
      });
    }
    const j = kf(JOGGER, tv);
    if (j && j.y > 0 && j.y < WY)
      L.push({
        k: j.x + j.y,
        f: () => {
          const a = P(j.x, j.y, 0);
          blit(b.JOG[Math.floor(tv * 9) % 2], a[0], a[1]);
        },
      });
    for (const q of VTREES)
      L.push({
        k: q[0] + q[1],
        f: () => {
          const a = P(q[0], q[1], 0);
          blit(b.TSH, a[0], a[1]);
          blit(q[2] ? b.TREE_S : b.TREE_B, a[0], a[1]);
        },
      });
    for (const q of LAMPS)
      L.push({
        k: q[0] + q[1],
        f: () => {
          const a = P(q[0], q[1], 0);
          blit(b.LAMP, a[0], a[1]);
        },
      });
    L.push({
      k: 84 + 3.5 + 47.4,
      f: () => {
        const a = P(84, 46.4, 0);
        blit(b.SHELTER, a[0], a[1]);
      },
    });
    L.sort((a, c) => a.k - c.k);
    for (const e of L) e.f();
  },
};

export default qualify;
