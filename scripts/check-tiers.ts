// Checks the first-degree tiers (lib/tiers.ts) and the tiered admitted-student figures (data/raw/admit-cases.json from
// scripts/pipeline/compass-build.ts), then prints a summary:
// - outside mainland China, Kaplan 360++'s rule by QS 2027 rank value: 120 A, 121 B, 300 B, 301 C, unranked C;
// - every university on Cambridge's Group A (37) and Group B (81) lists reads as its own entry by each of its names,
//   and whether it is in data/raw/institutions.json (a mainland tier needs no QS rank, so one that isn't is still read);
// - names that collide or that Cambridge files apart from 985/211, campuses, faculties, joint institutes, combined
//   names, and Sino-foreign universities as their awarding universities by its QS rank (whose QS ranks must still agree);
// - every private-school degree is tier C (QS 301+ or unranked): all seven of Kaplan's awarding universities, any QS
//   rank or none, and reported admits from Singapore private schools;
// - XJTLU and UNNC marks read as UK marks (65 → 3.5, where the mainland rule gave 1.70);
// - per programme, the tier mix adds up to the six groups' and to the linked reports, and a tier has its GPA band
//   (n, p25, median, p75, p90, ordered, matching the reports) exactly when at least five of its admits reported a GPA,
//   which lib/tiers.ts tierBand returns; and the file equals a fresh build (compass-build.ts build) but for its date;
// - admits per tier, programmes with a median per tier, and the gaps between tiers' medians on the same programme.
// Exits non-zero on a failure. Usage: npx tsx scripts/check-tiers.ts (after npx tsx scripts/pipeline/compass-build.ts)

import { readFileSync } from "node:fs";
import path from "node:path";
import { ukMarkToFour } from "../lib/gpa4";
import type { ResultsCases } from "../lib/results-types";
import { AWARDED, CAMBRIDGE_LISTS, cambridgeListed, MAINLAND, mainlandTier, PRIVATE_SCHOOL_TIER, privateSchoolTier, QS_TIER_A, QS_TIER_B, readAwarded, tierBand, tierByQs, TIERS, universityTier, type Tier } from "../lib/tiers";
import { build, collect, firstDegreeReader, MIN_CASES } from "./pipeline/compass-build";
import { SCHOOLS_FILE, type School } from "./pipeline/compass-match";
import { toFourPoint, ukMarksSchool } from "./pipeline/compass-lib";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = <T>(file: string): T => JSON.parse(readFileSync(path.join(ROOT, file), "utf8")) as T;
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) failures.push(what);
};

type Row = { id: string; name: string; country: string | null; qs: { rank: string; rankValue: number } | null; kaggle?: { names: string[] } | null };
const roster = read<{ institutions: Row[] }>("data/raw/institutions.json").institutions;
const rowById = new Map(roster.map((r) => [r.id, r]));
const asUniversity = (r: Row) => ({ name: r.name, country: r.country, qsValue: r.qs?.rankValue ?? null });

// 0. Outside mainland China by QS 2027 rank value: top 120 A, 121–300 B, 301+ or unranked C (Kaplan 360++'s rule).
check(QS_TIER_A === 120 && QS_TIER_B === 300, `cut-offs QS ${QS_TIER_A} / ${QS_TIER_B}, expected 120 / 300`);
const QS_RULE: [number | null, Tier][] = [[1, "A"], [120, "A"], [121, "B"], [300, "B"], [301, "C"], [1001, "C"], [null, "C"]];
for (const [v, want] of QS_RULE) check(tierByQs(v) === want, `QS ${v ?? "unranked"} reads as ${tierByQs(v)}, expected ${want}`);
// The same through a university as the site lists it, Hong Kong, Macau and Taiwan included (no mainland list there).
for (const country of ["Hong Kong SAR", "Macau SAR", "Taiwan", "United Kingdom"])
  for (const [v, want] of QS_RULE) check(universityTier({ name: "Any University", country, qsValue: v }) === want, `${country}, QS ${v ?? "unranked"}: ${universityTier({ name: "Any University", country, qsValue: v })}, expected ${want}`);
