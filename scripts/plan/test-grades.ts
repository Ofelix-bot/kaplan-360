// Checks lib/grades.ts and lib/admit-range.ts on typical requirement wordings, Kaplan graduates'
// results and the admission range. Usage: npx tsx scripts/plan/test-grades.ts
import { admitRange, LEVEL_NAME, levelNamed, standing, type Level } from "../../lib/admit-range";
import { chinesePercentToFour, fivePointToFour, fourToUkMark, ukMarkToFour } from "../../lib/gpa4";
import { RANK_NAME, requirementLevel, studentRank, type GoodReading } from "../../lib/grades";
import { academicStructured } from "../../lib/pipeline/requirements";

let failed = 0;
const expect = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(96).slice(0, 96)} → ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

const ntu: GoodReading = { level: 60, how: "own-words", quote: "A good bachelor’s degree (Honours with Second Class Upper or equivalent GPA)" };
// [text, country, good reading, want floor, want main]
const reqs: [string, string | null, GoodReading | null, Level | null, Level | null][] = [
  ["A bachelor's degree with second class honours or above, or equivalent", "Hong Kong SAR", null, 50, 50],
  ["Bachelor's degree with upper second class honours or a GPA of 3.0/4.0", "Hong Kong SAR", null, 60, 60],
  ["a CGPA of 3.3 out of 4.3 or equivalent", "Hong Kong SAR", null, 60, 60],
  ["Bachelor's degree with Grade C+ or above", "Macau SAR", null, 40, 40],
  ["A bachelor's degree with a minimum 2:2", "United Kingdom", null, 50, 50],
  ["Bachelor's degree with a weighted average mark of 65 or above", "Australia", null, 50, 50],
  ["A good Bachelor's degree from any discipline", "Singapore", ntu, 60, 60],
  ["A good Bachelor's degree from any discipline", "Singapore", null, 50, 50],
  ["A minimum of an upper second-class degree. Applicants with a lower second-class degree and relevant work experience may be considered.", "United Kingdom", null, 50, 60],
  ["a first-class or strong upper second-class undergraduate degree with honours", "United Kingdom", null, 65, 65],
  ["A UK High II.i Honours Degree", "United Kingdom", null, 65, 65],
  ["high 2:1 undergraduate Bachelor’s (honours) degree with a final mark of at least 65%", "United Kingdom", null, 65, 65],
  ["Second Class Honours (first division), or", "New Zealand", null, 60, 60],
  ["A bachelor honours degree in psychology (minimum class IIA honours)", "Australia", null, 60, 60],
  ["a 2(ii) undergraduate degree in a relevant subject", "United Kingdom", null, 50, 50],
  ["A recognised undergraduate degree at 3rd class minimum", "United Kingdom", null, 40, 40],
  ["an undergraduate degree of at least second class standard in a relevant subject", "United Kingdom", null, 50, 50],
  ["a cognate Bachelor degree or international equivalent with a minimum GPA of 5/7", "Australia", null, 50, 50],
  ["a bachelor's degree with a B+ Grade Point Average in 300-level courses", "New Zealand", null, 60, 60],
  ["an undergraduate degree in Economics with an admission GPA of at least 3.0 on the 4-point scale", "Canada", null, 60, 60],
  ["A good bachelor's degree in any discipline (Honours merit and above).", "Singapore", ntu, 50, 50],
  ["Bachelor's Degree (preferably with Honours: Merit/Second Class and above) in a related discipline", "Singapore", null, null, null],
  ["You must have a good undergraduate degree majoring in psychology with Honours (preferably 2nd Upper and above).", "Singapore", ntu, 60, 60],
  ["Bachelor's degree with honours or its equivalent from an institution of recognised standing.", "Singapore", null, null, null],
  ["minimum average of 70 per cent (B)", "Canada", null, null, null],
  ["A First degree in a relevant subject", "United Kingdom", null, null, null],
  ["First, applicants must hold a bachelor's degree", "United Kingdom", null, null, null],
  ["a First or a 2:1 in Economics", "United Kingdom", null, 60, 60],
  ["Applicants will normally hold a first or second-class Honours degree in a relevant policing-related subject.", "United Kingdom", null, 50, 50],
  ["Applicants must have achieved a First or strong Second Class Honours degree in a quantitative discipline.", "Ireland", null, 60, 60],
  ["A Bachelor's degree with Second Class Honours (Division One) or above", "Hong Kong SAR", null, 60, 60],
  ["A primary degree with Second Class Honours, Grade I", "Ireland", null, 60, 60],
  ["GPA: Undergraduate GPA calculated on 4.0 scale required", "United States", null, null, null],
  ["usually a minimum overall average in the B+ range (76% at UBC)", "Canada", null, 60, 60],
  ["Students must complete 36 credits with a minimum GPA of 3.000 to be eligible to graduate.", "United States", null, null, null],
  ["A minimum of a 2.2 honours degree, or equivalent, in any subject. Third Class Honours or Ordinary degrees may be considered on a case-by-case basis.", "United Kingdom", null, 40, 50],
  ["This is typically a first-class honours in Computer Science, although students with a second class honours primary degree can also be considered.", "Ireland", null, 50, 70],
  ["The minimum academic requirement for entry to the programme is a First Class Honours (or equivalent). However, a good Second Class Honours (or equivalent) can be deemed sufficient.", "Ireland", null, 50, 70],
  ["The mean undergraduate grade point average of entering students is 3.6 and GRE scores average in the low to mid 600s.", "United States", null, null, null],
  ["candidates must hold a second class honours degree (2.1) or higher in Computer Science", "Ireland", null, 60, 60],
  ["an Honour's Bachelor's degree with a major in Criminology or equivalent with a minimum average of 75% (B+).", "Canada", null, 60, 60],
  ["An honours bachelor's degree in Economics is required for admission. An average of at least \"B+\" is required.", "Canada", null, 60, 60],
  ["A minimum of an upper second-class Bachelor's degree in psychology. A lower second-class UK Bachelor's degree or equivalent may be accepted with evidence of further study.", "United Kingdom", null, 50, 60],
  ["Our entry requirements are listed using standard UK undergraduate degree classifications i.e. first-class honours, upper second-class honours and lower second-class honours. To learn the equivalent for your country, please choose it from the drop-down below.", "United Kingdom", null, null, null],
];
for (const [t, c, g, floor, main] of reqs) {
  const r = requirementLevel(academicStructured(t), t, c, g);
  expect(t, r ? [r.floor, r.main] : [null, null], [floor, main]);
}

