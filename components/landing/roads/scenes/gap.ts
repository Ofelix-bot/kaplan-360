import { msg } from "@/lib/i18n/translate";
import { hsh, ic3, ioc, keyframes, mk, mod, ocu, seg, SHADOW, type Engine, type Painter, type Point, type Point3, type SceneModule, type Sprite, type Tones } from "../engine";

// Road 4 · Gap: an isometric pixel diorama of an HDB corner, ported from the v2 prototype
// (scratchpad four-roads/_tools/gap-v2/scene.js). Below an L-shaped block with a void deck, a student
// pulls a large hourglass over on its swivel stand; while the sand runs, three crates stack up beside
// it and the weeks on a notice-board calendar are marked off, then the crates go back to the pile. A
// bus pulls in and out, people walk the covered walkway, laundry hangs from the windows. Pins: 1 the
// notice board, 2 the bus shelter, 3 the pass kiosk (the card order in content/roads.en.ts).
// 1 world unit = 2px across / 1px down; z in px. The background is not painted (the stage clears it).

const W = 352,
  H = 280,
  T = 7,
  OX0 = 144,
  OY0 = 96;

const K = {
  slabL: "#d2cdc3",
  slabR: "#b5afa4",
  pave: "#e3dfd7",
  pave2: "#dcd8cf",
  curb: "#f2f0ea",
  road: "#8f8d97",
  mark: "#f4f2ec",
  yel: "#e8c13a",
  grass: "#b4d68b",
  grass2: "#a5cd78",
  grassS: "#86ad5f",
  tL: "#9fd26c",
  tM: "#6aae4b",
  tD: "#44803a",
  tDD: "#356b30",
  trunk: "#7c6a57",
  trunkD: "#5e4f41",
  w0: "#fbfaf7",
  w1: "#efede8",
  g1: "#e2dfd8",
  g2: "#cbc7bf",
  g3: "#aaa5ac",
  g4: "#7b7783",
  g5: "#55515f",
  ink: "#1f1a2b",
  wallL: "#f1efe9",
  wallR: "#cdcac3",
  wallT: "#e4e1da",
  corr: "#7c8590",
  corrDot: "#545c67",
  soff: "#dedbd4",
  sal: "#d9786c",
  salR: "#b8655b",
  spdR: "#2a7a5e",
  winR: "#4a5468",
  fas: "#1c596e",
  fasR: "#164a5c",
  roofT: "#dcdad4",
  roofI: "#cfccc5",
  pilT: "#f3e8d2",
  pilL: "#ead9b8",
  pilR: "#c9b691",
  vdF: "#a3a5a1",
  vdW: "#b4b7b3",
  vdW2: "#9a9d99",
  vdS: "#3f6fa8",
  yelP: "#f1b53a",
  yelPD: "#cf952a",
  dome: "#d9533f",
  domeD: "#b23f2f",
  domeL: "#ee7a63",
  blueP: "#3a63b8",
  grnP: "#3f9a4f",
  grnPD: "#2f7a3c",
  mat: "#b8705e",
  matD: "#a36352",
  inA: "#c9a33f",
  inB: "#7d9a5a",
  cp: "#d6d2c6",
  cpJ: "#b5b0a3",
  stl: "#8e979e",
  stlD: "#6f7a82",
  brk: "#b9735a",
  brkJ: "#a46350",
  gapL: "#ead0a4",
  gapM: "#c69a5c",
  gapD: "#8a6334",
  capT: "#b88a52",
  capL: "#8a6334",
  capR: "#6b4a24",
  sand: "#f4c56e",
  sandD: "#d99a3e",
  glass: "rgba(226,242,250,0.82)",
  glassE: "#7f9cad",
  pL: "#b29ae0",
  pM: "#5f2ea0",
  pD: "#391763",
  litL: "#ffdca2",
  litR: "#f2b06a",
  litM: "#e8995a",
  red: "#d9533f",
  woodT: "#d8bf94",
} as const;
const SHC = SHADOW;

// ---------- painter (the stage's, set in init and every draw) ----------

let p: Painter;
const P = (x: number, y: number, z = 0) => p.P(x, y, z);
const poly = (pts: readonly Point[], c: string) => p.poly(pts, c);
const px = (x: number, y: number, c: string) => p.px(x, y, c);
const line = (x0: number, y0: number, x1: number, y1: number, c: string) => p.line(x0, y0, x1, y1, c);
const wl = (a: Point3, b: Point3, c: string) => p.wl(a, b, c);
const fl = (x0: number, x1: number, y: number, z0: number, z1: number, c: string) => p.fl(x0, x1, y, z0, z1, c);
const fr = (y0: number, y1: number, x: number, z0: number, z1: number, c: string) => p.fr(y0, y1, x, z0, z1, c);
const tp = (x0: number, y0: number, x1: number, y1: number, z: number, c: string) => p.tp(x0, y0, x1, y1, z, c);
const box = (x: number, y: number, z: number, w: number, d: number, h: number, t: readonly string[]) => p.box(x, y, z, w, d, h, [t[0], t[1], t[2]]);
const hull = (pts: readonly Point[]) => p.hull(pts);
const shadow = (x: number, y: number, w: number, d: number, h: number) => p.shadow(x, y, w, d, h);
const sprite = (w: number, h: number, ax: number, ay: number, fn: () => void) => p.sprite(w, h, ax, ay, fn);
const blit = (s: Sprite, x: number, y: number) => p.blit(s, x, y);
const pix = (rows: readonly string[], map: Record<string, string>, outline?: string) => p.pix(rows, map, outline);
/** A full-size layer drawn with the scene's origin. */
const layer = (fn: () => void) => p.withTarget(mk(W, H), OX0, OY0, fn);

const GREY = [K.w1, K.g1, K.g2],
  GREY2 = [K.g1, K.g2, K.g3],
  DARK = [K.g2, K.g3, K.g4],
  STL = [K.g2, K.stl, K.stlD];

/** Fill a world rect (at height z) pixel by pixel; fn(x, y) returns a colour or null. */
function wfill(x0: number, y0: number, x1: number, y1: number, z: number, fn: (x: number, y: number) => string | null) {
  const c = [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];
  let a = 1e9,
    b = -1e9,
    e = 1e9,
    f = -1e9;
  for (let i = 0; i < 4; i++) {
    a = Math.min(a, c[i][0]);
    b = Math.max(b, c[i][0]);
    e = Math.min(e, c[i][1]);
    f = Math.max(f, c[i][1]);
  }
  const g = p.g,
    ox = p.ox,
    oy = p.oy;
  for (let sy = Math.floor(e); sy < Math.ceil(f); sy++)
    for (let sx = Math.floor(a); sx < Math.ceil(b); sx++) {
      const u = (sx + 0.5 - ox) / 2,
        v = sy + 0.5 - oy + z,
        x = (v + u) / 2,
        y = (v - u) / 2;
      if (x < x0 || x >= x1 || y < y0 || y >= y1) continue;
      const col = fn(x, y);
      if (col) {
        g.fillStyle = col;
        g.fillRect(sx, sy, 1, 1);
      }
    }
}
function crazy(x0: number, y0: number, x1: number, y1: number, seed: number) {
  const pts: [number, number][] = [];
  for (let i = x0 - 2; i < x1 + 2; i += 2.3) for (let j = y0 - 2; j < y1 + 2; j += 2.3) pts.push([i + hsh(i + seed, j) * 1.9, j + hsh(j, i + seed) * 1.9]);
  wfill(x0, y0, x1, y1, 0, (x, y) => {
    let d1 = 1e9,
      d2 = 1e9;
    for (let k = 0; k < pts.length; k++) {
      const dx = pts[k][0] - x,
        dy = pts[k][1] - y,
        d = dx * dx + dy * dy;
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) d2 = d;
    }
    return Math.sqrt(d2) - Math.sqrt(d1) < 0.42 ? K.cpJ : K.cp;
  });
}

// ---------- sprites (built in init) ----------

const FIGMAP = { h: "#2b2233", s: "#f1c6a0", p: "#7a4fc4", q: "#5f2ea0", d: "#2f3447", k: "#1f1a2b", w: "#ffffff" };
const HD = ["...hhh...", "..hhhhh..", "..hssss..", "..sksks..", "...sss..."],
  HB = ["...hhh...", "..hhhhh..", "..hhhhh..", "..hhhhh..", "...sss..."];
const TOR = ["..ppppp..", ".qpppppq.", ".qpppppq.", ".qpppppq.", ".s.ppp.s.", "..ddddd.."];
const TORN = ["..ppppp..", "..ppppp..", "..ppppp..", "..ppppp..", "...ppp...", "..ddddd.."];
const LS = ["..dd.dd..", "..dd.dd..", "..kk.kk.."],
  LA_ = [".dd...dd.", ".dd...dd.", ".kk...kk."],
  LB_ = ["...ddd...", "...ddd...", "...kkk..."];