// Mainland China by Cambridge's lists, whatever the QS rank: a Group B university QS-ranked in the top 120 stays B, an unlisted one C.
check(universityTier({ name: "湖南大学", country: MAINLAND, qsValue: 100 }) === "B" && universityTier({ name: "济南大学", country: MAINLAND, qsValue: 100 }) === "C", "mainland China is read by Cambridge's lists, not by QS");

// 1. Cambridge's lists: each entry by each of its names, and in the roster.
const notInRoster: string[] = [];
const noQs: string[] = [];
for (const tier of ["A", "B"] as const) {
  for (const u of CAMBRIDGE_LISTS[tier]) {
    for (const n of [u.zh, u.en, ...(u.aliases ?? [])]) {
      const hit = cambridgeListed(n);
      check(hit?.tier === tier && hit.zh === u.zh, `Group ${tier} ${u.en}: "${n}" reads as ${hit ? `${hit.tier} ${hit.zh}` : "unlisted"}`);
    }
    const rows = roster.filter((r) => r.country === MAINLAND && [r.name, ...(r.kaggle?.names ?? [])].some((n) => cambridgeListed(n)?.zh === u.zh));
    if (!rows.length) notInRoster.push(`${tier} ${u.zh}`);
    else if (!rows.some((r) => r.qs)) noQs.push(`${tier} ${u.zh}`);
    for (const r of rows) check(universityTier(asUniversity(r)) === tier, `Group ${tier} ${u.en}: roster row ${r.id} reads as ${universityTier(asUniversity(r))}`);
  }
}
check(CAMBRIDGE_LISTS.A.length === 37, `Group A has ${CAMBRIDGE_LISTS.A.length} entries, not 37`);
check(CAMBRIDGE_LISTS.B.length === 81, `Group B has ${CAMBRIDGE_LISTS.B.length} entries, not 81`);
const rankedUnlisted = roster.filter((r) => r.country === MAINLAND && r.qs && mainlandTier(r.name).how === "unlisted");
for (const r of rankedUnlisted) check(universityTier(asUniversity(r)) === "C", `${r.name} (QS ${r.qs!.rank}, on neither list) reads as ${universityTier(asUniversity(r))}`);

