import { DRAFT } from "@/content/draft";
import { BASE, SHADOW, keyframes, mod, ocu, seg, type Engine, type Painter, type Point, type SceneModule, type Sprite, type Tones } from "@/components/landing/roads/engine";

// The skill levels' picture (components/careers/SkillLevels; 2026-11-02): an isometric pixel pyramid in the
// roads' style (the /move scenes' engine, palette and student), six tiers from level 1 at the base to level 6
// at the top, each numbered on its front. Story (12 s loop): the tiers drop in one by one, lightest first; the
// student walks up to the base and hops up a tier at a time; a flag pops on the top. Reduced motion shows the
// final frame (built, the student on top, the flag up). 1 world unit = 2px across / 1px down; z in px.

const W = 240,
  H = 192,
  T = 12,
  OX0 = 120,
  OY0 = 54;

/** Level 1 (base, lightest) to level 6 (top, the brand's deep purple): top, left face, right face. */
const TIERS: Tones[] = [
  ["#efe9fc", "#dcd2f6", "#c6b8ed"],
  ["#ddd2f7", "#c7b8ef", "#ad9ae3"],
  ["#c9b8f0", "#b29ae0", "#9579cf"],
  ["#a98ddf", "#8f6fcf", "#7552b6"],
  ["#8a63cf", "#6f45b6", "#55309a"],
  ["#6b3fb8", "#5f2ea0", "#391763"],
];
/** The ground slab x, y 0..60; the pyramid's base 10..50; each tier steps in by STEP on every side. */
const SLAB = 60,
  BASE0 = 10,
  SIDE = 40,
  STEP = 3,
  TZ = 11;
const tier = (i: number) => ({ x: BASE0 + STEP * i, y: BASE0 + STEP * i, s: SIDE - 2 * STEP * i, z: TZ * i });

/** When each tier lands (s), and how long its drop takes. */
const DROP = (i: number) => 0.2 + 0.32 * i,
  DROP_T = 0.42;
/** The student: walks in, then one hop per tier; the flag after the last. */
const WALK = [2.4, 3.4],
  HOP0 = 3.5,
  HOP = 0.62,
  REST = 0.2,
  FLAG = HOP0 + 6 * (HOP + REST) + 0.1;

/** 3 × 5 digits, for the tier numbers. */
const DIGITS: Record<number, string[]> = {
  1: [".d.", "dd.", ".d.", ".d.", "ddd"],
  2: ["dd.", "..d", ".d.", "d..", "ddd"],
  3: ["dd.", "..d", ".d.", "..d", "dd."],
  4: ["d.d", "d.d", "ddd", "..d", "..d"],
  5: ["ddd", "d..", "dd.", "..d", "dd."],
  6: [".dd", "d..", "dd.", "d.d", ".d."],
};

/** Where the student stands: the front corner of a tier's top (or the ground in front of the base). */
function spot(i: number): [number, number, number] {
  if (i < 0) return [BASE0 + SIDE + 4, BASE0 + SIDE + 4, 0];
  const t = tier(i);
  return [t.x + t.s - 3, t.y + t.s - 3, t.z + TZ];
}