const shiftR = (r: string[]) => r.map((s) => "." + s.slice(0, -1));
const FIG: Record<string, string[]> = {
  stand: HD.concat(TOR, LS),
  walkA: HD.concat(TOR, LA_),
  walkB: HD.concat(TOR, LB_),
  backS: HB.concat(TOR, LS),
  backA: HB.concat(TOR, LA_),
  backB: HB.concat(TOR, LB_),
  backN: HB.concat(TORN, LS),
  leanN: shiftR(HB.concat(TORN.slice(0, 5))).concat(["..ddddd..", "..dd.dd..", ".dd..dd..", ".kk..kk.."]),
  leanK: [".....hhh.", "....hhhhh", "....hhhhh", "....hhhhh", ".....sss.", "....ppppp", "....ppppp", "....ppppp", ".....ppp.", "...ddddd.", "..ddd.dd.", ".dd...dd.", ".kk...kk."],
  pull2: ["......hhh..", ".....hhhhh.", ".....hhhhh.", ".....hhhhh.", "......sss..", ".....ppppp.", "....ppppp..", "....ppppp..", "...ppppp...", "...ddddd...", "..ddd.dd...", ".dd....dd..", ".kk....kk.."],
  crouch: HB.concat(["..ppppp..", ".ppppppp.", "sqpppppqs", "..ddddd..", ".ddd.ddd.", ".dd...dd.", ".kk...kk."]),
  push: ["...hhh....", "..hhhhh...", "..hhhhh...", "..hhhhh...", "...sss....", "..ppppp...", ".pppppqqss", ".qppppp...", ".qppppp...", "..ppp.....", "..ddddd...", "..dd.dd...", "..dd..dd..", "..kk..kk.."],
};
const PED_C = ["#ffffff", "#8d9bb3", "#6a6672", "#b8b2c2", "#9cb38f", "#c4a597", "#e3a3a0"];
const CARC = [
  [K.w0, "#e3e0d9", "#c3beb6"],
  ["#b3bfcf", "#94a2b5", "#76849a"],
  ["#d3c2b6", "#b8a597", "#958375"],
  ["#8f8c96", "#77747f", "#5f5c68"],
  ["#c9ccc4", "#adb1a8", "#8e9289"],
];

type Sprites = {
  TREE_S: Sprite;
  TSH: Sprite;
  RAIN: Sprite;
  PALM: Sprite;
  LAMP: Sprite;
  POLE: Sprite;
  DOME: Sprite;
  BIKE: Sprite;
  FS: Record<string, Sprite>;
  FSH: Sprite;
  CRATE: Sprite;
  PED: Sprite[][];
  SEAT: Sprite[];
  CYC: Sprite[];
  CX: Sprite[];
  BUS: Sprite;
};
let S: Sprites;

function buildSprites(): Sprites {
  const g = () => p.g;
  const TREE_S = pix(["..aa...", ".aaabb.", "aaabbbc", ".abbbcc", "..bcc..", "...t..."], { a: K.tL, b: K.tM, c: K.tD, t: K.trunk });
  const TSH = sprite(12, 4, 2, 1, () => {
    g().fillStyle = SHC;
    g().fillRect(1, 0, 9, 1);
    g().fillRect(0, 1, 10, 1);
    g().fillRect(2, 2, 6, 1);
  });
  const RAIN = pix(
    [
      "...........aaaa..aaa............",
      ".......aaaaaaaaaaaaaaab.........",
      "....aaaaaaaaaaaaaaaaaabbbbb.....",
      "..aaaaaaaabbaaaaaaaabbbbbbbbb...",
      ".aaaaaaabbbbbbaaaabbbbbbbbbbbbc.",
      "aaaabbbbbbbbbbbbbbbbbbbbbbbcccc.",
      ".abbbbbbbbbbbbbbbbbbbbbbcccccccc",
      "..bbbbbbcccbbbbbbbbbcccccccccc..",
      "....cccccccccccccccccccccccccc..",
      ".......cccdd..dcccdddcc..ccc....",
      ".........t.....tt..t............",
      "..........t...tt.tt.............",
      "...........tt.tt.t..............",
      ".............ttt................",
      "..............tt................",
      "..............tu................",
      ".............ttuu...............",
    ],
    { a: K.tL, b: K.tM, c: K.tD, d: K.tDD, t: K.trunk, u: K.trunkD },
  );
  const PALM = pix(
    [".bb.....bb...", "...bb.a.b..bb", "bb..bbaabbb..", "..bbaaaaab...", ".b.aab.aabbb.", "..bb..t..b..b", ".b....t...b..", "......t......", "......t......", ".....t.......", ".....t.......", ".....t.......", ".....t.......", "......t......", "......t......"],
    { a: K.tL, b: K.tM, t: "#9a8466" },
  );
  const LAMP = sprite(6, 14, 2, 12, () => {
    g().fillStyle = K.g4;
    g().fillRect(2, 2, 1, 10);
    g().fillRect(3, 1, 2, 1);
    g().fillStyle = K.w0;
    g().fillRect(4, 2, 1, 1);
  });
  const POLE = sprite(6, 14, 2, 12, () => {
    g().fillStyle = K.g4;
    g().fillRect(2, 3, 1, 9);
    g().fillStyle = K.w0;
    g().fillRect(1, 1, 3, 3);
    g().fillStyle = K.g3;
    g().fillRect(1, 3, 3, 1);
  });
  const DOME = pix(["..rrrrr..", ".rlrrrrr.", "rlrrrrrrd", "rrrrrrrdd", "ddddddddd"], { r: K.dome, l: K.domeL, d: K.domeD });
  const BIKE = pix(["....k.", "kkkkkk", "k.kk.k", ".k..k."], { k: "#3a3644" });
  const FS: Record<string, Sprite> = {};
  Object.keys(FIG).forEach((k) => {
    FS[k] = pix(FIG[k], FIGMAP, K.ink);
    FS[k + "L"] = p.flip(FS[k]);
  });
  const FSH = sprite(14, 5, 7, 2, () => {
    g().fillStyle = SHC;
    g().fillRect(2, 1, 11, 1);
    g().fillRect(1, 2, 11, 1);
    g().fillRect(3, 3, 7, 1);
  });
  const CRATE = p.outl(
    sprite(20, 24, 8, 15, () => {
      box(0, 0, 0, 3, 3, 5, [K.gapL, K.gapM, K.gapD]);
      wl([0, 3, 2.5], [3, 3, 2.5], "#a87d45");
      wl([3, 0, 2.5], [3, 3, 2.5], "#6e4f29");
      wl([0, 1.5, 5], [3, 1.5, 5], "#dcbd88");
      const c = P(1.5, 3, 1.5);
      px(c[0] - 1, c[1] - 2, K.pM);
      px(c[0], c[1] - 2, K.pM);
    }),
    K.ink,
  );
  const PED = PED_C.map((c) => {
    const m = { k: "#2b2233", s: "#f1c6a0", c, d: "#3a3f52" };
    return [pix([".k.", ".s.", "ccc", ".c.", "d.d"], m), pix([".k.", ".s.", "ccc", ".c.", ".d."], m)];
  });
  const SEAT = PED_C.map((c) => pix([".k.", ".s.", "ccc", "dd."], { k: "#2b2233", s: "#f1c6a0", c, d: "#3a3f52" }));
  const cm = { h: "#2b2233", s: "#f1c6a0", c: "#e3803a", k: "#3a3644" };
  const CYC = [pix(["..h...", "..s...", ".cc...", "..cc..", "kk.kk.", "kk.kk."], cm), pix(["..h...", "..s...", ".cc...", ".cc...", "kk.kk.", "kk.kk."], cm)];
  const CX = CARC.map((t) =>
    sprite(16, 12, 5, 5, () => {
      poly([P(0.5, 0.4, 0), P(4.5, 0.4, 0), P(4.5, 2.4, 0), P(0.5, 2.4, 0)], SHC);
      box(0, 0, 0, 4, 2, 2, t);
      box(1, 0, 2, 2, 2, 2, [t[0], "#3b4255", "#2c3242"]);
      tp(1, 0, 3, 2, 4, t[0]);
    }),
  );
  const BUS = sprite(34, 18, 5, 10, () => {
    poly([P(0.5, 0.4, 0), P(10.5, 0.4, 0), P(10.5, 2.9, 0), P(0.5, 2.9, 0)], SHC);
    box(0, 0, 0, 10, 2.5, 7, [K.w0, "#e8e5df", "#c4c0b8"]);
    fl(0.6, 9.4, 2.5, 3, 5.5, "#3b4255");
    fr(0.3, 2.2, 10, 3, 5.5, "#2c3242");
    fl(0, 10, 2.5, 1.5, 2.5, "#6f8fa8");
    fr(0, 2.5, 10, 1.5, 2.5, "#5a7790");
    fl(1.3, 2.3, 2.5, 0, 1, K.ink);
    fl(7.5, 8.5, 2.5, 0, 1, K.ink);
    tp(1, 0.5, 4, 2, 7, K.g1);
  });
  return { TREE_S, TSH, RAIN, PALM, LAMP, POLE, DOME, BIKE, FS, FSH, CRATE, PED, SEAT, CYC, CX, BUS };
}

// ---------- world: ground ----------

const ZV = 8,
  NF = 11,
  ZT = ZV + 5 * NF; // void deck to z8, 11 floors to z63, fascia to 65, parapet to 66
