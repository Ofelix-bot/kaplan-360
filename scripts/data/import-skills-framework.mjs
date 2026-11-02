// Skills for the 10 careers from the official Skills Framework Dataset (Jobs-Skills Portal, SWDA;
// npx tsx scripts/data/fetch-skills-framework.ts downloads it). Adds each career's framework job
// role and its skills (titles and proficiency levels only) to data/raw/careers.json.
// The portal's terms bar reproducing its content without written permission (decided 2026-10-18):
// only short skill titles and levels are kept, with attribution and a link; no descriptions,
// job role descriptions or work functions. A permission request to SWDA covers the rest.
// Usage: node scripts/data/import-skills-framework.mjs   (after npm run data:mom)

import ExcelJS from "exceljs";
import { readFileSync, writeFileSync } from "node:fs";

const DATASET = "data/sources/skills-framework/jobsandskills-skillsfuture-skills-framework-dataset.xlsx";
const SOURCE = {
  id: "skills-framework-2026q3",
  title: "Skills Framework Dataset (Q3 2026): job roles, critical work functions, technical skills and competencies, critical core skills",
  publisher: "Jobs-Skills Portal, SkillsFuture Singapore / Skills and Workforce Development Agency",
  url: "https://jobsandskills.swda.gov.sg/frameworks/skills-frameworks",
  fileUrl: "https://file.go.gov.sg/jobsandskills-skillsfuture-skills-framework-dataset.xlsx",
  retrievedAt: new Date().toISOString().slice(0, 10),
};

// The framework job role closest to each career (sector | track | job role, exactly as in the dataset).
const ROLES = {
  "data-analyst-scientist": ["Infocomm Technology", "Data and Artificial Intelligence", "Data Analyst / Associate Data Engineer"],
  "ai-ml-engineer": ["Infocomm Technology", "Data and Artificial Intelligence", "Artificial Intelligence / Machine Learning Engineer"],
  "cybersecurity-analyst": ["Infocomm Technology", "Cyber Security", "Security Operations Analyst"],
  "financial-analyst-fintech": ["Accountancy", "Management Accounting", "Management Accountant / Financial Planning and Analysis Analyst / Business Analyst"],
  "digital-marketing-manager": ["Hotel and Accommodation Services", "Sales and Marketing", "Marketing Communications Manager / Digital Marketing Manager / Public Relations Manager / Assistant Marketing Communications Manager / Assistant Digital Marketing Manager / Assistant Public Relations Manager"],
  "supply-chain-logistics-manager": ["Logistics", "Logistics Solutioning and Programme Management", "Logistics Solutions Manager"],
  "software-engineer": ["Infocomm Technology", "Software and Applications", "Software Engineer"],
  "registered-nurse": ["Healthcare", "Nursing", "Staff Nurse"],
  "counsellor-psychology-associate": ["Social Service", "Counselling", "Counsellor"],
  "communications-pr": ["Trade Associations and Chambers", "Branding, Marketing and Communications", "Branding, Marketing & Communications Manager / Assistant Manager"],
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(DATASET);
const rows = (sheet) => {
  const ws = wb.getWorksheet(sheet);
  const head = ws.getRow(1).values.map((v) => String(v ?? "").trim());
  const out = [];
  ws.eachRow((r, i) => {
    if (i === 1) return;
    const o = {};
    head.forEach((h, c) => h && (o[h] = r.getCell(c).text.trim()));
    out.push(o);
  });
  return out;
};
const desc = rows("Job Role_Description");
const skills = rows("Job Role_TSC_CCS");
const roleKey = (r) => `${r.Sector}|${r["Job Role"]}`;
const roleCount = new Set(skills.map(roleKey)).size;
const rolesWith = new Map();
for (const [title, n] of Object.entries(Object.groupBy(skills, (r) => r["TSC_CCS Title"]))) rolesWith.set(title, new Set(n.map(roleKey)).size);
const same = (r, [s, t, j]) => r.Sector === s && r["Job Role"] === j && r.Track.split(" / ").includes(t);

const file = JSON.parse(readFileSync("data/raw/careers.json", "utf8"));
for (const c of file.careers) {
  const role = ROLES[c.id];
  if (!desc.some((r) => same(r, role))) throw new Error(`${c.id}: job role not in dataset: ${role.join(" | ")}`);
  const list = skills
    .filter((r) => same(r, role))
    .map((r) => {
      return {
        title: r["TSC_CCS Title"],
        kind: r["TSC_CCS Type"].toLowerCase() === "ccs" ? "critical-core" : "technical",
        proficiencyLevel: /^\d+$/.test(r["Proficiency Level"]) ? Number(r["Proficiency Level"]) : r["Proficiency Level"] || null,
        code: r["TSC_CCS Code"],
      };
    });
  // Most characteristic first: proficiency weighted by how few job roles across all sectors list the skill,
  // so "Data Visualisation" ranks above skills nearly every role shares.
  const score = (x) => (Number(x.proficiencyLevel) || 1) * Math.log(roleCount / (rolesWith.get(x.title) ?? 1));
  for (const x of list) x.distinctiveness = Number(score(x).toFixed(2));
  list.sort((a, b) => (a.kind === b.kind ? b.distinctiveness - a.distinctiveness : a.kind === "technical" ? -1 : 1));
  c.frameworkRole = { sector: role[0], track: role[1], jobRole: role[2], sourceId: SOURCE.id };
  // One entry per skill title (a title can appear under two codes); the higher-ranked one is kept.
  c.skills = list.filter((x, i) => list.findIndex((y) => y.title === x.title) === i);
  console.log(c.title.padEnd(36), `${list.filter((s) => s.kind === "technical").length} technical, ${list.filter((s) => s.kind !== "technical").length} core ·`, list.slice(0, 3).map((s) => `${s.title} (L${s.proficiencyLevel})`).join(", "));
}
file.sources = [...file.sources.filter((s) => s.id !== SOURCE.id), SOURCE];
writeFileSync("data/raw/careers.json", JSON.stringify(file, null, 2) + "\n");