function build(p: Painter, mk: Engine["mk"]) {
  const { on, P, poly, fl, fr, tp, box, shadow, contact, sprite, blit, pix } = p;

  // ---------- sprites ----------
  const TREE = pix(["..aa...", ".aaabb.", "aaabbbc", ".abbbcc", "..bcc..", "...t..."], { a: BASE.tL, b: BASE.tM, c: BASE.tD, t: BASE.trunk });
  const FIGMAP = { h: "#2b2233", s: "#f1c6a0", p: "#7a4fc4", q: "#5f2ea0", d: "#2f3447", k: "#1f1a2b", w: "#ffffff" };
  const HD = ["...hhh...", "..hhhhh..", "..hssss..", "..sksks..", "...sss..."];
  const TOR = ["..ppppp..", ".qpppppq.", ".qpppppq.", ".qpppppq.", ".s.ppp.s.", "..ddddd.."];
  const FIG: Record<string, string[]> = {
    stand: HD.concat(TOR, ["..dd.dd..", "..dd.dd..", "..kk.kk.."]),
    walkA: HD.concat(TOR, [".dd...dd.", ".dd...dd.", ".kk...kk."]),
    walkB: HD.concat(TOR, ["...ddd...", "...ddd...", "...kkk..."]),
    cheer: ["s.......s", "s.hhh...s", ".shhhhhs.", "..hssss..", "..sksks..", "...sss...", "..ppppp..", ".qpppppq.", ".qpppppq.", "..ppppp..", "..ddddd..", "..dd.dd..", "..dd.dd..", "..kk.kk.."],
  };
  const FS: Record<string, Sprite> = {};
  for (const k of Object.keys(FIG)) FS[k] = pix(FIG[k], FIGMAP, BASE.ink);
  const FSH = sprite(14, 5, 7, 2, () => {
    p.g.fillStyle = SHADOW;
    p.g.fillRect(2, 1, 11, 1);
    p.g.fillRect(1, 2, 11, 1);
    p.g.fillRect(3, 3, 7, 1);
  });
  const FLAG_S = pix(["mffff", "mfffa", "mffaa", "mf...", "m....", "m....", "m....", "m....", "m...."], { m: BASE.g5, f: "#f0b03a", a: "#e3803a" }, BASE.ink);
  const NUM: Record<number, Sprite> = {};
  for (const n of [1, 2, 3, 4, 5, 6]) NUM[n] = pix(DIGITS[n], { d: n <= 3 ? BASE.pD : "#ffffff" });

  // ---------- ground (pre-drawn) ----------
  const GROUND = on(mk(W, H));
  tp(0, 0, SLAB, SLAB, 0, BASE.grass);
  for (let i = 0; i < SLAB; i += 6) for (let j = 0; j < SLAB; j += 6) if (((i + j) / 6) % 2) tp(i, j, i + 6, j + 6, 0, BASE.grass2);
  fl(0, SLAB, SLAB, -6, 0, BASE.slabL);
  fr(0, SLAB, SLAB, -6, 0, BASE.slabR);
  fl(0, SLAB, SLAB, -1, 0, BASE.grassS);
  fr(0, SLAB, SLAB, -1, 0, "#6f9450");
  // a paved way up to the base's front corner
  tp(BASE0 + SIDE, BASE0 + SIDE - 6, SLAB, BASE0 + SIDE, 0, BASE.pave);
  tp(BASE0 + SIDE - 6, BASE0 + SIDE, BASE0 + SIDE, SLAB, 0, BASE.pave);
  tp(BASE0 + SIDE, BASE0 + SIDE, SLAB, SLAB, 0, BASE.pave2);
  for (const q of [
    [4, 6],
    [6, 52],
    [52, 5],
  ] as const) {
    const s = P(q[0], q[1], 0);
    blit(TREE, s[0], s[1]);
  }
  // the built pyramid's cast shadow, to the lower right, kept on the slab's top (as the /move scenes do)
  const MASK = on(mk(W, H));
  tp(0, 0, SLAB, SLAB, 0, "#000");
  const SH = on(mk(W, H));
  shadow(BASE0, BASE0, SIDE, SIDE, 6 * TZ);
  p.g.globalCompositeOperation = "destination-in";
  p.g.drawImage(MASK, 0, 0);
  p.g.globalCompositeOperation = "source-over";
  const GROUND_SH = on(mk(W, H));
  p.g.drawImage(GROUND, 0, 0);
  p.g.globalAlpha = 0.18;
  p.g.drawImage(SH, 0, 0);
  p.g.globalAlpha = 1;

  function drawTier(i: number, dz: number) {
    const t = tier(i);
    box(t.x, t.y, t.z + dz, t.s, t.s, TZ, TIERS[i]);
    if (dz === 0) contact(t.x, t.y, t.s, t.s, t.z);
    // the level's number on the left face, near its front corner
    const n = P(t.x + t.s - 4, t.y + t.s, t.z + dz + 3);
    blit(NUM[i + 1], n[0] - 4, n[1] + 1);
    // a 1px light edge along the top's two front sides
    poly([P(t.x, t.y + t.s, t.z + dz + TZ), P(t.x + t.s, t.y + t.s, t.z + dz + TZ), P(t.x + t.s, t.y + t.s, t.z + dz + TZ - 1), P(t.x, t.y + t.s, t.z + dz + TZ - 1)], TIERS[i][0]);
  }

  /** The student at time t: where, which pose, how high off the spot. */
  function student(t: number): { x: number; y: number; z: number; pose: string } | null {
    if (t < WALK[0]) return null;
    if (t < WALK[1]) {
      const g = spot(-1),
        k = keyframes(
          [
            [WALK[0], SLAB + 2, SLAB - 2],
            [WALK[1], g[0], g[1]],
          ],
          t,
          T,
        );
      return k ? { x: k.x, y: k.y, z: 0, pose: k.f ? "walkA" : "walkB" } : null;
    }
    for (let i = 0; i < 6; i++) {
      const a = HOP0 + i * (HOP + REST);
      if (t < a) {
        const s = spot(i - 1);
        return { x: s[0], y: s[1], z: s[2], pose: "stand" };
      }
      if (t < a + HOP) {
        const u = (t - a) / HOP,
          from = spot(i - 1),
          to = spot(i);
        const e = ocu(u);
        return { x: from[0] + (to[0] - from[0]) * e, y: from[1] + (to[1] - from[1]) * e, z: from[2] + (to[2] - from[2]) * e + Math.round(8 * Math.sin(Math.PI * u)), pose: "walkA" };
      }
    }
    const top = spot(5);
    return { x: top[0], y: top[1], z: top[2], pose: t >= FLAG + 0.3 ? "cheer" : "stand" };
  }

  return function drawFrame(t: number) {
    const g = p.g;
    g.drawImage(GROUND_SH, 0, 0);
    for (let i = 0; i < 6; i++) {
      const u = seg(t, DROP(i), DROP(i) + DROP_T);
      if (u <= 0) break;
      drawTier(i, Math.round(40 * (1 - ocu(u))));
    }
    const s = student(t);
    if (s) {
      const fp = P(s.x, s.y, 0);
      if (s.z === 0 || s.pose !== "walkA") {
        const sh = P(s.x, s.y, s.z);
        blit(FSH, sh[0], sh[1]);
      }
      blit(FS[s.pose], fp[0], fp[1] - s.z);
    }
    if (t >= FLAG) {
      const top = tier(5),
        f = P(top.x + top.s / 2 - 1, top.y + top.s / 2 - 1, top.z + TZ),
        rise = Math.round(9 * (1 - ocu(seg(t, FLAG, FLAG + 0.4))));
      blit(FLAG_S, f[0] + 2, f[1] + rise);
    }
  };
}

const built = new WeakMap<Engine, (t: number) => void>();
const ready = (engine: Engine) => {
  let f = built.get(engine);
  if (!f) {
    f = build(engine.p, engine.mk);
    built.set(engine, f);
  }
  return f;
};

const at = (x: number, y: number, z: number): Point => [OX0 + 2 * (x - y), OY0 + x + y - z];
const TOP = spot(5);

export const levelsScene: SceneModule = {
  logicalW: W,
  logicalH: H,
  period: T,
  // built, the student on the top tier cheering, the flag up
  finalT: T - 0.4,
  origin: [OX0, OY0],
  whole: true,
  label: DRAFT.careers.levels.figure,
  anchors: { "1": at(BASE0, BASE0 + SIDE, 0), "2": at(...TOP), "3": at(SLAB, SLAB, 0) },
  init(engine: Engine) {
    ready(engine);
  },
  draw(ctx: CanvasRenderingContext2D, t: number, engine: Engine) {
    const f = ready(engine);
    engine.p.g = ctx;
    f(mod(t, T));
  },
};