function ground() {
  tp(0, 0, 100, 68, 0, K.pave);
  fl(0, 100, 68, -7, 0, K.slabL);
  fr(0, 68, 100, -7, 0, K.slabR);
  fl(0, 100, 68, -1, 0, K.grassS);
  fr(0, 54, 100, -1, 0, "#6f9450");
  // lawns
  tp(0, 0, 30, 48, 0, K.grass);
  tp(30, 0, 88, 5, 0, K.grass);
  tp(87, 0, 100, 46, 0, K.grass);
  tp(30, 20, 66, 48, 0, K.grass);
  for (let i = 0; i < 100; i += 6) for (let j = 0; j < 48; j += 6) if (hsh(i, j) < 0.35) tp(i, j, i + 3, j + 2, 0, K.grass2);
  tp(30, 17, 76, 20, 0, K.pave2);
  tp(30, 16, 76, 17, 0, K.curb);
  tp(86, 5, 87, 46, 0, K.pave2);
  // jogging track loop + fitness corner
  wfill(1, 1, 29, 26, 0, (x, y) => {
    const dx = Math.max(0, Math.abs(x - 15) - 9),
      dy = Math.max(0, Math.abs(y - 13.5) - 7),
      d = Math.hypot(dx, dy);
    return d > 3.2 && d < 4.4 ? (d < 3.5 || d > 4.1 ? "#7d6f69" : "#8d7d74") : null;
  });
  tp(20, 15, 26, 19, 0, K.cp);
  // playground mat with 2-colour circle inlay
  tp(5, 27, 21, 41, 0, K.matD);
  tp(5.5, 27.5, 20.5, 40.5, 0, K.mat);
  wfill(5, 27, 21, 41, 0, (x, y) => {
    const d = Math.hypot(x - 13, y - 34);
    return d < 2.4 ? K.inA : d < 3.6 ? K.inB : d < 4.2 ? K.inA : null;
  });
  // crazy paving: plaza + paths
  crazy(41, 27, 62, 46, 1);
  crazy(52, 20, 55, 27, 2);
  crazy(21, 37.5, 41, 40.5, 3);
  crazy(23.5, 40.5, 26.5, 48, 4);
  crazy(62, 35.5, 66, 38.5, 5);
  // hedge gap path to pavement; walkway floor
  tp(66, 17, 69, 49, 0, K.pave2);
  tp(66, 46, 80, 49, 0, K.pave2);
  // pavement + bus-stop brick pavers
  tp(0, 48, 100, 54, 0, K.pave);
  for (let i = 0; i < 100; i += 4) for (let j = 49; j < 54; j += 2.5) if ((i / 4 + (j > 51 ? 1 : 0)) % 2) tp(i, j, i + 4, j + 2.5, 0, K.pave2);
  tp(76, 46, 96, 54, 0, K.brk);
  for (let i = 76; i < 96; i += 1.5) wl([i, 46, 0], [i, 54, 0], K.brkJ);
  for (let j = 47; j < 54; j += 1.5) wl([76, j, 0], [96, j, 0], K.brkJ);
  // road
  tp(0, 53.5, 100, 54, 0, K.curb);
  tp(0, 54, 100, 64, 0, K.road);
  tp(0, 64, 100, 64.5, 0, K.curb);
  for (let i = 1; i < 100; i += 6) tp(i, 58.8, i + 3, 59.3, 0, K.mark);
  tp(74, 54, 96, 54.5, 0, K.yel);
  tp(0, 54.4, 74, 54.8, 0, K.mark);
  tp(96, 54.4, 100, 54.8, 0, K.mark);
  tp(0, 63.2, 100, 63.6, 0, K.mark);
  // front verge
  tp(0, 64.5, 100, 68, 0, K.grass);
  for (let i = 2; i < 100; i += 8) tp(i, 65, i + 4, 67.5, 0, K.grass2);
}

// ---------- the HDB block ----------
// Painter's order: back = void deck + main wing + its corridor face and roof; then the cores and planters;
// front = the short wing (gable, window face, its roof), which sits nearer the viewer than all of those.
const CORES = [38, 58];
function blockBack() {
  // void deck interior: floor, inner walls (blue stripe), furniture
  tp(30, 11, 81, 16, 0, K.vdF);
  tp(81, 6, 86, 40, 0, K.vdF);
  fr(6, 40, 81, 0, 8, K.vdW2);
  fr(6, 40, 81, 2, 3, "#36609a");
  fl(30, 81, 11, 0, 8, K.vdW);
  fl(30, 81, 11, 2, 3, K.vdS);
  for (let i = 33; i < 80; i += 6) fl(i, i + 0.5, 11, 0, 8, K.g3); // downpipes
  const stool = ["#d8d3c8", "#bdb7aa", "#a49e92"];
  [
    [49.4, 12.8],
    [34.4, 12.8],
  ].forEach((q) => {
    box(q[0] - 0.9, q[1] + 0.2, 0, 0.6, 0.6, 2, stool);
    box(q[0] + 1.5, q[1] + 0.2, 0, 0.6, 0.6, 2, stool);
    box(q[0], q[1], 0, 1.2, 1.2, 3, ["#e2ddd2", "#c4beb2", "#a49e92"]);
    box(q[0] + 0.3, q[1] + 1.8, 0, 0.6, 0.6, 2, stool);
  });
  let q = P(48.8, 13.4, 0);
  blit(S.SEAT[1], q[0], q[1]);
  q = P(51.2, 13.4, 0);
  blit(S.SEAT[5], q[0], q[1]);
  q = P(35.8, 14.4, 0);
  blit(S.SEAT[3], q[0], q[1]);
  [
    [71, 12.6],
    [73, 12.6],
    [83.5, 30],
  ].forEach((r) => {
    const b = P(r[0], r[1], 0);
    blit(S.BIKE, b[0], b[1]);
  });
  for (let i = 72; i < 76; i += 1) wl([i, 12, 0], [i, 12, 2], K.g4);
  // pillars on the open faces
  const pil = [K.pilT, K.pilL, K.pilR];
  [30, 35, 45, 50, 55, 65, 70, 75].forEach((x) => box(x, 15, 0, 1, 1, ZV, pil));
  [6, 11, 16, 21, 26, 31, 35.5].forEach((y) => box(85, y, 0, 1, 1, ZV, pil));
  box(85, 39, 0, 1, 1, ZV, pil);
  // closed lobby at the gable with letterbox grid
  fl(76, 81, 40, 0, ZV, K.wallL);
  fl(76, 81, 40, 0, 1, K.g2);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) fl(77 + i * 0.5, 77.5 + i * 0.5, 40, 2 + j, 3 + j, (i + j) % 2 ? "#8a96a3" : "#a9b4bf");
  fl(78.8, 80.6, 40, 0, 5.5, "#5a6878");
  fl(78.8, 80.6, 40, 5, 5.5, K.g3);
  // main wing
  box(30, 6, ZV, 56, 10, ZT + 3 - ZV, [K.wallT, K.wallL, K.wallR]);
  // corridor face: parapet, salmon stripe, dark corridor with doors, soffit (the short wing is drawn later and covers it)
  for (let k = 0; k < NF; k++) {
    const b = ZV + 5 * k;
    fl(30, 76, 16, b + 1, b + 2, K.sal);
    fl(30, 76, 16, b + 2, b + 4, K.corr);
    fl(30, 76, 16, b + 4, b + 5, K.soff);
    for (let i = 31; i < 76; i += 3) fl(i, i + 0.5, 16, b + 2, b + 4, K.corrDot);
    for (let i = 32; i < 76; i += 3) if (hsh(i, k) < 0.18) fl(i, i + 0.5, 16, b + 2, b + 3, K.tM);
  }
  // main roof: teal fascia, parapet, flat top, tank room
  fl(30, 76, 16, ZT, ZT + 2, K.fas);
  fl(30, 76, 16, ZT + 2, ZT + 3, K.w0);
  tp(30, 6, 86, 16, ZT + 3, K.roofT);
  tp(30.6, 6.6, 85.4, 15.4, ZT + 3, K.roofI);
  box(68, 8, ZT + 3, 6, 4, 5, GREY);
  fl(68, 74, 12, ZT + 4, ZT + 5, K.g2);
  for (let i = 32; i < 84; i += 6) box(i, 7, ZT + 3, 1, 1, 1.5, GREY2);
}
function blockFront() {
  box(76, 16, ZV, 10, 24, ZT + 3 - ZV, [K.wallT, K.wallL, K.wallR]);
  // window face (x=86): 2x2 windows over teal-green spandrels, pilasters
  for (let k = 0; k < NF; k++) {
    const b = ZV + 5 * k;
    fr(6, 40, 86, b, b + 1, "#c2bfb8");
    for (let j = 7; j + 1 <= 39.4; j += 2) {
      if (j > 21 && j < 24.5) continue;
      fr(j, j + 1, 86, b + 2, b + 4, K.winR);
      fr(j, j + 1, 86, b + 1, b + 2, K.spdR);
      fr(j, j + 0.5, 86, b + 3, b + 4, "#6b7891");
    }
  }
  [
    [22.2, 1.2],
    [6, 0.7],
    [39.3, 0.7],
  ].forEach((q) => box(86, q[0], ZV, 0.6, q[1], ZT - ZV, ["#e9e6df", "#e9e6df", "#bfbbb3"]));
  // gable: plain, column of slits
  for (let k = 0; k < NF; k++) {
    const b = ZV + 5 * k;
    fl(80.75, 81.25, 40, b + 2, b + 4, K.corrDot);
  }
  // short-wing roof: teal fascia, parapet, flat top
  fl(76, 86, 40, ZT, ZT + 2, K.fas);
  fr(6, 40, 86, ZT, ZT + 2, K.fasR);
  fl(76, 86, 40, ZT + 2, ZT + 3, K.w0);
  fr(6, 40, 86, ZT + 2, ZT + 3, K.g1);
  tp(76, 16, 86, 40, ZT + 3, K.roofT);
  tp(76.6, 15.4, 85.4, 39.4, ZT + 3, K.roofI);
  box(80, 26, ZT + 3, 4, 6, 4, GREY2);
  // laundry poles (static); clothes drawn per frame
  LAUN.forEach((L) => L.poles.forEach((q) => wl([86, q, L.z], [88.6, q, L.z], "#bdbab4")));
}
type Cloth = { y: number; x: number; z: number; c: string; h: number; ph: number };
const LAUN: { z: number; poles: number[]; cl: Cloth[] }[] = [];
[
  [2, 29],
  [3, 13],
  [5, 33],
  [6, 19],
  [8, 27],
  [9, 11],
].forEach((q, n) => {
  const b = ZV + 5 * q[0],
    z = b + 1.5,
    poles = [q[1] - 0.6, q[1] + 0.4, q[1] + 1.4],
    cl: Cloth[] = [];
  const cols = ["#e3803a", "#8d6cc4", "#d9533f", "#7fb8e0", "#ffffff", "#f1b53a", "#ffffff"];
  poles.forEach((pp, m) => {
    if (m !== 1)
      for (let s = 0.7; s < 2.5; s += 0.8)
        if (hsh(n * 7 + m, s * 10) < 0.75) cl.push({ y: pp, x: 86 + s, z, c: cols[Math.floor(hsh(m + n, s) * 7)], h: hsh(s, n + m) < 0.5 ? 2 : 1, ph: hsh(n, m + s) * 6.28 });
  });
  LAUN.push({ z, poles, cl });
});
function clothes(tv: number) {
  LAUN.forEach((L) =>
    L.cl.forEach((c) => {
      const q = P(c.x, c.y, c.z),
        d = Math.sin((tv / T) * 2 * Math.PI * 2 + c.ph) > 0.55 ? 1 : 0;
      p.g.fillStyle = c.c;
      p.g.fillRect(Math.round(q[0]) + d, Math.round(q[1]), 1, c.h);
    }),
  );
}
function cores() {
  CORES.forEach((x) => {
    box(x, 16, 0, 4, 2, ZT + 6, [K.wallT, K.w1, K.wallR]);
    box(x, 13, ZT + 3, 4, 3, 3, [K.wallT, K.w1, K.wallR]);
    tp(x, 13, x + 4, 18, ZT + 6, K.g1);
    fl(x, x + 4, 18, ZT + 5, ZT + 6, K.fas);
    fr(13, 18, x + 4, ZT + 5, ZT + 6, K.fasR);
    for (let z = 3; z < ZT; z += 2) fl(x + 1.75, x + 2.25, 18, z, z + 1, "#8b929b");
    fl(x + 0.6, x + 3.4, 18, 0, 5, "#6c7684");
    fl(x + 1.9, x + 2.1, 18, 0, 5, K.g3); // lift doors
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) fr(16.1 + i * 0.45, 16.55 + i * 0.45, x + 4, 1.5 + j, 2.5 + j, (i + j) % 2 ? "#8a96a3" : "#a9b4bf");
  });
}
function litCorr(n: number) {
  for (let k = 0; k < n; k++) {
    const b = ZV + 5 * k;
    fl(30, 76, 16, b + 2, b + 4, K.litL);
    for (let i = 31; i < 76; i += 3) fl(i, i + 0.5, 16, b + 2, b + 4, K.litM);
  }
}
function litWin(n: number) {
  for (let k = 0; k < n; k++) {
    const b = ZV + 5 * k;
    for (let j = 7; j + 1 <= 39.4; j += 2) {
      if (j > 21 && j < 24.5) continue;
      if (hsh(j, k) < 0.66) fr(j, j + 1, 86, b + 2, b + 4, K.litR);
    }
  }
}
function litCores(n: number) {
  const top = ZV + 5 * n;
  CORES.forEach((x) => {
    for (let z = 3; z < Math.min(top, ZT); z += 2) fl(x + 1.75, x + 2.25, 18, z, z + 1, K.litR);
  });
}

