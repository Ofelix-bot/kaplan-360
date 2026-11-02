import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import admitCases from "@/data/raw/admit-cases.json";
import admitModel from "@/data/raw/admit-model.json";
import institutions from "@/data/raw/institutions.json";
import kaplan from "@/data/raw/kaplan-programmes.json";
import mbaRates from "@/data/raw/mba-admit-rates.json";
import programmesRaw from "@/data/raw/programmes.json";
import checks from "@/data/pipeline/admit-model/checks.json";
import peiMatched from "@/data/pipeline/admit-model/pei_matched.json";
import targets from "@/data/pipeline/admit-model/targets.json";
import xdf from "@/data/pipeline/xdf/cases.json";
import { matchRate, type MatchParams } from "@/lib/admit-model";
import { msg } from "@/lib/i18n/translate";
import { tierByQs, type Tier } from "@/lib/tiers";

// Every number on /algorithm (the Core Algorithm page), read at build time from the admission model and the files it
// was built from (scripts/admit-model), so the page follows each rebuild. Nothing here is typed in by hand except
// the step-3 grade conversion, which repeats scripts/admit-model/common.py's ucd_to_four.

type ModelProgramme = {
  k: number; theta: number; s: number; c: number; bgFactor: number; cluster: "elite" | "taught"; n: number; basis: "observed" | "blended" | "predicted";
  floor: number | null; floorBandFactor: number | null; experienceClass: MatchParams["exp"]; greWeight: number; gmatWeight: number; ieltsBase: number | null;
  offerRate: number | null; offerRateFrom: string | null; ukOfferRate?: number; foi?: unknown; policyRisks: { id: string; level: string }[];
};
type Model = {
  method: string[];
  fit: { cvRmse: { med: [number, number] }; coefficients: Record<string, number> };
  global: {
    tierShift: Record<Tier, number>;
    privateDelta: { mu: number; sd: number; p10: number; p90: number; n: number };
    cShareCurve: { a: number; b: number; center: number; kRef: number };
    curveCalibration: { rows: number; programmes: number; admitRateByIqrFromMedian: Record<string, { n: number; admitRate: number }> };
    floorBand: Record<string, { factor: number; ratio: number }>;
    ukFoiCeiling: { m: number; cv: { rmseRate: number; baselineRmse: number }; observed: number; programmes: number };
    ukOfficial: { yieldPooled: number; byOrigin: Record<string, { ratio?: number }> };
    eliteK: number; eliteRatio: number; ceilingTaught: number;
    mbaRates: { programmes: number; ceilingX: number };
    experience: { internDiscount: number; weights: Record<string, number> };
  };
  counts: Record<string, number>;
  programmes: Record<string, ModelProgramme>;
};
const M = admitModel as unknown as Model;
/** The three large pipeline files, read rather than imported so type-checking skips them. */
const pipeline = (f: string) => JSON.parse(readFileSync(path.join(process.cwd(), "data/pipeline/admit-model", f), "utf8"));
const records = pipeline("records.json");
const externalRecords = pipeline("external-records.json");
const foiProgrammes = pipeline("foi_programmes.json");
const G = M.global;
const PROGS = Object.entries(M.programmes);
const NAMES = new Map((programmesRaw as unknown as { programmes: { id: string; name: string; institutionId: string }[] }).programmes.map((p) => [p.id, p]));
const INST = new Map((institutions as unknown as { institutions: { id: string; name: string; country?: string; qs?: { rankValue?: number | null } | null }[] }).institutions.map((i) => [i.id, i]));
const INST_BY_NAME = new Map([...INST.values()].map((i) => [i.name, i]));

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const label = (pid: string) => {
  const p = NAMES.get(pid);
  return p ? `${INST.get(p.institutionId)?.name ?? p.institutionId} · ${p.name}` : pid;
};
const fit = (m: ModelProgramme): MatchParams => ({
  k: m.k, theta: m.theta, s: m.s, c: m.c, bg: m.bgFactor, elite: m.cluster === "elite", floor: m.floor, fbf: m.floorBandFactor,
  exp: m.experienceClass, greW: m.greWeight ?? 0, gmatW: m.gmatWeight ?? 0, ieltsBase: m.ieltsBase ?? null,
});
/** scripts/admit-model/common.py ucd_to_four: a UCD GPA (4.2 scale) on the 4-point scale, band by band. */
function ucdToFour(g: number) {
  const T: [[number, number], [number, number]][] = [[[3.68, 4.2], [3.7, 4.0]], [[3.08, 3.67], [3.3, 3.66]], [[2.48, 3.07], [2.7, 3.24]], [[2.0, 2.47], [2.0, 2.63]]];
  for (const [[a, b], [c, d]] of T) if (g >= a && g <= b + 0.005) return c + ((Math.min(g, b) - a) / (b - a)) * (d - c);
  return 2.0;
}
const ucdMark = (g: number) => (g >= 3.68 ? 70 : g >= 3.08 ? 60 : g >= 2.48 ? 50 : 40);