// 2. Names: collisions, Cambridge apart from 985/211, campuses, faculties, joint institutes, combined, Sino-foreign.
const NAMES: [string, Tier][] = [
  ["东北大学", "B"], ["湖南大学", "B"], ["西北农林科技大学", "B"], ["南方科技大学", "B"],
  ["苏州大学", "B"], ["暨南大学", "B"], ["济南大学", "C"], ["西北大学", "B"], ["西北工业大学", "A"],
  ["西南大学", "B"], ["西南交通大学", "B"], ["西南财经大学", "B"], ["中国科学院大学", "A"], ["中国科学技术大学", "A"],
  ["国防科学技术大学", "A"], ["第二军医大学", "B"], ["第四军医大学", "B"], ["陆军军医大学", "C"], ["Central China Normal University", "B"],
  ["University of Jinan", "C"], ["Northwestern Polytechnical University", "A"],
  ["山东大学（威海）", "A"], ["山东大学威海分校", "A"], ["哈尔滨工业大学(威海)", "A"], ["哈尔滨工业大学深圳校区", "A"], ["东北大学秦皇岛分校", "B"],
  ["东北大学（中国）", "B"], ["中国石油大学（华东）", "B"], ["中国石油大学（北京）克拉玛依校区", "B"], ["中国矿业大学（北京）", "B"], ["华北电力大学（保定）", "B"],
  ["Harbin Institute of Technology, Shenzhen", "A"],
  ["厦门大学嘉庚学院", "C"], ["浙江大学城市学院", "C"], ["北京工业大学北京-都柏林国际学院", "B"], ["北京理工大学+北京大学", "A"], ["上海旅游高等专科学校+上海师范大学", "C"],
  ["西交利物浦大学", "B"], ["西交利物浦", "B"], ["Xi'an Jiaotong Liverpool University", "B"], ["宁波诺丁汉大学", "A"], ["香港中文大学（深圳）", "A"], ["昆山杜克大学", "A"],
  ["广东以色列理工学院", "C"], ["深圳北理莫斯科大学", "A"], ["北京师范大学-香港浸会大学联合国际学院", "B"], ["北师香港浸会大学", "B"], ["温州肯恩大学", "C"], ["上海纽约大学", "A"],
];
for (const [n, want] of NAMES) {
  const r = mainlandTier(n);
  check(r.tier === want, `"${n}" reads as ${r.tier} (${r.how}), expected ${want}`);
}
check(mainlandTier("复旦大学上海医学院", { faculty: true }).tier === "A" && mainlandTier("复旦大学上海医学院").tier === "C", "复旦大学上海医学院: A only when the name is known to be a faculty");
check(mainlandTier("暨南大学伯明翰大学联合学院", { elsewhere: (p) => (p === "伯明翰大学" ? "A" : null) }).tier === "A", "暨南大学伯明翰大学联合学院 takes the better of 暨南大学 (B) and 伯明翰大学");
for (const name of ["Northeastern University", "Soochow University"]) {
  for (const r of roster.filter((x) => x.name === name && x.country !== MAINLAND)) check(universityTier(asUniversity(r)) === tierByQs(r.qs?.rankValue ?? null), `${name} (${r.country}) is read by QS, not as the mainland university`);
}
for (const a of AWARDED) {
  const read = mainlandTier(a.zh);
  check(read.how === "awarded" && read.tier === tierByQs(a.awarderQs), `${a.zh}: ${read.tier} (${read.how}), expected ${tierByQs(a.awarderQs)} as ${a.awarderName} (QS ${a.awarderQs ?? "unranked"})`);
  const r = a.awarder ? rowById.get(a.awarder) : null;
  check(!a.awarder || (!!r && (r.qs?.rankValue ?? null) === a.awarderQs), `${a.zh}: awarder ${a.awarder} QS ${a.awarderQs} differs from data/raw/institutions.json (${r?.qs?.rankValue ?? "not there"})`);
}

// 3. Private-school degrees: tier C (QS 301+ or unranked) whatever the awarding university.
const KAPLAN = ["monash-university", "university-college-dublin", "aston-university", "murdoch-university", "northumbria-university-at-newcastle", "university-of-portsmouth", "birmingham-city-university"];
check(PRIVATE_SCHOOL_TIER === "C" && PRIVATE_SCHOOL_TIER === tierByQs(QS_TIER_B + 1) && PRIVATE_SCHOOL_TIER === tierByQs(null), `private-school tier ${PRIVATE_SCHOOL_TIER}, not the tier of QS ${QS_TIER_B + 1}+ or unranked`);
for (const v of [1, 120, 121, 300, 301, 1001, null]) check(privateSchoolTier({ qsValue: v }) === "C", `private-school degree, awarder QS ${v ?? "unranked"}: ${privateSchoolTier({ qsValue: v })}, expected C`);
for (const t of TIERS) check(readAwarded("private-school", t) === "C" && readAwarded("sino-foreign", t) === t, `awarder tier ${t}: private school ${readAwarded("private-school", t)}, Sino-foreign ${readAwarded("sino-foreign", t)}`);
// Reported admits' Singapore private schools and campuses, by the names reports give: C, with the awarder's QS rank beside.
const schools = JSON.parse(readFileSync(SCHOOLS_FILE, "utf8")) as Record<string, School>;
const reader = firstDegreeReader(schools);
const sgPrivate = ["Curtin Singapore", "科廷大学新加坡校区", "James Cook University (Singapore Campus)", "PSB Academy"].filter((n) => schools[n]);
for (const n of sgPrivate) {
  const r = reader.overseas(n);
  check(r.tier === "C", `reported first degree "${n}" (awarder QS ${schools[n].qsRank ?? "unranked"}) reads as ${r.tier} (${r.how}), expected C`);
}
check(reader.overseas("新加坡国立大学").tier === "A", "NUS stays tier A: a Singapore university, not a private school");
const kaplanLines = KAPLAN.map((id) => {
  const r = rowById.get(id);
  const t = r ? privateSchoolTier(asUniversity(r)) : null;
  check(t === "C", `${id}: ${t ?? "not in the roster"}, expected C`);
  return `${r?.name ?? id} (QS ${r?.qs?.rank ?? "—"}) ${t}`;
});