// ---------- playground, park, walkway, shelter, board ----------

function playground() {
  const BL = [K.blueP, K.blueP, "#2b4c94"];
  box(9.5, 31, 0, 7, 4, 0.5, [K.matD, K.matD, K.matD]);
  [
    [10, 31.2],
    [13, 31.2],
    [16, 31.2],
  ].forEach((q) => box(q[0], q[1], 0, 0.4, 0.4, 10, BL));
  box(10, 31.2, 5, 6, 3.6, 0.8, [K.yelP, K.yelPD, "#a9771f"]);
  fl(10.2, 12.8, 34.8, 5.8, 9, K.yelP);
  fl(13.2, 15.8, 34.8, 5.8, 9, K.grnP);
  fl(13.2, 15.8, 34.8, 8.4, 9, K.grnPD);
  fl(10.2, 12.8, 34.8, 8.4, 9, K.yelPD);
  [
    [10, 34.4],
    [13, 34.4],
    [16, 34.4],
  ].forEach((q) => box(q[0], q[1], 0, 0.4, 0.4, 10, BL));
  let q = P(11.5, 32.8, 10);
  blit(S.DOME, q[0], q[1] + 1);
  q = P(14.6, 32.8, 10);
  blit(S.DOME, q[0], q[1] + 1);
  // slide curving out in +x
  for (let s = 0; s < 1; s += 0.05) {
    const x = 16.4 + 5 * s,
      z = 5.6 * Math.pow(1 - s, 1.4) + 0.6;
    tp(x, 32, x + 0.3, 33.6, z, K.grnP);
    fl(x, x + 0.3, 33.6, z - 0.8, z, K.grnPD);
  }
  // ladder (red/green rungs) on the left
  wl([9.2, 33.2, 0], [10, 33.2, 5], K.dome);
  wl([9.2, 34.2, 0], [10, 34.2, 5], K.dome);
  for (let r = 0; r < 4; r++) {
    const u = r / 4 + 0.15;
    wl([9.2 + 0.8 * u, 33.2, 5 * u], [9.2 + 0.8 * u, 34.2, 5 * u], r % 2 ? K.grnP : K.dome);
  }
}
function fitness() {
  const c = [K.yelP, K.yelPD, "#a9771f"];
  box(21, 15.6, 0, 0.4, 0.4, 6, DARK);
  box(24.6, 15.6, 0, 0.4, 0.4, 6, DARK);
  box(21, 15.6, 6, 4, 0.4, 0.4, c);
  box(21, 17.6, 0, 0.4, 0.4, 4, DARK);
  box(24.6, 17.6, 0, 0.4, 0.4, 4, DARK);
  box(21, 17.6, 4, 4, 0.4, 0.4, c);
  box(22.4, 18.4, 0, 1.4, 0.6, 1.5, [K.grnP, K.grnPD, "#245e2e"]);
}
function hedge(x0: number, x1: number) {
  box(x0, 47.6, 0, x1 - x0, 1.2, 3, [K.tM, K.tD, K.tDD]);
  for (let i = x0 + 0.5; i < x1; i += 1.3) if (hsh(i, 3) < 0.5) tp(i, 47.8, i + 0.5, 48.3, 3, K.tL);
}
function bench(x: number, y: number) {
  box(x, y, 0, 0.4, 1, 1.5, DARK);
  box(x + 2.6, y, 0, 0.4, 1, 1.5, DARK);
  box(x - 0.2, y, 1.5, 3.4, 1.1, 0.6, [K.grnP, K.grnPD, "#245e2e"]);
  fl(x - 0.2, x + 3.2, y, 2, 3.5, K.grnPD);
}
function walkway() {
  for (let i = 18; i < 46; i += 4) {
    box(66.3, i, 0, 0.4, 0.4, 9, STL);
    box(68.3, i, 0, 0.4, 0.4, 9, STL);
  }
  for (let i = 70; i < 80; i += 4) {
    box(i, 46.3, 0, 0.4, 0.4, 9, STL);
    box(i, 48.3, 0, 0.4, 0.4, 9, STL);
  }
  box(65.6, 16, 9, 4, 31, 1.5, ["#a0a8ad", "#5c6f77", "#4a5b62"]);
  box(65.6, 45.6, 9, 14, 4, 1.5, ["#a0a8ad", "#5c6f77", "#4a5b62"]);
  for (let i = 18; i < 46; i += 2) wl([65.8, i, 10.5], [69.4, i, 10.5], "#949ca1");
}
function shelter() {
  box(80.4, 48.2, 0, 0.5, 0.5, 8, STL);
  box(86, 48.2, 0, 0.5, 0.5, 8, STL);
  box(91.4, 48.2, 0, 0.5, 0.5, 8, STL);
  box(91.2, 48.7, 1, 0.6, 2.4, 6, [K.w0, "#edf0f2", "#d5dbe0"]);
  fr(48.9, 50.9, 91.8, 1.6, 6.4, "#f7f8f9");
  box(79.6, 47.6, 8, 13, 4, 2, ["#b3babf", K.stlD, "#5d676e"]);
  tp(80, 48, 92.2, 51.2, 10, "#c0c6ca");
}
function shelterBack() {
  box(80.6, 48.2, 0, 10.8, 0.4, 6, [K.g2, "#c9d4dc", "#b0bcc5"]);
  box(82.5, 48.8, 0, 6.5, 1.1, 2, [K.g2, K.stl, K.stlD]);
  const q = P(84, 49.6, 0);
  blit(S.SEAT[2], q[0], q[1]);
}
const MARKZ = [11, 9, 7, 5],
  BX = 4,
  BY = 22; // notice board: frame x BX..BX+4.4, face at y=BY (park lawn, inside the jogging loop)
