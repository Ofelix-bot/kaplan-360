// Kappy, the AI adviser's mascot, as pixel grids on a 64 x 96 canvas. Round parts (head, lens, bulb) are rasterised
// from circles and rounded rectangles, outlined, then shaded from the top-left; the claws, faces and chest icons are
// drawn by hand. "." is transparent; every other letter is a colour class in components/kappy/kappy.module.css.
// npm run kappy:sprite writes lib/kappy/sprite.json, which components/kappy/engine.ts draws.
export const W = 64, H = 96;
const grid = (w, h, fn) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y)).join(""));
/** Outline every filled pixel that touches an empty one (4-neighbours), keeping the rest. */
const outline = (g, keep = "") => g.map((row, y) => [...row].map((c, x) => {
  if (c === "." || keep.includes(c)) return c;
  const out = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (g[y + dy]?.[x + dx] ?? ".") === ".");
  return out ? "K" : c;
}).join(""));
/** Light from the top-left: >0 lit, <0 shaded. */
const lit = (nx, ny) => -(nx * 0.7071 + ny * 0.7071);

// ── head: shell, lens mount, amber ring with four screws, dark glass with a reflection ─────────────────────
export const HEAD = outline(grid(36, 36, (x, y) => {
  const dx = x + 0.5 - 18, dy = y + 0.5 - 18, d = Math.hypot(dx, dy);
  if (d > 18) return ".";
  const l = lit(dx / (d || 1), dy / (d || 1)), ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (d > 15) return l > 0.82 && d > 16 ? "h" : l > 0.35 ? "H" : l < -0.45 ? "D" : "B";
  if (d > 14) return "K";
  if (d > 10.2) {
    const screw = [45, 135, -45, -135].some((s) => Math.abs(ang - s) < 7) && d > 11.4 && d < 13;
    if (screw) return "q";
    return l > 0.45 ? "Y" : l < -0.35 ? "a" : "A";
  }
  if (d > 9.2) return "K";
  if (d > 7.1 && d <= 7.9) return "g";
  if (d > 5.6 && d <= 7.1 && ang > -165 && ang < -110) return "R";
  return "G";
}));

// ── iris (moves inside the glass) ────────────────────────────────────────────────────────────────────────
export const PUPIL = grid(10, 10, (x, y) => {
  const d = Math.hypot(x + 0.5 - 5, y + 0.5 - 5);
  return d > 5 ? "." : d <= 1.7 ? "P" : d <= 3.1 ? "I" : d <= 4.2 ? "J" : "j";
});
export const GLINT = ["WW", "W."];

// ── body: rounded box, chest screen, status light, vents ─────────────────────────────────────────────────
const inRound = (x, y, w, h, r) => {
  const px = x + 0.5, py = y + 0.5;
  const cx = Math.min(Math.max(px, r), w - r), cy = Math.min(Math.max(py, r), h - r);
  return Math.hypot(px - cx, py - cy) <= r;
};
export const BODY = (() => {
  const w = 30, h = 26;
  let g = grid(w, h, (x, y) => {
    if (!inRound(x, y, w, h, 7)) return ".";
    if (x >= 5 && x <= 24 && y >= 7 && y <= 20) {
      if (!inRound(x - 5, y - 7, 20, 14, 2.6)) return "B";
      if (x === 5 || x === 24 || y === 7 || y === 20 || !inRound(x - 6, y - 8, 18, 12, 2)) return "K";
      return (x - 6) + (y - 8) < 3 ? "s" : "S";
    }
    if (y === 22 && ((x >= 11 && x <= 13) || (x >= 16 && x <= 18))) return "D";
    if ((x === 3 || x === 4) && (y === 9 || y === 10)) return x === 3 && y === 9 ? "Y" : "A";
    if (x <= 2 || y <= 2) return x + y <= 6 ? "h" : "H";
    if (x >= 27 || y >= 23) return "D";
    return "B";
  });
  return outline(g, "KsSYA");
})();

