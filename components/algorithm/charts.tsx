"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { AlgorithmFacts } from "@/lib/algorithm/facts";
import { Key, pct, useCalcResult, type CalcProps } from "./calculator";

// The Core Algorithm page's pictures, one per step that has one. Colours are the site's chart tokens
// (app/globals.css), so they follow light and dark. Every chart has a text name; hover titles give the detail.

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const lin = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
const AXIS = "var(--land-body)";
const GRID = "var(--chart-grid)";
const TIER_COLOR = { A: "var(--chart-emph)", B: "var(--chart-au)", C: "var(--chart-pei)" } as const;

/** Step 1: each tier's admitted median against the C tier's, on the same programmes, before and after the shift. */
export function TierChart({ gaps, shift }: { gaps: AlgorithmFacts["tierGaps"]; shift: AlgorithmFacts["tierShift"] }) {
  const t = useT();
  const [on, setOn] = useState(false);
  const rows = [...gaps.map((g) => ({ tier: g.tier, gap: g.gap, n: g.programmes })), { tier: "C" as const, gap: 0, n: null }];
  const x = lin(-0.3, 0.1, 80, 600);
  return (
    <figure className="m-0 flex flex-col gap-3">
      <label className="flex items-center gap-2 self-start text-sm font-medium">
        <Switch checked={on} onCheckedChange={setOn} />
        {t("Convert to C-tier equivalent")}
      </label>
      <svg viewBox="0 0 640 190" role="img" aria-label={t("Admitted medians by first-degree tier, relative to the C tier on the same programme")} className="h-auto w-full text-[17px] sm:text-[11px]">
        {[-0.3, -0.2, -0.1, 0, 0.1].map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={10} y2={160} stroke={GRID} />
            <text x={x(v)} y={178} textAnchor="middle" fill={AXIS}>
              {v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = 36 + i * 50;
          const v = r.gap + (on ? shift[r.tier] : 0);
          return (
            <g key={r.tier}>
              <text x={8} y={y + 4} fill="currentColor" fontWeight={700}>
                {t("Tier {tier}", { tier: r.tier })}
              </text>
              <line x1={x(0)} x2={x(v)} y1={y} y2={y} stroke={TIER_COLOR[r.tier]} strokeWidth={6} strokeLinecap="round" className="motion-safe:transition-all motion-safe:duration-500" />
              <circle cx={x(v)} cy={y} r={7} fill={TIER_COLOR[r.tier]} className="motion-safe:transition-all motion-safe:duration-500">
                <title>{r.n ? t("{n} programmes", { n: r.n }) : t("Reference")}</title>
              </circle>
              <text x={x(v) + (v < 0 ? -12 : 12)} y={y - 12} textAnchor={v < 0 ? "end" : "start"} fill={TIER_COLOR[r.tier]} fontWeight={700} className="tabular-nums">
                {v === 0 ? "0" : v.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-(--land-body)">{t("Median gap in admitted GPA against C-tier graduates on the same programme.")}</figcaption>
    </figure>
  );
}

/** Step 2: the curve with its three dials. */
export function DialsChart() {
  const t = useT();
  const [theta, setTheta] = useState(3.4);
  const [s, setS] = useState(0.15);
  const [c, setC] = useState(0.8);
  const x = lin(2.6, 4.2, 44, 620);
  const y = lin(0, 1, 200, 16);
  let d = "";
  for (let v = 2.6; v <= 4.2001; v += 0.02) d += `${d ? "L" : "M"}${x(v).toFixed(1)},${y(c * sig((v - theta) / s)).toFixed(1)}`;
  const dial = (label: string, value: number, set: (v: number) => void, min: number, max: number, step: number, shown: string) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex justify-between text-xs font-medium text-(--land-body)">
        {label}
        <span className="font-semibold text-(--text) tabular-nums">{shown}</span>
      </span>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => set(Array.isArray(v) ? v[0] : v)} thumbLabels={[label]} />
    </div>
  );
  return (
    <figure className="m-0 flex flex-col gap-3">
      <svg viewBox="0 0 640 230" role="img" aria-label={t("A programme curve: θ sets where it rises, s how steeply, c how high it goes")} className="h-auto w-full text-[17px] sm:text-[11px]">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={44} x2={620} y1={y(v)} y2={y(v)} stroke={GRID} />
            <text x={36} y={y(v) + 4} textAnchor="end" fill={AXIS}>{`${v * 100}%`}</text>
          </g>
        ))}
        <line x1={44} x2={620} y1={y(c)} y2={y(c)} stroke="var(--chart-pei)" strokeDasharray="4 4" />
        <text x={620} y={y(c) - 6} textAnchor="end" fill="var(--chart-pei)">{`c ${c.toFixed(2)}`}</text>
        <line x1={x(theta)} x2={x(theta)} y1={16} y2={200} stroke={AXIS} strokeDasharray="3 4" />
        <text x={x(theta) + 5} y={30} fill={AXIS}>{`θ ${theta.toFixed(2)}`}</text>
        <path d={d} fill="none" stroke="var(--chart-emph)" strokeWidth={2.6} />
        {[2.6, 3.0, 3.4, 3.8, 4.2].map((v) => (
          <text key={v} x={x(v)} y={220} textAnchor="middle" fill={AXIS}>
            {v.toFixed(1)}
          </text>
        ))}
      </svg>
      <div className="grid gap-4 sm:grid-cols-3">
        {dial(t("θ threshold"), theta, setTheta, 2.8, 4.0, 0.01, theta.toFixed(2))}
        {dial(t("s slope"), s, setS, 0.06, 0.4, 0.01, s.toFixed(2))}
        {dial(t("c ceiling"), c, setC, 0.1, 0.95, 0.01, c.toFixed(2))}
      </div>
    </figure>
  );
}