function board() {
  box(BX + 0.6, BY - 0.4, 0, 0.4, 0.4, 5, DARK);
  box(BX + 3.4, BY - 0.4, 0, 0.4, 0.4, 5, DARK);
  box(BX, BY - 0.6, 4.5, 4.4, 0.6, 10, ["#8b7563", "#6b5a4c", "#54463b"]);
  fl(BX + 0.4, BX + 4, BY, 5, 14, K.w0);
  fl(BX + 0.4, BX + 4, BY, 13, 14, K.pM);
  MARKZ.forEach((z) => {
    for (let c = 0; c < 7; c++) fl(BX + 0.5 + 0.5 * c, BX + 1 + 0.5 * c, BY, z, z + 1, c % 2 ? "#d6d1c7" : "#e8e4dc");
  });
}
// reset: the stack is carried back to the supply pile one crate at a time (top first), the flag drops,
// and the board's week marks come off last-first; no dissolves
const PILE = [57.5, 38.5, 1],
  UNSTACK = [
    [6.62, 6.9],
    [6.44, 6.72],
    [6.26, 6.54],
  ],
  UNMARK = [6.62, 6.5, 6.38, 6.26];
// sign-free pass kiosk on the lawn (pin 3): walls, service window with counter, flat roof with a deep fascia
const KX = 0.6,
  KY = 41.5; // on the lawn at the park's left edge, so its leader runs over open background
function kiosk() {
  const w = 5,
    d = 3.5,
    h = 11;
  box(KX, KY, 0, w, d, h, [K.wallT, K.wallL, K.wallR]);
  fl(KX, KX + w, KY + d, 0, 1.2, K.g2);
  fr(KY, KY + d, KX + w, 0, 1.2, K.g3);
  fl(KX + 0.7, KX + w - 0.7, KY + d, 4, 8.5, "#3f4a5e");
  fl(KX + 0.7, KX + w - 0.7, KY + d, 7.6, 8.4, "#6b7891");
  fl(KX + 2.4, KX + 2.6, KY + d, 4, 8.5, K.g3);
  box(KX + 0.4, KY + d, 3.3, w - 0.8, 0.8, 0.7, [K.w0, K.g1, K.g2]);
  fr(KY + 0.7, KY + d - 0.7, KX + w, 5, 8.5, "#4a5468");
  fr(KY + 0.7, KY + d - 0.7, KX + w, 7.6, 8.5, "#6b7891");
  fl(KX, KX + w, KY + d, 9, 10, K.sal);
  fr(KY, KY + d, KX + w, 9, 10, K.salR);
  box(KX - 0.5, KY - 0.5, h, w + 1, d + 1, 1.6, [K.roofT, K.fas, K.fasR]);
  const q = P(KX + 3, KY + d + 1.3, 0);
  blit(pix([".k.", ".k.", "ccc", ".c.", "d.d"], { k: "#2b2233", c: "#5f6f8f", d: "#3a3f52" }), q[0], q[1]);
}

// ---------- hourglass (3D, rotates about the world y axis) ----------

type V3 = [number, number, number];
const HX = 50,
  HY = 33,
  HCZ = 4.5,
  HA = 4.1,
  HC = 3.6,
  HP = 1.6,
  HPO = 1.35,
  ZS = 2.4,
  BL = 3.4;
function W3(c: V3, th: number, a: number, pp: number, q: number): V3 {
  const s = Math.sin(th),
    co = Math.cos(th);
  return [c[0] + a * s + pp * co, c[1] + q, c[2] + a * co - pp * s];
}
const PP = (v: V3) => P(v[0], v[1], ZS * v[2]);
function shadeN(n: readonly number[], t: Tones) {
  const b = 0.75 * n[2] + 0.45 * n[1] - 0.1 * n[0];
  return b > 0.6 ? t[0] : b > 0.2 ? t[1] : t[2];
}
function hgBox(c: V3, th: number, a0: number, a1: number, p0: number, p1: number, q0: number, q1: number, t: Tones) {
  const s = Math.sin(th),
    co = Math.cos(th),
    d = [s, 0, co],
    e = [co, 0, -s],
    f = [0, 1, 0];
  const V = (a: number, pp: number, q: number) => PP(W3(c, th, a, pp, q));
  const F: [number[], V3[]][] = [
    [
      d,
      [
        [a1, p0, q0],
        [a1, p1, q0],
        [a1, p1, q1],
        [a1, p0, q1],
      ],
    ],
    [
      [-d[0], 0, -d[2]],
      [
        [a0, p0, q0],
        [a0, p1, q0],
        [a0, p1, q1],
        [a0, p0, q1],
      ],
    ],
    [
      e,
      [
        [a0, p1, q0],
        [a1, p1, q0],
        [a1, p1, q1],
        [a0, p1, q1],
      ],
    ],
    [
      [-e[0], 0, -e[2]],
      [
        [a0, p0, q0],
        [a1, p0, q0],
        [a1, p0, q1],
        [a0, p0, q1],
      ],
    ],
    [
      f,
      [
        [a0, p0, q1],
        [a1, p0, q1],
        [a1, p1, q1],
        [a0, p1, q1],
      ],
    ],
    [
      [0, -1, 0],
      [
        [a0, p0, q0],
        [a1, p0, q0],
        [a1, p1, q0],
        [a0, p1, q0],
      ],
    ],
  ];
  F.forEach((fc) => {
    const n = fc[0];
    if (n[0] + n[1] + n[2] <= 1e-6) return;
    poly(
      fc[1].map((v) => V(v[0], v[1], v[2])),
      shadeN(n, t),
    );
  });
}
const rr = (u: number) => 0.22 + 1.05 * Math.pow(Math.sin((u * Math.PI) / 2), 0.55) * (1 - 0.1 * u * u);
function ring(c: V3, th: number, s: number, u0: number, u1: number, lit?: boolean) {
  const o: [number, number][] = [];
  for (let i = 0; i <= 5; i++) {
    const u = u0 + ((u1 - u0) * i) / 5,
      a = s * (0.2 + BL * u),
      r = rr(u);
    for (let j = 0; j < 12; j++) {
      const an = (j * Math.PI) / 6,
        pp = r * Math.cos(an);
      if (lit && pp > 0.25 * r) continue;
      o.push(PP(W3(c, th, a, pp, r * Math.sin(an))));
    }
  }
  return o;
}
function hgDraw(th: number, fa: number, fb: number, run: number, tv: number) {
  const c: V3 = [HX, HY, HCZ],
    L: { k: number; f: () => void }[] = [];
  [1, -1].forEach((s) => {
    const a0 = s > 0 ? HC : -HA,
      a1 = s > 0 ? HA : -HC,
      m = W3(c, th, (a0 + a1) / 2, 0, 0);
    L.push({
      k: m[0] + m[1] + m[2],
      f: () => {
        hgBox(c, th, a0, a1, -HP, HP, -HP, HP, [K.capT, K.capL, K.capR]);
        const b0 = s > 0 ? a0 : a1 - 0.2,
          b1 = b0 + 0.2;
        hgBox(c, th, b0, b1, -HP - 0.01, HP + 0.01, -HP - 0.01, HP + 0.01, ["#d1a46a", "#a57a45", "#83592c"]);
      },
    });
  });
  [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].forEach((o) => {
    const pp = o[0] * HPO,
      q = o[1] * HPO,
      m = W3(c, th, 0, pp, q),
      dk = m[0] + m[1] + m[2] - c[0] - c[1] - c[2];
    L.push({
      k: m[0] + m[1] + m[2],
      f: () => {
        const A = PP(W3(c, th, -HC, pp, q)),
          B = PP(W3(c, th, HC, pp, q)),
          col = dk > 0 ? "#a57a45" : K.capR;
        line(A[0], A[1] - 1, B[0], B[1] - 1, col);
        const M0 = PP(W3(c, th, 0, -HPO, q)),
          M1 = PP(W3(c, th, 0, HPO, q));
        if (o[0] > 0) line(M0[0], M0[1] - 1, M1[0], M1[1] - 1, col);
      },
    });
  });
  [1, -1].forEach((s) => {
    const m = W3(c, th, s * 1.8, 0, 0),
      fill = s > 0 ? fa : fb;
    L.push({
      k: m[0] + m[1] + m[2] - 0.3,
      f: () => {
        const Hh = hull(ring(c, th, s, 0, 1));
        poly(Hh, K.glass);
        if (fill > 0.001) {
          let u0, u1;
          if (s > 0) {
            u0 = 0;
            u1 = Math.pow(fill, 0.6);
          } else {
            u1 = 1;
            u0 = 1 - Math.pow(fill, 0.85);
          }
          poly(hull(ring(c, th, s, u0, u1)), K.sandD);
          poly(hull(ring(c, th, s, u0, u1, true)), K.sand);
        }
        for (let i = 0; i < Hh.length; i++) {
          const a = Hh[i],
            b = Hh[(i + 1) % Hh.length];
          line(a[0], a[1] - 0.5, b[0], b[1] - 0.5, K.glassE);
        }
        const h0 = PP(W3(c, th, s * 1.0, -0.7, 0.4)),
          h1 = PP(W3(c, th, s * 2.9, -0.85, 0.4));
        line(h0[0], h0[1] - 1, h1[0], h1[1] - 1, "#ffffff");
      },
    });
  });
  if (run > 0 && run < 1) {
    L.push({
      k: c[0] + c[1] + c[2] + 0.5,
      f: () => {
        const a = PP(W3(c, th, 0, 0, 0)),
          b = PP(W3(c, th, -(0.2 + BL * (1 - Math.pow(run, 0.85))), 0, 0));
        for (let y = Math.round(a[1]); y < Math.round(b[1]); y++) if ((y + Math.floor(tv * 14)) % 3) px(a[0], y, K.sandD);
        px(a[0], a[1] - 1, K.sandD);
      },
    });
  }
  L.sort((a, b) => a.k - b.k);
  L.forEach((e) => e.f());
}
const HGO = [HX * 2 - HY * 2 + OX0 - 26, Math.round(HX + HY + OY0 - HCZ * ZS) - 30];
let HGC: HTMLCanvasElement;
function hourglass(th: number, fa: number, fb: number, run: number, tv: number) {
  p.withTarget(HGC, OX0 - HGO[0], OY0 - HGO[1], () => {
    p.g.clearRect(0, 0, 52, 60);
    hgDraw(th, fa, fb, run, tv);
  });
  p.outl({ c: HGC }, K.ink);
  box(HX - 0.3, HY - 2.4, 0, 0.6, 0.6, HCZ * ZS + 1, ["#8b7563", "#6b5a4c", "#54463b"]);
  box(HX - 1.4, HY - 2.6, 0, 2.8, 1, 0.8, ["#8b7563", "#6b5a4c", "#54463b"]);
  p.g.drawImage(HGC, HGO[0], HGO[1]);
  box(HX - 0.3, HY + 1.8, 0, 0.6, 0.6, HCZ * ZS + 1, ["#a08a77", "#7d6a5a", "#5e4f43"]);
  box(HX - 1.4, HY + 1.6, 0, 2.8, 1, 0.8, ["#a08a77", "#7d6a5a", "#5e4f43"]);
  const a = P(HX, HY + 1.8, HCZ * ZS),
    b = P(HX, HY + HPO, HCZ * ZS);
  line(a[0], a[1] - 1, b[0], b[1] - 1, K.ink);
}

