"use client";

import type { ReactNode } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { matchPosition, matchRate, type MatchGlobal, type MatchInput, type MatchParams } from "@/lib/admit-model";
import { mbaWorkGate } from "@/lib/admit-weights";
import type { Draws } from "@/lib/algorithm/sample";

// A programme's match-rate curve with the student on it: the median curve, thirty of the drawn curves
// (lib/algorithm/sample.ts), the admitted 25th percentile to median, θ, and the student before and after the tier
// shift. Shared by the Core Algorithm page's calculator and the Finder's programme card, which also marks where
// Strong position starts and, in its what-if, where the student's own answers put them (`ghost`).
// Colours come from --mc-curve and --mc-you, falling back to the site's chart tokens (app/globals.css).

export const pct = (x: number) => (x < 0.005 && x > 0 ? "<1%" : `${Math.round(x * 100)}%`);

/** The lowest rate shown as Strong position (lib/admit-model.ts bandOf: 61% and up). */
export const STRONG_FROM = 0.605;

const CURVE = "var(--mc-curve, var(--chart-emph))";
const YOU = "var(--mc-you, var(--chart-pei))";
const BAND = "var(--mc-band, var(--chart-poly))";
const STRONG = "var(--mc-strong, var(--land-ok))";

export function Key({ color, faint, children }: { color: string; faint?: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="inline-block h-1 w-4 rounded-full" style={{ background: color, opacity: faint ? 0.3 : 1 }} />
      {children}
    </span>
  );
}

export function MatchCurve({
  fit,
  g,
  you,
  draws,
  ghost,
  strongZone,
}: {
  fit: MatchParams;
  g: MatchGlobal;
  you: MatchInput;
  draws: Draws;
  /** The student's own answers, when a what-if has moved them: drawn hollow. */
  ghost?: MatchInput | null;
  /** Shade where Strong position starts. */
  strongZone?: boolean;
}) {
  const t = useT();
  const match = matchRate(fit, g, you);
  const x = matchPosition(fit, g, you);
  const W = 640, H = 300, L = 44, R = 624, T = 14, B = 250;
  const x0 = 2.4, x1 = 4.4;
  const sx = (v: number) => L + ((Math.min(Math.max(v, x0), x1) - x0) / (x1 - x0)) * (R - L);
  const sy = (v: number) => B - v * (B - T);
  // The same parts as lib/admit-model.ts matchRate, at every point of the scale: curve or floor band, then the
  // background factor and (MBA and executive programmes) the work gate.
  const gate = fit.exp === "mba-exec" ? mbaWorkGate(you.workYears) : 1;
  const sig = (z: number) => 1 / (1 + Math.exp(-z));
  const rateAt = (v: number, theta: number, c: number) => Math.max(c * sig((v - theta) / fit.s), fit.floor !== null && fit.fbf !== null ? fit.fbf * c * sig((fit.k - theta) / fit.s) : 0) * fit.bg * gate;
  const path = (theta: number, c: number) => {
    let d = "";
    for (let v = x0; v <= x1 + 1e-9; v += 0.02) d += `${d ? "L" : "M"}${sx(v).toFixed(1)},${sy(rateAt(v, theta, c)).toFixed(1)}`;
    return d;
  };
  const before = ghost ? matchRate(fit, g, ghost) : null;
  const beforeX = ghost ? matchPosition(fit, g, ghost) : null;
  const moved = before && beforeX !== null && !before.belowMinimum && (Math.abs(beforeX - x) > 1e-6 || Math.abs(before.rate - match.rate) > 1e-6);
  const right = sx(x) > 520;
  return (
    <figure className="m-0 flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("The programme’s curve: match rate against the C-tier-equivalent GPA, with you on it at {rate}", { rate: pct(match.rate) })} className="h-auto w-full text-[17px] sm:text-[11px]">
        {strongZone && (
          <g>
            <rect x={L} y={sy(1)} width={R - L} height={sy(STRONG_FROM) - sy(1)} fill={STRONG} fillOpacity={0.07} />
            <text x={R - 4} y={sy(STRONG_FROM) - 6} textAnchor="end" fill={STRONG} fontWeight={700}>
              {t("Strong position")}
            </text>
          </g>
        )}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={L} x2={R} y1={sy(v)} y2={sy(v)} stroke="var(--chart-grid)" />
            <text x={L - 8} y={sy(v) + 4} textAnchor="end" fill="currentColor" fillOpacity={0.6}>{`${v * 100}%`}</text>
          </g>
        ))}
        {[2.4, 2.8, 3.2, 3.6, 4.0, 4.4].map((v) => (
          <text key={v} x={sx(v)} y={B + 18} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
            {v.toFixed(1)}
          </text>
        ))}
        <text x={R} y={B + 40} textAnchor="end" fill="currentColor" fillOpacity={0.6}>
          {t("C-tier-equivalent GPA (4-point scale)")} →
        </text>
        {draws.curves.map((cu, i) => (
          <path key={i} d={path(cu.theta, cu.c)} fill="none" stroke={CURVE} strokeOpacity={0.12} strokeWidth={1.2} />
        ))}
        <rect x={sx(fit.theta)} y={B - 19} width={Math.max(2, sx(fit.k) - sx(fit.theta))} height={10} rx={3} fill={BAND} fillOpacity={0.35} />
        <line x1={sx(fit.k)} x2={sx(fit.k)} y1={B - 21} y2={B - 7} stroke={BAND} strokeWidth={2} />
        <path d={path(fit.theta, fit.c)} fill="none" stroke={CURVE} strokeWidth={2.6} />
        <line x1={sx(fit.theta)} x2={sx(fit.theta)} y1={T} y2={B} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="3 4" />
        <text x={sx(fit.theta) + 5} y={T + 26} fill="currentColor" fillOpacity={0.6}>{`θ ${fit.theta.toFixed(2)}`}</text>
        {moved && before && beforeX !== null && (
          <g>
            <circle cx={sx(beforeX)} cy={sy(before.rate)} r={5} fill="var(--chart-surface)" stroke={YOU} strokeWidth={2} />
            <text x={sx(beforeX) - 8} y={sy(before.rate) + 18} textAnchor="end" fill={YOU}>
              {t("Now {rate}", { rate: pct(before.rate) })}
            </text>
          </g>
        )}
        {!match.belowMinimum && (
          <g>
            <circle cx={sx(you.gpa4)} cy={B + 2} r={5} fill="var(--chart-surface)" stroke={YOU} strokeWidth={2} />
            <line x1={sx(you.gpa4)} x2={sx(x)} y1={B + 2} y2={B + 2} stroke={YOU} strokeWidth={1.5} />
            <circle cx={sx(x)} cy={B + 2} r={5.5} fill={YOU} />
            <line x1={sx(x)} x2={sx(x)} y1={B - 4} y2={sy(match.rate)} stroke={YOU} strokeDasharray="2 3" />
            <circle cx={sx(x)} cy={sy(match.rate)} r={4.5} fill={YOU} />
            <text x={sx(x) + (right ? -8 : 8)} y={sy(match.rate) - 8} textAnchor={right ? "end" : "start"} fill={YOU} fontWeight={700} fontSize="1.15em">
              {t("You {rate}", { rate: pct(match.rate) })}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-75">
        <Key color={CURVE}>{t("Curve (median)")}</Key>
        <Key color={CURVE} faint>
          {t("30 sampled curves")}
        </Key>
        <Key color={YOU}>{t("You (after the shift)")}</Key>
        <Key color={BAND}>{t("Admitted: 25th percentile to median")}</Key>
      </figcaption>
    </figure>
  );
}
