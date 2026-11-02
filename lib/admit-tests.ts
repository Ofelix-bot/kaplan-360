// Test scores on the admission model's GPA scale (data/raw/admit-model.json → global.gre, programmes[].greWeight).
//
// GRE (verbal + quantitative, 260–340): no bonus up to 325; 0.01 GPA points for each point from 325 to 335, and
// 0.013 for each point above 335 (at most 0.165 at 340). The programme's greWeight scales it: 1 where the GRE is
// required, 0.5 where it is optional, recommended or only mentioned, 0 where the page says it is not required.
// GradCafe offers and rejections on the same programmes put +10 GRE points at +0.37 GPA in 2012–15 master's
// admissions but only +0.13 in 2016–19; since 2020 many programmes have made the GRE optional and its weight is still
// falling, so the rule sits below the older estimate.
//
// GMAT: see gmatToGre below.
//
// IELTS: see ieltsAdjustment below. Within-programme data show no measurable IELTS effect (admitted students with
// higher IELTS also had higher GPAs), so this part is Kaplan 360++'s own rule.

export const GRE_FREE_UP_TO = 325;
export const GRE_PER_POINT_TO_335 = 0.01;
export const GRE_PER_POINT_ABOVE_335 = 0.013;

/** The GRE bonus (GPA points) before the programme's weight; null or out-of-range scores count as none. */
export function greBonus(total: number | null | undefined): number {
  if (total == null || !Number.isFinite(total) || total < 260 || total > 340) return 0;
  const mid = Math.min(Math.max(total - GRE_FREE_UP_TO, 0), 10);
  const top = Math.max(total - 335, 0);
  return mid * GRE_PER_POINT_TO_335 + top * GRE_PER_POINT_ABOVE_335;
}

/** The bonus on this programme's curve: greBonus × the programme's greWeight (1, 0.5 or 0). */
export const programmeGreBonus = (total: number | null | undefined, greWeight: number) => greBonus(total) * greWeight;

/** IELTS rule (Kaplan 360++'s, not measured). Elite programmes: −0.1 below 7.5, nothing above. Other programmes: +0.05
 *  at 1.5 or more above `ieltsBase`, the lowest IELTS minimum among the university's programmes. Below the programme's
 *  own minimum the offer carries a language condition; that is shown, not scored. */
export function ieltsAdjustment(score: number | null | undefined, cluster: "elite" | "taught", ieltsBase: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 0;
  if (cluster === "elite") return score < 7.5 ? -0.1 : 0;
  return ieltsBase != null && score >= ieltsBase + 1.5 ? 0.05 : 0;
}

// GMAT through the GRE: a GMAT Focus Edition total (205–805, ending in 5) is first read as a GMAT (10th edition) total
// with GMAC's concordance table (August 2024), then as a GRE verbal + quantitative total by inverting ETS's GRE
// Comparison Tool regression (GMAT total = −2080.75 + 6.38 × GRE verbal + 10.62 × GRE quant) with the two sections
// equal: GRE total = (GMAT + 2080.75) / 8.5. The GRE rule and the programme's GMAT weight then apply.
const FOCUS_TO_CLASSIC: [number, number][] = [
  [205, 200], [285, 215], [325, 250], [365, 315], [405, 375], [445, 445], [485, 495], [525, 555],
  [565, 605], [605, 650], [645, 695], [685, 735], [725, 760], [765, 780], [805, 795],
];

function along(points: [number, number][], x: number) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}

/** A GMAT total as a GRE verbal + quantitative total; null when not a GMAT score. */
export function gmatToGre(gmat: number | null | undefined): number | null {
  if (gmat == null || !Number.isFinite(gmat) || gmat < 200 || gmat > 805) return null;
  const classic = gmat % 10 === 5 ? along(FOCUS_TO_CLASSIC, gmat) : gmat;
  return Math.min(340, Math.max(260, (classic + 2080.75) / 8.5));
}

/** The GMAT bonus (GPA points) before the programme's weight. */
export const gmatBonus = (gmat: number | null | undefined) => greBonus(gmatToGre(gmat));