// ---------- layers (built in init) ----------

let LA: HTMLCanvasElement, LB: HTMLCanvasElement, LW: HTMLCanvasElement, LC: HTMLCanvasElement, LD: HTMLCanvasElement;
let VMASK: HTMLCanvasElement, TMP: HTMLCanvasElement, KIOSK: Sprite, MARKS: Sprite[];
function buildLayers() {
  const mask = layer(() => tp(0, 0, 100, 68, 0, "#000"));
  const sh = layer(() => {
    shadow(30, 6, 56, 10, ZT + 3);
    shadow(76, 16, 10, 24, ZT + 3);
    shadow(66, 16, 3.6, 31, 10);
    shadow(66, 46, 14, 3.6, 10);
    shadow(80, 48, 12, 3, 10);
    shadow(BX, BY - 0.6, 4.4, 0.6, 14);
    shadow(KX - 0.5, KY - 0.5, 6, 4.5, 12);
    shadow(HX - 1.4, HY - 3, 2.8, 6, 15);
    shadow(9.5, 31, 7, 4, 10);
    const g = p.g;
    [
      [12, 13],
      [95, 28],
      [20, 6],
    ].forEach((q) => {
      const c = P(q[0] + 3.5, q[1] + 1, 0);
      g.fillStyle = "#000";
      for (let dy = -4; dy <= 4; dy++) {
        const hw = Math.round(16 * Math.sqrt(1 - (dy * dy) / 25));
        g.fillRect(Math.round(c[0]) - hw, Math.round(c[1]) + dy, 2 * hw, 1);
      }
    });
    [
      [36, 24],
      [33, 35],
      [42, 46.5],
      [62, 44],
      [17, 44.5],
    ].forEach((q) => shadow(q[0] - 1, q[1] - 1, 2, 2, 9));
    g.globalCompositeOperation = "destination-in";
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = "source-over";
  });
  LA = layer(() => {
    ground();
    p.g.globalAlpha = 0.21;
    p.g.drawImage(sh, 0, 0);
    p.g.globalAlpha = 1;
    hedge(0, 23.5);
    hedge(26.5, 66);
    shelterBack();
    [
      [34, 2.5],
      [44, 2.5],
      [54, 2.5],
      [64, 2.5],
      [74, 2.5],
      [84, 2.5],
    ].forEach((q) => {
      const c = P(q[0], q[1], 0);
      blit(S.TSH, c[0], c[1]);
      blit(S.TREE_S, c[0], c[1]);
    });
    blockBack();
  });
  // cores and planters sit in front of the corridor face but behind the short wing
  LC = layer(() => {
    cores();
    [
      [31, 18.2, 7],
      [44, 18.2, 6],
      [56, 18.2, 8],
      [70, 18.2, 5.5],
    ].forEach((q) => {
      box(q[0], q[1], 0, q[2], 1.4, 1, [K.g1, K.g2, K.g3]);
      for (let i = q[0] + 0.3; i < q[0] + q[2] - 0.3; i += 0.55) {
        const c = P(i, q[1] + 0.7, 1);
        px(c[0], c[1] - 1, hsh(i, 1) < 0.3 ? "#e0679a" : hsh(i, 2) < 0.5 ? K.tM : K.tD);
        px(c[0], c[1] - 2, hsh(i, 3) < 0.35 ? "#f08cb6" : K.tL);
      }
    });
  });
  LD = layer(blockFront);
  LB = layer(() => {
    fitness();
    playground();
    bench(24, 43.5);
    bench(36, 43.5);
    [
      [3, 26],
      [28, 25],
      [27, 31],
    ].forEach((q, i) => {
      if (i === 2) return;
      const c = P(q[0], q[1], 0);
      blit(S.TSH, c[0], c[1]);
      blit(S.PALM, c[0], c[1]);
    });
    let c = P(12, 13, 0);
    blit(S.RAIN, c[0], c[1]);
    c = P(20, 6, 0);
    blit(S.RAIN, c[0], c[1]);
    [
      [31, 30],
      [44, 24],
      [17, 44.5],
    ].forEach((q) => {
      const l = P(q[0], q[1], 0);
      blit(S.LAMP, l[0], l[1]);
    });
    board();
    box(57.2, 38.2, 0, 3.6, 3.6, 1, [K.woodT, "#c2a77e", "#9d855f"]);
    const c1 = P(57.5, 38.5, 1);
    blit(S.CRATE, c1[0], c1[1]); // supply pile
    box(48.4, 39.4, 0, 3.4, 3.4, 1, [K.woodT, "#c2a77e", "#9d855f"]); // build platform
  });
  LW = layer(() => {
    walkway();
    shelter();
  });
}

// ---------- timing ----------

const D2R = Math.PI / 180;
function theta(t: number) {
  if (t < 0.55) return 0;
  if (t < 0.95) return 4 * D2R * ioc(seg(t, 0.55, 0.95));
  if (t < 1.6) return (4 + 182 * ic3(seg(t, 0.95, 1.6))) * D2R;
  if (t < 1.9) return (186 - 6 * ioc(seg(t, 1.6, 1.9))) * D2R;
  return Math.PI;
}
const RUN0 = 1.95,
  RUN1 = 6.3;
function hgState(t: number) {
  const th = theta(t),
    run = seg(t, RUN0, RUN1);
  if (th < Math.PI - 1e-9) return { th, fa: 0, fb: 1, run: 0 };
  return { th: th - Math.PI, fa: 1 - run, fb: run, run };
}
// figure
const GRIP = [1.5, 0.5]; // toward the rail's swinging end, so the hands travel with the body side as it tips
const F0 = [HX + 2.8, HY - 1.5],
  FM = [HX + 3.4, HY - 1.48],
  F1 = [HX + 6.3, HY - 1.4],
  FB = [54.4, 41.7],
  PULL = 0.95,
  REL = 1.17,
  BK = 1.4,
  BT = [2.55, 3.4, 4.25],
  SLOT = [48.6, 39.6];
