import { msg } from "@/lib/i18n/translate";
import { BASE, RAMPS, SHADOW, hsh, keyframes, mod, pickFade, seg, type Engine, type Painter, type PinKey, type Point, type Point3, type SceneModule, type Sprite, type Tones } from "../engine";

// Study: isometric pixel diorama of a learning hub of stacked rounded towers round an open atrium
// (modelled on The Hive, NTU; architecture only). Ported from the v2 prototype
// (scratchpad four-roads/_tools/study-v2/scene.js) pixel for pixel, minus the background fill: the
// stage clears to transparent so the art sits on --land-ground. 1 world unit = 2px across / 1px down;
// z in px. Light from the top-left, shadows to the lower right.
//
// Story (9 s loop): a student waits on the far kerb while a car passes, crosses the zebra, hops onto a
// stone kerb beside a stack of books, leaps onto a front tower, then onto the tallest planted roof,
// walks to the gold trophy resting there and lifts it overhead (it glints), and the storeys light up
// floor by floor, while students walk the plaza and cars circle the drop-off road. The figure and
// trophy fade back to the start for a seamless loop.

const W = 352,
  H = 280,
  T = 9,
  OX0 = 144,
  OY0 = 96;

const K = {
  ...BASE,
  seam: "#5a4a3f",
  seamR: "#45382f",
  slot: "#2f2724",
  soffit: "#3d2e24",
  plaza: "#d6d1c5",
  plaza2: "#cbc6b9",
  kerb: "#ece8df",
  lf: "#6d7a35",
  lfL: "#a3ad5a",
  lfD: "#4d532a",
  glow: "#f6ead0",
  glowS: "#ffd98a",
  glowB: "#e9cf9a",
  gL: RAMPS.study[0],
  gM: RAMPS.study[1],
  gD: RAMPS.study[2],
};
// band tones across the drum: 0 highlight, 1 lit, 2 mid, 3 shade, 4 deep
const FACE = ["#f4eadf", "#ecdfd2", "#cdb9a5", "#a08a76", "#8a7462"],
  RIB = ["#dccdbd", "#d3c3b2", "#b29e8a", "#8a7462", "#735f4f"],
  LIP = ["#fffaf2", "#f8efe4", "#e2d2c0", "#b9a38e", "#9b8571"],
  UND = ["#bfab98", "#b39f8b", "#9a8572", "#7a6555", "#624f42"];
const SHC = SHADOW;

// ---------- painter state (set in init and at the start of every draw) ----------

let p: Painter;
/** Id pass: everything drawn black except the tagged seams, so the seams can be lifted into glow layers. */
let ID = false;
const C = (c: string) => (ID && c.charAt(0) !== "r" ? "#000" : c);
const P = (x: number, y: number, z = 0) => p.P(x, y, z);
const poly = (pts: readonly Point[], c: string) => p.poly(pts, C(c));
function fp(X: number, Y: number, c: string) {
  p.g.fillStyle = C(c);
  p.g.fillRect(X, Y, 1, 1);
}
let SIL = new WeakMap<Sprite, HTMLCanvasElement>();
function sil(s: Sprite) {
  let c = SIL.get(s);
  if (!c) {
    c = document.createElement("canvas");
    c.width = s.c.width;
    c.height = s.c.height;
    const cg = c.getContext("2d");
    if (cg) {
      cg.drawImage(s.c, 0, 0);
      cg.globalCompositeOperation = "source-in";
      cg.fillStyle = "#000";
      cg.fillRect(0, 0, c.width, c.height);
    }
    SIL.set(s, c);
  }
  return c;
}
function blit(s: Sprite, x: number, y: number) {
  if (ID) p.g.drawImage(sil(s), Math.round(x) - s.ax, Math.round(y) - s.ay);
  else p.blit(s, x, y);
}

// ---------- sprites (built in init) ----------

type Tree = { can: Sprite; tr: Sprite };
type Sprites = {
  RAIN: Tree;
  TREE_B: Tree;
  TSH: Sprite;
  BUSH: Sprite[];
  RTREE: Sprite;
  LAMP: Sprite;
  FS: Record<string, Sprite>;
  FSH: Sprite;
  TRO: Sprite;
  STANDF: Sprite[];
  TROF: Sprite[];
  BACKF: Sprite[];
  PED: Sprite[][];
  GRP: Sprite[];
  CX: Sprite[];
  CY: Sprite[];
  BUS: Sprite;
};
let S: Sprites;

const FIGMAP = { h: "#2b2233", s: "#f1c6a0", p: "#7a4fc4", q: "#5f2ea0", d: "#2f3447", k: "#1f1a2b", w: "#ffffff" };
const HD = ["...hhh...", "..hhhhh..", "..hssss..", "..sksks..", "...sss..."],
  HB = ["...hhh...", "..hhhhh..", "..hhhhh..", "..hhhhh..", "...sss..."];
const TOR = ["..ppppp..", ".qpppppq.", ".qpppppq.", ".qpppppq.", ".s.ppp.s.", "..ddddd.."];
const LS = ["..dd.dd..", "..dd.dd..", "..kk.kk.."];
const FIG: Record<string, string[]> = {
  stand: HD.concat(TOR, LS),
  backS: HB.concat(TOR, LS),
  land: HB.concat(["..ppppp..", ".qpppppq.", ".qpppppq.", ".s.ppp.s.", "..ddddd.."], [".dd...dd.", ".dd...dd.", ".kk...kk."]),
  crouch: HB.concat(["..ppppp..", ".ppppppp.", "sqpppppqs", "..ddddd..", ".ddd.ddd.", ".dd...dd.", ".kk...kk."]),
  squash: ["...hhh...", "..hhhhh..", "..hhhhh..", "..sssss..", ".ppppppp.", "ppppppppp", "qpppppppq", "s.ddddd.s", ".dd...dd.", ".dd...dd.", ".kk...kk."],
  up: [".s.....s.", ".q.hhh.q.", ".qhhhhhq.", ".qhhhhhq.", "..qhhhq..", "...sss...", "..ppppp..", "..ppppp..", "..ppppp..", "...ppp...", "..ddddd..", "..dd.dd..", "..dd.dd..", "..kk.kk.."],
  launch: ["...hhh...", "..hhhhh..", "..hhhhh..", ".shhhhhs.", ".q.sss.q.", "..ppppp..", "..ppppp..", "..ppppp..", "...ppp...", "..ddddd..", "..dd.dd..", "..dd..dd.", "..kk...kk"],
  reach: ["...hhh...", "..hhhhh..", "..hhhhh..", "..hhhhh..", "...sss...", "sqpppppqs", "..ppppp..", "..ppppp..", "...ppp...", "..ddddd..", ".dd...dd.", ".dd...dd.", ".kk...kk."],
  tuck: ["s.......s", "q..hhh..q", ".qhhhhhq.", "..hhhhh..", "..hhhhh..", "...sss...", "..ppppp..", ".ppppppp.", ".ddddddd.", ".dd...dd.", ".kk...kk."],
  walkA: HB.concat(TOR, ["..dd.dd..", ".dd...dd.", ".kk...kk."]),
  walkB: HB.concat(TOR, ["..dd.dd..", "..dd.dd..", "..kk.kk.."]),
  pickF: ["...hhh...", "..hhhhh..", "..hssss..", "..sksks..", "...sss...", "..ppppp..", ".ppppppp.", "sqpppppqs", "..ddddd..", ".ddd.ddd.", ".dd...dd.", ".kk...kk."],
  liftF: ["...hhh...", "..hhhhh..", "s.hssss.s", "q.sksks.q", ".q.sss.q.", "..ppppp..", "..ppppp..", "..ppppp..", "...ppp...", "..ddddd..", "..dd.dd..", "..dd.dd..", "..kk.kk.."],
  cheer: [".s.....s.", ".q.hhh.q.", ".qhhhhhq.", ".qhssssq.", "..sksks..", "...sss...", "..ppppp..", "..ppppp..", "..ppppp..", "...ppp...", "..ddddd..", "..dd.dd..", "..dd.dd..", "..kk.kk.."],
};
const PED_C = ["#ffffff", "#8d9bb3", "#6a6672", "#b8b2c2", "#9cb38f", "#c4a597", "#e9c46a"];
const CARC: Tones[] = [
  [K.w0, "#e3e0d9", "#c3beb6"],
  ["#b3bfcf", "#94a2b5", "#76849a"],
  ["#d3c2b6", "#b8a597", "#958375"],
  ["#8f8c96", "#77747f", "#5f5c68"],
];

