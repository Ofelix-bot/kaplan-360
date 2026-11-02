"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { GROUPS, SALARY_BY_RELEASE, type GroupId } from "@/lib/data/employment";

const ROW = 58;
const LEFT = 52;
const RIGHT = 28;
const TOP = 12;
const AXIS = 34;
const MIN = 2500;
const MAX = 5000;
const TICKS = [2500, 3000, 3500, 4000, 4500, 5000];
const ORDER: GroupId[] = ["poly", "pei", "au"];

const sgd = (v: number) => `S$${v.toLocaleString("en-SG")}`;
const compact = new Intl.NumberFormat("en-SG", { notation: "compact", maximumFractionDigits: 1 });

interface Tip {
  left: number;
  top: number;
  group: GroupId;
  release: string;
  value: number;
}

export default function SalaryDotPlot() {
  const t = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  // Drawn at the container's real width so text stays at its true size.
  const [W, setW] = useState(640);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = SALARY_BY_RELEASE;
  const H = TOP + rows.length * ROW + AXIS;
  const last = rows.length - 1;
  const x = (v: number) => LEFT + ((v - MIN) / (MAX - MIN)) * (W - LEFT - RIGHT);

  return (
    <div ref={wrapRef} className="chart-wrap" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group" aria-labelledby="salary-chart-title">
        <title id="salary-chart-title">
          {t("Median gross monthly salary of fresh graduates in full-time permanent jobs, by survey year")}
        </title>
        {TICKS.map((v) => (
          <g key={v}>
            <line className="grid-line" x1={x(v)} x2={x(v)} y1={TOP} y2={H - AXIS + 6} />
            <text className="tick" x={x(v)} y={H - 10} textAnchor="middle">
              {(v === MIN ? "S$" : "") + compact.format(v)}
            </text>
          </g>
        ))}

        {rows.map((r, i) => {
          const cy = TOP + i * ROW + ROW / 2;
          const vals = ORDER.map((g) => r[g]);
          return (
            <g key={r.release}>
              <text className="row-label" x={0} y={cy + 4}>
                {r.release}
              </text>
              <line className="connector" x1={x(Math.min(...vals))} x2={x(Math.max(...vals))} y1={cy} y2={cy} />
              {ORDER.map((g) => {
                const cx = x(r[g]);
                const show = () =>
                  setTip({ left: (cx / W) * 100, top: (cy / H) * 100, group: g, release: r.release, value: r[g] });
                return (
                  <g key={g}>
                    <circle
                      className="hit"
                      cx={cx}
                      cy={cy}
                      r={14}
                      tabIndex={0}
                      role="img"
                      aria-label={`${t(GROUPS[g].short)}, ${r.release}: ${sgd(r[g])}`}
                      onMouseEnter={show}
                      onFocus={show}
                      onBlur={() => setTip(null)}
                    />
                    <circle
                      className="dot"
                      cx={cx}
                      cy={cy}
                      r={i === last ? 7 : 5.5}
                      fill={`var(--chart-${g})`}
                      pointerEvents="none"
                    />
                  </g>
                );
              })}
              {i === last &&
                ORDER.map((g, k) => (
                  <text
                    key={`${g}-v`}
                    className="value-label"
                    x={x(r[g])}
                    y={k === 1 ? cy + 24 : cy - 14}
                    textAnchor="middle"
                  >
                    {sgd(r[g])}
                  </text>
                ))}
            </g>
          );
        })}
      </svg>

      {tip && (
        <div className="tooltip" style={{ left: `${tip.left}%`, top: `${tip.top}%` }} role="status">
          {t(GROUPS[tip.group].short)} · {tip.release}
          <br />
          {t.rich("<b>{pay}</b> / month", { b: (c) => <strong>{c}</strong> }, { pay: sgd(tip.value) })}
        </div>
      )}
    </div>
  );
}