function gripPts(th: number) {
  const c: V3 = [HX, HY, HCZ];
  return GRIP.map((a) => PP(W3(c, th, a, HPO, -HPO)));
}
// reach (0.12-0.36) and grip the near rail above the waist; anticipation: lean back 1 px, then 2 px with knees bent (0.36-PULL),
// feet planted, while the glass strains 4 deg toward the body; exertion (PULL-REL): a short pull back, hands locked on the rail
// until it tips past about 30 deg (arms stay at grip length); release (REL-BK): let go and step clear while the glass rolls on through 180
type Hero = { pose: string; fx: number; fy: number; arms: number; lean: number; blk: V3 | null };
function hero(t: number): Hero {
  const r: Hero = { pose: "backS", fx: F0[0], fy: F0[1], arms: 0, lean: 0, blk: null };
  if (t < 0.12) {
    // standing
  } else if (t < 0.36) {
    r.pose = "backN";
    r.arms = ioc(seg(t, 0.12, 0.36));
  } else if (t < PULL) {
    const e = seg(t, 0.36, 0.62);
    r.arms = 1;
    r.lean = e < 0.5 ? 1 : 2;
    r.pose = e < 0.5 ? "leanN" : "pull2";
  } else if (t < REL) {
    const u = ioc(seg(t, PULL, REL));
    r.fx = F0[0] + (FM[0] - F0[0]) * u;
    r.fy = F0[1] + (FM[1] - F0[1]) * u;
    r.pose = "pull2";
    r.lean = 2;
    r.arms = 1;
  } else if (t < BK) {
    const v = seg(t, REL, REL + 0.08),
      w = ocu(seg(t, REL, REL + 0.07));
    r.fx = FM[0] + (F1[0] - FM[0]) * w;
    r.fy = FM[1] + (F1[1] - FM[1]) * w;
    r.arms = 1 - v;
    r.lean = v < 0.5 ? 1 : 0;
    r.pose = w < 1 ? (v < 0.5 ? "leanN" : "backA") : "backS";
  } else if (t < 2.0) {
    r.fx = F1[0];
    r.fy = F1[1];
  } else if (t < 2.5) {
    const w = ioc(seg(t, 2.0, 2.5));
    r.fx = F1[0] + (FB[0] - F1[0]) * w;
    r.fy = F1[1] + (FB[1] - F1[1]) * w;
    r.pose = Math.floor(t * 7) % 2 ? "walkA" : "walkB";
  } else if (t < 5.35) {
    r.fx = FB[0];
    r.fy = FB[1];
    r.pose = "backSL";
    for (let i = 0; i < 3; i++) {
      const a = BT[i],
        d = t - a;
      if (d < 0 || d >= 0.85) continue;
      const hz = 1 + 5 * i;
      if (d < 0.22) {
        r.pose = "crouchL";
      } else if (d < 0.4) {
        r.pose = "backSL";
        const u2 = seg(d, 0.22, 0.4);
        r.blk = [FB[0] - 1.6, FB[1] - 2.6, 1 + (Math.max(5, hz - 2) - 1) * ocu(u2)];
      } else if (d < 0.7) {
        r.pose = "pushL";
        const u3 = ioc(seg(d, 0.4, 0.7)),
          z0 = Math.max(5, hz - 2);
        r.blk = [FB[0] - 1.6 + (SLOT[0] - FB[0] + 1.6) * u3, FB[1] - 2.6 + (SLOT[1] - FB[1] + 2.6) * u3, z0 + (hz - z0) * u3 + 0.6 * Math.sin(Math.PI * u3)];
      } else {
        r.pose = "pushL";
      }
    }
  } else if (t < 5.95) {
    const b = ioc(seg(t, 5.35, 5.95));
    r.fx = FB[0] + (F0[0] - FB[0]) * b;
    r.fy = FB[1] + (F0[1] - FB[1]) * b;
    r.pose = Math.floor(t * 7) % 2 ? "backA" : "backB";
  }
  return r;
}
function thickArm(x0: number, y0: number, x1: number, y1: number) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  const Sd: Record<string, 1> = {},
    L: [number, number][] = [],
    dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0),
    sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let e = dx + dy,
    x = x0,
    y = y0;
  const add = (a: number, b: number) => {
    const q = a + "," + b;
    if (!Sd[q]) {
      Sd[q] = 1;
      L.push([a, b]);
    }
  };
  for (;;) {
    add(x, y);
    add(x + 1, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) {
      e += dy;
      x += sx;
    }
    if (e2 <= dx) {
      e += dx;
      y += sy;
    }
  }
  const g = p.g;
  g.fillStyle = K.ink;
  L.forEach((q) =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].forEach((o) => {
      const a = q[0] + o[0],
        b = q[1] + o[1];
      if (!Sd[a + "," + b] && Math.abs(b - y0) + Math.abs(a - x0) > 2) g.fillRect(a, b, 1, 1);
    }),
  );
  L.forEach((q) => {
    g.fillStyle = Math.abs(q[0] - x1) + Math.abs(q[1] - y1) <= 1 ? "#f1c6a0" : "#5f2ea0";
    g.fillRect(q[0], q[1], 1, 1);
  });
}
type Crate = { m: boolean; x: number; y: number; z: number };
function crates(t: number) {
  const n: Crate[] = [];
  for (let i = 0; i < 3; i++) {
    const d = t - BT[i];
    if (d < 0.7) continue;
    let z = 1 + 5 * i;
    const U = UNSTACK[i];
    if (d < 0.85) z -= Math.sin(Math.PI * seg(d, 0.7, 0.85)) * 1;
    if (t >= U[1]) continue;
    if (t >= U[0]) {
      const u = ioc(seg(t, U[0], U[1]));
      n.push({ m: true, x: SLOT[0] + (PILE[0] - SLOT[0]) * u, y: SLOT[1] + (PILE[1] - SLOT[1]) * u, z: z + (PILE[2] - z) * u + 5 * Math.sin(Math.PI * u) });
      continue;
    }
    n.push({ m: false, x: 0, y: 0, z });
  }
  return n;
}
function lit(t: number) {
  if (t < 5.2) return 0;
  if (t < 5.7) return Math.floor(NF * seg(t, 5.2, 5.7) + 1e-4);
  if (t < 6.05) return NF;
  if (t < 6.4) return Math.ceil(NF * (1 - seg(t, 6.05, 6.4)));
  return 0;
}
// traffic and people
const VX = 130 / T;
function busX(t: number) {
  if (t < 1.0) return 80;
  if (t < 2.6) return 80 + 23 * Math.pow(seg(t, 1.0, 2.6), 2);
  if (t < 3.2) return 200;
  if (t < 5.4) return -12 + 69 * seg(t, 3.2, 5.4);
  const u = seg(t, 5.4, 7.0);
  return 57 + 23 * (1 - (1 - u) * (1 - u));
}
const CARS = [
  { x0: 20, c: 1 },
  { x0: 72, c: 3 },
  { x0: 118, c: 4 },
];
type Key = readonly [number, number, number];
const PEDS: { c: number; k: Key[] }[] = [
  {
    c: 0,
    k: [
      [3.0, 67.5, 14.2],
      [3.25, 67.5, 17.6],
      [5.3, 67.5, 47.3],
      [6.05, 79.3, 47.3],
      [6.45, 84.6, 50.6],
      [7.6, 84.6, 50.6],
    ],
  },
  {
    c: 6,
    k: [
      [0.4, 86.5, 52.8],
      [0.7, 85.5, 50.8],
      [1.15, 79.3, 47.6],
      [1.9, 67.6, 47.6],
      [3.95, 67.6, 17.6],
      [4.2, 67.6, 14.2],
    ],
  },
  {
    c: 4,
    k: [
      [0.8, 30.5, 14.5],
      [2.2, 30.5, 14.5],
    ],
  },
  {
    c: 1,
    k: [
      [4.4, 40, 18.6],
      [6.6, 52.5, 18.6],
      [6.9, 53.5, 14.4],
    ],
  },
  {
    c: 3,
    k: [
      [0, 2.3, 13.5],
      [0.75, 2.3, 22],
      [1.05, 4.6, 24.3],
      [2.7, 25.4, 24.3],
      [3.0, 27.7, 22],
      [4.1, 27.7, 5],
      [4.4, 25.4, 2.7],
      [6.05, 4.6, 2.7],
      [6.35, 2.3, 5],
      [7, 2.3, 13.5],
    ],
  },
  {
    c: 5,
    k: [
      [1.2, 25, 46.6],
      [2.6, 25, 40.6],
      [4.0, 22.4, 38.8],
      [4.01, 22.4, 38.8],
    ],
  },
];
function mkMask() {
  VMASK = layer(() => {
    fl(30, 76, 16, 0, ZV, "#000");
    fr(6, 40, 86, 0, ZV, "#000");
    fl(81, 86, 40, 0, ZV, "#000");
  });
}
/** Draw fn masked to the void deck's openings (people walking behind the pillars). */
function clipped(fn: () => void) {
  p.withTarget(TMP, p.ox, p.oy, () => {
    const g = p.g;
    g.clearRect(0, 0, W, H);
    fn();
    g.globalCompositeOperation = "destination-in";
    g.drawImage(VMASK, 0, 0);
    g.globalCompositeOperation = "source-over";
  });
  p.g.drawImage(TMP, 0, 0);
}
const TREES = [
  [36, 24],
  [33, 35],
  [42, 46.5],
  [62, 44],
  [3, 46],
  [98, 18],
  [4, 66.2],
  [14, 66.2],
  [24, 66.2],
  [34, 66.2],
  [46, 66.2],
  [58, 66.2],
  [70, 66.2],
  [82, 66.2],
  [94, 66.2],
  [90, 4],
  [95, 10],
  [97, 40],
  [2, 8],
];
const LAMPS = [
  [12, 52.8],
  [40, 52.8],
  [64, 52.8],
  [97, 52.8],
  [30, 66.4],
  [76, 66.4],
];

