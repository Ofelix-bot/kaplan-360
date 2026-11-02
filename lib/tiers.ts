// First-degree tiers A, B and C: where an applicant took their bachelor's, read the way the University of Cambridge
// reads Chinese universities in mainland China and, everywhere else, by the QS ranking on Kaplan 360++'s rule. The
// admitted-student figures use it (scripts/pipeline/compass-build.ts), and so does /results for the visitor's own degree.
// - Mainland China: Cambridge's Group A and Group B lists (data/raw/tiers/cn-cambridge.json); any other mainland
//   institution is C. A campus counts as its university (山东大学（威海）, 东北大学秦皇岛分校), and so does a faculty:
//   a joint institute by its name (北京工业大学北京-都柏林国际学院), any other (复旦大学上海医学院) when the caller
//   knows the name is one, since "X大学Y学院" is more often an independent college (厦门大学嘉庚学院), which Cambridge
//   does not list. "A大学+B大学" and a joint institute naming both universities (暨南大学伯明翰大学联合学院) take
//   the better tier. Cambridge's lists cover mainland China only.
// - Everywhere else, Hong Kong, Macau and Taiwan included: the QS World University Rankings 2027 rank value (a band at
//   its lower bound): 120 or better A, 121 to 300 B, 301 or below or not ranked C. The 120 / 300 split is Kaplan
//   360++'s rule (the owner's decision of 2026-10-26), not Cambridge's.
// - A degree from a Sino-foreign university in China (data/raw/tiers/awarded-by.json) is read as its awarding
//   university; a private school's degree in Singapore (a Kaplan, SIM or PSB degree, the visitor's own through
//   privateSchoolTier, and reported admits' alike) is tier C, the tier of QS 301+ or unranked, whatever the awarding
//   university (READ_AS), with no further step down: the owner's rule of 2026-10-26, from experience, not a
//   university rule.

import awardedBy from "@/data/raw/tiers/awarded-by.json";
import cambridge from "@/data/raw/tiers/cn-cambridge.json";

export type Tier = "A" | "B" | "C";
export const TIERS: Tier[] = ["A", "B", "C"];
export const MAINLAND = "China (Mainland)";
/** The QS 2027 rank value down to which a university outside mainland China is tier A (Kaplan 360++'s rule). */
export const QS_TIER_A = 120;
/** The QS 2027 rank value down to which a university outside mainland China is tier B; below it, or not ranked, C (Kaplan 360++'s rule). */
export const QS_TIER_B = 300;
/** The tier every private-school degree is read as, whatever the awarding university: the tier of QS 301+ or unranked. */
export const PRIVATE_SCHOOL_TIER: Tier = "C";
/** One tier on the 4-point scale: for a 2:1 Cambridge asks GPA 3.5 from Group A, 3.7 from Group B and 3.9 from any other Chinese university. */
export const TIER_STEP = Math.round((cambridge.twoOneGpa.B - cambridge.twoOneGpa.A) * 100) / 100;
/** Where the mainland lists come from, and the GPA Cambridge asks of each group for a 2:1. */
export const CAMBRIDGE = { url: cambridge.source.url, published: cambridge.published, checked: cambridge.checked, twoOneGpa: cambridge.twoOneGpa };

/** A university on Cambridge's lists: its name as Cambridge gives it, the Chinese name, and other names it goes by. */
export type Listed = { en: string; zh: string; aliases?: string[] };
export const CAMBRIDGE_LISTS: Record<"A" | "B", Listed[]> = { A: cambridge.A, B: cambridge.B };
/** A Sino-foreign university and the university that awards its degrees (id in data/raw/institutions.json, QS 2027 rank value). */
export type Awarded = { zh: string; en: string; aliases?: string[]; awarder: string | null; awarderName: string; awarderQs: number | null; marks?: string };
export const AWARDED: Awarded[] = awardedBy.universities;

