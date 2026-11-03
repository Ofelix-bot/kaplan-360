import sprite from "@/lib/kappy/sprite.json";
import css from "./kappy.module.css";

// Kappy's engine: draws the sprite (lib/kappy/sprite.json, from scripts/kappy/sprite.mjs) as SVG paths, one per colour,
// and plays its states on the element React gives it (components/kappy/Kappy.tsx). Imperative on purpose: the moves
// are timers and data attributes on one element, and the CSS (kappy.module.css) does the drawing. Every loop stops
// while the system asks for reduced motion (html[data-paused], components/shared/PauseProvider); the states still change.
// What it says goes to a speech bubble (KappyBubble) with a typewriter, and to a hidden live region in one piece.

export type Face = keyof typeof sprite.faces;
export type KappyState = "idle" | "listen" | "think" | "blocked" | "human" | "done";
export type Tool = "school" | "case" | "pass" | "chart";
export type Accessory = "cap" | "case";
export type Pose = { face?: Face; look?: [number, number]; bulb?: "up" | "full"; lamp?: boolean; alert?: boolean; cl?: boolean; cr?: boolean };
export type KappyInfo = { state: KappyState; bulb: "OFF" | "UP" | "FLASH" | "LIT"; tool: string };
export type KappyOptions = { still?: boolean; acc?: Accessory; poke?: string | null; onChange?: (info: KappyInfo) => void };

type Grid = readonly string[];
const S = sprite;
const c = (name: string) => css[name] ?? name;

/** Sprite letters to colour classes (kappy.module.css). */
const CLS: Record<string, string> = { K: "ko", B: "kb", H: "kh", h: "ks", D: "kd", A: "ra", Y: "ry", a: "rd", q: "rq", G: "gg", g: "gr", R: "gf", W: "ww", P: "i1", I: "i2", J: "i3", j: "i4", S: "sc", s: "sh", F: "fc", N: "cn", n: "ct", v: "cv", M: "m1", m: "m2", L: "bl", f: "bf", O: "bo" };

/** One path per colour, horizontal runs merged; `cls` paints every pixel with one class instead. */
export function gridPaths(grid: Grid, ox: number, oy: number, mirror = false, cls: string | null = null): { cls: string; d: string }[] {
  const by: Record<string, string[]> = {};
  grid.forEach((row0, y) => {
    const row = mirror ? [...row0].reverse().join("") : row0;
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === ch) w++;
      (by[ch] ||= []).push(`M${ox + x} ${oy + y}h${w}v1h-${w}z`);
      x += w;
    }
  });
  return Object.entries(by).map(([ch, d]) => ({ cls: cls ?? c(CLS[ch] ?? "ko"), d: d.join("") }));
}

const cache = new Map<string, string>();
function P(name: string, grid: Grid, ox: number, oy: number, mirror = false, cls: string | null = null) {
  const key = `${name}|${ox}|${oy}|${mirror}|${cls}`;
  let out = cache.get(key);
  if (out === undefined) {
    out = gridPaths(grid, ox, oy, mirror, cls).map((p) => `<path class="${p.cls}" d="${p.d}"/>`).join("");
    cache.set(key, out);
  }
  return out;
}