// ---------- frame ----------

function draw(t: number) {
  t = mod(t, T);
  const tv = mod(t + 0.0123, T);
  const g = p.g;
  g.drawImage(LA, 0, 0);
  const n = lit(t);
  litCorr(n);
  g.drawImage(LC, 0, 0);
  litCores(n);
  g.drawImage(LD, 0, 0);
  litWin(n);
  clothes(tv);
  g.drawImage(LB, 0, 0);
  MARKZ.forEach((z, i) => {
    if (t >= 2.8 + 0.9 * i && t < UNMARK[i]) blit(MARKS[i], OX0, OY0);
  });
  const back: { k: number; f: () => void }[] = [],
    front: { k: number; f: () => void }[] = [];
  const add = (x: number, y: number, f: () => void) => (y >= 51.6 || x >= 92 ? front : back).push({ k: x + y, f });
  add(KX + 2.5, KY + 1.75, () => blit(KIOSK, OX0, OY0));
  PEDS.forEach((pd) => {
    const q = keyframes(pd.k, tv, T);
    if (!q) return;
    add(q.x, q.y, () => {
      const c = P(q.x, q.y, 0);
      if (q.y < 16.3 || (q.x > 81.2 && q.y < 40)) clipped(() => blit(S.PED[pd.c][q.f], c[0], c[1]));
      else blit(S.PED[pd.c][q.f], c[0], c[1]);
    });
  });
  TREES.forEach((q) =>
    add(q[0], q[1], () => {
      const c = P(q[0], q[1], 0);
      blit(S.TSH, c[0], c[1]);
      blit(S.TREE_S, c[0], c[1]);
    }),
  );
  add(95, 28, () => {
    const c = P(95, 28, 0);
    blit(S.RAIN, c[0], c[1]);
  });
  LAMPS.forEach((q) =>
    add(q[0], q[1], () => {
      const c = P(q[0], q[1], 0);
      blit(S.LAMP, c[0], c[1]);
    }),
  );
  add(93.8, 52.8, () => {
    const c = P(93.8, 52.8, 0);
    blit(S.POLE, c[0], c[1]);
  });
  const bx = busX(tv);
  if (bx >= 0 && bx <= 90)
    add(bx + 5, 55 + 1.2, () => {
      const c = P(bx, 54.7, 0);
      blit(S.BUS, c[0], c[1]);
    });
  CARS.forEach((m) => {
    const x = mod(m.x0 - VX * tv, 130) - 15;
    if (x < 0 || x > 96) return;
    add(x + 2, 61, () => {
      const c = P(x, 60.4, 0);
      blit(S.CX[m.c], c[0], c[1]);
    });
  });
  const cx = mod(104 - 16.4 * tv, 115) - 8;
  if (cx > 1 && cx < 98)
    add(cx, 52.9, () => {
      const c = P(cx, 52.9, 0);
      blit(S.CYC[Math.floor(tv * 8) % 2], c[0], c[1]);
    });
  // hero group
  const hs = hgState(t),
    h = hero(t);
  add(HX, HY, () => hourglass(hs.th, hs.fa, hs.fb, hs.run, tv));
  const cs = crates(t);
  add(SLOT[0] + 1.5, SLOT[1] + 1.5, () => {
    cs.forEach((c) => {
      if (c.m) return;
      const q = P(SLOT[0], SLOT[1], c.z);
      blit(S.CRATE, q[0], q[1]);
    });
    if (t >= 5.1 && t < 6.3) {
      const nz = cs.length === 3 && !cs[2].m ? 16 : 0,
        q = P(SLOT[0] + 1.5, SLOT[1] + 1.5, nz),
        up = Math.round(3 * ocu(seg(t, 5.1, 5.3)) - 4 * ic3(seg(t, 6.12, 6.26)));
      if (nz && up > -1) {
        line(q[0], q[1] - 1, q[0], q[1] - 2 - up - 2, K.g5);
        p.g.fillStyle = K.pM;
        p.g.fillRect(Math.round(q[0]) + 1, Math.round(q[1]) - up - 5, 3, 2);
        p.g.fillStyle = K.pL;
        p.g.fillRect(Math.round(q[0]) + 1, Math.round(q[1]) - up - 5, 1, 1);
        px(q[0] + 4, q[1] - up - 4, K.pM);
      }
    }
  });
  cs.forEach((c) => {
    if (c.m)
      add(c.x + 1.5, c.y + 1.5, () => {
        const q = P(c.x, c.y, c.z);
        blit(S.CRATE, q[0], q[1]);
      });
  });
  add(h.fx, h.fy, () => {
    const fp = P(h.fx, h.fy, 0);
    let b = h.blk;
    if (b && b[0] + b[1] < h.fx + h.fy) {
      const q = P(b[0], b[1], b[2]);
      blit(S.CRATE, q[0], q[1]);
      b = null;
    }
    blit(S.FSH, fp[0], fp[1]);
    // arms reach forward, away from the viewer: drawn first so the back of the head and torso cover them
    if (h.arms) {
      const G = gripPts(theta(t)),
        sh = [
          [fp[0] - 2 + h.lean, fp[1] - 9 + (h.lean > 1 ? 1 : 0)],
          [fp[0] + 1 + h.lean, fp[1] - 9 + (h.lean > 1 ? 1 : 0)],
        ],
        rest = [
          [fp[0] - 3, fp[1] - 4],
          [fp[0] + 3, fp[1] - 4],
        ];
      for (let i = 0; i < 2; i++) {
        const hx = Math.round(rest[i][0] + (G[i][0] - rest[i][0]) * h.arms),
          hy = Math.round(rest[i][1] + (G[i][1] - 1 - rest[i][1]) * h.arms);
        thickArm(sh[i][0], sh[i][1], hx, hy);
      }
    }
    blit(S.FS[h.pose], fp[0], fp[1]);
    if (b) {
      const q2 = P(b[0], b[1], b[2]);
      blit(S.CRATE, q2[0], q2[1]);
    }
  });
  back.sort((a, b) => a.k - b.k);
  back.forEach((e) => e.f());
  g.drawImage(LW, 0, 0);
  front.sort((a, b) => a.k - b.k);
  front.forEach((e) => e.f());
}

// ---------- anchors ----------
// pins sit beside their subject, never on the hero prop: 1 above the notice board, 2 on the bus-shelter roof
// (wide view: its right end, so the leader comes in over the lawn corner, not across the road), 3 on the kiosk roof.
// Computed with the projection at the scene's origin (as the prototype's pt()).
const prj = (x: number, y: number, z: number): [number, number] => [OX0 + 2 * (x - y), OY0 + x + y - z];
const BP = prj(BX + 2.2, BY, 14.5),
  KP = prj(KX + 2.5, KY + 1.75, 12.6);

let built = false;

export const gap: SceneModule = {
  logicalW: W,
  logicalH: H,
  period: T,
  finalT: 6.0,
  origin: [OX0, OY0],
  label: msg(
    "Pixel diorama of a Singapore public-housing corner: in the park below an L-shaped block with a void deck, a student grips a large hourglass on a swivel stand, leans back and pulls it over; while the sand runs, three crates stack up beside it and the weeks on a notice-board calendar are marked off, then the crates go back to the pile. A small pass kiosk stands on the lawn. A bus pulls in and out of the stop, people walk the covered walkway, and laundry hangs from the windows.",
  ),
  // The prototype's FOC [142, 184] and CH 160: the crop centred there, 160 px tall below 480 CSS px.
  crop: { x: 0, y: 104, w: 284, h: 160 },
  anchors: { "1": [BP[0] + 1, BP[1] - 11], "2": prj(91, 49.6, 10), "3": KP },
  cropAnchors: { "1": [BP[0], BP[1] + 5], "2": prj(84, 51.6, 9), "3": KP },
  pinOffsets: { "1": [18, -2], "2": [12, -10], "3": [-10, -12] },
  cards: { "1": { x: 96, y: -10, leader: "vertical" }, "2": { x: 258, y: 252, leader: "vertical" }, "3": { x: 0, y: 0, leader: "vertical" } },
  cardWidth: 184,
  overlayMinScale: 1.75,
  init(engine: Engine) {
    p = engine.p;
    if (built) return;
    S = buildSprites();
    HGC = mk(52, 60);
    TMP = mk(W, H);
    MARKS = MARKZ.map((z) =>
      sprite(W, H, OX0, OY0, () => {
        fl(BX + 0.5, BX + 4, BY, z, z + 1, K.gapM);
        const q = P(BX + 3.8, BY, z + 1);
        px(q[0] - 1, q[1] - 1, K.gapD);
      }),
    );
    KIOSK = sprite(W, H, OX0, OY0, kiosk);
    mkMask();
    buildLayers();
    built = true;
  },
  draw(_ctx: CanvasRenderingContext2D, t: number, engine: Engine) {
    p = engine.p;
    draw(t);
  },
};

export default gap;