function buildSprites(): Sprites {
  // tree split into canopy + trunk so the canopy can sway 1px
  const tree = (rows: string[], map: Record<string, string>): Tree => ({
    can: p.pix(
      rows.map((r) => r.replace(/t/g, ".")),
      map,
    ),
    tr: p.pix(
      rows.map((r) => r.replace(/[^t]/g, ".")),
      map,
    ),
  });
  const TM = { a: K.tL, b: K.tM, c: K.tD, t: K.trunk };
  const LM = { a: K.lfL, b: K.lf, c: K.lfD, t: "#6b5a48" };
  const FS: Record<string, Sprite> = {};
  for (const k of Object.keys(FIG)) FS[k] = p.pix(FIG[k], FIGMAP, K.ink);
  // gold trophy: two handles, a white glint on the cup, stem and foot
  const TRO = p.pix([".lwlllab.", "l.wllab.b", "l.wllab.b", ".l.lab.b.", "...lab...", "....a....", "...lab...", "..laaab.."], { l: K.gL, w: "#fffbe6", a: K.gM, b: K.gD }, K.ink);
  // [25%, 50%, 75% faded], as in the prototype
  const fades3 = (s: Sprite) => p.fades(s).slice(1);
  const carX = (t: Tones) =>
    p.sprite(16, 12, 5, 5, () => {
      p.poly([P(0.5, 0.4, 0), P(4.5, 0.4, 0), P(4.5, 2.4, 0), P(0.5, 2.4, 0)], SHC);
      p.box(0, 0, 0, 4, 2, 2, t);
      p.box(1, 0, 2, 2, 2, 2, [t[0], "#3b4255", "#2c3242"]);
      p.tp(1, 0, 3, 2, 4, t[0]);
    });
  const carY = (t: Tones) =>
    p.sprite(16, 12, 9, 5, () => {
      p.poly([P(0.4, 0.5, 0), P(2.4, 0.5, 0), P(2.4, 4.5, 0), P(0.4, 4.5, 0)], SHC);
      p.box(0, 0, 0, 2, 4, 2, t);
      p.box(0, 1, 2, 2, 2, 2, [t[0], "#3b4255", "#2c3242"]);
      p.tp(0, 1, 2, 3, 4, t[0]);
    });
  return {
    RAIN: tree(["......aaaa.......", "...aaaaaaabbb....", ".aaaaaaabbbbbbb..", "aaaaaabbbbbbbbbcc", ".aabbbbbbbbbcccc.", "...bbbbcccccc....", ".......tt........", ".......t.........", "......tt.........", ".......t........."], TM),
    TREE_B: tree(["....aaa....", "..aaaaabb..", ".aaaaaabbb.", "aaaaaabbbbc", "aaaabbbbbcc", ".aabbbbbcc.", "..bbbbccc..", "....ccc....", ".....t.....", ".....t....."], TM),
    TSH: p.sprite(14, 5, 2, 1, () => {
      p.g.fillStyle = SHC;
      p.g.fillRect(1, 0, 11, 1);
      p.g.fillRect(0, 1, 12, 1);
      p.g.fillRect(2, 2, 8, 1);
    }),
    BUSH: [p.pix([".aab.", "aaabb", "abbbc", ".bcc."], LM), p.pix(["..aab..", ".aaabbb", "aaabbbc", "abbbccc", ".bcccc."], LM), p.pix([".ab.", "abbc", ".cc."], LM)],
    RTREE: p.pix(["..aab..", ".aaabbb", "aaabbbc", ".abbcc.", "...t...", "...t..."], LM),
    LAMP: p.sprite(6, 14, 2, 12, () => {
      p.g.fillStyle = "#2b2830";
      p.g.fillRect(2, 2, 1, 10);
      p.g.fillRect(2, 1, 3, 1);
      p.g.fillStyle = "#f6d58a";
      p.g.fillRect(4, 2, 1, 1);
    }),
    FS,
    FSH: p.sprite(14, 5, 7, 2, () => {
      p.g.fillStyle = SHC;
      p.g.fillRect(2, 1, 11, 1);
      p.g.fillRect(1, 2, 11, 1);
      p.g.fillRect(3, 3, 7, 1);
    }),
    TRO,
    STANDF: fades3(FS.cheer),
    TROF: fades3(TRO),
    BACKF: fades3(FS.backS),
    PED: PED_C.map((c) => {
      const m = { k: "#2b2233", s: "#f1c6a0", c, d: "#3a3f52" };
      return [p.pix([".k.", ".s.", "ccc", ".c.", "d.d"], m), p.pix([".k.", ".s.", "ccc", ".c.", ".d."], m)];
    }),
    // group of recent graduates chatting on the plaza (card 2 anchor): 5x9 figures, outlined, read at 1:1
    GRP: [
      ["#2b2233", "#f6f4f0"],
      ["#5a3b2a", "#a9c4dc"],
      ["#1f1a2b", "#e2cfa6"],
      ["#3b2a22", "#9fb59a"],
    ].map((c) =>
      p.pix([".hhh.", ".sss.", "cclcc", "scccs", ".ccc.", ".ddd.", ".d.d.", ".d.d.", ".k.k."], { h: c[0], s: "#f1c6a0", c: c[1], l: "#7a6f86", d: "#3a3f52", k: "#1f1a2b" }, "#4a4152"),
    ),
    CX: CARC.map(carX),
    CY: CARC.map(carY),
    BUS: p.sprite(30, 16, 5, 9, () => {
      p.poly([P(0.5, 0.4, 0), P(8.5, 0.4, 0), P(8.5, 2.4, 0), P(0.5, 2.4, 0)], SHC);
      p.box(0, 0, 0, 8, 2, 6, [K.w0, "#e6e3dc", "#c3beb6"]);
      p.fl(0.5, 7.5, 2, 3, 5, "#3b4255");
      p.fr(0.3, 1.7, 8, 3, 5, "#2c3242");
      p.fl(0, 8, 2, 1, 2, K.g2);
      p.fl(1, 1.8, 2, 0, 1, K.ink);
      p.fl(6, 6.8, 2, 0, 1, K.ink);
    }),
  };
}