let markup: string | null = null;
function MARKUP() {
  return (markup ??= `
    <span class="${c("glow")}" aria-hidden="true"></span>
    <svg class="${c("shadow")}" viewBox="0 0 32 4" shape-rendering="crispEdges" aria-hidden="true">${P("shadow", S.shadow, 0, 0, false, "")}</svg>
    <svg class="${c("sprite")}" viewBox="0 0 64 96" shape-rendering="crispEdges" aria-hidden="true">
      <g class="${c("bot")}">
        <g class="${c("lampbox")}">
          <g class="${c("rays")}"><g class="${c("r1")}">${P("rays", S.rays, 17, 1)}</g><g class="${c("r2")}">${P("rays2", S.rays2, 17, 1)}</g></g>
          <g class="${c("bulb")}"><g class="${c("off")}">${P("bulbOff", S.bulbOff, 25, 6)}</g><g class="${c("on")}">${P("bulbOn", S.bulbOn, 25, 6)}</g></g>
        </g>
        <g class="${c("cl")} ${c("dn")}">${P("clawDown", S.clawDown, 0, 60)}</g>
        <g class="${c("cl")} ${c("up")}">${P("clawUp", S.clawUp, 0, 47)}</g>
        <g class="${c("cr")} ${c("dn")}">${P("clawDown", S.clawDown, 46, 60, true)}</g>
        <g class="${c("cr")} ${c("up")}">${P("clawUp", S.clawUp, 46, 47, true)}</g>
        <g>${P("feet", S.feet, 21, 84)}</g>
        <g>${P("body", S.body, 17, 59)}</g>
        <g data-face></g>
        <g class="${c("headg")}">
          ${P("head", S.head, 14, 28)}
          <g class="${c("pupil")}">${P("pupil", S.pupil, 27, 41)}</g>
          ${P("glint", S.glint, 23, 37)}
          <g class="${c("cap")}">${P("cap", S.cap, 8, 12)}</g>
        </g>
        <g class="${c("briefcase")}">${P("case", S.briefcase, 48, 71)}</g>
      </g>
    </svg>
    <span class="${c("fx")}" aria-hidden="true"></span>`);
}
const face = (name: Face) => P(`face-${name}`, S.faces[name], 24, 68);
const STAR = `<svg viewBox="0 0 5 5" shape-rendering="crispEdges"><path d="M2 0h1v2h2v1h-2v2h-1v-2h-2v-1h2z" fill="#ffd98a"/><path d="M2 2h1v1h-1z" fill="#ffffff"/></svg>`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const DOTS: Face[] = ["dots1", "dots2", "dots3"];
const SCAN = [-3, -2, -1, 0, 1, 2, 3, 2, 1, 0, -1, -2];
const TOOL_NAME: Record<Tool, string> = { school: "PROGRAMMES", case: "ROLES", pass: "WORK PASS", chart: "FIGURES" };

/** True while the system asks for reduced motion. */
export const motionOff = () => document.documentElement.dataset.paused === "true" || matchMedia("(prefers-reduced-motion: reduce)").matches;

// Every free Kappy looks toward the pointer.
const free = new Set<KappyEngine>();
let mx = 0;
let my = 0;
let raf = 0;
function onPointer(e: PointerEvent) {
  mx = e.clientX;
  my = e.clientY;
  if (!raf)
    raf = requestAnimationFrame(() => {
      raf = 0;
      for (const k of free) if (k.follow && !k.el.closest(`.${c("away")}`)) k.toward(mx, my);
    });
}

type Group = "lamp" | "arms" | "face" | "type" | "misc";

export class KappyEngine {
  readonly el: HTMLElement;
  bubble: HTMLElement | null = null;
  state: KappyState = "idle";
  follow = false;
  private o: KappyOptions;
  private faceG: SVGGElement;
  private pupil: SVGGElement;
  private svg: SVGSVGElement;
  private fx: HTMLElement;
  private loops: number[] = [];
  private timers: Record<Group, number[]> = { lamp: [], arms: [], face: [], type: [], misc: [] };
  private hold = 0;
  private faceName: Face | null = null;
  private tool = "—";
  private dir: [number, number] = [0, 0];

  constructor(el: HTMLElement, o: KappyOptions = {}) {
    this.el = el;
    this.o = o;
    el.innerHTML = MARKUP();
    if (o.still) el.dataset.still = "";
    this.faceG = el.querySelector("[data-face]") as SVGGElement;
    this.pupil = el.querySelector(`.${c("pupil")}`) as SVGGElement;
    this.svg = el.querySelector(`.${c("sprite")}`) as SVGSVGElement;
    this.fx = el.querySelector(`.${c("fx")}`) as HTMLElement;
    this.setFace("idle");
    if (!o.still) {
      if (!free.size) addEventListener("pointermove", onPointer, { passive: true });
      free.add(this);
      this.set("idle");
    }
  }

  destroy() {
    this.stopAll();
    free.delete(this);
    if (!free.size) removeEventListener("pointermove", onPointer);
  }

  // ── timers ──
  private loop(ms: number, fn: () => void) {
    this.loops.push(window.setInterval(fn, ms));
  }
  clearLoops() {
    this.loops.forEach(clearInterval);
    this.loops = [];
  }
  private after(group: Group, ms: number, fn: () => void) {
    this.timers[group].push(window.setTimeout(fn, ms));
  }
  private clear(group: Group) {
    this.timers[group].forEach(clearTimeout);
    this.timers[group] = [];
  }
  stopAll() {
    this.clearLoops();
    (Object.keys(this.timers) as Group[]).forEach((g) => this.clear(g));
  }

