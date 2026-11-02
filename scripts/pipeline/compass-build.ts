// Admitted (and rejected) applicants per programme from three kinds of report, linked to programmes by
// compass-match.ts (only matches it was sure of):
// - 指南者 cases (compass-cases.ts; dated, with experiences, by compass-detail.ts): admits, with their first-degree
//   category, GPA, English and test scores, and whether they applied in their final year or with work experience;
// - GradCafe survey results (gradcafe-results.ts): admits, rejections and waiting lists, with GPA and GRE;
// - 飞跃手册 posts (feiyue-reports.ts): one graduate's every master's result, with their background;
// - 新东方 slides of Kaplan Singapore graduates' offers (xdf-cases.ts): admits with the Kaplan degree and its GPA.
// Admits give the profile (GPA on the 4-point scale, English, experience, first degree); rejections are counted apart.
// First degrees are put in tiers A, B and C (lib/tiers.ts: Cambridge's lists in mainland China, QS 2027 elsewhere on
// Kaplan 360++'s rule, top 120 A, 121–300 B, 301+ or unranked C; a Sino-foreign university as its awarding university,
// a Singapore private school's degree as C), with the GPA quartiles of each tier that has enough (lib/tiers.ts
// tierBand reads them); the six groups used before (985, 211, other mainland, overseas by QS band) are kept as details.
// GMAT scores are put on the Focus Edition scale one by one (lib/stand/rules.ts gmatFocus: GMAC's concordance, the
// edition read from each score's last digit) before their median is taken, so the median is a Focus Edition figure.
// High-variance figures are flagged: a wide GPA or IELTS spread, sources that disagree, rejected applicants' GPAs
// as high as admitted ones', and small samples.
// Writes data/raw/admit-cases.json. Usage: npx tsx scripts/pipeline/compass-build.ts

import path from "node:path";
import { COMPASS_CASES_FILE, COMPASS_DIR, type CompassCase } from "./compass-cases";
import { awardedFor, bestTier, cambridgeListed, combinedParts, MAINLAND, mainlandTier, QS_TIER_A, QS_TIER_B, readAwarded, tierByQs, TIERS, universityTier, type How, type Tier } from "../../lib/tiers";
import { fivePointSchools, GPA_RULE_TEXT, institutionFor, parseBackground, splitTitle, toFourPoint, ucdToFour, ukMarksSchool, type GpaRule, type Status } from "./compass-lib";
import { PROGRAMME_MATCHES_FILE, SCHOOLS_FILE, type ProgrammeMatch, type School } from "./compass-match";
import { ROOT } from "./config";
import { FEIYUE_FILE, fullYear, type FeiyueReport } from "./feiyue-reports";
import { GRADCAFE_FILE, type GradcafeResult } from "./gradcafe-results";
import { JJL_FILE, type JjlCase } from "./jjl-cases";
import { XDF_FILE, xdfDate, type XdfCase } from "./xdf-cases";
import { gmatFocus } from "../../lib/stand/rules";
import { readJson, today, writeJson } from "./util";

export const DETAILS_FILE = path.join(COMPASS_DIR, "details.json");
export const ADMIT_CASES_FILE = path.join(ROOT, "data", "raw", "admit-cases.json");
const CN_LIST = path.join(ROOT, "scripts", "pipeline", "lists", "cn-universities.json");
/** Reports from before this are left out (admission standards move). */
const SINCE = "2022-01-01";
/** Fewer reported admits and rejections together than this and a programme gets no summary. */
export const MIN_CASES = 5;

export type Detail = { date: string | null; experiences: string[]; kinds: Kind[]; hidden: boolean };
export type Kind = "internship" | "work" | "research" | "competition" | "project" | "other";
export type Group = "985" | "211" | "other" | "qs50" | "qs300" | "qsRest";
type Source = "compass" | "gradcafe" | "feiyue" | "jjl" | "xdf";
const SOURCES: Source[] = ["compass", "gradcafe", "feiyue", "jjl", "xdf"];