// ---- intro: what the model is built from ----
const recordLists = Object.values((records as unknown as { records: Record<string, unknown[]> }).records);
const extStats = (externalRecords as unknown as { stats: Record<string, number> }).stats;
const XDF = (xdf as unknown as { cases: { degree: string; gpa: number | null; applications: { programmeId?: string; result?: string }[] }[] }).cases;
const sources = {
  records: recordLists.reduce((t, l) => t + l.length, 0),
  external: Object.entries(extStats).filter(([k]) => k.endsWith(":linked")).reduce((t, [, v]) => t + v, 0),
  curveRows: G.curveCalibration.rows,
  kaplanStudents: XDF.length,
  foiProgrammes: Object.keys((foiProgrammes as unknown as { programmes: object }).programmes).length,
  programmes: PROGS.length,
};

// ---- step 1: tiers line up after the shift (tier medians against the C-tier median, same programme) ----
type ByTier = { tier: Tier; n: number; median: number };
const CASES = Object.values((admitCases as unknown as { programmes: Record<string, { n: number; mix: Record<Tier, number>; gpa?: { median: number } | null; gpaByTier?: ByTier[] }> }).programmes);
const tierGaps = (["A", "B"] as const).map((tier) => {
  const gaps = CASES.flatMap((c) => {
    const t = c.gpaByTier?.find((b) => b.tier === tier && b.n >= 5);
    const cc = c.gpaByTier?.find((b) => b.tier === "C" && b.n >= 5);
    return t && cc ? [t.median - cc.median] : [];
  });
  return { tier, programmes: gaps.length, gap: round(median(gaps), 2) };
});
const tierCounts = /\((\d+) and (\d+) programmes\)/.exec(M.method[0]);

// ---- step 2: floors and floor bands ----
const floors = PROGS.filter(([, p]) => p.floor !== null).length;

// ---- step 3: δ, from the same offers and the same likelihood as scripts/admit-model/delta.py ----
const SHIFT = G.tierShift;
const T = Object.fromEntries(
  Object.entries((targets as unknown as { programmes: Record<string, { n: number; med: number; p25: number | null; p75: number | null }> }).programmes).filter(([, v]) => v.n >= 5 && v.p25 !== null && v.med < 3.9),
) as Record<string, { med: number; p25: number; p75: number }>;
type Offer = { source: string; pid: string; g4: number; tier: Tier };
const offers: Offer[] = [];
for (const r of peiMatched as unknown as { pid: string; credibility: string; scale: string; school: string | null; gpa4: number; awarderTier: Tier | null }[])
  if (r.credibility === "确认新加坡就读" && !String(r.scale).includes("AU") && r.awarderTier && T[r.pid]) offers.push({ source: "pei-" + (r.school ?? "unknown"), pid: r.pid, g4: r.gpa4, tier: r.awarderTier });
for (const c of XDF)
  if (c.degree.startsWith("ucd-") && c.gpa !== null)
    for (const a of c.applications) if (a.result === "admit" && a.programmeId && T[a.programmeId]) offers.push({ source: "kaplan-ucd", pid: a.programmeId, g4: ucdToFour(c.gpa), tier: "A" });
const sdOf = (t: { p25: number; p75: number }) => Math.sqrt((Math.max(t.p75 - t.p25, 0.08) / 1.35) ** 2 + 0.05 ** 2);
const isKaplan = (o: Offer) => o.source === "kaplan-ucd" || o.source === "pei-Kaplan";
const dots = offers.map((o) => ({ shift: round(T[o.pid].med - o.g4 - SHIFT[o.tier], 3), sd: round(sdOf(T[o.pid]), 3), programme: label(o.pid), kaplan: isKaplan(o) }));
// delta.py's grid (1,101 points on [-0.40, +0.15]); the chart takes every tenth point.
const grid = Array.from({ length: 1101 }, (_, i) => -0.4 + i * 0.0005);
const logL = grid.map((d) => offers.reduce((t, o) => { const z = (T[o.pid].med - o.g4 - SHIFT[o.tier] - d) / sdOf(T[o.pid]); return t - 2.5 * Math.log1p((z * z) / 4); }, 0));
const top = Math.max(...logL);
const dens = logL.map((l) => Math.exp(l - top));
const posterior = grid.flatMap((d, i) => (i % 10 === 0 ? [{ d: round(d, 3), p: round(dens[i], 4) }] : []));
/** δ's 95% range from the same posterior: whether studying at Kaplan differs from the partner university beyond error. */
const densTotal = dens.reduce((a, b) => a + b, 0);
let running = 0;
const cdf = dens.map((v) => (running += v / densTotal));
const deltaAt = (f: number) => round(grid[cdf.findIndex((v) => v >= f)], 3);
const delta95: [number, number] = [deltaAt(0.025), deltaAt(0.975)];

