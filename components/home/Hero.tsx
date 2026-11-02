import type { CSSProperties } from "react";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/translate";
import { HERO } from "@/content/landing.en";
import { getReadCount } from "@/lib/read-count";
import HeroChoices from "./HeroChoices";

/**
 * "PLAN" re-spaced to the slogan's tracking. Each letter's shift (logo units) leaves a
 * 1.0-unit (0.044em) gap between neighbours, close to Archivo Expanded's own gaps at the
 * slogan's -0.02em tracking (P–L 0.075em, L–A 0.015em), scaled down because the logo's
 * letters are narrower. All three gaps are equal so the baseline feet never touch.
 */
const PLAN_LETTERS = [
  {
    d: "M44.552,20.665h1.86a7.625,7.625,0,0,0,2.678-.372,5.223,5.223,0,0,0,3.347-4.76A5.071,5.071,0,0,0,51.4,12.26C50.356,11,48.646,10.4,46.042,10.4H40.687V26.169h3.868v-5.5Zm0-7.587H45.6c1.934,0,2.826.744,2.826,2.455a2.976,2.976,0,0,1-.818,2.157c-.372.372-.893.446-2.231.446H44.48V13.078Z",
    shift: 0,
  },
  { d: "M67.094,23.566h-5.5V10.474H57.72V26.169h9.372Z", shift: -4.279 },
  {
    d: "M75.5,22.227h5.43l1.636,4.017h4.463l-6.917-15.62H77.654l-7.066,15.62h3.124Zm2.826-6.471,1.711,4.165h-3.5Z",
    shift: -6.773,
  },
  {
    d: "M95.729,26.169V16.127c1.264,1.86,6.769,10.116,6.769,10.116h3.5V10.474h-3.942V20.516c-1.264-1.934-6.62-9.967-6.62-9.967H91.787v15.62Z",
    shift: -10.531,
  },
];

// The official Kaplan logo (public/brand/kaplan-logo.svg), split into parts so the
// intro can take it apart. Paths are copied unchanged; only grouped.
const LOGO = {
  viewBox: "0 0 124 41.059",
  ka: [
    "M4.389,10.474H0V26.169H4.389Z",
    "M15.992,26.169l-5.058-7.81H9.6l4.537-7.884H10.785L6.174,18.433l4.984,7.736Z",
    "M23.8,22.227h5.43l1.636,4.017h4.463l-6.917-15.62h-2.38l-7.066,15.62h3.124Zm2.826-6.471,1.711,4.165h-3.5Z",
  ].join(""),
  swoosh:
    "M112.365,0h-2.752c6.4,3.793,10.339,8.256,10.339,13.091,0,14.281-30.348,24.843-67.315,24.843-21.347,0-40.389-3.719-52.736-9.446v3.05c12.719,5.876,31.612,9.521,52.736,9.521,40.017-.149,69.324-12.273,69.324-27.3,0-5.058-3.5-9.744-9.6-13.761",
  /** The bounding box of the re-spaced "PLAN", in its own (untranslated) coordinates. */
  planViewBox: "40.687 10.4 54.78 15.844",
};

/** The slogan's "PLAN": the logo's own letterforms, re-spaced, so it matches the intro's end frame. */
function PlanMark() {
  return (
    <svg className="plan-mark" viewBox={LOGO.planViewBox} aria-hidden="true" focusable="false">
      {PLAN_LETTERS.map((l) => (
        <path key={l.shift} d={l.d} transform={l.shift ? `translate(${l.shift} 0)` : undefined} />
      ))}
    </svg>
  );
}

