// Server side of /pathway: the collected programmes (data/raw/topups.json) as cards, with fees in S$,
// the field each belongs to, and whether CSCSE's list covers the school and the university.

import cscse from "@/data/raw/cscse-sg-2026-09.json";
import fx from "@/data/raw/fx-mas.json";
import kaplan from "@/data/raw/kaplan-programmes.json";
import raw from "@/data/raw/topups.json";
import access from "@/data/raw/topup-international.json";
import scholarships from "@/data/raw/topup-scholarships.json";
import { fieldOf, type Route, type TopupCard } from "@/lib/topups";

type Raw = {
  id: string;
  provider: string;
  kaplanId: string | null;
  name: string;
  university: string | null;
  route: Route | null;
  routeText: string | null;
  months: [number, number] | null;
  intakeMonths: number[];
  coreModules: string[];
  qualifications: { text: string }[];
  fieldRequirement: string | null;
  gradeRequirement: string | null;
  english: string[];
  ieltsMin: number | null;
  workExperience: string | null;
  international: boolean | null;
  fees: { applicant: "local" | "international" | "all"; amount: number; currency: string; text: string }[];
  grants: { title: string }[];
  url: string;
  retrievedAt: string;
};

/** Every school students can come from: Kaplan, the CSCSE list's private institutions, and Amity. */
export type School = { id: string; name: string; cscseFrom: string | null };

const RATES = fx.rates as Record<string, number>;
const sgd = (amount: number, currency: string) => (currency === "SGD" ? amount : RATES[currency] ? amount * RATES[currency] : null);

const PROVIDER_NAMES: Record<string, string> = {
  kaplan: "Kaplan Higher Education Academy",
  "psb-academy": "PSB Academy",
  sim: "Singapore Institute of Management",
  "jcu-singapore": "James Cook University, Singapore Campus",
  "curtin-singapore": "Curtin Education Centre",
  "amity-singapore": "Amity Global Institute",
};
const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** CSCSE's names for the institutions whose programmes we collected, keyed by our provider id. */
const CSCSE_ID: Record<string, string> = {
  "Kaplan Higher Education Academy": "kaplan",
  "PSB Academy": "psb-academy",
  "Singapore Institute of Management": "sim",
  "James Cook University, Singapore Campus": "jcu-singapore",
  "Curtin Education Centre": "curtin-singapore",
};

const rows = cscse.rows as { university: string | null; institution: string; from: string }[];
const uniKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(the|university|of|at newcastle|national|ireland|,)\b/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim();

export const SCHOOLS: School[] = [
  { id: "kaplan", name: "Kaplan Higher Education Academy", cscseFrom: "2011-07" },
  ...[...new Map(rows.map((r) => [r.institution, r.from])).entries()]
    .filter(([name]) => name !== "Kaplan Higher Education Academy")
    .map(([name, from]) => ({ id: CSCSE_ID[name] ?? slug(name), name, cscseFrom: from })),
  { id: "amity-singapore", name: "Amity Global Institute", cscseFrom: null },
].sort((a, b) => (a.id === "kaplan" ? -1 : b.id === "kaplan" ? 1 : a.name.localeCompare(b.name)));

function cscseFor(provider: string, university: string | null): TopupCard["cscse"] {
  const name = PROVIDER_NAMES[provider];
  const listed = rows.filter((r) => r.institution === name);
  if (!listed.length) return null;
  const pair = !!university && listed.some((r) => r.university && uniKey(r.university) === uniKey(university));
  return { from: listed[0].from, pair };
}

// Study modes re-read from each page (scripts/topups/international.ts) override collect.ts's reading.
const VERDICTS = new Map(access.verdicts.map((v) => [v.id, v]));
const DOUBLES = access.murdochDoubleMajors.map((d) => ({
  ...d,
  fee: Number(d.feeText?.match(/S\$([\d,]+(\.\d+)?)/)?.[1].replace(/,/g, "")) || null,
}));
/** "Bachelor of Business in Accounting" → "accounting". */
const majorOf = (name: string) => name.replace(/\((single|double) major\)/i, "").match(/\bin\s+(.+)$/i)?.[1].trim().toLowerCase() ?? null;

const kaplanDiscipline = new Map(kaplan.programmes.map((p) => [p.id, p.discipline]));
const kaplanUniversity = new Map(kaplan.programmes.map((p) => [p.id, p.university]));

export const TOPUPS: TopupCard[] = (raw.programmes as unknown as Raw[]).map((t) => {
  const fee = (who: "local" | "international") => {
    const list = t.fees.filter((f) => f.applicant === who || f.applicant === "all").map((f) => sgd(f.amount, f.currency)).filter((n): n is number => n != null);
    return list.length ? Math.round(Math.min(...list)) : null;
  };
  const verdict = VERDICTS.get(t.id);
  const major = verdict?.mode === "local-only" ? majorOf(t.name) : null;
  return {
    id: t.id,
    provider: t.provider,
    providerName: PROVIDER_NAMES[t.provider] ?? t.provider,
    kaplanId: t.kaplanId,
    name: t.name,
    university: (t.kaplanId && kaplanUniversity.get(t.kaplanId)) || t.university,
    discipline: (t.kaplanId && kaplanDiscipline.get(t.kaplanId)) || fieldOf(t.name),
    route: t.route,
    routeText: t.routeText,
    months: t.months,
    intake: t.intakeMonths.reduce((m, x) => m | (1 << (x - 1)), 0),
    coreModules: t.coreModules,
    qualifications: t.qualifications.map((q) => q.text),
    fieldRequirement: t.fieldRequirement,
    gradeRequirement: t.gradeRequirement,
    english: t.english,
    ieltsMin: t.ieltsMin,
    workExperience: t.workExperience,
    international: verdict ? verdict.mode === "full-time" : t.international,
    access: verdict && verdict.mode !== "full-time" ? (verdict.mode as TopupCard["access"]) : null,
    accessQuote: verdict?.quote ?? null,
    doubleMajors: major ? DOUBLES.filter((d) => d.majors.some((m) => m.toLowerCase() === major)).map(({ name, url, fee, feeText }) => ({ name, url, fee, feeText })) : [],
    feeLocal: fee("local"),
    feeInternational: fee("international"),
    feeText: t.fees[0]?.text ?? null,
    // Referral rebates and union training funds aren't scholarships; education grants and awards are.
    grants: t.grants.map((g) => g.title).filter((g) => !/referral|UTAP|NTUC|SkillsFuture/i.test(g)),
    cscse: cscseFor(t.provider, (t.kaplanId && kaplanUniversity.get(t.kaplanId)) || t.university),
    url: t.url,
    retrievedAt: t.retrievedAt,
  };
});

export const SCHOLARSHIPS = scholarships.items;