  // ── drawing ──
  setFace(name: Face, holdMs = 0) {
    if (holdMs) this.hold = Date.now() + holdMs;
    else if (Date.now() < this.hold) return;
    if (this.faceName === name) return;
    this.faceName = name;
    this.faceG.innerHTML = face(name);
  }
  lookAt(dx: number, dy: number) {
    const x = clamp(Math.round(dx), -3, 3);
    const y = clamp(Math.round(dy), -3, 3);
    if (x === this.dir[0] && y === this.dir[1]) return;
    this.dir = [x, y];
    this.pupil.style.transform = `translate(${x}px, ${y}px)`;
  }
  toward(x: number, y: number, reach = 140) {
    const r = this.svg.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
    const vx = x - (r.left + r.width / 2);
    const vy = y - (r.top + (r.height * 46) / 96);
    this.lookAt(clamp(vx / reach, -1, 1) * 3, clamp(vy / reach, -1, 1) * 3);
  }
  towardEl(el: Element) {
    const r = el.getBoundingClientRect();
    this.toward(r.left + r.width / 2, r.top + r.height / 2, 60);
  }
  private emit() {
    const d = this.el.dataset;
    const bulb = d.bulb ? (d.lamp !== undefined ? (d.bulb === "full" ? "LIT" : "FLASH") : "UP") : "OFF";
    this.o.onChange?.({ state: this.state, bulb, tool: this.tool });
  }

  // ── speech ──
  say(text: string) {
    const b = this.bubble;
    if (!b) return;
    this.clear("type");
    const vis = b.querySelector<HTMLElement>("[data-vis]");
    const sr = b.querySelector<HTMLElement>("[data-sr]");
    if (!vis || !sr) return;
    delete b.dataset.empty;
    sr.textContent = text;
    const typing = css.typing ?? "typing";
    if (motionOff()) {
      vis.textContent = text;
      vis.classList.remove(typing);
      return;
    }
    vis.textContent = "";
    vis.classList.add(typing);
    const chars = [...text];
    let i = 0;
    const step = () => {
      vis.textContent = chars.slice(0, ++i).join("");
      if (i < chars.length) this.after("type", 26, step);
      else vis.classList.remove(typing);
    };
    step();
  }
  hush() {
    const b = this.bubble;
    if (!b) return;
    this.clear("type");
    b.dataset.empty = "";
    b.querySelectorAll("[data-vis], [data-sr]").forEach((n) => (n.textContent = ""));
  }

