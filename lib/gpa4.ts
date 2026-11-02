// Grades on the 4-point GPA scale, the scale the admitted-student figures use (data/raw/admit-cases.json), so an
// admitted student's GPA and the visitor's own result can be set side by side.
// - A mainland Chinese percentage mark: Peking University's and Beijing Institute of Technology's own rule,
//   GPA = 4 − 3(100 − X)² / 1600 (60 ≤ X ≤ 100).
// - A mainland 5-point GPA: Tongji University's own table (5 = 95%, 4 = 85%, 3 = 75%, 2 = 65%), then that rule.
// - A UK mark: the commonly cited bands, First (70%+) 3.7–4.0, 2:1 3.3–3.6, 2:2 about 2.7, Third about 2.0. No
//   official rule exists; they are an approximation. Australian marks and 7-point GPAs are first put on the UK
//   scale with the equivalences UK universities publish (lib/grades.ts), then read the same way.

import type { Rank } from "@/lib/grades";

function along(points: [number, number][], x: number) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}

const clamp = (g: number) => Math.round(Math.min(4, Math.max(0, g)) * 100) / 100;

export const chinesePercentToFour = (x: number) => clamp(4 - (3 * (100 - x) ** 2) / 1600);
export const fivePointToFour = (v: number) => chinesePercentToFour(45 + 10 * v);

const UK_MARK: [number, number][] = [[40, 2.0], [50, 2.7], [60, 3.3], [70, 3.7], [80, 4.0]];
export const ukMarkToFour = (mark: number) => clamp(along(UK_MARK, mark));
/** The other way: a 4-point GPA as a UK mark, through the same bands (below 2.0 reads as 40). */
export const fourToUkMark = (gpa: number) => Math.round(along(UK_MARK.map(([m, g]) => [g, m] as [number, number]), gpa) * 10) / 10;

/** A UK class alone, as a span on the 4-point scale (its marks' span through the same bands). */
export const CLASS_FOUR: Record<Rank, [number, number]> = { 1: [3.7, 4.0], 2: [3.3, 3.66], 3: [2.7, 3.24], 4: [2.0, 2.63] };