/** From a [25%, 50%, 75% faded] list: the full sprite at lv ≥ 1, nothing at lv ≤ 0, else the nearest step. */
const fade = (s: Sprite, F: Sprite[], lv: number) => pickFade([s, ...F], lv);

// ---------- the hub: 12 rounded towers round an open atrium ----------

const CX0 = 52,
  CY0 = 28,
  RX = 18,
  RY = 15;
const NS = [6, 5, 6, 5, 6, 6, 7, 7, 8, 8, 7, 7],
  PLANT: Record<number, number> = { 0: 1, 2: 1, 4: 1, 6: 2, 9: 2, 11: 1 };
type Tower = { i: number; cx: number; cy: number; r0: number; n: number; pl: number; ph: number };
type Storey = { x: number; y: number; r: number };
const TW: Tower[] = [];
for (let i = 0; i < 12; i++) {
  const th = ((i * 30 - 15) * Math.PI) / 180;
  TW.push({ i, cx: CX0 + RX * Math.cos(th), cy: CY0 + RY * Math.sin(th), r0: 4.6 + 0.6 * hsh(i, 3), n: NS[i], pl: PLANT[i] || 0, ph: i % 4 });
}
const WOB = [
  [0.5, 0],
  [0, 0.5],
  [-0.5, 0],
  [0, -0.5],
];
function stor(t: Tower, s: number): Storey {
  if (s === 0) return { x: t.cx, y: t.cy, r: t.r0 - 1.1 };
  const w = WOB[(s + t.ph) % 4];
  return { x: t.cx + w[0], y: t.cy + w[1], r: t.r0 + 0.35 * s };
}
const topZ = (t: Tower) => 9 + 10 * (t.n - 1);
function cols(cx: number, cy: number, r: number, fn: (X: number, u: number, yo: number, cy: number) => void) {
  const c = P(cx, cy, 0),
    A = 2 * Math.SQRT2 * r,
    B = Math.SQRT2 * r;
  for (let X = Math.floor(c[0] - A); X <= Math.ceil(c[0] + A); X++) {
    const u = (X + 0.5 - c[0]) / A;
    if (u <= -1 || u >= 1) continue;
    fn(X, u, B * Math.sqrt(1 - u * u), c[1]);
  }
}
const tone = (u: number) => (u < -0.93 ? 1 : u < -0.42 ? 0 : u < -0.08 ? 1 : u < 0.38 ? 2 : u < 0.78 ? 3 : 4);
function band(b: Storey, zt: number) {
  for (let k = 0; k < 8; k++)
    cols(b.x, b.y, k === 0 || k === 7 ? b.r - 0.3 : b.r, (X, u, yo, cy) => {
      const tn = tone(u);
      let c: string;
      if (k === 0) c = LIP[tn];
      else if (k === 7) c = UND[tn];
      else if (k === 2 || k === 5) c = RIB[tn];
      else c = FACE[tn];
      if (k > 0 && k < 7 && tn <= 1 && X % 7 === 0) c = RIB[tn];
      fp(X, Math.round(cy - zt + k + yo), c);
    });
}
function seam(b: Storey, zt: number, s: number) {
  for (let k = 0; k < 2; k++)
    cols(b.x, b.y, b.r - 0.35, (X, u, yo, cy) => {
      const slot = k === 0 && u < 0.55 && (X + s) % 5 !== 0;
      const c = ID ? "rgb(" + s + "," + (k ? 203 : slot ? 202 : 201) + ",0)" : slot ? K.slot : u < 0.3 ? K.seam : K.seamR;
      fp(X, Math.round(cy - zt + k + yo), c);
    });
}
function ground(b: Storey) {
  for (let z = 8; z >= 0; z--)
    cols(b.x, b.y, b.r, (X, u, yo, cy) => {
      let c = z >= 7 ? K.soffit : u < 0.2 ? "#4d5058" : "#383a41";
      if (z < 7 && (Math.abs(u + 0.62) < 0.07 || Math.abs(u + 0.12) < 0.07 || Math.abs(u - 0.38) < 0.07 || Math.abs(u - 0.8) < 0.06)) c = u < 0.2 ? "#e6dccf" : "#b9ab9c";
      if (z === 6 && u < 0.2 && c !== "#e6dccf") c = "#6b6e76";
      fp(X, Math.round(cy - z + yo), c);
    });
}
function roof(t: Tower, b: Storey, zt: number) {
  const rr = b.r - 0.3,
    ri = b.r - 1.15,
    pl = t.pl;
  cols(b.x, b.y, rr, (X, u, yo, cy) => {
    const y0 = Math.round(cy - zt - yo),
      y1 = Math.round(cy - zt + yo);
    for (let Y = y0; Y < y1; Y++) fp(X, Y, Y === y0 ? LIP[Math.min(4, tone(u) + 1)] : LIP[tone(u)]);
  });
  cols(b.x, b.y, ri, (X, u, yo, cy) => {
    const y0 = Math.round(cy - zt - yo),
      y1 = Math.round(cy - zt + yo);
    for (let Y = y0 + 1; Y < y1; Y++) fp(X, Y, pl ? (Y === y0 + 1 ? "#3c4120" : K.lfD) : Y === y0 + 1 ? "#a8977f" : (X + Y) % 2 ? "#d9cdbd" : "#d2c6b6");
  });
  if (!pl) {
    // open terrace: thin railing on the back rim
    cols(b.x, b.y, ri, (X, u, yo, cy) => {
      const y = Math.round(cy - zt - yo) - 2;
      fp(X, y, "#7b6a5c");
      if (X % 3 === 0) fp(X, y + 1, "#7b6a5c");
    });
    const bc = P(b.x - 1, b.y - 1, zt);
    fp(Math.round(bc[0]), Math.round(bc[1]), "#a7a094");
    fp(Math.round(bc[0]) + 2, Math.round(bc[1]), "#a7a094");
    return;
  }
  // planting: clumps round the rim (front landing point kept clear on the climb towers), small tree on some
  const spots: [number, number, number][] = [];
  for (let j = 0; j < 7; j++) {
    const a = ((j * 51 + t.i * 37) * Math.PI) / 180;
    const ad = Math.abs(((((a * 180) / Math.PI - 45) % 360) + 540) % 360 - 180);
    if ((t.i === 3 || t.i === 9) && ad < 40) continue;
    spots.push([b.x + 0.7 * ri * Math.cos(a), b.y + 0.7 * ri * Math.sin(a), j]);
  }
  spots.sort((m, n) => m[0] + m[1] - n[0] - n[1]);
  if (pl === 2) {
    const tc = P(b.x - 1.2, b.y - 1.6, zt);
    blit(S.RTREE, tc[0], tc[1]);
  }
  spots.forEach((s) => {
    const q = P(s[0], s[1], zt);
    blit(S.BUSH[s[2] % 3], q[0], q[1] + 1);
  });
  // clumps spilling over the left rim
  const sp = P(b.x - b.r * 0.55, b.y + b.r * 0.75, zt);
  blit(S.BUSH[2], sp[0], sp[1] + 2);
}
function vine(b: Storey, zt: number, u0: number, len: number, seed: number) {
  const c = P(b.x, b.y, 0),
    A = 2 * Math.SQRT2 * b.r,
    X = Math.round(c[0] + u0 * A),
    yo = Math.SQRT2 * b.r * Math.sqrt(1 - u0 * u0),
    y0 = Math.round(c[1] - zt + yo) - 1;
  for (let Y = y0; Y < y0 + len; Y++) {
    const w = Math.round(Math.sin((Y + seed) * 0.7) * 0.6);
    fp(X + w, Y, (Y + seed) % 3 ? K.lf : K.lfD);
    if (Y < y0 + len - 6 && (Y + seed) % 4) fp(X + w + 1, Y, Y % 2 ? K.lfL : K.lf);
  }
  fp(X, y0 + len, K.lfD);
}
function tower(t: Tower) {
  ground(stor(t, 0));
  for (let s = 1; s < t.n; s++) {
    const b = stor(t, s),
      zb = 9 + 10 * (s - 1);
    seam(b, zb + 2, s);
    band(b, zb + 10);
  }
  const b = stor(t, t.n - 1);
  roof(t, b, topZ(t));
  if (t.pl) {
    const zt = topZ(t);
    if (t.i % 2 === 0) vine(b, zt, -0.86, 22 + ((t.i * 7) % 14), t.i);
    vine(b, zt, 0.84, 14 + ((t.i * 5) % 12), t.i + 3);
  }
}
// bronze stair core: octagonal shaft of vertical bronze slats (w4); 3 facets show: lit left (+y), front (+x+y), shade right (+x)
// per facet: s slat, b gap behind the slats, e arris, br ledge (every 2 storeys), d ledge underside
const CF = [
  { s: "#6b5040", b: "#4d3a2f", e: "#94735c", br: "#86695a", d: "#3a2d25" },
  { s: "#4a3f3a", b: "#362d29", e: "#6d5a4f", br: "#625149", d: "#2a221e" },
  { s: "#2e2622", b: "#211b18", e: "#4a3d36", br: "#40342e", d: "#1c1714" },
];
const CORE_R = 2.4;
function core(x: number, y: number, zt: number) {
  const r = CORE_R,
    V: [number, number][] = [];
  for (let k = 0; k < 8; k++) {
    const a = ((22.5 + 45 * k) * Math.PI) / 180;
    V.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
  }
  // facets: [vertex pair, tone]  normal 90 = V1-V2 (lit), 45 = V0-V1 (front), 0 = V7-V0 (shade)
  for (const F of [
    [1, 2, 0],
    [0, 1, 1],
    [7, 0, 2],
  ]) {
    const A = P(V[F[0]][0], V[F[0]][1], 0),
      B = P(V[F[1]][0], V[F[1]][1], 0),
      f = CF[F[2]];
    const xa = Math.min(A[0], B[0]),
      xb = Math.max(A[0], B[0]),
      X0 = Math.floor(xa);
    for (let X = X0; X < Math.ceil(xb); X++) {
      const tt = (X + 0.5 - A[0]) / (B[0] - A[0]),
        yb = Math.round(A[1] + (B[1] - A[1]) * tt) - 1,
        edge = X === X0,
        mid = Math.abs(X + 0.5 - (xa + xb) / 2) < (xb - xa) * 0.36;
      for (let z = 0; z < zt; z++) {
        let c = (X - X0) % 2 === 1 ? f.s : f.b;
        if (edge) c = f.e;
        if (z % 10 === 9 && !edge) c = f.b;
        if (z % 20 === 19) c = f.br;
        else if (z % 20 === 18) c = f.d;
        if (z < 8 && mid && F[2] < 2) c = z === 7 ? f.br : z === 6 ? f.d : "#1f1612";
        fp(X, yb - z, c);
      }
    }
  }
  // crown: closed flat bronze cap with a lit rim (no open hollow)
  poly(
    V.map((v) => P(v[0], v[1], zt)),
    "#94735c",
  );
  poly(
    V.map((v) => P(x + (v[0] - x) * 0.72, y + (v[1] - y) * 0.72, zt)),
    "#7a5f4d",
  );
}
// cores sit in the front-left (towers 3|4) and front-right (towers 1|2) gaps; the front-left one is drawn after the back pod and before the front pod of its gap, so the front pod rim overlaps the shaft; the front-right one sorts by its own position
const gk = (a: number, b: number) => (TW[a].cx + TW[a].cy + TW[b].cx + TW[b].cy) / 2;
const CORES = [
  { x: 53.2, y: 47.6, z: 49, k: gk(3, 4) },
  { x: 72.6, y: 40.2, z: 49, k: 72.6 + 40.2 },
];
type Job = { k: number; f: () => void };
function cluster() {
  // shaded undercroft + atrium floor under the ring
  for (let z = 0; z < 9; z++) cols(CX0, CY0, 15.5, (X, u, yo, cy) => fp(X, Math.round(cy - z + yo), z >= 7 ? K.soffit : "#2f2622"));
  cols(CX0, CY0, 15.5, (X, u, yo, cy) => {
    const y0 = Math.round(cy - 9 - yo),
      y1 = Math.round(cy - 9 + yo);
    for (let Y = y0; Y < y1; Y++) fp(X, Y, (X + Y) % 2 ? "#9a948a" : "#928c82");
  });
  const L: Job[] = [];
  TW.forEach((t) => L.push({ k: t.cx + t.cy, f: () => tower(t) }));
  CORES.forEach((c) => L.push({ k: c.k, f: () => core(c.x, c.y, c.z) }));
  L.sort((a, b) => a.k - b.k);
  L.forEach((e) => e.f());
}