/** The Kaplan degrees' awarding universities, by QS rank, with the tier that sets their shift. */
const partners = [...new Set((kaplan as unknown as { programmes: { university: string | null }[] }).programmes.map((p) => p.university).filter((u): u is string => !!u))]
  .map((name) => {
    const qs = INST_BY_NAME.get(name)?.qs?.rankValue ?? null;
    return { name, qs, tier: tierByQs(qs) };
  })
  .sort((a, b) => (a.qs ?? 9999) - (b.qs ?? 9999));

// ---- step 5: elite, background factor, the MBA table ----
const cshare = (k: number) => 1 / (1 + Math.exp(-(G.cShareCurve.a + G.cShareCurve.b * (k - G.cShareCurve.center))));
const bgAt = (k: number) => Math.min(1, cshare(k) / cshare(G.cShareCurve.kRef));
const sharePoints = CASES.filter((c) => c.gpa && Object.values(c.mix).reduce((a, b) => a + b, 0) >= 10).map((c) => {
  const tot = Object.values(c.mix).reduce((a, b) => a + b, 0);
  const sh = (Object.entries(c.mix) as [Tier, number][]).reduce((t, [tier, n]) => t + SHIFT[tier] * n, 0) / tot;
  return { k: round(c.gpa!.median + sh, 3), share: round(c.mix.C / tot, 3), n: tot };
});
const shareBelow = sharePoints.filter((p) => p.k < 3.4);
const shareTop = sharePoints.filter((p) => p.k >= 3.9);
/** The average share across programmes (each programme counts once). */
const wShare = (ps: typeof sharePoints) => ps.reduce((t, p) => t + p.share, 0) / Math.max(1, ps.length);
const mba = (mbaRates as unknown as { source: string; url: string; checked: string; schools: { school: string; acceptRate: number }[] }).schools
  .map((s) => ({ school: s.school, rate: s.acceptRate, ceiling: round(Math.max(s.acceptRate, Math.min(0.9, G.mbaRates.ceilingX * s.acceptRate)), 3) }))
  .sort((a, b) => a.rate - b.rate);

// ---- step 6: programmes without cases ----
const COEF_LABEL: Record<string, string> = {
  log_qs: msg("University rank (log QS)"), log_subj: msg("Subject rank (log)"), log_ratio: msg("Applications per place (log)"), ielts: msg("IELTS minimum"),
  any_background: msg("Open to any first degree"), competitive_words: msg("Competitive wording"), generic_mgmt: msg("Generic management name"), env_sustain: msg("Environment / sustainability name"),
  quant: msg("Quantitative name"), practice: msg("Practice-based"), conversion_words: msg("Conversion wording"), "deg:mba": msg("MBA"), duration_long: msg("Longer than a year"),
  "ctry:United States": msg("United States"), "ctry:Australia": msg("Australia"), "ctry:Canada": msg("Canada"), "ctry:Hong Kong SAR": msg("Hong Kong"),
};
const coefficients = Object.entries(M.fit.coefficients)
  .filter(([k]) => k in COEF_LABEL)
  .map(([k, v]) => ({ key: COEF_LABEL[k], value: round(v, 3) }))
  .sort((a, b) => b.value - a.value);

// ---- step 7: experience and tests ----
const count = (f: (p: ModelProgramme) => boolean) => PROGS.filter(([, p]) => f(p)).length;
const experience = (["mba-exec", "required", "preferred", "none"] as const).map((c) => ({ cls: c, weight: G.experience.weights[c], programmes: count((p) => p.experienceClass === c) }));
const tests = {
  greFull: count((p) => p.greWeight === 1), greHalf: count((p) => p.greWeight === 0.5),
  gmatFull: count((p) => p.gmatWeight === 1), gmatHalf: count((p) => p.gmatWeight === 0.5),
};

// ---- step 8: policy risk flags ----
const policy = Object.fromEntries(
  ["ie-absence-90", "us-travel-ban", "uk-atas", "uk-graduate-route-18m", "us-visa-vetting", "us-china-stem"].map((id) => [id, count((p) => p.policyRisks.some((r) => r.id === id))]),
) as Record<string, number>;

