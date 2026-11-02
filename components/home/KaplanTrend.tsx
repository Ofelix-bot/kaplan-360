import { useT } from "@/components/i18n/I18nProvider";
import { KAPLAN } from "@/lib/data/employment";

// Kaplan's employment rate over three surveys (the comparable "employed" series), with the
// private-degree average where it is loaded. Kaplan is the emphasised series; the average is muted.
// Every point carries its value, so nothing depends on colour alone.

const W = 360;
const H = 176;
const PAD = { top: 22, right: 18, bottom: 30, left: 34 };
const Y_MIN = 60;
const Y_MAX = 90;

const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / (KAPLAN.trend.length - 1);
const y = (v: number) => PAD.top + ((Y_MAX - v) * (H - PAD.top - PAD.bottom)) / (Y_MAX - Y_MIN);

export default function KaplanTrend() {
  const t = useT();
  const rows = KAPLAN.trend;
  const kaplanPath = rows.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.kaplan)}`).join(" ");
  const peiPoints = rows.map((r, i) => ({ i, v: r.pei })).filter((p): p is { i: number; v: number } => p.v !== null);
  const peiPath = peiPoints.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.v)}`).join(" ");
  const summary = rows
    .map((r) => (r.pei !== null ? t("{cohort}: Kaplan {kaplan}%, private-degree average {pei}%", { cohort: r.cohort, kaplan: r.kaplan, pei: r.pei }) : t("{cohort}: Kaplan {kaplan}%", { cohort: r.cohort, kaplan: r.kaplan })))
    .join("; ");

  return (
    <svg className="trend-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Employed about six months after graduation. {summary}.", { summary })}>
      {[60, 70, 80, 90].map((v) => (
        <g key={v}>
          <line className="trend-grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
          <text className="tick" x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
            {v}%
          </text>
        </g>
      ))}
      {rows.map((r, i) => (
        <text key={r.cohort} className="tick" x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"}>
          {r.cohort}
        </text>
      ))}
      <path className="line-muted" d={peiPath} />
      {peiPoints.map((p) => (
        <g key={`pei-${p.i}`}>
          <circle className="dot-muted" cx={x(p.i)} cy={y(p.v)} r={4} />
          <text className="value-muted" x={x(p.i)} y={y(p.v)} dy={rows[p.i].kaplan > p.v ? 16 : -10} textAnchor="middle">
            {p.v.toFixed(1)}%
          </text>
        </g>
      ))}
      <path className="line-emph" d={kaplanPath} />
      {rows.map((r, i) => {
        const below = r.pei !== null && r.pei > r.kaplan;
        return (
          <g key={`k-${r.cohort}`}>
            <circle className="dot-emph" cx={x(i)} cy={y(r.kaplan)} r={5} />
            <text className="value-emph" x={x(i)} y={y(r.kaplan)} dy={below ? 18 : -11} textAnchor={i === 0 ? "start" : i === rows.length - 1 ? "end" : "middle"}>
              {r.kaplan.toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
