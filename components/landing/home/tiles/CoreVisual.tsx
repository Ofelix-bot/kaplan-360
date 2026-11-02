import type { MatchBand } from "@/lib/admit-model";

// The core algorithm's tile: what goes in (result, awarding university, work and internships, tests)
// lights up and runs into one programme's curve; the admitted students' results gather under it, the
// student's point lands on the curve between the 30% and 60% lines, and the match rate comes out with
// its band. The point is the worked example's real rate (lib/home/core-example.ts), so it sits where
// the card says. 8s loop (globals.css .hb-core); every resting style is the final frame.

/** The curve as drawn: the share of its ceiling at x, on a 260 × 150 box with the baseline at y 122. */
const BASE = 122;
const TALL = 104;
const CEIL = 0.85;
const MID = 130;
const SPREAD = 24;
const yOf = (rate: number) => BASE - TALL * rate;
const rateAt = (x: number) => CEIL / (1 + Math.exp(-(x - MID) / SPREAD));
const CURVE = Array.from({ length: 39 }, (_, i) => 16 + i * 6).map((x, i) => `${i ? "L" : "M"}${x} ${yOf(rateAt(x)).toFixed(1)}`).join(" ");
/** Where admitted students' results fall along the scale, under the baseline: denser to the right. */
const ADMITS: [number, number][] = [[96, 134], [112, 138], [121, 131], [130, 136], [138, 132], [144, 139], [150, 134], [156, 130], [161, 137], [167, 133], [172, 139], [177, 131], [182, 135], [188, 138], [193, 132], [198, 136], [204, 130], [210, 137], [216, 133], [224, 136], [232, 131]];
/** The four inputs' rows, as a share of the wire's height, and where they meet. */
const ROWS = [12.5, 37.5, 62.5, 87.5];

export function CoreVisual({ inputs, rate, band, bandLabel, rateLabel, example, note }: { inputs: string[]; rate: number | null; band: MatchBand | null; bandLabel: string; rateLabel: string; example: string; note: string }) {
  const q = rate !== null ? Math.min(Math.max(rate / CEIL, 0.03), 0.97) : null;
  const mx = q !== null ? MID + SPREAD * Math.log(q / (1 - q)) : null;
  return (
    <div className="hb-v hb-core">
      <div className="hb-core-left">
        <ul className="hb-core-in">
          {inputs.map((label, i) => (
            <li key={label} style={{ animationDelay: `${i * 0.25}s` }}>
              {label}
            </li>
          ))}
        </ul>
        <svg className="hb-core-wire" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          {ROWS.map((y) => (
            <path key={y} d={`M0 ${y} C 55 ${y}, 45 50, 100 50`} pathLength={100} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
      <div className="hb-core-side">
        <div className="hb-core-chart">
          <svg viewBox="0 0 260 150" focusable="false">
            <path className="hb-core-axis" d={`M16 ${BASE} H244`} />
            {[0.3, 0.6].map((t) => (
              <g key={t} className="hb-core-guide">
                <path d={`M16 ${yOf(t)} H244`} />
                <text x={246} y={yOf(t) + 3}>{`${t * 100}%`}</text>
              </g>
            ))}
            <g className="hb-core-admits">
              {ADMITS.map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r={2.6} />
              ))}
            </g>
            <path className="hb-core-curve" d={CURVE} pathLength={100} />
            {mx !== null && rate !== null && (
              <g className="hb-core-mark">
                <path d={`M${mx.toFixed(1)} ${BASE} V${yOf(rate).toFixed(1)}`} />
                <circle cx={mx} cy={yOf(rate)} r={6} />
              </g>
            )}
          </svg>
        </div>
        {rate !== null && band && (
          <div className="hb-core-result" data-band={band}>
            <div className="hb-core-rate">
              <b>{Math.round(rate * 100)}%</b>
              <span>{rateLabel}</span>
            </div>
            <span className="hb-core-band">{bandLabel}</span>
            <span className="hb-core-scale">
              <span className="hb-core-fill" style={{ width: `${Math.round(rate * 100)}%` }} />
            </span>
            <span className="hb-core-who">{example}</span>
          </div>
        )}
        <span className="hb-core-note">{note}</span>
      </div>
    </div>
  );
}