/** Outside mainland China: by QS 2027 rank value (a band at its lower bound), A to QS_TIER_A, B to QS_TIER_B, else C; null when not ranked, C. */
export const tierByQs = (rankValue: number | null): Tier => (rankValue === null || rankValue > QS_TIER_B ? "C" : rankValue <= QS_TIER_A ? "A" : "B");
/** The tier below; none below C. */
export const tierBelow = (t: Tier): Tier | null => (t === "A" ? "B" : t === "B" ? "C" : null);
/** The best of some tiers ("A" sorts first). */
export const bestTier = (ts: Tier[]): Tier | null => (ts.length ? [...ts].sort()[0] : null);

const HAN = /[㐀-鿿]/;
/** Chinese names: full-width and half-width forms alike ("（" is "("), no spaces. */
const zhKey = (s: string) => s.normalize("NFKC").replace(/\s+/g, "");
/**
 * English names: case, accents, "the", "(formerly known as …)" and punctuation aside; `loose` drops every bracket too,
 * campuses ("(Wuhan)") and abbreviations ("(USTC)") alike.
 */
const enKey = (s: string, loose = false) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(loose ? /\([^)]*\)/g : /\((?:formerly |also )?known as[^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/\bthe\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const key = (s: string) => (HAN.test(s) ? zhKey(s) : enKey(s));
const names = (u: { en: string; zh: string; aliases?: string[] }) => [u.zh, u.en, ...(u.aliases ?? [])];

const LISTED = new Map<string, Listed & { tier: "A" | "B" }>();
/** English names without their brackets: "China University of Geosciences (Wuhan)" and "(Beijing)" share one, both B. */
const LOOSE = new Map<string, Listed & { tier: "A" | "B" }>();
for (const tier of ["A", "B"] as const)
  for (const u of CAMBRIDGE_LISTS[tier])
    for (const n of names(u)) {
      LISTED.set(key(n), { ...u, tier });
      if (!HAN.test(n) && !LOOSE.has(enKey(n, true))) LOOSE.set(enKey(n, true), { ...u, tier });
    }
const AWARDED_BY = new Map(AWARDED.flatMap((u) => names(u).map((n) => [key(n), u] as const)));

/** A Sino-foreign university in China by any of its names, with the university that awards its degrees. */
export const awardedFor = (name: string): Awarded | null => AWARDED_BY.get(key(name.trim())) ?? null;

/** The universities a campus's name points to, longest first: "山东大学（威海）", "北京交通大学威海校区", "Shandong University, Weihai". */
function campusOf(s: string): string[] {
  if (!HAN.test(s)) {
    const m = /^(.+?)\s*(?:,\s*[a-z ]+|\s+[a-z]+\s+campus)$/i.exec(s);
    return m ? [m[1]] : [];
  }
  const out: string[] = [];
  for (const m of s.matchAll(/大学|学院/g)) {
    const end = m.index + m[0].length;
    if (/^(?:\([^)]+\))?(?:.{0,8}(?:校区|分校))?$/.test(s.slice(end)) && end < s.length) out.push(s.slice(0, end));
  }
  return out.reverse();
}

/** A faculty's name after its university's that marks a joint institute with a university abroad, not an independent college. */
const JOINT = /联合|国际|中外|合作/;

/**
 * "A大学+B大学", "A大学、B大学", "A大学B大学联合学院": the parts of a name that joins two institutions (a joint or
 * 2+2 programme, a joint institute); null for one.
 */
export function combinedParts(name: string): string[] | null {
  const s = name.normalize("NFKC");
  const joint = /^(.+?大学)(.+?大学)(?:联合|合作)(?:国际)?学院$/.exec(s);
  if (joint) return [joint[1], joint[2]];
  const parts = s
    .split(HAN.test(s) ? /[+&、/]/ : /\s*[+/]\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : null;
}

/** How a name was read: as a Sino-foreign university's awarder, a listed university, its campus or faculty, a combined name, or none listed. */
export type How = "awarded" | "listed" | "campus" | "faculty" | "combined" | "unlisted";

/**
 * A mainland institution on Cambridge's lists, by any name it goes by, as a campus of one, or as a joint institute of
 * one; `faculty`: the name may be any faculty or school of one ("上海交通大学医学院").
 */
export function cambridgeListed(name: string, opts: { faculty?: boolean } = {}): (Listed & { tier: "A" | "B"; how: "listed" | "campus" | "faculty" }) | null {
  const s = HAN.test(name) ? zhKey(name) : name.trim();
  const exact = LISTED.get(key(s)) ?? (HAN.test(s) ? undefined : LOOSE.get(enKey(s, true)));
  if (exact) return { ...exact, how: "listed" };
  for (const parent of campusOf(s)) {
    const hit = LISTED.get(key(parent));
    if (hit) return { ...hit, how: "campus" };
  }
  if (HAN.test(s)) {
    const parent = [...LISTED.keys()].filter((k) => HAN.test(k) && s.startsWith(k) && s.length > k.length).sort((a, b) => b.length - a.length)[0];
    if (parent && (opts.faculty || JOINT.test(s.slice(parent.length)))) return { ...LISTED.get(parent)!, how: "faculty" };
  }
  return null;
}

/** Who teaches a degree that another university awards. */
export type TaughtAt = "sino-foreign" | "private-school";
/**
 * How a degree that another university awards is read: as the awarding university ("awarder") or as the place that
 * taught it ("school": a Sino-foreign university as a mainland institution no Cambridge list names, a Singapore
 * private school as an institution QS does not rank, so C either way). Sino-foreign universities as the awarder;
 * private schools as the school, tier C (PRIVATE_SCHOOL_TIER). Every reading of such a degree goes through readAwarded.
 */
export const READ_AS: Record<TaughtAt, "awarder" | "school"> = { "sino-foreign": "awarder", "private-school": "school" };
export const readAwarded = (at: TaughtAt, awarder: Tier, school: Tier = PRIVATE_SCHOOL_TIER): Tier => (READ_AS[at] === "awarder" ? awarder : school);

/**
 * A mainland institution's tier by any name it goes by: a Sino-foreign university as its awarding university, else
 * Cambridge's group (a campus as its university; a faculty too with `faculty`), else C. A combined name takes its best
 * part; `elsewhere` reads a part that may be a university outside the mainland ("海南大学+亚利桑那州立大学").
 */
export function mainlandTier(name: string, opts: { faculty?: boolean; elsewhere?: (part: string) => Tier | null } = {}): { tier: Tier; how: How } {
  const awarded = awardedFor(name);
  if (awarded) return { tier: readAwarded("sino-foreign", tierByQs(awarded.awarderQs)), how: "awarded" };
  const listed = cambridgeListed(name, opts);
  if (listed && listed.how !== "faculty") return { tier: listed.tier, how: listed.how };
  const parts = combinedParts(name);
  if (parts) {
    const each = parts.map((p) => {
      const r = mainlandTier(p, { faculty: opts.faculty });
      return r.how !== "unlisted" ? r.tier : (opts.elsewhere?.(p) ?? "C");
    });
    return { tier: bestTier(each)!, how: "combined" };
  }
  return listed ? { tier: listed.tier, how: listed.how } : { tier: "C", how: "unlisted" };
}

/** A university as the site lists it (data/raw/institutions.json, ResultsUniversity): mainland by Cambridge's lists, elsewhere by QS 2027 (tierByQs). */
export const universityTier = (u: { name: string; country: string | null; qsValue: number | null }): Tier =>
  u.country === MAINLAND ? mainlandTier(u.name).tier : tierByQs(u.qsValue);

/**
 * The visitor's degree a private school teaches and a university awards (a Kaplan, SIM or PSB degree): tier C, as
 * READ_AS says, whatever the awarding university's own tier (tierByQs).
 */
export const privateSchoolTier = (awarder: { qsValue: number | null }): Tier => readAwarded("private-school", tierByQs(awarder.qsValue));

/** A tier's admitted GPAs on one programme (4-point scale), as compass-build.ts stores them for a tier with at least five. */
export type TierBand = { n: number; p25: number; median: number; p75: number; p90: number };
/** The admitted GPAs of one first-degree tier on a programme ("C" for a private-school degree); null under five GPAs. */
export function tierBand(cases: { gpaByTier: ({ tier: Tier } & TierBand)[] } | null | undefined, tier: Tier): TierBand | null {
  const g = cases?.gpaByTier.find((x) => x.tier === tier);
  return g ? { n: g.n, p25: g.p25, median: g.median, p75: g.p75, p90: g.p90 } : null;
}