/** One applicant's result for one programme, from any source. */
export type Rec = {
  source: Source;
  result: "admit" | "reject" | "waitlist";
  date: string | null;
  group: Group | null;
  tier: Tier | null;
  gpa: number | null;
  rule: GpaRule | null;
  ielts: number | null;
  toefl: number | null;
  gre: number | null;
  gmat: number | null;
  status: Status | null;
  workYears: number | null;
  kinds: Kind[] | null;
};

/** How a first degree's tier was read: lib/tiers.ts How, or outside mainland China by QS rank, unranked, as a private school's degree (C), or by the report's category alone. */
export type TierHow = How | "qs" | "unranked" | "private-school" | "category";
export type TierRead = { tier: Tier; how: TierHow };

/** A Singapore private school, or a foreign university's Singapore campus, as reports name one; NUS, NTU and Singapore's other universities are mapped to Singapore itself. */
const SG_PRIVATE = /新加坡|Singapore|PSB|\bSIM\b|Kaplan|楷博|MDIS/i;

/** An English university name as QS names it, case, "The", brackets and punctuation aside. */
const plain = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/\bthe\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const HAN = /[㐀-鿿]/;
type Qs = { name: string; country: string; rankValue: number };
const readQs = () => readJson<{ universities: Qs[] }>(path.join(ROOT, "data", "raw", "qs-wur-2027.json"), { universities: [] }).universities;

/**
 * The tier of a reported first degree (lib/tiers.ts), from the university's name as the report gives it and, outside
 * mainland China, the agency's mapping of that name to QS 2027 (compass-match.ts) or the name as QS gives it.
 */
export function firstDegreeReader(schools: Record<string, School>) {
  type Row = { id: string; name: string; country: string | null; qs: { rankValue: number } | null };
  const roster = new Map(readJson<{ institutions: Row[] }>(path.join(ROOT, "data", "raw", "institutions.json"), { institutions: [] }).institutions.map((i) => [i.id, i]));
  const qsByName = new Map(readQs().map((u) => [plain(u.name), u]));
  /**
   * A name the agency mapped, or an English name as QS 2027 gives it: by QS rank, or by Cambridge's lists for a
   * university in mainland China (厦门大学马来西亚分校 as Xiamen University).
   */
  const mapped = (name: string): TierRead | null => {
    const s = schools[name];
    const q = s?.country || HAN.test(name) ? null : qsByName.get(plain(name));
    const known = s?.country ? { english: s.english ?? name, country: s.country, rank: s.qsRankValue } : q ? { english: q.name, country: q.country, rank: q.rankValue } : null;
    if (!known) return null;
    if (known.country === MAINLAND) return mainlandTier(known.english);
    const tier = tierByQs(known.rank);
    if (SG_PRIVATE.test(name) && known.country !== "Singapore") return { tier: readAwarded("private-school", tier), how: "private-school" };
    return { tier, how: known.rank === null ? "unranked" : "qs" };
  };
  /** One part of a combined name: the agency's mapping, else a university here by the name offer titles give it. */
  const part = (name: string): Tier | null => {
    const m = mapped(name);
    if (m) return m.tier;
    const r = roster.get(institutionFor(name) ?? "");
    return r ? universityTier({ name: r.name, country: r.country, qsValue: r.qs?.rankValue ?? null }) : null;
  };
  return {
    /** A name filed under a mainland category: Cambridge's lists (a faculty of a listed university too, with `faculty`), else an overseas university filed there, else C. */
    mainland(name: string, faculty: boolean): TierRead {
      const r = mainlandTier(name, { faculty, elsewhere: part });
      return r.how === "unlisted" ? (mapped(name) ?? r) : r;
    },
    /**
     * A name filed as overseas: the agency's mapping or QS (a combined name its best part), an English name on
     * Cambridge's lists that QS does not rank ("Central University of Finance and Economics"), else unranked. Chinese
     * names are not looked up on the lists here: filed as overseas, 西北大学 is Northwestern University.
     */
    overseas(name: string): TierRead {
      if (awardedFor(name)) return mainlandTier(name);
      const each = (combinedParts(name) ?? []).flatMap((p) => {
        const t = part(p) ?? cambridgeListed(p)?.tier ?? null;
        return t ? [t] : [];
      });
      if (each.length) return { tier: bestTier(each)!, how: "combined" };
      const listed = HAN.test(name) ? null : cambridgeListed(name);
      return mapped(name) ?? (listed ? { tier: listed.tier, how: listed.how } : { tier: "C", how: "unranked" });
    },
  };
}

