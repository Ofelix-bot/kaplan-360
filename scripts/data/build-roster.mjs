// Builds the institution roster (data/raw/institutions.json) from:
//   1. the Kaggle dataset mylesoneill/world-university-rankings (THE, CWUR, ARWU files), used as a
//      roster only: its old ranks are not kept;
//   2. QS World University Rankings 2027 (data/raw/qs-wur-2027.json, from import-qs.mjs);
//   3. Kaplan Singapore's partner universities.
// Run with: npm run data:roster   (after npm run data:qs)
//
// The Kaggle CSVs live in data/sources/kaggle-world-university-rankings/ (not committed: the dataset's
// licence is "Data files © Original Authors"). Download them with kagglehub or the Kaggle CLI.

import { readFileSync, writeFileSync } from "node:fs";

const SRC = new URL("../../data/sources/kaggle-world-university-rankings/", import.meta.url);
const QS = JSON.parse(readFileSync(new URL("../../data/raw/qs-wur-2027.json", import.meta.url), "utf8"));
const OUT = new URL("../../data/raw/institutions.json", import.meta.url);

// QS 2027 names of Kaplan Singapore's partners (kaplan.com.sg/university/*, checked 2026-10-18).
// International students on a Student's Pass can choose only Murdoch, UCD, Northumbria and Portsmouth
// (Kaplan Degree Enrolment Day deck, 9 Mar 2026, p.15).
const KAPLAN_PARTNERS = {
  "Aston University": { studentPass: false },
  "Birmingham City University": { studentPass: false },
  "Monash University": { studentPass: false },
  "Murdoch University": { studentPass: true },
  "Northumbria University at Newcastle": { studentPass: true },
  "University College Dublin": { studentPass: true },
  "University of Portsmouth": { studentPass: true },
};
// Hong Kong and Macau joined on 2026-10-20: with Singapore, the first reference for private-school students.
const TIER1_COUNTRIES = new Set(["Singapore", "United Kingdom", "Australia", "Ireland", "Hong Kong SAR", "Macau SAR"]);
// Institutions in neither QS 2027 nor the Kaggle roster, added by hand (official sites checked 2026-10-20):
// Kaplan itself, for the master's it teaches with partner universities, and two universities the user listed.
const MANUAL = [
  { id: "kaplan-higher-education-academy", name: "Kaplan Higher Education Academy", country: "Singapore", url: "https://www.kaplan.com.sg/" },
  { id: "hang-seng-university-of-hong-kong", name: "The Hang Seng University of Hong Kong", country: "Hong Kong SAR", url: "https://www.hsu.edu.hk/" },
  { id: "macao-university-of-tourism", name: "Macao University of Tourism", country: "Macau SAR", url: "https://www.utm.edu.mo/" },
];
// Programme data is collected for the QS top 500 everywhere, in phases (decided 2026-10-19).
const TIER1_QS_MAX = 500;

// Kaggle country spellings → QS spellings.
const COUNTRY = {
  "United States of America": "United States",
  USA: "United States",
  UK: "United Kingdom",
  "Republic of Ireland": "Ireland",
  "Unted Kingdom": "United Kingdom",
  "Unisted States of America": "United States",
  China: "China (Mainland)",
  "Hong Kong": "Hong Kong SAR",
  Macau: "Macau SAR",
  "Russian Federation": "Russia",
  Czechia: "Czech Republic",
};

// Kaggle names that are renamed, merged or differently spelled institutions, mapped to their
// QS 2027 name (or to one Kaggle spelling for duplicates). Checked 2026-10-18.
const ALIAS = {
  "University College London": "UCL",
  "City University London": "City St George’s, University of London", // merged with St George's, 2024
  "National University of Ireland, Maynooth": "Maynooth University",
  "Dublin Institute of Technology": "Technological University Dublin", // merged into TU Dublin, 2019
  "University of South Australia": "Adelaide University", // merged with the University of Adelaide, 2026
  "University of Central Lancashire": "University of Lancashire", // renamed 2025
  "Royal Veterinary College, University of London": "Royal Veterinary College",
};

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((v) => v.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, j) => [h.trim(), (r[j] ?? "").trim()])));
}

const norm = (s) =>
  s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/^\s*the\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
const STOP = new Set(["of", "the", "and", "at", "in", "de", "di", "la"]);
const tokens = (s) => new Set(norm(s).split(" ").filter((t) => t && !STOP.has(t)));
const slug = (s) => norm(s).replace(/ /g, "-");
const country = (c) => (c ? COUNTRY[c] ?? c : null);

// 1. Kaggle roster
const kaggle = new Map(); // norm name → { names:Set, country, sources:Set, lastYear }
function add(name, ctry, source, year) {
  if (!name) return;
  const key = norm(ALIAS[name] ?? name);
  const e = kaggle.get(key) ?? { names: new Set(), country: null, sources: new Set(), lastYear: 0 };
  e.names.add(name);
  e.country ??= country(ctry);
  e.sources.add(source);
  e.lastYear = Math.max(e.lastYear, Number(year) || 0);
  kaggle.set(key, e);
}
for (const r of parseCsv(readFileSync(new URL("timesData.csv", SRC), "utf8"))) add(r.university_name, r.country, "THE", r.year);
for (const r of parseCsv(readFileSync(new URL("cwurData.csv", SRC), "utf8"))) add(r.institution, r.country, "CWUR", r.year);
for (const r of parseCsv(readFileSync(new URL("shanghaiData.csv", SRC), "utf8"))) add(r.university_name, null, "ARWU", r.year);
const schoolCountry = new Map(
  parseCsv(readFileSync(new URL("school_and_country_table.csv", SRC), "utf8")).map((r) => [norm(r.school_name), country(r.country)]),
);
for (const [key, e] of kaggle) e.country ??= schoolCountry.get(key) ?? null;