function IntroLogo() {
  return (
    <span className="intro-logo-wrap" aria-hidden="true">
      <svg className="intro-logo" viewBox={LOGO.viewBox} focusable="false">
        <g transform="translate(0.074 -2.664)">
          <path className="logo-ka" d={LOGO.ka} />
          {/* Letters close up to the slogan's spacing while the logo slides. */}
          <g className="logo-plan">
            {PLAN_LETTERS.map((l) => (
              <path
                key={l.shift}
                className="logo-letter"
                d={l.d}
                style={{ "--shift": `${l.shift}px` } as CSSProperties}
              />
            ))}
          </g>
        </g>
        <path className="logo-swoosh" d={LOGO.swoosh} transform="translate(0.1)" />
      </svg>
    </span>
  );
}

interface Stop {
  x: number;
  y: number;
  step: string;
  label: string;
  /** When the amber flow reaches this stop (ms from page load). */
  lit: number;
}

interface Trajectory {
  className: string;
  viewBox: string;
  /** The ribbon that drops from the logo. */
  sweep: string;
  /** A full ring around the bulb (the 360°), continuing from the sweep's end. */
  ring: string;
  stops: [Stop, Stop, Stop];
  ringCenter: { cx: number; cy: number };
  fontSize: number;
  labelGap: number;
}

// The first two stops are points on the cubic sweep (t = 0.3, and 0.65 desktop / 0.6 mobile).
// `lit` is when the eased flow (globals.css: 1200ms from 2000ms) reaches each stop's
// arc-length fraction of sweep + ring; the bulb lights as the flow ends.
const DESKTOP: Trajectory = {
  className: "trajectory trajectory-desktop",
  viewBox: "0 0 1200 200",
  sweep: "M20 18 C300 160 700 124 1090 124",
  ring: "A50 50 0 0 0 1090 24 A50 50 0 0 0 1090 124",
  stops: [
    { x: 301, y: 104, step: "01", label: HERO.stops[0], lit: 2391 },
    { x: 682, y: 128, step: "02", label: HERO.stops[1], lit: 2590 },
    { x: 1090, y: 74, step: "03", label: HERO.stops[2], lit: 3200 },
  ],
  ringCenter: { cx: 1090, cy: 74 },
  fontSize: 22,
  labelGap: 46,
};

const MOBILE: Trajectory = {
  className: "trajectory trajectory-mobile",
  viewBox: "0 0 600 190",
  sweep: "M10 14 C150 120 330 110 470 110",
  ring: "A50 50 0 0 0 470 10 A50 50 0 0 0 470 110",
  stops: [
    { x: 145, y: 81, step: "01", label: HERO.stops[0], lit: 2373 },
    { x: 288, y: 107, step: "02", label: HERO.stops[1], lit: 2516 },
    { x: 470, y: 60, step: "03", label: HERO.stops[2], lit: 3200 },
  ],
  ringCenter: { cx: 470, cy: 60 },
  fontSize: 24,
  labelGap: 50,
};

const litAt = (ms: number) => ({ "--lit": `${ms}ms` }) as CSSProperties;

// Rays around the glass (centre 0,-8), pointing left, up and right.
const RAYS = [180, 225, 270, 315, 0].map((deg) => {
  const a = (deg * Math.PI) / 180;
  const p = (r: number) => `${(Math.cos(a) * r).toFixed(2)} ${(-8 + Math.sin(a) * r).toFixed(2)}`;
  return `M${p(24)} L${p(31)}`;
}).join(" ");

/** The last stop: a bulb inside the ring, off until the flow arrives. */
function Bulb({ cx, cy }: { cx: number; cy: number }) {
  const glass = "M-8 12 C-8 5 -17 1 -17 -8 A17 17 0 1 1 17 -8 C17 1 8 5 8 12 Z";
  const filament = "M-4 12 V3 M4 12 V3 M-4 3 Q0 -4 4 3";
  const base = "M-7 18 H7 M-4.5 24 H4.5";
  return (
    <g className="bulb" transform={`translate(${cx} ${cy})`}>
      <g className="bulb-off">
        <path d={glass} />
        <path d={filament} />
        <path d={base} />
      </g>
      <g className="bulb-lit" style={litAt(3200)}>
        <circle className="bulb-glow" cx={0} cy={-8} r={27} />
        <path className="bulb-rays" d={RAYS} />
        <path className="bulb-glass" d={glass} />
        <path className="bulb-filament" d={filament} />
        <path className="bulb-base" d={base} />
      </g>
    </g>
  );
}