// ---------- ground (painted per pixel from the world plan) ----------

function eR(x: number, y: number) {
  const a = (x - CX0) / 40,
    b = (y - CY0) / 34;
  return Math.sqrt(a * a + b * b);
}
const RGB: Record<string, [number, number, number]> = {};
function rgb(h: string) {
  if (!RGB[h]) RGB[h] = [parseInt(h.substring(1, 3), 16), parseInt(h.substring(3, 5), 16), parseInt(h.substring(5, 7), 16)];
  return RGB[h];
}
function groundAt(x: number, y: number) {
  const e = eR(x, y);
  const path = x >= 41 && x < 46;
  if (e < 0.835) return (Math.floor(x / 4) + Math.floor(y / 4)) & 1 ? K.plaza2 : K.plaza;
  if (e < 0.86) return K.kerb;
  if (e < 1.0) {
    if (path && y > 40) return Math.floor(x * 1.25) % 2 ? K.mark : K.road;
    const an = Math.atan2((y - CY0) / 34, (x - CX0) / 40);
    if (Math.abs(e - 0.93) < 0.008 && Math.floor(((an + Math.PI) * 14) / Math.PI) % 2) return K.mark;
    return K.road;
  }
  if (x >= 84 && y >= 44 && y < 50) return y >= 46.8 && y < 47.3 && Math.floor(x / 3) % 2 ? K.mark : K.road;
  if (x >= 84 && ((y >= 43 && y < 44) || (y >= 50 && y < 51))) return K.curb;
  if (e < 1.025) return K.curb;
  if (path) return Math.floor(y / 2) % 2 ? K.pave : K.pave2;
  if (x >= 40 && x < 47) return K.curb;
  return hsh(Math.floor(x * 1.5), Math.floor(y * 1.5)) < 0.18 ? K.grass2 : K.grass;
}
function paintGround() {
  const g = p.g,
    d = g.getImageData(0, 0, W, H);
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      const a = (X + 0.5 - p.ox) / 2,
        b = Y + 0.5 - p.oy,
        x = (a + b) / 2,
        y = (b - a) / 2;
      if (x < 0.3 || x > 99.7 || y < 0.3 || y > 67.7) continue;
      const c = rgb(groundAt(x, y)),
        i = (Y * W + X) * 4;
      d.data[i] = c[0];
      d.data[i + 1] = c[1];
      d.data[i + 2] = c[2];
      d.data[i + 3] = 255;
    }
  g.putImageData(d, 0, 0);
}