// 2. Match Kaggle names to QS 2027
const qsByNorm = new Map(QS.universities.map((u) => [norm(u.name), u]));
const qsTokens = QS.universities.map((u) => ({ u, t: tokens(u.name) }));
function matchQs(key, e) {
  if (qsByNorm.has(key)) return { u: qsByNorm.get(key), how: "exact" };
  // Same country, every Kaggle token present in the QS name, at most two extra QS tokens
  // (e.g. "Northumbria University" → "Northumbria University at Newcastle").
  const t = [...tokens([...e.names][0])];
  if (t.length < 2 || !e.country) return null;
  const hits = qsTokens.filter(
    ({ u, t: qt }) => u.country === e.country && t.every((x) => qt.has(x)) && qt.size - t.length <= 2,
  );
  return hits.length === 1 ? { u: hits[0].u, how: "token-subset" } : null;
}

const byId = new Map();
const unmatched = [];
for (const u of QS.universities) {
  byId.set(`qs-${u.qsId}`, {
    id: slug(u.name),
    name: u.name,
    country: u.country,
    qs: { id: u.qsId, rank: u.rank, rankValue: u.rankValue < 1e9 ? u.rankValue : null, url: u.url },
    kaggle: null,
  });
}
for (const [key, e] of kaggle) {
  const m = matchQs(key, e);
  const k = { names: [...e.names], sources: [...e.sources].sort(), lastYear: e.lastYear, match: m?.how ?? null };
  if (m) {
    const rec = byId.get(`qs-${m.u.qsId}`);
    if (rec.kaggle) {
      rec.kaggle.names.push(...k.names);
      rec.kaggle.sources = [...new Set([...rec.kaggle.sources, ...k.sources])].sort();
      rec.kaggle.lastYear = Math.max(rec.kaggle.lastYear, k.lastYear);
    } else rec.kaggle = k;
  } else {
    unmatched.push({ name: k.names[0], country: e.country });
    byId.set(`kg-${key}`, { id: slug(k.names[0]), name: k.names[0], country: e.country, qs: null, kaggle: k });
  }
}

for (const m of MANUAL) if (![...byId.values()].some((r) => r.name === m.name)) byId.set(`manual-${m.id}`, { id: m.id, name: m.name, country: m.country, qs: null, kaggle: null, manual: { url: m.url } });

const institutions = [...byId.values()].map((r) => {
  const partner = KAPLAN_PARTNERS[r.name];
  return {
    ...r,
    kaplanPartner: partner ? { studentPass: partner.studentPass } : null,
    tier: partner || TIER1_COUNTRIES.has(r.country) || (r.qs?.rankValue ?? Infinity) <= TIER1_QS_MAX ? 1 : 2,
    sources: [r.qs && "qs-wur-2027", r.kaggle && "kaggle-wur", partner && "kaplan-partners", r.manual && "manual"].filter(Boolean),
  };
});
// Ids must be unique: suffix the country when two institutions share a name slug.
const seen = new Map();
for (const r of institutions) seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
for (const r of institutions) if (seen.get(r.id) > 1) r.id = `${r.id}-${slug(r.country ?? "unknown")}`;
institutions.sort((a, b) => (a.qs?.rankValue ?? 1e9) - (b.qs?.rankValue ?? 1e9) || a.name.localeCompare(b.name));

const missingPartners = Object.keys(KAPLAN_PARTNERS).filter((n) => !institutions.some((r) => r.name === n));
if (missingPartners.length) throw new Error(`Partners missing from QS 2027: ${missingPartners.join(", ")}`);

const out = {
  dataset: "Institution roster",
  builtAt: new Date().toLocaleDateString("sv-SE"),
  sources: {
    "qs-wur-2027": { name: QS.dataset, url: QS.source, retrievedAt: QS.retrievedAt },
    "kaggle-wur": {
      name: "World University Rankings (Kaggle: mylesoneill/world-university-rankings), THE 2011–2016, CWUR 2012–2015, ARWU 2005–2015",
      url: "https://www.kaggle.com/datasets/mylesoneill/world-university-rankings",
      note: "Used as a roster only; its ranks are not kept. Licence: Data files © Original Authors.",
    },
    "kaplan-partners": { name: "Kaplan Singapore partner universities", url: "https://www.kaplan.com.sg/" },
  },
  notes: [
    "Kaggle names are matched to QS 2027 by exact normalised name, or by a same-country token subset with at most two extra tokens. Unmatched Kaggle names stay as separate records without a QS rank; some are spelling variants of a QS institution and are listed in unmatchedKaggle for review.",
    "tier 1 = Kaplan partner, located in Singapore, the United Kingdom, Australia or Ireland, or in the QS 2027 top 500: programme-level data is collected for these, in phases (English-speaking countries and Hong Kong first). tier 2 = institution record only for now.",
  ],
  counts: {
    total: institutions.length,
    withQsRank: institutions.filter((r) => r.qs).length,
    kaggleOnly: institutions.filter((r) => !r.qs).length,
    tier1: institutions.filter((r) => r.tier === 1).length,
    kaplanPartners: institutions.filter((r) => r.kaplanPartner).length,
  },
  institutions,
  unmatchedKaggle: unmatched.sort((a, b) => (a.country ?? "").localeCompare(b.country ?? "") || a.name.localeCompare(b.name)),
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out.counts));
