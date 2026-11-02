import { matchRate, type MatchGlobal, type MatchInput, type MatchParams } from "@/lib/admit-model";

// The calculator's range on /algorithm: the match rate (lib/admit-model.ts) worked out 3,000 times with the
// uncertain parts drawn afresh each time, as the model's step 4 describes. The private-institution offset δ comes
// from its posterior (normal, mean and sd from data/raw/admit-model.json), the threshold θ from a normal around the
// programme's own value (thetaSe: the model's standard error for a programme without cases, smaller with cases), and
// the ceiling c from a Beta with mean c and 20 pseudo-observations. A fixed seed keeps the range steady as the
// visitor types.

/** The model's standard error of θ for a programme without reported admits (fit_state sd_pred, about 0.20). */
export const THETA_SE_PREDICTED = 0.202;
export const DRAWS = 3000;

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampler(seed: number) {
  const rand = rng(seed);
  const gauss = (m: number, s: number) => {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const gamma = (k: number): number => {
    if (k < 1) return gamma(k + 1) * Math.pow(rand(), 1 / k);
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number, v: number;
      do {
        x = gauss(0, 1);
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = rand();
      if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
  const beta = (a: number, b: number) => {
    const x = gamma(a), y = gamma(b);
    return x / (x + y);
  };
  return { gauss, beta };
}

export type Draws = {
  rates: number[];
  p10: number;
  p50: number;
  p90: number;
  /** Thirty of the drawn curves (θ and c), for the chart. */
  curves: { theta: number; c: number }[];
  belowMinimum: boolean;
};

const q = (sorted: number[], f: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];

export function drawRates(p: MatchParams, g: MatchGlobal, you: MatchInput, deltaSd: number, thetaSe = THETA_SE_PREDICTED, n = DRAWS): Draws {
  const first = matchRate(p, g, you);
  if (first.belowMinimum) return { rates: [], p10: 0, p50: 0, p90: 0, curves: [], belowMinimum: true };
  const { gauss, beta } = sampler(7);
  const k = 20;
  const rates: number[] = [];
  const curves: Draws["curves"] = [];
  for (let i = 0; i < n; i++) {
    const theta = gauss(p.theta, thetaSe);
    const c = p.c >= 0.999 ? p.c : beta(p.c * k, (1 - p.c) * k);
    const r = matchRate({ ...p, theta, c }, { ...g, delta: gauss(g.delta, deltaSd) }, you).rate;
    rates.push(r);
    if (i < 30) curves.push({ theta, c });
  }
  const sorted = [...rates].sort((a, b) => a - b);
  return { rates, p10: q(sorted, 0.1), p50: q(sorted, 0.5), p90: q(sorted, 0.9), curves, belowMinimum: false };
}