// ---------- props ----------

const S0: Point3 = [45.6, 52.9, 4],
  PLINTH = { x: 43.6, y: 51.8, w: 8, d: 2.2, h: 4 };
const GROUP = [
  [26.6, 39.4, 0],
  [29.9, 39.9, 1],
  [26.4, 42.6, 2],
  [29.7, 43.0, 3],
];
function props() {
  const Q = PLINTH,
    x1 = Q.x + Q.w,
    y1 = Q.y + Q.d;
  p.tp(x1, Q.y + 0.4, x1 + 0.55, y1 + 0.4, 0, SHC);
  p.tp(Q.x + 0.4, y1, x1 + 0.55, y1 + 0.45, 0, SHC);
  p.box(Q.x, Q.y, 0, Q.w, Q.d, Q.h, ["#f6f3ec", "#d9d2c4", "#a39b8e"]);
  p.fl(Q.x, x1, y1, 0, 0.8, "#8f887c");
  p.fr(Q.y, y1, x1, 0, 0.8, "#7c766c");
  p.wl([Q.x, y1, Q.h], [x1, y1, Q.h], "#fffdf8");
  // book stack on the kerb, touching the figure's feet (gold accent)
  const bx = S0[0] + 1.9,
    by = S0[1] - 1.2,
    bz = Q.h;
  p.box(bx, by, bz, 2.4, 1.5, 1, ["#f3efe6", K.w1, K.g2]);
  p.box(bx + 0.2, by + 0.1, bz + 1, 2, 1.3, 1, [K.pL, K.pM, K.pD]);
  p.box(bx, by, bz + 2, 2.3, 1.4, 1.2, [K.gL, K.gM, K.gD]);
  p.fl(bx + 0.3, bx + 2, by + 1.4, bz + 2.3, bz + 2.8, "#fff4d6");
  GROUP.forEach((q) => {
    const a = P(q[0], q[1], 0);
    p.blit(S.FSH, a[0], a[1]);
  });
  GROUP.forEach((q) => {
    const a = P(q[0], q[1], 0);
    p.blit(S.GRP[q[2]], a[0], a[1]);
  });
  // low planters on the plaza
  [
    [22, 27, 2, 6],
    [79, 24, 2, 6],
    [57, 51.5, 5, 1.6],
    [30, 45, 4, 1.6],
    [70, 47.5, 4, 1.6],
  ].forEach((q) => {
    p.box(q[0], q[1], 0, q[2], q[3], 2, [K.grass, "#dcd6cb", "#b7b0a4"]);
    for (let a = 0; a < q[2] * q[3]; a += 2.5) {
      const b = P(q[0] + 0.8 + (a % q[2]), q[1] + 0.6 + Math.floor(a / q[2]) * 1.2, 2);
      p.blit(S.BUSH[2], b[0], b[1] + 1);
    }
  });
}
const LAMPS = [
  [18, 50.5],
  [30, 58.5],
  [62, 61],
  [78, 56],
  [90, 44],
  [92, 22],
  [12, 36],
  [39, 56],
  [66, 52.5],
  [24, 22],
];

// ---------- layers (built in init) ----------

let LA: HTMLCanvasElement, LB: HTMLCanvasElement, LC: HTMLCanvasElement;
let GL: HTMLCanvasElement[] = [];
let OCC: Uint8Array | null = null;

function cylShadow(cx: number, cy: number, r: number, h: number) {
  const a = 0.34 * h,
    b = 0.07 * h,
    pts: Point[] = [];
  for (let i = 0; i < 16; i++) {
    const t = (i * Math.PI) / 8;
    pts.push(P(cx + r * Math.cos(t), cy + r * Math.sin(t), 0));
    pts.push(P(cx + a + r * Math.cos(t), cy + b + r * Math.sin(t), 0));
  }
  p.poly(p.hull(pts), "#000");
}

function buildLayers(mk: Engine["mk"]) {
  const mask = p.on(mk(W, H));
  p.tp(0, 0, 100, 68, 0, "#000");
  const sh = p.on(mk(W, H));
  TW.forEach((t) => {
    const b = stor(t, t.n - 1);
    cylShadow(t.cx, t.cy, b.r, topZ(t) + 2);
  });
  CORES.forEach((c) => cylShadow(c.x, c.y, CORE_R, c.z));
  p.shadow(PLINTH.x, PLINTH.y, PLINTH.w, PLINTH.d, PLINTH.h);
  p.g.globalCompositeOperation = "destination-in";
  p.g.drawImage(mask, 0, 0);
  p.g.globalCompositeOperation = "source-over";
  LA = p.on(mk(W, H));
  p.tp(0, 0, 100, 68, 0, K.grass);
  p.fl(0, 100, 68, -7, 0, K.slabL);
  p.fr(0, 68, 100, -7, 0, K.slabR);
  p.fl(0, 100, 68, -1, 0, K.grassS);
  p.fr(0, 68, 100, -1, 0, "#6f9450");
  p.fr(44, 50, 100, -1, 0, "#77747f");
  paintGround();
  p.g.globalAlpha = 0.21;
  p.g.drawImage(sh, 0, 0);
  p.g.globalAlpha = 1;
  LC = p.on(mk(W, H));
  cluster();
  // id pass: same geometry, seams tagged by storey -> per-storey glow layers
  p.on(mk(W, H));
  ID = true;
  try {
    cluster();
  } finally {
    ID = false;
  }
  const d = p.g.getImageData(0, 0, W, H).data;
  GL = [];
  for (let s = 1; s < 8; s++) {
    const gc = mk(W, H),
      gg = gc.getContext("2d");
    if (!gg) continue;
    const im = gg.createImageData(W, H),
      q = im.data;
    for (let k = 0; k < d.length; k += 4) {
      if (d[k] === s && d[k + 1] > 200 && d[k + 2] === 0) {
        const c = rgb(d[k + 1] === 202 ? K.glowS : d[k + 1] === 203 ? K.glowB : K.glow);
        q[k] = c[0];
        q[k + 1] = c[1];
        q[k + 2] = c[2];
        q[k + 3] = 255;
      }
    }
    gg.putImageData(im, 0, 0);
    GL[s] = gc;
  }
  LB = p.on(mk(W, H));
  props();
}