// 4. UK-style marks at XJTLU and UNNC.
const at = (school: string, v: number) => toFourPoint(v, { mainland: true, country: null, ukMarks: ukMarksSchool(school) });
const xjtlu65 = at("西交利物浦大学", 65);
const mainlandRule65 = toFourPoint(65, { mainland: true, country: null });
check(xjtlu65?.rule === "uk-mark" && xjtlu65.gpa === ukMarkToFour(65), `XJTLU 65 reads as ${JSON.stringify(xjtlu65)}, not the UK mark ${ukMarkToFour(65)}`);
check(at("西交利物浦大学", 55)?.gpa === ukMarkToFour(55), "XJTLU 55 is read as a UK mark, not left out");
check(at("宁波诺丁汉大学", 67)?.gpa === ukMarkToFour(67), "UNNC 67 is read as a UK mark");
check(at("西交利物浦大学", 3.6)?.gpa === 3.6, "a 4-point GPA from XJTLU stays as it is");
check(!ukMarksSchool("香港中文大学（深圳）") && !ukMarksSchool("昆山杜克大学") && !ukMarksSchool("温州肯恩大学"), "CUHK-Shenzhen, Duke Kunshan and Wenzhou-Kean report 4-point GPAs, not UK marks");

// 5. Per programme: the mix against the six groups and the reports; GPA bands only with five GPAs, ordered, as reported.
const built = read<{ counts: { tiers: { admits: Record<Tier, number>; read: Record<string, number> } }; programmes: Record<string, ResultsCases> }>("data/raw/admit-cases.json");
const { records } = collect();
// The file as a fresh build writes it, its date aside.
const fresh = JSON.parse(JSON.stringify(build().out)) as Record<string, unknown>;
const onFile = read<Record<string, unknown>>("data/raw/admit-cases.json");
for (const k of new Set([...Object.keys(fresh), ...Object.keys(onFile)]))
  if (k !== "builtAt") check(JSON.stringify(fresh[k]) === JSON.stringify(onFile[k]), `data/raw/admit-cases.json "${k}" differs from a fresh build: rerun npx tsx scripts/pipeline/compass-build.ts`);
const summarised = [...records].filter(([, recs]) => recs.filter((r) => r.result === "admit" || r.result === "reject").length >= MIN_CASES);
check(summarised.length === Object.keys(built.programmes).length, `${Object.keys(built.programmes).length} programmes built, ${summarised.length} with enough reports: rebuild first`);
for (const [id, p] of Object.entries(built.programmes)) {
  const admits = (records.get(id) ?? []).filter((r) => r.result === "admit");
  const tierSum = TIERS.reduce((s, t) => s + p.mix[t], 0);
  const groupSum = Object.values(p.groups).reduce((s, n) => s + n, 0);
  check(tierSum === groupSum, `${id}: tiers add up to ${tierSum}, the six groups to ${groupSum}`);
  for (const t of TIERS) {
    check(p.mix[t] === admits.filter((r) => r.tier === t).length, `${id}: tier ${t} ${p.mix[t]} against ${admits.filter((r) => r.tier === t).length} reports`);
    const gpas = admits.flatMap((r) => (r.tier === t && r.gpa !== null ? [r.gpa] : [])).sort((a, b) => a - b);
    const n = gpas.length;
    const m = p.gpaByTier.find((x) => x.tier === t);
    const band = tierBand(p, t);
    check(m ? m.n === n && n >= MIN_CASES : n < MIN_CASES, `${id}: tier ${t} has ${n} GPAs and ${m ? `a band of ${m.n}` : "no band"}`);
    check(!!band === !!m, `${id}: tierBand(${t}) is ${band ? "a band" : "null"}, the file has ${m ? "one" : "none"}`);
    if (band) {
      check(band.p25 <= band.median && band.median <= band.p75 && band.p75 <= band.p90, `${id}: tier ${t} band out of order: ${JSON.stringify(band)}`);
      check(band.p25 >= gpas[0] && band.p90 <= gpas[n - 1], `${id}: tier ${t} band ${JSON.stringify(band)} outside its GPAs ${gpas[0]}–${gpas[n - 1]}`);
    }
  }
}