console.log("--- stated levels");
const said: [string, Level | null][] = [
  ["Nearly all successful applicants hold a First Class degree in any of the eligible undergraduate degrees", 70],
  ["most successful applicants have a first-class degree or the equivalent", 70],
  ["Admitted students typically have earned a grade point average of at least 3.0 on a 4.0 scale", 60],
  ["most successful applicants have achieved higher GPA scores", null],
  ["preferably 2nd Upper and above", 60],
  ["preferably with Honours: Merit/Second Class and above", 50],
  ["a good first degree", null],
];
for (const [s, want] of said) expect(s, levelNamed(s), want);

console.log("--- students");
const students: [string, Parameters<typeof studentRank>[1], string][] = [
  ["Northumbria University at Newcastle", { classification: "2:1", averageMark: null, degreeGpa: null }, "2:1"],
  ["Northumbria University at Newcastle", { classification: "2:1", averageMark: 66, degreeGpa: null }, "2:1 66"],
  ["University College Dublin", { classification: null, averageMark: null, degreeGpa: 3.2 }, "2:1 62"],
  ["University College Dublin", { classification: null, averageMark: null, degreeGpa: 2.9 }, "2:2 57"],
  ["Murdoch University", { classification: null, averageMark: 82, degreeGpa: null }, "First 71"],
  ["Murdoch University", { classification: null, averageMark: 72, degreeGpa: null }, "2:1 62"],
  ["Murdoch University", { classification: null, averageMark: 66, degreeGpa: null }, "2:2 52"],
  ["Murdoch University", { classification: null, averageMark: null, degreeGpa: 3.0 }, "2:1 60"],
  ["Monash University", { classification: null, averageMark: null, degreeGpa: 2.5 }, "2:2 50"],
  ["Murdoch University", { classification: "first", averageMark: null, degreeGpa: null }, "First"],
];
for (const [u, a, want] of students) {
  const r = studentRank(u, a);
  expect(`${u} ${JSON.stringify(a)}`, r ? `${RANK_NAME[r.rank]}${r.mark !== null ? ` ${Math.round(r.mark)}` : ""}` : null, want);
}