// ---------- timing ----------

function topPt(i: number, f: number): Point3 {
  const t = TW[i],
    b = stor(t, t.n - 1);
  return [b.x + b.r * f, b.y + b.r * f, topZ(t)];
}
/** A point on tower i's top roof at angle deg (0 = +x, 90 = +y), at share f of the radius. */
function roofPt(i: number, deg: number, f: number): Point3 {
  const t = TW[i],
    b = stor(t, t.n - 1),
    a = (deg * Math.PI) / 180;
  return [b.x + b.r * f * Math.cos(a), b.y + b.r * f * Math.sin(a), topZ(t)];
}
// L2: front-left of the top roof (75° on the rim) so the trophy (front-right, 10°) is never crossed by the arriving arc
const L1 = topPt(3, 0.5),
  L2 = roofPt(9, 75, 0.65);
const arc = (a: Point3, b: Point3, q: number, h: number): Point3 => [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q + h * 4 * q * (1 - q)];
const jpose = (q: number) => (q < 0.16 ? "launch" : q < 0.44 ? "up" : q < 0.72 ? "tuck" : "reach");
const lerp3 = (a: Point3, b: Point3, q: number): Point3 => [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q];
const wk = (t: number) => (Math.floor(t * 8) % 2 ? "walkA" : "walkB");
// START sits back on the footpath, left of the car's screen path, so the passing car is never hidden behind the figure;
// W1, W2: the far end of the zebra, then the foot of the kerb plinth. D: when the two jumps start (they keep their old timing).
const START: Point3 = [45.5, 67.5, 0],
  W1: Point3 = [43.5, 55.3, 0],
  W2: Point3 = [45.6, 55.3, 0],
  D = 2.7,
  GO = 0.85;
const REST = roofPt(9, 10, 0.6);
// pick spot: 7 px left of the trophy on the same screen row, so the pickF right hand lands on the trophy's left handle
const FP: Point3 = [REST[0] - 1.75, REST[1] + 1.75, REST[2]];
/** tro: where the trophy is (resting on the roof, being picked up, lifted to the chest, held overhead). */
type Hero = { p: Point3; pose: string; tro: "rest" | "pick" | "lift" | "over"; out: number; inn: number; air?: number; tk?: number; bump?: boolean };
function hero(t: number): Hero {
  const r: Hero = { p: START, pose: "backS", tro: "rest", out: 1, inn: 0 },
    u = t - D;
  if (t < GO) {
    // waiting on the far kerb while the car passes
  } else if (t < 2.2) {
    r.p = lerp3(START, W1, seg(t, GO, 2.2));
    r.pose = wk(t);
  } else if (t < 2.4) {
    r.p = lerp3(W1, W2, seg(t, 2.2, 2.4));
    r.pose = wk(t);
  } else if (t < 2.52) {
    r.p = W2;
    r.pose = "crouch";
  } else if (t < 2.8) {
    const h0 = seg(t, 2.52, 2.8);
    r.p = arc(W2, S0, h0, 5);
    r.pose = h0 < 0.5 ? "up" : "reach";
    r.air = 1;
  } else if (t < 2.9) {
    r.p = S0;
    r.pose = "land";
  } else if (t < 3.0) {
    r.p = S0;
  } else if (u < 0.72) {
    r.p = S0;
    r.pose = u < 0.5 ? "crouch" : "squash";
  } else if (u < 1.32) {
    const q = seg(u, 0.72, 1.32);
    r.p = arc(S0, L1, q, 22);
    r.pose = jpose(q);
    r.air = 1;
  } else if (u < 1.46) {
    r.p = L1;
    r.pose = "land";
  } else if (u < 1.62) {
    r.p = L1;
    r.pose = "backS";
  } else if (u < 1.92) {
    r.p = L1;
    r.pose = u < 1.76 ? "crouch" : "squash";
  } else if (u < 2.6) {
    const q = seg(u, 1.92, 2.6);
    r.p = arc(L1, L2, q, 20);
    r.pose = jpose(q);
    r.air = 1;
  } else if (u < 2.72) {
    r.p = L2;
    r.pose = "land";
  } else if (t < 5.5) {
    r.p = L2;
    r.pose = "stand";
  } else if (t < 5.75) {
    r.p = lerp3(L2, FP, seg(t, 5.5, 5.75));
    r.pose = wk(t);
  } else {
    r.p = FP;
    if (t < 5.88) {
      r.pose = "pickF";
      r.tro = "pick";
      r.tk = seg(t, 5.77, 5.83);
    } else if (t < 6.0) {
      r.pose = "liftF";
      r.tro = "lift";
    } else {
      r.pose = "cheer";
      r.tro = "over";
      r.bump = t < 6.08;
      if (t >= 8.1) r.out = 1 - seg(t, 8.1, 8.75);
    }
  }
  r.inn = t >= 8.1 ? seg(t, 8.1, 8.75) : 0;
  return r;
}
function lit(t: number) {
  if (t < 6.0) return 0;
  if (t < 7.3) return Math.min(7, 1 + Math.floor(7 * seg(t, 6.0, 7.3)));
  if (t < 8.0) return 7;
  if (t < 8.5) return Math.ceil(7 * (1 - seg(t, 8.0, 8.5)));
  return 0;
}
function surfZ(x: number, y: number) {
  let z = -1;
  TW.forEach((t) => {
    const b = stor(t, t.n - 1),
      dx = x - b.x,
      dy = y - b.y;
    if (dx * dx + dy * dy < (b.r - 0.4) * (b.r - 0.4)) z = Math.max(z, topZ(t));
  });
  if (x >= PLINTH.x && x <= PLINTH.x + PLINTH.w && y >= PLINTH.y && y <= PLINTH.y + PLINTH.d) z = Math.max(z, PLINTH.h);
  return z;
}