  // ── states ──
  set(state: KappyState, o: { target?: Element } = {}) {
    this.clearLoops();
    this.state = state;
    const d = this.el.dataset;
    d.mode = state;
    if (state !== "blocked") delete d.alert;
    if (state !== "human") delete d.cr;
    this.follow = state === "idle" || state === "done";
    const still = motionOff();
    if (state === "idle" || state === "done") {
      this.hold = 0;
      this.setFace(state === "done" ? "happy" : "idle");
      if (!still) this.loop(3400 + Math.random() * 1600, () => this.blink());
    } else if (state === "listen") {
      this.hold = 0;
      this.setFace("idle");
      if (o.target) this.towardEl(o.target);
    } else if (state === "think") {
      this.hold = 0;
      let i = 0;
      let j = 0;
      this.setFace(DOTS[0]);
      this.loop(300, () => this.setFace(DOTS[++i % 3]));
      if (!still) this.loop(120, () => this.lookAt(SCAN[++j % SCAN.length], 0));
      else this.lookAt(2, 0);
    } else if (state === "blocked") {
      this.unlight();
      d.alert = "";
      this.hold = 0;
      this.setFace("blocked");
      this.lookAt(0, 0);
      if (!still) {
        d.shake = "";
        this.after("misc", 520, () => delete d.shake);
      }
    } else if (state === "human") {
      this.unlight();
      this.hold = 0;
      this.setFace("sad");
      this.lookAt(3, 1);
      if (this.o.acc !== "case") d.cr = "up";
    }
    this.emit();
  }
  private blink() {
    if (this.faceName !== "idle" || Date.now() < this.hold || motionOff()) return;
    this.setFace("blink", 130);
    this.after("face", 140, () => {
      this.hold = 0;
      if (this.state === "idle" || this.state === "listen") this.setFace("idle");
    });
  }
  /** Call on every keystroke while the visitor types: eyes on the field, a nod, an equaliser on the screen. */
  hear(target?: Element) {
    if (this.state !== "listen") this.set("listen", { target });
    if (target) this.towardEl(target);
    this.setFace(this.faceName === "eq1" ? "eq2" : "eq1", 200);
    const d = this.el.dataset;
    if (!motionOff() && d.nod === undefined) {
      d.nod = "";
      this.after("misc", 110, () => delete d.nod);
    }
    this.clear("face");
    this.after("face", 900, () => {
      this.hold = 0;
      this.setFace("idle");
    });
  }
  /** A lookup: the tool's icon on the chest screen for `ms`. */
  showTool(kind: Tool, ms = 1100) {
    this.tool = TOOL_NAME[kind];
    this.clear("face");
    this.hold = 0;
    this.setFace(kind, ms);
    const ping = c("ping");
    this.el.classList.add(ping);
    this.after("face", 260, () => this.el.classList.remove(ping));
    this.after("face", ms, () => {
      this.hold = 0;
      this.tool = "—";
      this.setFace(this.state === "think" ? DOTS[0] : this.state === "done" ? "happy" : "idle");
      this.emit();
    });
    this.emit();
  }
  /** A step has a result: the bulb pops up, blinks and goes back. */
  flash() {
    this.clear("lamp");
    const d = this.el.dataset;
    d.bulb = "up";
    delete d.lamp;
    const seq: [number, "on" | "off" | "hide"][] = motionOff()
      ? [[0, "on"], [900, "off"], [1100, "hide"]]
      : [[260, "on"], [360, "off"], [450, "on"], [1250, "off"], [1420, "hide"]];
    for (const [t, a] of seq)
      this.after("lamp", t, () => {
        if (a === "on") d.lamp = "";
        else if (a === "off") delete d.lamp;
        else delete d.bulb;
        this.emit();
      });
    this.emit();
  }
  /** The answer passed its check: the bulb lights fully and stays lit. */
  light({ instant = false } = {}) {
    this.clear("lamp");
    const d = this.el.dataset;
    d.bulb = "full";
    if (instant || motionOff()) {
      d.lamp = "";
      this.emit();
      return;
    }
    delete d.lamp;
    for (const [t, on] of [[260, 1], [350, 0], [430, 1], [500, 0], [600, 1]] as const)
      this.after("lamp", t, () => {
        if (on) d.lamp = "";
        else delete d.lamp;
        this.emit();
      });
    this.after("lamp", 600, () => this.arms("both", 900));
    this.emit();
  }
  unlight() {
    this.clear("lamp");
    delete this.el.dataset.bulb;
    delete this.el.dataset.lamp;
    this.emit();
  }
  private arms(which: "left" | "right" | "both", ms: number) {
    this.clear("arms");
    const d = this.el.dataset;
    if (which !== "right") d.cl = "up";
    if (which !== "left" && this.o.acc !== "case") d.cr = "up";
    this.after("arms", ms, () => {
      delete d.cl;
      if (this.state !== "human") delete d.cr;
    });
  }
  wave() {
    this.clear("arms");
    const d = this.el.dataset;
    const side = this.o.acc === "case" ? "cl" : "cr";
    this.setFace("happy", 1100);
    if (motionOff()) {
      d[side] = "up";
      this.after("arms", 700, () => delete d[side]);
      return;
    }
    for (let i = 0; i < 6; i++)
      this.after("arms", i * 150, () => {
        if (i % 2 === 0) d[side] = "up";
        else delete d[side];
      });
    this.after("arms", 900, () => delete d[side]);
  }
  /** A click: wave, and say the poke line if there is one. */
  poke() {
    this.wave();
    if (this.o.poke) this.say(this.o.poke);
  }
  burst(kind: "star" | "puff" = "star", n = 8) {
    if (motionOff()) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const dist = (kind === "star" ? 34 : 18) + Math.random() * 10;
      const p = document.createElement("i");
      if (kind === "star") p.innerHTML = STAR;
      else p.className = c("puff");
      p.style.setProperty("--tx", `calc(var(--s) * ${Math.round(Math.cos(a) * dist)}px)`);
      p.style.setProperty("--ty", `calc(var(--s) * ${Math.round(Math.sin(a) * dist * (kind === "star" ? 0.9 : 0.6))}px)`);
      this.fx.append(p);
      this.after("misc", 900, () => p.remove());
    }
  }
  /** Saved to the plan: a jump, both claws up, stars. */
  celebrate() {
    const d = this.el.dataset;
    this.setFace("wow", 700);
    this.after("face", 700, () => {
      this.hold = 0;
      this.setFace("happy", 1200);
    });
    this.arms("both", 800);
    if (!motionOff()) {
      d.jump = "";
      this.after("misc", 740, () => delete d.jump);
    }
    this.burst("star", 10);
  }
  /** A still frame (the state cards). */
  pose(p: Pose) {
    const d = this.el.dataset;
    this.faceG.innerHTML = face(p.face ?? "idle");
    if (p.look) this.lookAt(...p.look);
    if (p.bulb) d.bulb = p.bulb;
    if (p.lamp) d.lamp = "";
    if (p.alert) d.alert = "";
    if (p.cl) d.cl = "up";
    if (p.cr) d.cr = "up";
  }
}