console.log("--- ranges and standing");
const lse = admitRange({ floor: 60, main: 60, evidence: { stats: { applications: 252, places: 35, year: "2025", quote: "", url: "" } }, qs: 56 });
expect("LSE 2:1, 252 applications for 35 places", [lse.usual, lse.basis], [65, "statistics"]);
const ntuMim = admitRange({ floor: 60, main: 60, evidence: undefined, qs: 12 });
expect("NTU MiM, good degree (2:1), QS 12", [ntuMim.usual, ntuMim.basis], [65, "estimate"]);
const imperial = admitRange({ floor: 60, main: 60, evidence: { stated: { level: 70, quote: "", url: "" } }, qs: 2 });
expect("Imperial statistics: nearly all First", [imperial.usual, imperial.basis], [70, "published"]);
const open = admitRange({ floor: 40, main: 40, evidence: undefined, qs: 400 });
expect("Any bachelor's, QS 400", [open.usual, open.basis], [40, "minimum"]);
const alt = admitRange({ floor: 50, main: 60, evidence: { competitive: { quote: "", url: "" } }, qs: 120 });
expect("2:1 main, 2:2 route, competitive, QS 120", [alt.floor, alt.usual], [50, 65]);
for (const [label, you, want] of [
  ["Third vs NTU MiM", { rank: 4, mark: null }, "below"],
  ["2:2 vs NTU MiM", { rank: 3, mark: null }, "below"],
  ["2:1 vs NTU MiM", { rank: 2, mark: null }, "near"],
  ["2:1 61% vs NTU MiM", { rank: 2, mark: 61 }, "meets"],
  ["2:1 66% vs NTU MiM", { rank: 2, mark: 66 }, "in"],
  ["First vs NTU MiM", { rank: 1, mark: null }, "in"],
] as const)
  expect(label, standing(ntuMim, you), want);
expect("2:1 vs a high 2:1 minimum", standing(admitRange({ floor: 65, main: 65, evidence: undefined, qs: 6 }), { rank: 2, mark: null }), "edge");

// Reported admitted students set the usual level once there are enough of them (GPA on the 4-point scale).
expect("4-point bands: 3.3 → 60, 3.5 → 65, 3.7 → 70, 2.7 → 50", [fourToUkMark(3.3), fourToUkMark(3.5), fourToUkMark(3.7), fourToUkMark(2.7)], [60, 65, 70, 50]);
expect("UK 68% → 3.62, 62% → 3.38", [ukMarkToFour(68), ukMarkToFour(62)], [3.62, 3.38]);
expect("Mainland 85% (Peking University rule) → 3.58, 5-point 4.4 → 3.77", [chinesePercentToFour(85), fivePointToFour(4.4)], [3.58, 3.77]);
const reported = admitRange({ floor: 60, main: 60, evidence: { competitive: { quote: "", url: "" } }, qs: 10, cases: { n: 202, p25: 3.55 } });
expect("202 admits, p25 3.55 → high 2:1 from reported admits", [reported.usual, reported.basis], [65, "cases"]);
const few = admitRange({ floor: 60, main: 60, evidence: undefined, qs: 10, cases: { n: 12, p25: 3.8 } });
expect("12 admits: too few, the estimate stands", [few.usual, few.basis], [65, "estimate"]);
const low = admitRange({ floor: 60, main: 60, evidence: undefined, qs: 300, cases: { n: 40, p25: 2.9 } });
expect("admits below the minimum's level: never below the minimum", [low.usual, low.basis], [60, "cases"]);
const stated = admitRange({ floor: 60, main: 60, evidence: { stated: { level: 70, quote: "", url: "" } }, qs: 2, cases: { n: 50, p25: 3.4 } });
expect("the programme's own words come before reported admits", [stated.usual, stated.basis], [70, "published"]);
console.log(`levels: ${Object.values(LEVEL_NAME).join(" < ")}`);

if (failed) {
  console.log(`${failed} failed`);
  process.exit(1);
}