// ── claws: a hand-drawn round pincer (a disc with a slot on top) on a short arm ────────────────────────────
const DISC = ["...XX..XX...", "..XXX..XXX..", ".XXXX..XXXX.", ".XXXXXXXXXX.", "XXXXXXXXXXXX", "XXXXXXXXXXXX", "XXXXXXXXXXXX", "XXXXXXXXXXXX", ".XXXXXXXXXX.", ".XXXXXXXXXX.", "..XXXXXXXX..", "....XXXX...."];
const claw = ({ w = 18, h = 14, dy = 1, arm = [10, 8, 17.5, 8.5] } = {}) => outline(grid(w, h, (x, y) => {
  const px = x + 0.5, py = y + 0.5, cx = 6, cy = dy + 6.5;
  const inDisc = DISC[y - dy]?.[x] === "X";
  const [ax, ay, bx, by] = arm;
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  const inArm = Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))) <= 1.6;
  if (!inDisc && !inArm) return ".";
  if (!inDisc) return py < Math.min(ay, by) ? "H" : "B";
  const nx = px - cx, ny = py - cy, r = Math.hypot(nx, ny), l = lit(nx / (r || 1), ny / (r || 1));
  return r > 3 && l > 0.45 ? "H" : r > 3.6 && l < -0.35 ? "D" : "B";
}));
export const CLAW_DOWN = claw();
export const CLAW_UP = claw({ h: 22, dy: 0, arm: [9, 10, 17.5, 19.5] });

// ── feet, shadow ──────────────────────────────────────────────────────────────────────────────────────────
const foot = outline(grid(9, 6, (x, y) => (!inRound(x, y, 9, 6, 2.2) ? "." : y <= 1 ? "H" : y >= 4 ? "D" : "B")));
export const FEET = foot.map((r) => r + "...." + r);
export const SHADOW = grid(32, 4, (x, y) => (((x + 0.5 - 16) / 15) ** 2 + ((y + 0.5 - 2) / 2) ** 2 <= 1 ? "K" : "."));

// ── bulb (off / on), rays ─────────────────────────────────────────────────────────────────────────────────
const bulb = (on) => outline(grid(14, 21, (x, y) => {
  const px = x + 0.5, py = y + 0.5, d = Math.hypot(px - 7, py - 7);
  const glass = d <= 6.7 || (y >= 11 && y <= 14 && Math.abs(px - 7) <= 4.6 - (y - 11) * 0.5);
  if (glass) {
    if ((x === 4 && (y === 3 || y === 4)) || (x === 5 && y === 3)) return "W";
    const fil = (y === 6 && (x === 5 || x === 8)) || (y === 7 && (x === 4 || x === 6 || x === 7 || x === 9)) || (y === 8 && (x === 4 || x === 9)) || (y >= 9 && y <= 13 && (x === 5 || x === 8));
    if (on) return fil ? "W" : d <= 4.3 ? "O" : "Y";
    return fil ? "f" : "L";
  }
  if (y >= 15 && y <= 19 && x >= 4 && x <= 9) return y % 2 ? "M" : "m";
  if (y === 20 && x >= 6 && x <= 7) return "m";
  return ".";
}), "W");
export const BULB_OFF = bulb(false);
export const BULB_ON = bulb(true);
const rays = (r0, r1) => grid(30, 24, (x, y) => {
  const px = x + 0.5 - 15, py = y + 0.5 - 12, d = Math.hypot(px, py);
  const ang = (Math.atan2(py, px) * 180) / Math.PI;
  const ray = [180, -135, -90, -45, 0, 150, 30].some((a) => Math.abs(((ang - a + 540) % 360) - 180) < (d > 11 ? 5 : 7));
  return ray && d >= r0 && d <= r1 ? "Y" : ".";
});
export const RAYS = rays(9.5, 12.5);
export const RAYS2 = rays(11, 14.5);