// ambient: cars on the ring road (one lap per loop), walkers, swaying trees
type Car = { e: number; dir: number; ph: number; c: number; bus?: number };
const CARS: Car[] = [
  { e: 0.905, dir: 1, ph: 0.2267, c: 0 },
  { e: 0.905, dir: 1, ph: 0.6767, c: 2 },
  { e: 0.958, dir: -1, ph: 0.6745, c: 1 },
  { e: 0.958, dir: -1, ph: 0.1189, c: 3, bus: 1 },
];
type CarPos = { x: number; y: number; ax: boolean; m: Car };
function carAt(m: Car, t: number): CarPos {
  const a = 2 * Math.PI * (m.ph + (m.dir * t) / T),
    x = CX0 + 40 * m.e * Math.cos(a),
    y = CY0 + 34 * m.e * Math.sin(a),
    tx = -40 * Math.sin(a),
    ty = 34 * Math.cos(a);
  return { x, y, ax: Math.abs(tx) > Math.abs(ty), m };
}
const PEDS: { c: number; k: [number, number, number][] }[] = [
  {
    c: 0,
    k: [
      [2.55, 43.5, 68.6],
      [4.0, 43.5, 61.8],
      [4.6, 43.6, 56.4],
      [5.2, 46.2, 55.2],
      [7.7, 63.5, 50.6],
      [8.4, 66.5, 46.6],
    ],
  },
  {
    c: 3,
    k: [
      [3.2, 61, 49.6],
      [4.8, 56.6, 53],
      [5.8, 46.6, 55.8],
      [6.2, 44.6, 56.6],
      [6.9, 44.6, 62.4],
      [7.9, 44.6, 68.6],
    ],
  },
  {
    c: 6,
    k: [
      [0, 81.5, 37],
      [4.65, 74.8, 45.2],
      [5.4, 74.8, 45.2],
      [9, 81.5, 37],
    ],
  },
  {
    c: 5,
    k: [
      [0, 26, 35],
      [4.5, 31.5, 47],
      [9, 26, 35],
    ],
  },
  {
    c: 2,
    k: [
      [2.25, 99.6, 46.2],
      [8.25, 88.5, 46.2],
    ],
  },
  {
    c: 0,
    k: [
      [0, 76.4, 43.6],
      [9, 76.4, 43.6],
    ],
  },
];
const TREES = [
  [4, 14, 0],
  [5, 30, 1],
  [3, 38, 1],
  [6, 47, 0],
  [9, 54, 1],
  [13, 58.5, 0],
  [19, 62, 1],
  [25, 64.5, 1],
  [34, 66, 1],
  [52, 66.8, 1],
  [57.5, 67.4, 0],
  [70, 65.5, 0],
  [78, 64.5, 1],
  [84, 62, 1],
  [92, 56, 0],
  [97, 53, 1],
  [96.5, 36, 1],
  [97, 27, 1],
  [95.5, 15, 0],
  [92, 6, 1],
  [86, 3, 1],
  [18, 6, 1],
  [8, 4, 1],
];

// ---------- frame ----------

function occ() {
  if (!OCC) {
    const o = new Uint8Array(W * H);
    for (const c of [LC, LB]) {
      const d = c.getContext("2d")?.getImageData(0, 0, W, H).data;
      if (d) for (let i = 0; i < W * H; i++) if (d[i * 4 + 3]) o[i] = 1;
    }
    OCC = o;
  }
  return OCC;
}
function airShadow(q: Point3, sz: number, mask: boolean) {
  const a = P(q[0], q[1], Math.max(0, sz)),
    cx = Math.round(a[0]),
    cy = Math.round(a[1]),
    hg = q[2] - Math.max(0, sz),
    w = Math.max(7, 11 - Math.round(hg / 10)),
    o = mask ? occ() : null;
  if (ID) return;
  p.g.fillStyle = "rgba(43,34,51,0.55)";
  for (let r = -1; r <= 1; r++) {
    const hw = r ? Math.floor(w / 2) - 2 : Math.floor(w / 2),
      Y = cy + r;
    for (let x = -hw; x <= hw; x++) {
      const X = cx + x;
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      if (o && o[Y * W + X]) continue;
      p.g.fillRect(X, Y, 1, 1);
    }
  }
}
function drawFig(h: Hero, t: number) {
  const q = h.p,
    f = P(q[0], q[1], q[2]),
    s = S.FS[h.pose];
  const sz = surfZ(q[0], q[1]);
  if (h.air) {
    if (sz >= 0) {
      if (q[2] >= sz - 1) airShadow(q, sz, false);
    } else airShadow(q, 0, true);
  } else if (h.out > 0.5) p.blit(S.FSH, f[0], f[1]);
  const fig = h.pose === "cheer" ? fade(S.FS.cheer, S.STANDF, h.out) : s;
  const fx = Math.round(f[0]),
    fy = Math.round(f[1]);
  let tb: Point | null = null;
  // pick: the trophy stays where it rests and rises 1 px in the hand (drawn under the figure so the hand shows on the handle)
  if (h.tro === "pick") {
    const R0 = P(REST[0], REST[1], REST[2]);
    p.blit(S.TRO, R0[0], R0[1] - ((h.tk ?? 0) >= 0.5 ? 1 : 0));
  }
  if (fig) p.blit(fig, f[0], f[1]);
  if (h.tro === "lift") tb = [fx, fy - 11];
  else if (h.tro === "over") tb = [fx, fy - 14 - (h.bump ? 1 : 0)];
  if (tb) {
    const ts = fade(S.TRO, S.TROF, h.out);
    if (ts) p.blit(ts, tb[0], tb[1]);
  }
  if (h.tro === "over" && h.out >= 1) {
    if (t >= 6.0 && t < 6.3) {
      const cy = fy - 19,
        ph = t < 6.15;
      [
        [-7, 0],
        [7, 0],
        [-5, -5],
        [5, -5],
        [0, -8],
      ].forEach((o, i) => {
        if (ph || i % 2) p.px(fx + Math.round(o[0] * (ph ? 1 : 1.3)), cy + Math.round(o[1] * (ph ? 1 : 1.3)), K.gM);
      });
    }
    const tw = mod(t, 0.9);
    if (t >= 6.4 && tw >= 0.2 && tw < 0.32) star(fx + 3, fy - 21, false);
  }
}
/** A four-point glint: white core, light-gold arms (and mid-gold tips when big). */
function star(x: number, y: number, big: boolean) {
  p.px(x, y, "#ffffff");
  p.px(x - 1, y, K.gL);
  p.px(x + 1, y, K.gL);
  p.px(x, y - 1, K.gL);
  p.px(x, y + 1, K.gL);
  if (big) {
    p.px(x - 2, y, K.gM);
    p.px(x + 2, y, K.gM);
    p.px(x, y - 2, K.gM);
    p.px(x, y + 2, K.gM);
  }
}
/** The trophy resting on the top roof, faded in by lv on the way back to the start; it glints every 1.5 s. */
function drawRest(lv: number, t: number) {
  const s = fade(S.TRO, S.TROF, lv),
    q = P(REST[0], REST[1], REST[2]);
  if (!s) return;
  if (lv >= 1) {
    p.g.fillStyle = SHC;
    p.g.fillRect(Math.round(q[0]) - 2, Math.round(q[1]) - 1, 7, 1);
  }
  p.blit(s, q[0], q[1]);
  const tw = mod(t, 1.5);
  if (lv >= 1 && tw >= 0.3 && tw < 0.42) star(Math.round(q[0]) + 2, Math.round(q[1]) - 8, true);
}
function treeAt(q: number[], i: number, tv: number) {
  const a = P(q[0], q[1], 0),
    tr = q[2] ? S.TREE_B : S.RAIN,
    sw = Math.sin(2 * Math.PI * (tv / 3) + i * 1.7) > 0.55 ? 1 : 0;
  p.blit(S.TSH, a[0], a[1]);
  p.blit(tr.tr, a[0], a[1]);
  p.blit(tr.can, a[0] + sw, a[1]);
}
function drawCar(q: CarPos) {
  const m = q.m;
  if (m.bus) {
    const a = P(q.x - (q.ax ? 4 : 1), q.y - (q.ax ? 1 : 4), 0);
    p.blit(q.ax ? S.BUS : S.CY[m.c], a[0], a[1]);
    return;
  }
  const a = P(q.x - (q.ax ? 2 : 1), q.y - (q.ax ? 1 : 2), 0);
  p.blit(q.ax ? S.CX[m.c] : S.CY[m.c], a[0], a[1]);
}
const lampAt = (q: number[]) => {
  const a = P(q[0], q[1], 0);
  p.blit(S.LAMP, a[0], a[1]);
};