// ---- step 9: UK ceilings ----
const uk = PROGS.filter(([id]) => INST.get(NAMES.get(id)?.institutionId ?? "")?.country === "United Kingdom");
const ukCeilings = {
  withReply: round(median(uk.filter(([, p]) => p.foi).map(([, p]) => p.c)), 2),
  predicted: round(median(uk.filter(([, p]) => !p.foi && p.ukOfferRate !== undefined).map(([, p]) => p.c)), 2),
  before: G.ceilingTaught,
};

// ---- backtest: Kaplan offers with a grade, through the site's own match rate ----
const backtest = XDF.flatMap((c) =>
  c.degree.startsWith("ucd-") && c.gpa !== null
    ? c.applications.flatMap((a) => {
        const m = a.result === "admit" && a.programmeId ? M.programmes[a.programmeId] : null;
        if (!m) return [];
        const r = matchRate(fit(m), { tierShift: SHIFT, delta: G.privateDelta.mu }, {
          gpa4: ucdToFour(c.gpa!), mark: ucdMark(c.gpa!), awarderTier: "A", workYears: null, internshipsSame: null, internshipsOther: null, ielts: null, gre: null, gmat: null,
        });
        return [{ programme: label(a.programmeId!), rate: round(r.rate, 3), belowMinimum: r.belowMinimum }];
      })
    : [],
);

const hk = (checks as unknown as { hongKongSlope: { programmes: number; oddsRatioPerPoint: { median: number }; paper: { oddsRatioPerPoint: number } } }).hongKongSlope;
const origin = G.ukOfficial.byOrigin;

/** θ's standard error where the programme has reported admits (the rest use the model's value for none). */
const thetaSe = Object.fromEntries(PROGS.filter(([, p]) => p.basis !== "predicted").map(([id, p]) => [id, round((p as unknown as { thetaSe: number }).thetaSe, 3)]));

export function algorithmFacts() {
  return {
    thetaSe,
    sources,
    tierShift: SHIFT,
    tierCounts: tierCounts ? [Number(tierCounts[1]), Number(tierCounts[2])] : null,
    tierGaps,
    floors,
    floorBand: Object.entries(G.floorBand).map(([country, v]) => ({ country, factor: v.factor, ratio: v.ratio })),
    delta: { ...G.privateDelta, dots, posterior, range95: delta95 },
    partners,
    elite: {
      k: G.eliteK, ratio: G.eliteRatio, count: count((p) => p.cluster === "elite"),
      shares: { programmes: sharePoints.length, below34: round(wShare(shareBelow), 3), top39: round(wShare(shareTop), 3), topProgrammes: shareTop.length, topNone: shareTop.filter((p) => p.share === 0).length },
      bg39: round(bgAt(3.9), 2), bg405: round(bgAt(4.05), 2), points: sharePoints, curve: G.cShareCurve,
    },
    mba: { rows: mba, programmes: G.mbaRates.programmes, ceilingX: G.mbaRates.ceilingX, source: (mbaRates as { source: string }).source, url: (mbaRates as { url: string }).url },
    prediction: { withCases: (M.counts.observed ?? 0) + (M.counts.blended ?? 0), predicted: M.counts.predicted ?? 0, cv: M.fit.cvRmse.med.map((x) => round(x, 2)) as [number, number], coefficients },
    experience, internDiscount: G.experience.internDiscount, tests,
    calibration: { rows: G.curveCalibration.rows, programmes: G.curveCalibration.programmes, bands: G.curveCalibration.admitRateByIqrFromMedian },
    policy,
    ukFoi: { m: G.ukFoiCeiling.m, cv: G.ukFoiCeiling.cv, observed: G.ukFoiCeiling.observed, matched: sources.foiProgrammes, ceilings: ukCeilings },
    official: {
      yield: G.ukOfficial.yieldPooled,
      oxfordAsia: origin["Asia (Oxford domicile)"]?.ratio ?? null,
      cambridgeAsia: origin["Asia (Cambridge citizenship)"]?.ratio ?? null,
      hk: { programmes: hk.programmes, model: hk.oddsRatioPerPoint.median, paper: hk.paper.oddsRatioPerPoint },
    },
    backtest: {
      offers: backtest.length,
      median: round(median(backtest.map((b) => b.rate)), 3),
      below30: backtest.filter((b) => Math.round(b.rate * 100) < 30).length,
      rows: backtest.sort((a, b) => b.rate - a.rate),
    },
  };
}

export type AlgorithmFacts = ReturnType<typeof algorithmFacts>;