// ── mortarboard (study) and briefcase (work) ──────────────────────────────────────────────────────────────
export const CAP = (() => {
  const w = 48, h = 22;
  const top = (x, y) => Math.abs(x + 0.5 - 24) / 24 + Math.abs(y + 0.5 - 7) / 7 <= 1;
  const edge = (x, y) => !top(x, y) && top(x, y - 2) && y <= 16;
  const skull = (x, y) => x >= 12 && x <= 35 && y >= 12 && y <= 19 && inRound(x - 12, y - 12, 24, 8, 2);
  const rim = (x, y) => y + 0.5 < 7 && Math.abs(x + 0.5 - 24) / 24 + Math.abs(y + 0.5 - 7) / 7 > 0.74;
  let g = grid(w, h, (x, y) => (top(x, y) ? (rim(x, y) ? "v" : "n") : edge(x, y) ? "N" : skull(x, y) ? (y <= 13 ? "n" : "N") : "."));
  g = outline(g);
  const set = (x, y, c) => { g[y] = g[y].slice(0, x) + c + g[y].slice(x + 1); };
  for (let x = 24; x <= 43; x++) set(x, 7 + Math.round((x - 24) / 10), "A");
  for (let y = 9; y <= 16; y++) set(43, y, "A");
  for (const [x, y] of [[42, 16], [44, 16], [42, 17], [43, 17], [44, 17], [43, 18]]) set(x, y, "Y");
  for (const [x, y] of [[23, 6], [24, 6], [23, 7], [24, 7]]) set(x, y, "Y");
  return g;
})();
export const BRIEFCASE = outline(grid(16, 13, (x, y) => {
  if (y <= 3) return (y === 0 && x >= 5 && x <= 10) || ((x === 5 || x === 10) && y <= 3) ? "q" : ".";
  if (!inRound(x, y - 3, 16, 10, 2)) return ".";
  if ((x === 7 || x === 8) && (y === 7 || y === 8)) return "Y";
  if (y === 7) return "a";
  return y <= 5 ? "Y" : x >= 13 || y >= 11 ? "a" : "A";
}), "q");

// ── chest screen: faces and tool icons, 16 x 10 ──────────────────────────────────────────────────────────
const eyesOpen = ["................", "...###....###...", "...###....###...", "...###....###..."];
const smile = ["................", "................", "....#......#....", ".....#....#.....", "......####......", "................"];
const arches = ["....#......#....", "...#.#....#.#...", "..#...#..#...#..", "................"];
export const FACES = {
  idle: [...eyesOpen, ...smile],
  blink: ["................", "................", "................", "...###....###...", ...smile],
  happy: ["................", ...arches, "................", "...#........#...", "....#......#....", ".....######.....", "................"],
  wow: ["................", ...arches, "................", "......####......", ".....#....#.....", "......####......", "................"],
  blocked: ["..#...#..#...#..", "...#.#....#.#...", "....#......#....", "...#.#....#.#...", "..#...#..#...#..", "................", "................", ".....######.....", "................", "................"],
  sad: [...eyesOpen, "................", "................", "......####......", ".....#....#.....", "....#......#....", "................"],
  dots1: ["................", "................", "................", "................", "...##...........", "...##...........", "................", "................", "................", "................"],
  dots2: ["................", "................", "................", "................", "...##...##......", "...##...##......", "................", "................", "................", "................"],
  dots3: ["................", "................", "................", "................", "...##...##...##.", "...##...##...##.", "................", "................", "................", "................"],
  school: [".......##.......", ".....##..##.....", "...##......##...", ".##############.", "..##.##..##.##..", "..##.##..##.##..", "..##.##..##.##..", "..##.##..##.##..", ".##############.", "################"],
  case: ["......####......", ".....#....#.....", ".##############.", ".#............#.", ".#............#.", ".######..######.", ".#....####....#.", ".#............#.", ".#............#.", ".##############."],
  pass: ["################", "#..............#", "#..##..#######.#", "#.####.........#", "#..##...#####..#", "#.####.........#", "#.####..######.#", "#.####.........#", "#..............#", "################"],
  chart: [".............##.", ".............##.", ".........##..##.", ".........##..##.", ".....##..##..##.", ".....##..##..##.", ".##..##..##..##.", ".##..##..##..##.", ".##..##..##..##.", "################"],
};
const eq = (hs) => grid(16, 10, (x, y) => { const i = [1, 4, 7, 10, 13].findIndex((b) => x === b || x === b + 1); return i >= 0 && y >= 10 - hs[i] ? "#" : "."; });
FACES.eq1 = eq([3, 7, 10, 6, 2]);
FACES.eq2 = eq([6, 3, 7, 9, 5]);
for (const k of Object.keys(FACES)) FACES[k] = FACES[k].map((r) => r.replaceAll("#", "F"));