// Summary.
const sum = (f: (p: ResultsCases) => number) => Object.values(built.programmes).reduce((s, p) => s + f(p), 0);
const total = TIERS.map((t) => sum((p) => p.mix[t]));
const groupTotal = sum((p) => Object.values(p.groups).reduce((s, n) => s + n, 0));
const withMedian = TIERS.map((t) => Object.values(built.programmes).filter((p) => tierBand(p, t)).length);
const gap = (hi: Tier, lo: Tier) => {
  const d = Object.values(built.programmes).flatMap((p) => {
    const a = p.gpaByTier.find((x) => x.tier === lo);
    const b = p.gpaByTier.find((x) => x.tier === hi);
    return a && b ? [b.median - a.median] : [];
  });
  const s = [...d].sort((x, y) => x - y);
  const mid = s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : NaN;
  const mean = d.reduce((x, y) => x + y, 0) / d.length;
  return `${d.length} programmes, average ${mean >= 0 ? "+" : ""}${mean.toFixed(3)}, median ${mid >= 0 ? "+" : ""}${mid.toFixed(2)}, higher in ${Math.round((100 * d.filter((x) => x > 0).length) / d.length)}%`;
};
console.log(
  [
    `Cambridge's lists: Group A ${CAMBRIDGE_LISTS.A.length}, Group B ${CAMBRIDGE_LISTS.B.length}, ${[...CAMBRIDGE_LISTS.A, ...CAMBRIDGE_LISTS.B].reduce((s, u) => s + 2 + (u.aliases?.length ?? 0), 0)} names in all (Chinese, Cambridge's English, aliases).`,
    `  Not in data/raw/institutions.json (${notInRoster.length}): ${notInRoster.join(", ")}.`,
    `  They are read by the names reports give, through the lists; a mainland tier needs no QS rank.`,
    `  In it without a QS rank (${noQs.length}): ${noQs.join(", ")}.`,
    `  QS-ranked mainland universities on neither list, all C: ${rankedUnlisted.length}.`,
    `Kaplan's awarding universities, as private-school degrees: ${kaplanLines.join(" · ")}.`,
    `Reported first degrees from Singapore private schools checked as C: ${sgPrivate.join(", ")}; read as private-school in the build: ${built.counts.tiers.read["overseas:private-school"] ?? 0}.`,
    `XJTLU 65: ${xjtlu65?.gpa} (${xjtlu65?.rule}); the mainland percentage rule gave ${mainlandRule65?.gpa}.`,
    `Admits by tier over ${Object.keys(built.programmes).length} programmes: A ${total[0]} · B ${total[1]} · C ${total[2]} (sum ${total.reduce((s, n) => s + n, 0)}; the six groups ${groupTotal}).`,
    `Programmes with a GPA band (≥${MIN_CASES} GPAs: n, p25, median, p75, p90): A ${withMedian[0]} · B ${withMedian[1]} · C ${withMedian[2]}.`,
    `Gap in median GPA on the same programme, B − A: ${gap("B", "A")}.`,
    `Gap in median GPA on the same programme, C − B: ${gap("C", "B")}.`,
    `How first degrees were read (linked reports): ${Object.entries(built.counts.tiers.read).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
  ].join("\n"),
);
if (failures.length) {
  console.log(`\n${failures.length} check(s) failed:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("\nAll tier checks passed.");