type Spread = { n: number; p10: number; p25: number; median: number; p75: number; p90: number; low: number; high: number };

/** Linear-interpolated percentile of sorted values. */
function pct(sorted: number[], p: number) {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function spread(values: number[], digits: number): Spread | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const r = (v: number) => Number(v.toFixed(digits));
  return { n: s.length, p10: r(pct(s, 0.1)), p25: r(pct(s, 0.25)), median: r(pct(s, 0.5)), p75: r(pct(s, 0.75)), p90: r(pct(s, 0.9)), low: r(s[0]), high: r(s[s.length - 1]) };
}

/** Publication date of a 指南者 case from its id: the dated cases' ids, interpolated (ids grow with time). */
function dater(details: Record<string, Detail>) {
  const known = Object.entries(details)
    .filter(([, d]) => d.date)
    .map(([id, d]) => [Number(id), Date.parse(d.date!)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  if (known.length < 2) return null;
  return (id: number) => {
    const exact = details[id]?.date;
    if (exact) return exact.slice(0, 10);
    let i = known.findIndex(([k]) => k >= id);
    if (i <= 0) i = i === 0 ? 1 : known.length - 1;
    const [x0, y0] = known[i - 1];
    const [x1, y1] = known[i];
    return new Date(y0 + ((id - x0) / (x1 - x0)) * (y1 - y0)).toISOString().slice(0, 10);
  };
}

/** Every linked report since SINCE, by programme id, with how each first degree's tier was read (counted per report). */
export function collect() {
  const { cases } = readJson<{ cases: CompassCase[] }>(COMPASS_CASES_FILE, { cases: [] });
  const matches = readJson<Record<string, ProgrammeMatch>>(PROGRAMME_MATCHES_FILE, {});
  const schools = readJson<Record<string, School>>(SCHOOLS_FILE, {});
  const details = readJson<Record<string, Detail>>(DETAILS_FILE, {});
  const gradcafe = readJson<{ results: GradcafeResult[] }>(GRADCAFE_FILE, { results: [] }).results;
  const feiyue = readJson<{ reports: FeiyueReport[] }>(FEIYUE_FILE, { reports: [] }).reports;
  const jjl = readJson<{ cases: JjlCase[] }>(JJL_FILE, { cases: [] }).cases;
  const xdf = readJson<{ cases: XdfCase[] }>(XDF_FILE, { cases: [] }).cases;
  const cnTier = new Map(readJson<{ universities: { zh: string; tier: "985" | "211" }[] }>(CN_LIST, { universities: [] }).universities.map((u) => [u.zh, u.tier]));
  const dateOf = dater(details);
  const linked = (institutionId: string | null, name: string) => {
    const m = institutionId ? matches[`${institutionId}|${name}`] : null;
    return m?.sure ? m.ids : [];
  };

  const records = new Map<string, Rec[]>();
  const add = (ids: string[], r: Rec) => ids.forEach((id) => records.set(id, [...(records.get(id) ?? []), r]));
  const used: Record<Source, number> = { compass: 0, gradcafe: 0, feiyue: 0, jjl: 0, xdf: 0 };
  let old = 0;

  // 指南者: every case is an offer.
  const mainland = (c: CompassCase) => c.category !== "海外本科";
  const five = fivePointSchools(
    cases.filter(mainland).flatMap((c) => {
      const g = parseBackground(c.background).gpa;
      return g !== null ? [{ school: c.school, gpa: g }] : [];
    }),
  );
  const reader = firstDegreeReader(schools);
  const how: Partial<Record<string, number>> = {};
  const tally = (side: "mainland" | "overseas", r: TierRead) => {
    how[`${side}:${r.how}`] = (how[`${side}:${r.how}`] ?? 0) + 1;
    return r.tier;
  };
  const tierOf = (c: CompassCase): Tier => {
    if (!mainland(c)) return tally("overseas", reader.overseas(c.school));
    const r = reader.mainland(c.school, c.category === "985" || c.category === "211");
    // No university named, only the category ("985", "211高校"): Group A has 36 of the 39 985 universities, Group B
    // every 211 university outside 985.
    if (r.how === "unlisted" && c.category !== "普通本科" && !/大学|学院|[a-z]/i.test(c.school)) return tally("mainland", { tier: c.category === "985" ? "A" : "B", how: "category" });
    return tally("mainland", r);
  };
  const groupOf = (c: CompassCase): Group => {
    if (c.category === "985") return "985";
    if (c.category === "211") return "211";
    if (c.category === "普通本科") return "other";
    const rank = schools[c.school]?.qsRankValue ?? null;
    return rank !== null && rank <= 50 ? "qs50" : rank !== null && rank <= 300 ? "qs300" : "qsRest";
  };
  for (const c of cases) {
    const t = splitTitle(c.title);
    const ids = t ? linked(t.institutionId, t.zh) : [];
    if (!ids.length) continue;
    const date = dateOf ? dateOf(c.id) : null;
    if (date && date < SINCE) {
      old++;
      continue;
    }
    const b = parseBackground(c.background);
    const four = b.gpa !== null ? toFourPoint(b.gpa, { mainland: mainland(c), country: schools[c.school]?.country ?? null, fivePoint: five.has(c.school), ukMarks: ukMarksSchool(c.school) }) : null;
    const d = details[c.id];
    used.compass++;
    add(ids, {
      source: "compass",
      result: "admit",
      date,
      group: groupOf(c),
      tier: tierOf(c),
      gpa: four?.gpa ?? null,
      rule: four?.rule ?? null,
      ielts: b.ielts,
      toefl: b.toefl,
      gre: b.gre,
      gmat: b.gmat,
      status: b.status,
      workYears: b.workYears,
      // A page whose experience lines aren't sorted yet (compass-detail.ts sorts them) isn't counted.
      kinds: d && (d.kinds.length || !d.experiences.length) ? d.kinds : null,
    });
  }

  // GradCafe: accepted, rejected, wait listed (interviews and others are left out); US-style GPAs on 4.0.
  for (const r of gradcafe) {
    const result = r.decision === "accepted" ? "admit" : r.decision === "rejected" ? "reject" : r.decision === "waitlisted" ? "waitlist" : null;
    const ids = result ? linked(r.institutionId, r.programme) : [];
    if (!ids.length || !result) continue;
    if (r.added && r.added < SINCE) continue;
    used.gradcafe++;
    add(ids, { source: "gradcafe", result, date: r.added, group: null, tier: null, gpa: r.gpa !== null && r.gpa <= 4 ? r.gpa : null, rule: r.gpa !== null && r.gpa <= 4 ? "four" : null, ielts: null, toefl: null, gre: r.gre, gmat: null, status: null, workYears: null, kinds: null });
  }

  // 飞跃手册: one graduate's every master's result, with their background.
  for (const p of feiyue) {
    const year = fullYear(p.year);
    if (year !== null && year < Number(SINCE.slice(0, 4))) continue;
    const tier = cnTier.get(p.undergrad);
    const group: Group = tier === "985" ? "985" : tier === "211" ? "211" : "other";
    const firstTier = tally("mainland", reader.mainland(p.undergrad, false));
    const gpa = p.gpa === null ? null : p.gpaScale === 100 || p.gpa > 5 ? toFourPoint(p.gpa, { mainland: true, country: null }) : p.gpaScale === 5 ? toFourPoint(p.gpa, { mainland: true, country: null, fivePoint: true }) : toFourPoint(p.gpa, { mainland: true, country: null });
    const kinds: Kind[] = [...(p.research ? ["research" as const] : []), ...(p.internships ? ["internship" as const] : []), ...(p.workYears ? ["work" as const] : [])];
    for (const x of p.applications) {
      if (x.result === "other") continue;
      const ids = linked(institutionFor(x.university.trim()), x.programme.trim());
      if (!ids.length) continue;
      used.feiyue++;
      add(ids, {
        source: "feiyue",
        result: x.result,
        date: year ? `${year}-01-01` : null,
        group,
        tier: firstTier,
        gpa: gpa?.gpa ?? null,
        rule: gpa?.rule ?? null,
        ielts: p.ielts,
        toefl: p.toefl,
        gre: p.gre,
        gmat: null,
        status: p.workYears ? "working" : null,
        workYears: p.workYears,
        kinds,
      });
    }
  }

  // 金吉列: the agency's success stories, one student's master's results each.
  const qsRank = new Map(readQs().map((u) => [plain(u.name), u.rankValue]));
  const undergradGroup = (school: string | null): Group | null => {
    if (!school) return null;
    const tier = cnTier.get(school);
    if (tier) return tier;
    if (/[㐀-鿿]/.test(school)) {
      const overseas = schools[school];
      if (overseas) return overseas.qsRankValue !== null && overseas.qsRankValue <= 50 ? "qs50" : overseas.qsRankValue !== null && overseas.qsRankValue <= 300 ? "qs300" : "qsRest";
      return /大学|学院/.test(school) ? "other" : null;
    }
    const rank = qsRank.get(plain(school)) ?? null;
    return rank !== null && rank <= 50 ? "qs50" : rank !== null && rank <= 300 ? "qs300" : "qsRest";
  };
  // In the same order as undergradGroup: the 211 list, the agency's overseas mapping, any other mainland name; English names as overseas.
  const undergradTier = (school: string | null): Tier | null => {
    if (!school) return null;
    if (cnTier.has(school)) return tally("mainland", reader.mainland(school, false));
    if (!HAN.test(school) || schools[school]) return tally("overseas", reader.overseas(school));
    return /大学|学院/.test(school) ? tally("mainland", reader.mainland(school, false)) : null;
  };
  for (const c of jjl) {
    if (c.date < SINCE) continue;
    const group = undergradGroup(c.undergrad);
    const firstTier = undergradTier(c.undergrad);
    const mainlandSchool = group === "985" || group === "211" || group === "other";
    const four = c.gpa === null ? null : toFourPoint(c.gpa, { mainland: mainlandSchool, country: null, fivePoint: c.gpaScale === 5, ukMarks: ukMarksSchool(c.undergrad) });
    const kinds: Kind[] = [...(c.research ? ["research" as const] : []), ...(c.internships ? ["internship" as const] : []), ...(c.workYears ? ["work" as const] : [])];
    for (const x of c.applications) {
      if (x.result === "other") continue;
      const ids = linked(institutionFor(x.university.trim()), x.programme.trim());
      if (!ids.length) continue;
      used.jjl++;
      add(ids, { source: "jjl", result: x.result, date: c.date, group, tier: firstTier, gpa: four?.gpa ?? null, rule: four?.rule ?? null, ielts: c.ielts, toefl: c.toefl, gre: c.gre, gmat: c.gmat, status: c.workYears ? "working" : null, workYears: c.workYears, kinds });
    }
  }
  // 新东方: Kaplan degrees, a Singapore private school's (tier C, below QS 300 as a group); offers already linked by id.
  for (const c of xdf) {
    const ucd = c.gpa !== null && c.gpaScale === 4.2 ? ucdToFour(c.gpa) : null;
    const four = ucd !== null ? { gpa: ucd, rule: "ucd-4.2" as const } : c.gpa !== null && c.gpaScale === 4 ? toFourPoint(c.gpa, { mainland: false, country: null }) : null;
    for (const x of c.applications) {
      const date = xdfDate(x);
      if (!x.programmeId || !date) continue;
      if (date < SINCE) {
        old++;
        continue;
      }
      used.xdf++;
      tally("overseas", { tier: "C", how: "private-school" });
      add([x.programmeId], { source: "xdf", result: x.result, date, group: "qsRest", tier: "C", gpa: four?.gpa ?? null, rule: four?.rule ?? null, ielts: null, toefl: null, gre: null, gmat: null, status: null, workYears: null, kinds: null });
    }
  }
  return { records, used, old, five, how };
}

/** data/raw/admit-cases.json as a fresh build would write it (scripts/check-tiers.ts compares the two). */
export function build() {
  const { records, used, old, five, how } = collect();
  const rules: Partial<Record<GpaRule | "unread", number>> = {};
  const tierTotals: Record<Tier, number> = { A: 0, B: 0, C: 0 };
  const programmes: Record<string, unknown> = {};
  let flagged = 0;
  for (const [id, recs] of records) {
    const admits = recs.filter((r) => r.result === "admit");
    const rejects = recs.filter((r) => r.result === "reject");
    if (admits.length + rejects.length < MIN_CASES) continue;
    const mix: Record<Tier, number> = { A: 0, B: 0, C: 0 };
    const groups: Record<Group, number> = { "985": 0, "211": 0, other: 0, qs50: 0, qs300: 0, qsRest: 0 };
    for (const r of admits) {
      if (r.tier) mix[r.tier]++;
      if (r.group) groups[r.group]++;
    }
    for (const t of TIERS) tierTotals[t] += mix[t];
    const gpas = admits.flatMap((r) => (r.gpa !== null ? [r.gpa] : []));
    for (const r of admits) rules[r.rule ?? "unread"] = (rules[r.rule ?? "unread"] ?? 0) + 1;
    const by = new Map<string, number[]>();
    for (const r of admits)
      if (r.gpa !== null && r.group) {
        const k = r.group === "qs50" || r.group === "qs300" || r.group === "qsRest" ? "overseas" : r.group;
        by.set(k, [...(by.get(k) ?? []), r.gpa]);
      }
    const status = { fresh: 0, graduated: 0, working: 0, other: 0 };
    for (const r of admits) if (r.status) status[r.status]++;
    const workYears = admits.flatMap((r) => (r.workYears !== null ? [r.workYears] : []));
    const kinds: Record<Kind | "none", number> = { internship: 0, work: 0, research: 0, competition: 0, project: 0, other: 0, none: 0 };
    let sampled = 0;
    for (const r of admits)
      if (r.kinds) {
        sampled++;
        if (!r.kinds.length) kinds.none++;
        for (const k of new Set(r.kinds)) kinds[k]++;
      }
    const dates = admits.flatMap((r) => (r.date ? [r.date] : [])).sort();
    const count = (list: Rec[]) => Object.fromEntries(SOURCES.map((s) => [s, list.filter((r) => r.source === s).length])) as Record<Source, number>;
    const gpa = spread(gpas, 2);
    const ielts = spread(admits.flatMap((r) => (r.ielts !== null ? [r.ielts] : [])), 1);
    const rejectGpa = spread(rejects.flatMap((r) => (r.gpa !== null ? [r.gpa] : [])), 2);
    const gpaBySource = SOURCES.flatMap((s) => {
      const v = admits.filter((r) => r.source === s && r.gpa !== null).map((r) => r.gpa!);
      return v.length >= MIN_CASES ? [{ source: s, n: v.length, median: spread(v, 2)!.median }] : [];
    });
    // High variance, flagged on the card: a wide spread, sources that disagree, rejections as strong as admits, few reports.
    const flags = [
      gpa && gpa.n >= 10 && (gpa.p90 - gpa.p10 >= 0.8 || gpa.p75 - gpa.p25 >= 0.4) && "gpaWide",
      ielts && ielts.n >= 10 && ielts.p90 - ielts.p10 >= 1.5 && "ieltsWide",
      gpaBySource.length >= 2 && Math.max(...gpaBySource.map((s) => s.median)) - Math.min(...gpaBySource.map((s) => s.median)) >= 0.3 && "sourcesDiffer",
      gpa && rejectGpa && gpa.n >= 5 && rejectGpa.n >= 5 && rejectGpa.median >= gpa.median && "rejectedHigher",
      admits.length < 10 && "few",
    ].filter((f): f is string => !!f);
    if (flags.some((f) => f !== "few")) flagged++;
    programmes[id] = {
      n: admits.length,
      sources: count(admits),
      years: dates.length ? [Number(dates[0].slice(0, 4)), Number(dates[dates.length - 1].slice(0, 4))] : null,
      mix,
      gpa,
      gpaByTier: TIERS.flatMap((t) => {
        const v = admits.flatMap((r) => (r.tier === t && r.gpa !== null ? [r.gpa] : []));
        if (v.length < MIN_CASES) return [];
        const s = spread(v, 2)!;
        return [{ tier: t, n: s.n, p25: s.p25, median: s.median, p75: s.p75, p90: s.p90 }];
      }),
      groups,
      gpaByGroup: ["985", "211", "other", "overseas"].flatMap((k) => {
        const v = by.get(k) ?? [];
        return v.length >= MIN_CASES ? [{ group: k, n: v.length, median: spread(v, 2)!.median }] : [];
      }),
      gpaBySource,
      ielts,
      toefl: spread(admits.flatMap((r) => (r.toefl !== null ? [r.toefl] : [])), 0),
      gre: (() => {
        const v = admits.flatMap((r) => (r.gre !== null ? [r.gre] : []));
        return v.length ? { n: v.length, median: spread(v, 0)!.median } : null;
      })(),
      gmat: (() => {
        // Each score on the Focus Edition scale first: a median over both editions' raw scores is on neither.
        const v = admits.flatMap((r) => (r.gmat !== null ? [gmatFocus(r.gmat)] : []));
        return v.length ? { n: v.length, median: spread(v, 0)!.median, edition: "focus" as const } : null;
      })(),
      status: { ...status, workYears: workYears.length ? spread(workYears, 1)!.median : null },
      experience: sampled ? { sampled, ...kinds } : null,
      rejected: rejects.length ? { n: rejects.length, sources: count(rejects), gpa: rejectGpa && rejectGpa.n >= 3 ? rejectGpa : null } : null,
      waitlisted: recs.filter((r) => r.result === "waitlist").length,
      flags,
    };
  }

  const out = {
    dataset: "Applicants' reported results per programme: 指南者留学 published cases, the GradCafe survey, Chinese universities' 飞跃手册, 金吉列留学 case articles, 新东方 slides of Kaplan Singapore graduates' offers",
    sources: {
      compass: { name: "指南者留学 case library", url: "https://www.compassedu.hk/offer", note: "The agency's published admission cases of its own clients: chosen by it, mostly mainland Chinese applicants, admits only." },
      gradcafe: { name: "GradCafe admissions survey", url: "https://www.thegradcafe.com/survey/", note: "Applicants' own reports, mostly to North American programmes: admits, rejections and waiting lists, with GPA and GRE where given." },
      feiyue: { name: "飞跃手册 (university handbooks)", url: "https://github.com/SUSTech-Application/SUSTechapplication", note: "Graduates' own accounts of all their applications (南方科技大学, 海南大学, 福州大学), admits and rejections." },
      jjl: { name: "金吉列留学 case articles", url: "https://www.jjl.cn/case/", note: "The agency's published success stories: chosen to advertise, often a modest GPA's success, nearly all admits." },
      xdf: { name: "新东方 Kaplan Singapore progression cases", url: "https://www.xdf.cn/", note: "The agency's slides of Kaplan Singapore graduates' master's offers (UCD, Northumbria and Murdoch degrees), each with the offer letter: chosen to advertise, admits only. Supplied as a PDF and transcribed by hand; names left out." },
    },
    checked: readJson<{ checked?: string }>(COMPASS_CASES_FILE, {}).checked ?? today(),
    builtAt: today(),
    notes: [
      "Reported results, not the programmes' own figures: who chose to report, and what an agency chose to publish. Rejections are counted apart from admits.",
      `GPA on the 4-point scale: ${Object.entries(GPA_RULE_TEXT).map(([k, v]) => `${k}: ${v}`).join("; ")}.`,
      "GMAT: each reported score put on the Focus Edition scale with GMAC's concordance table (a score ending in 5 read as a Focus Edition score, any other as a 10th Edition score: Kaplan 360++'s rule), then the median taken (edition \"focus\").",
      `First degrees in tiers A, B and C (lib/tiers.ts): mainland China by the University of Cambridge's Group A and Group B lists (any other mainland institution C; a campus or faculty as its university; a combined name by its best part); everywhere else, Hong Kong, Macau and Taiwan included, the QS World University Rankings 2027 on Kaplan 360++'s rule (rank value ${QS_TIER_A} or better A, ${QS_TIER_A + 1} to ${QS_TIER_B} B, ${QS_TIER_B + 1} or below or not ranked C); a Sino-foreign university as its awarding university; a Singapore private school's degree as C (QS ${QS_TIER_B + 1}+ or unranked), whatever the awarding university. gpaByTier: n, p25, median, p75 and p90 of each tier's GPAs, for a tier with at least ${MIN_CASES}. groups: the six groups used before (985, 211, other mainland universities by the agency's category; overseas by QS band: top 50, 51–300, below or unranked), kept as details.`,
      `Reports are linked to a programme only when Claude was sure the name is the same programme (新东方's offers by hand, from the offer letters); reports from before ${SINCE} are left out; programmes with fewer than ${MIN_CASES} reported admits and rejections get no summary. Flags: gpaWide (middle 80% across 0.8 or more on the 4-point scale, or middle half across 0.4), ieltsWide (middle 80% across 1.5 bands), sourcesDiffer (sources' median GPAs 0.3 or more apart), rejectedHigher (rejected applicants' median GPA at or above admitted ones'), few (under 10 admits).`,
    ],
    counts: { used, olderThanSince: old, programmes: Object.keys(programmes).length, flagged, gpaRules: rules, fivePointSchools: [...five], tiers: { admits: tierTotals, read: Object.fromEntries(Object.entries(how).sort((a, b) => b[1]! - a[1]!)) } },
    programmes,
  };
  return { out, used, old, flagged, tierTotals };
}

function main() {
  const { out, used, old, flagged, tierTotals } = build();
  writeJson(ADMIT_CASES_FILE, out);
  const programmes = out.programmes;
  console.log(`Linked reports: 指南者 ${used.compass} · GradCafe ${used.gradcafe} · 飞跃手册 ${used.feiyue} · 金吉列 ${used.jjl} · 新东方 ${used.xdf} (reports before ${SINCE}: ${old}) · programmes with a summary: ${Object.keys(programmes).length} · flagged for variance: ${flagged} · admits by tier: A ${tierTotals.A} · B ${tierTotals.B} · C ${tierTotals.C}`);
}

// Run only as a script: compass-detail.ts imports the file name and types, scripts/check-tiers.ts the reports and a fresh build.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/pipeline/compass-build.ts")) main();
