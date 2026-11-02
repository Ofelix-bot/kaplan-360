// Skills and common software for the 10 careers from the O*NET® 31.0 Database (U.S. Department of
// Labor, Employment and Training Administration; CC BY 4.0). Download db_31_0_text.zip from
// https://www.onetcenter.org/database.html and unzip it into data/sources/onet/.
// Adds, per career: the O*NET-SOC occupations it maps to, their skills ranked by importance (with
// importance and level ratings), and the software flagged "Hot Technology". Writes data/raw/careers.json.
// Usage: node scripts/data/import-onet.mjs   (after npm run data:mom)

import { readFileSync, writeFileSync } from "node:fs";

const DIR = "data/sources/onet/db_31_0_text";
const SOURCE = {
  id: "onet-31-0",
  title: "O*NET® 31.0 Database",
  publisher: "U.S. Department of Labor, Employment and Training Administration (USDOL/ETA)",
  url: "https://www.onetcenter.org/database.html",
  licence: "CC BY 4.0",
  // Required wording (https://www.onetcenter.org/license_db.html), the "modified" form: we select and rank.
  attribution:
    "This page includes information from the O*NET 31.0 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. Kaplan 360++ has modified all or some of this information. USDOL/ETA has not approved, endorsed, or tested these modifications.",
  modifications: "Selected occupations per career; skills from the first listed occupation with ratings, ranked by importance; software limited to Hot Technology entries, in-demand first, general office and email tools left out.",
  retrievedAt: new Date().toISOString().slice(0, 10),
};

// O*NET-SOC occupations per career; the first is the main one (US occupations, closest match).
const OCCUPATIONS = {
  "data-analyst-scientist": ["15-2051.01", "15-2051.00"],
  "ai-ml-engineer": ["15-1221.00"], // lists "AI Engineer" and "Machine Learning Engineer" among its titles
  "cybersecurity-analyst": ["15-1212.00"],
  "financial-analyst-fintech": ["13-2051.00", "13-2031.00"], // 13-2051.00 has no skill ratings in 31.0: skills from Budget Analysts
  "digital-marketing-manager": ["13-1161.01", "11-2021.00"],
  "supply-chain-logistics-manager": ["11-3071.04"],
  "software-engineer": ["15-1252.00"],
  "registered-nurse": ["29-1141.00"],
  "counsellor-psychology-associate": ["21-1014.00"],
  "communications-pr": ["27-3031.00"],
};

/** Office suites, email and file tools: listed for almost every job, so they say little about this one. */
const GENERIC = /^(Microsoft (Office software|Outlook|Word|Teams|PowerPoint|SharePoint|OneDrive)|Google (Docs|Drive|Sheets|Workspace software|Gmail)|Adobe Acrobat|Email software|Web browser software|Zoom)$/;

const table = (name) => {
  const [head, ...lines] = readFileSync(`${DIR}/${name}.txt`, "utf8").trim().split(/\r?\n/);
  const cols = head.split("\t");
  return lines.map((l) => Object.fromEntries(l.split("\t").map((v, i) => [cols[i], v])));
};
const occData = table("Occupation Data");
const occ = new Map(occData.map((r) => [r["O*NET-SOC Code"], r.Title]));
const occDescription = new Map(occData.map((r) => [r["O*NET-SOC Code"], r.Description]));
const ratings = [...table("Essential Skills").map((r) => ({ ...r, group: "essential" })), ...table("Transferable Skills").map((r) => ({ ...r, group: "transferable" }))];
const software = table("Software Skills");

const file = JSON.parse(readFileSync("data/raw/careers.json", "utf8"));
for (const c of file.careers) {
  const codes = OCCUPATIONS[c.id];
  const main = codes[0];
  if (!occ.has(main)) throw new Error(`${c.id}: ${main} not in O*NET 31.0`);
  const rated = codes.find((code) => ratings.some((r) => r["O*NET-SOC Code"] === code));
  const mine = ratings.filter((r) => r["O*NET-SOC Code"] === rated && r["Recommend Suppress"] !== "Y");
  const byName = new Map();
  for (const r of mine) {
    const s = byName.get(r["Element Name"]) ?? { title: r["Element Name"], group: r.group, importance: null, level: null };
    if (r["Scale ID"] === "IM") s.importance = Number(r["Data Value"]); // 1–5
    if (r["Scale ID"] === "LV" && r["Not Relevant"] !== "Y") s.level = Number(r["Data Value"]); // 0–7
    byName.set(s.title, s);
  }
  const skills = [...byName.values()].filter((s) => s.importance !== null).sort((a, b) => b.importance - a.importance || (b.level ?? 0) - (a.level ?? 0));
  const tools = [...new Map(
    software
      .filter((r) => codes.includes(r["O*NET-SOC Code"]) && r["Hot Technology"] === "Y" && !GENERIC.test(r["Workplace Example"]))
      .map((r) => [r["Workplace Example"], { name: r["Workplace Example"], category: r["Element Name"], inDemand: r["In Demand"] === "Y" }]),
  ).values()].sort((a, b) => Number(b.inDemand) - Number(a.inDemand));
  c.onet = { occupations: codes.map((code) => ({ code, title: occ.get(code), description: occDescription.get(code) })), skillsFrom: rated, skills, software: tools, sourceId: SOURCE.id };
  console.log(c.title.padEnd(36), occ.get(main).padEnd(42), skills.slice(0, 3).map((s) => `${s.title} ${s.importance}`).join(", "), "|", tools.slice(0, 5).map((t) => t.name).join(", "));
}
file.sources = [...file.sources.filter((s) => s.id !== SOURCE.id), SOURCE];
writeFileSync("data/raw/careers.json", JSON.stringify(file, null, 2) + "\n");