/** Step 3: the shift each offer implies, the allowed range, and the posterior. */
export function DeltaChart({ delta, top }: { delta: AlgorithmFacts["delta"]; top: number }) {
  const t = useT();
  const x = lin(-0.45, 1.05, 40, 620);
  const peak = Math.max(...delta.posterior.map((p) => p.p));
  const y = lin(0, peak, 150, 24);
  let d = "";
  for (const p of delta.posterior) d += `${d ? "L" : "M"}${x(p.d + top).toFixed(1)},${y(p.p).toFixed(1)}`;
  const mean = delta.mu + top;
  return (
    <figure className="m-0 flex flex-col gap-2">
      <svg viewBox="0 0 640 230" role="img" aria-label={t("The tier shift implied by each Kaplan offer, and what they give together: {v}", { v: mean.toFixed(2) })} className="h-auto w-full text-[17px] sm:text-[11px]">
        <rect x={x(0)} y={16} width={x(top) - x(0)} height={176} fill="var(--chart-muted)" fillOpacity={0.25} />
        {[-0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
          <text key={v} x={x(v)} y={212} textAnchor="middle" fill={AXIS}>
            {v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)}
          </text>
        ))}
        <text x={x(0) - 6} y={30} textAnchor="end" fill={AXIS}>{t("C tier")}</text>
        <text x={x(top) + 6} y={30} fill={AXIS}>{t("Awarding tier")}</text>
        <path d={d} fill="none" stroke="var(--chart-emph)" strokeWidth={2.4} />
        <line x1={x(mean)} x2={x(mean)} y1={20} y2={192} stroke="var(--chart-emph)" strokeDasharray="3 3" />
        <text x={x(mean) + 5} y={60} fill="var(--chart-emph)" fontWeight={700}>{`+${mean.toFixed(2)}`}</text>
        {delta.dots.map((o, i) => (
          <circle key={i} cx={x(o.shift + top)} cy={172 - (i % 3) * 7} r={5} fill={o.kaplan ? "var(--chart-pei)" : "var(--chart-au)"} fillOpacity={0.85}>
            <title>{`${o.programme}: ${o.shift + top >= 0 ? "+" : ""}${(o.shift + top).toFixed(2)}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--land-body)">
        <Key color="var(--chart-pei)">{t("One Kaplan offer")}</Key>
        {delta.dots.some((o) => !o.kaplan) && <Key color="var(--chart-au)">{t("Another private-institution offer")}</Key>}
        <Key color="var(--chart-emph)">{t("What the offers give together")}</Key>
        <Key color="var(--chart-muted)">{t("Allowed range")}</Key>
      </figcaption>
    </figure>
  );
}

/** Step 4: the 3,000 match rates behind the calculator's number. */
export function RangeChart(props: CalcProps) {
  const t = useT();
  const r = useCalcResult(props);
  if (!r || r.match.belowMinimum) return <p className="m-0 text-sm text-(--land-body)">{t("Set the calculator above to see its range.")}</p>;
  const bins = Array.from({ length: 40 }, () => 0);
  for (const v of r.draws.rates) bins[Math.min(39, Math.floor(v * 40))]++;
  const max = Math.max(...bins);
  const x = lin(0, 1, 40, 620);
  const y = lin(0, max, 180, 20);
  const mark = (v: number, label: string, row: number, strong?: boolean) => (
    <g>
      <line x1={x(v)} x2={x(v)} y1={14} y2={180} stroke={strong ? "var(--chart-pei)" : "var(--chart-emph)"} strokeWidth={strong ? 2 : 1} strokeDasharray={strong ? undefined : "3 3"} />
      <text x={x(v) + 4} y={26 + row * 14} fill={strong ? "var(--chart-pei)" : "var(--chart-emph)"} fontWeight={strong ? 700 : 400}>
        {`${label} ${pct(v)}`}
      </text>
    </g>
  );
  return (
    <figure className="m-0">
      <svg viewBox="0 0 640 210" role="img" aria-label={t("3,000 drawn match rates: 80% fall between {low} and {high}", { low: pct(r.draws.p10), high: pct(r.draws.p90) })} className="h-auto w-full text-[17px] sm:text-[11px]">
        <rect x={x(r.draws.p10)} y={14} width={x(r.draws.p90) - x(r.draws.p10)} height={166} fill="var(--chart-emph)" fillOpacity={0.08} />
        {bins.map((n, i) => (
          <rect key={i} x={x(i / 40) + 1} y={y(n)} width={(580 / 40) - 2} height={180 - y(n)} fill="var(--chart-emph)" fillOpacity={0.55} rx={2} />
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text key={v} x={x(v)} y={198} textAnchor="middle" fill={AXIS}>{`${v * 100}%`}</text>
        ))}
        {mark(r.draws.p10, "p10", 1)}
        {mark(r.draws.p90, "p90", 2)}
        {mark(r.match.rate, t("Shown"), 0, true)}
      </svg>
    </figure>
  );
}

/** Step 5: C-tier share of admits against competitiveness K, the fitted curve, and the background factor. */
export function ShareChart({ elite }: { elite: AlgorithmFacts["elite"] }) {
  const t = useT();
  const x = lin(3.0, 4.2, 44, 620);
  const y = lin(0, 1, 200, 16);
  const { a, b, center, kRef } = elite.curve;
  const share = (k: number) => sig(a + b * (k - center));
  let d = "", bg = "";
  for (let k = 3.0; k <= 4.2001; k += 0.02) {
    d += `${d ? "L" : "M"}${x(k).toFixed(1)},${y(share(k)).toFixed(1)}`;
    bg += `${bg ? "L" : "M"}${x(k).toFixed(1)},${y(Math.min(1, share(k) / share(kRef))).toFixed(1)}`;
  }
  return (
    <figure className="m-0 flex flex-col gap-2">
      <svg viewBox="0 0 640 230" role="img" aria-label={t("Share of admits from C-tier universities falls as competitiveness K rises; elite starts at K {k}", { k: elite.k })} className="h-auto w-full text-[17px] sm:text-[11px]">
        <rect x={x(elite.k)} y={16} width={620 - x(elite.k)} height={184} fill="var(--chart-pei)" fillOpacity={0.08} />
        <text x={x(elite.k) + 4} y={30} fill="var(--chart-pei)" fontWeight={700}>{t("Elite")}</text>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={44} x2={620} y1={y(v)} y2={y(v)} stroke={GRID} />
            <text x={36} y={y(v) + 4} textAnchor="end" fill={AXIS}>{`${v * 100}%`}</text>
          </g>
        ))}
        {elite.points.filter((p) => p.k >= 3 && p.k <= 4.2).map((p, i) => (
          <circle key={i} cx={x(p.k)} cy={y(p.share)} r={Math.min(6, 1.5 + Math.sqrt(p.n) / 4)} fill="var(--chart-muted)" fillOpacity={0.6} />
        ))}
        <path d={d} fill="none" stroke="var(--chart-emph)" strokeWidth={2.4} />
        <path d={bg} fill="none" stroke="var(--chart-pei)" strokeWidth={2} strokeDasharray="5 4" />
        {[3.0, 3.4, 3.8, 4.2].map((v) => (
          <text key={v} x={x(v)} y={220} textAnchor="middle" fill={AXIS}>
            {`K ${v.toFixed(1)}`}
          </text>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--land-body)">
        <Key color="var(--chart-muted)">{t("One programme (10+ admits)")}</Key>
        <Key color="var(--chart-emph)">{t("C-tier share, fitted")}</Key>
        <Key color="var(--chart-pei)">{t("Background factor")}</Key>
      </figcaption>
    </figure>
  );
}

/** Step 6: each factor's effect on the predicted median admitted GPA. */
export function CoefChart({ rows }: { rows: AlgorithmFacts["prediction"]["coefficients"] }) {
  const t = useT();
  const max = Math.max(...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label={t("Each factor’s effect on the median admitted GPA")}>
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs sm:grid-cols-[14rem_minmax(0,1fr)_3.5rem]">
          <span className="truncate text-(--land-body)">{t(r.key)}</span>
          <span className="relative h-3">
            <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-(--land-line)" />
            <span
              aria-hidden
              className="absolute inset-y-0 rounded-sm"
              style={{
                background: r.value >= 0 ? "var(--chart-emph)" : "var(--chart-pei)",
                left: r.value >= 0 ? "50%" : `${50 - (Math.abs(r.value) / max) * 50}%`,
                width: `${(Math.abs(r.value) / max) * 50}%`,
              }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums">{r.value > 0 ? `+${r.value.toFixed(2)}` : r.value.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}