function draw(ctx: CanvasRenderingContext2D, t: number, engine: Engine) {
  p = engine.p;
  p.g = ctx;
  p.ox = OX0;
  p.oy = OY0;
  const g = ctx;
  g.drawImage(LA, 0, 0);
  const tv = mod(t + 0.0123, T),
    h = hero(t),
    L: Job[] = [];
  const cars = CARS.map((m) => carAt(m, tv)).filter((q) => q.x > 2 && q.x < 98 && q.y > 2 && q.y < 66);
  cars.forEach((q) => {
    if (q.x + q.y < 72) drawCar(q);
  });
  const BK: Job[] = [];
  TREES.forEach((q, i) => {
    if (q[0] + q[1] < 72) BK.push({ k: q[0] + q[1], f: () => treeAt(q, i, tv) });
  });
  LAMPS.forEach((q) => {
    if (q[0] + q[1] < 72) BK.push({ k: q[0] + q[1], f: () => lampAt(q) });
  });
  BK.sort((a, b) => a.k - b.k);
  BK.forEach((e) => e.f());
  g.drawImage(LC, 0, 0);
  const n = lit(t);
  for (let k = 1; k <= n; k++) if (GL[k]) g.drawImage(GL[k], 0, 0);
  g.drawImage(LB, 0, 0);
  cars.forEach((q) => {
    if (q.x + q.y >= 72) L.push({ k: q.x + q.y, f: () => drawCar(q) });
  });
  TREES.forEach((q, i) => {
    if (q[0] + q[1] >= 72) L.push({ k: q[0] + q[1], f: () => treeAt(q, i, tv) });
  });
  LAMPS.forEach((q) => {
    if (q[0] + q[1] >= 72) L.push({ k: q[0] + q[1], f: () => lampAt(q) });
  });
  PEDS.forEach((pd) => {
    const q = keyframes(pd.k, tv, T);
    if (!q) return;
    L.push({
      k: q.x + q.y,
      f: () => {
        const a = P(q.x, q.y, 0);
        p.blit(S.PED[pd.c][q.f], a[0], a[1]);
      },
    });
  });
  // on the ground or the kerb the figure sorts with the street; up on the roofs it draws last
  const low = !h.air && h.p[2] <= 4.5;
  if (h.tro === "rest" || h.inn > 0) L.push({ k: 1e9 - 1, f: () => drawRest(h.tro === "rest" ? 1 : h.inn, t) });
  if (h.inn > 0)
    L.push({
      k: START[0] + START[1] + 0.5,
      f: () => {
        // the next loop's figure fading in at the start
        const b = fade(S.FS.backS, S.BACKF, h.inn),
          q = P(START[0], START[1], START[2]);
        if (h.inn > 0.5) p.blit(S.FSH, q[0], q[1]);
        if (b) p.blit(b, q[0], q[1]);
      },
    });
  L.push({ k: low ? h.p[0] + h.p[1] + 0.5 : 1e9, f: () => drawFig(h, t) });
  L.sort((a, b) => a.k - b.k);
  L.forEach((e) => e.f());
}

// ---------- anchors ----------

/** The projection at the scene's origin, for anchors (no canvas needed). */
const proj = (a: Point3): Point => [OX0 + 2 * (a[0] - a[1]), OY0 + a[0] + a[1] - a[2]];
// card 1 points at the tallest open roof terrace (tower 8), reached from the sky on the left so the leader crosses no tower
const A1: Point3 = [TW[8].cx - 6, TW[8].cy + 2.7, topZ(TW[8])];
// card 2 points at the group of recent graduates on the plaza
const A2: Point3 = [28.15, 41.2, 5];
// card 3 points at the top of the book stack on the kerb plinth
const A3: Point3 = [48.65, 52.4, 7.2];
const ANCHORS: Record<PinKey, Point> = { "1": proj(A1), "2": proj(A2), "3": proj(A3) };

export const study: SceneModule = {
  logicalW: W,
  logicalH: H,
  period: T,
  // the trophy held overhead with every storey lit
  finalT: 7.6,
  origin: [OX0, OY0],
  anchors: ANCHORS,
  // the prototype's FOC [177, 138] and CH 160
  crop: { x: 97, y: 58, w: 160, h: 160 },
  pinOffsets: { "1": [-20, 5], "2": [-26, -22], "3": [14, 14] },
  // pin 3 drops below the plinth to beside card 3, so it never covers the books it names
  overlayPinOffsets: { "2": [-26, -22], "3": [2, 114] },
  // Cards 1 and 2 sit higher and lower than the prototype's (y 12 and 66): with the receipts chip on its own row the
  // site's cards are about 106 CSS px tall against 96, and at those places they nearly touched.
  cards: { "1": { x: 0, y: 6 }, "2": { x: 0, y: 68 }, "3": { x: 0, y: 232 } },
  cardWidth: 240,
  label: msg(
    "Pixel diorama of a learning hub of stacked rounded towers round an open atrium: a student waits at the kerb while a car passes, crosses the zebra, hops onto a stone kerb beside a stack of books, leaps onto a front tower, then onto the tallest planted roof, lifts a gold trophy overhead and the storeys light up floor by floor while students walk the plaza and cars circle the drop-off road.",
  ),
  init(engine) {
    p = engine.p;
    const g0 = p.g;
    p.ox = OX0;
    p.oy = OY0;
    SIL = new WeakMap();
    OCC = null;
    S = buildSprites();
    buildLayers(engine.mk);
    p.g = g0;
  },
  draw,
};

export default study;