function TrajectoryArt({ t, tr }: { t: Trajectory; tr: T }) {
  const labelY = (s: Stop, i: number) => (i === 2 ? t.ringCenter.cy + 50 + t.labelGap - 4 : s.y + t.labelGap);
  return (
    <svg className={t.className} viewBox={t.viewBox} aria-hidden="true" focusable="false">
      {/* Lands white from the logo; amber then flows along it and round the ring. */}
      <g className="ribbon">
        <path className="path sweep" d={t.sweep} />
        <path className="path flow" d={`${t.sweep} ${t.ring}`} pathLength={1} />
        {t.stops.slice(0, 2).map((s) => (
          <circle key={s.label} className="node stop" cx={s.x} cy={s.y} r={9} style={litAt(s.lit)} />
        ))}
        <Bulb cx={t.ringCenter.cx} cy={t.ringCenter.cy} />
        {t.stops.map((s, i) => (
          <text
            key={`${s.label}-label`}
            className="fade"
            x={i === 2 ? t.ringCenter.cx : s.x}
            y={labelY(s, i)}
            textAnchor="middle"
            fontSize={t.fontSize}
            style={litAt(s.lit)}
          >
            <tspan className="label-step" fontSize={t.fontSize * 0.7}>
              {s.step}
            </tspan>
            <tspan className="label" dx={8}>
              {tr(s.label)}
            </tspan>
          </text>
        ))}
      </g>
    </svg>
  );
}

/** The slogan's "°": the glyph stays in the text (screen readers, copy), clear, with the amber ring drawn over it. */
function Degree() {
  return (
    <span className="hero-deg">
      °
      <svg className="hero-deg-ring" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <circle cx="20" cy="20" r="14" pathLength={100} />
      </svg>
    </span>
  );
}

// The intro is pure CSS and plays once on load (components/landing/HeroStage.tsx takes .hero-motion off
// when it has played, so a page kept by Activity doesn't replay it). The trajectory retells the route:
// look, check, decide. The slogan under the heading is text only (its link and round arrow went on 2026-11-02:
// the button under the route goes to /move); it is English on every page (lang="en", translate="no"), never a message.
export default async function Hero() {
  const t = await getT();
  const reads = getReadCount();
  return (
    <section id="start" className="hero hero-motion" aria-labelledby="hero-title">
      <div className="container">
        <p className="hero-eyebrow">{t("For Singapore private-school diploma and degree students")}</p>

        {/* The page's h1. "PLAN" is drawn from the logo's letterforms, so the heading also carries it as
            hidden text: without it the page's text (no CSS, reader mode, crawlers) read a lone "ahead.".
            With reduced motion the slogan shows in full at once (globals.css). */}
        <h1 id="hero-title" className="slogan" aria-label={t("Plan ahead.")}>
          <span className="slogan-line">
            <span className="plan">
              <span className="visually-hidden">PLAN&nbsp;</span>
              <PlanMark />
              <IntroLogo />
            </span>
            <span className="ahead">ahead.</span>
          </span>
        </h1>

        <p className="hero-sub">
          <span className="hero-sub-text" lang="en" translate="no">
            <span className="hero-sub-a">
              360
              <Degree /> clarity.
            </span>{" "}
            <span className="hero-sub-b">One defining leap.</span>
          </span>
        </p>

        <TrajectoryArt t={DESKTOP} tr={t} />
        <TrajectoryArt t={MOBILE} tr={t} />
        <p className="hero-route">{t(HERO.route)}</p>

        <div className="hero-copy">
          <HeroChoices reads={{ n: reads.total, date: reads.latest }} />
        </div>
      </div>
    </section>
  );
}
