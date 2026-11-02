// Median monthly wages for the 10 in-demand careers, from MOM's Occupational Wage Tables 2025
// (Occupational Wage Survey, June 2025; released 30 June 2026). Reads Table 1 (all industries,
// full-time resident employees) from data/sources/mom/ and writes data/raw/careers.json.
// Each career maps to SSOC 2024 occupations; the first one gives the headline figure.
// Usage: node scripts/data/import-mom-wages.mjs   (download the xlsx first; see README)

import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";

const TABLE = "data/sources/mom/mrsd_2025Wages_table1.xlsx";
const SOURCE = {
  id: "mom-ows-2025",
  title: "Occupational Wage Tables 2025, Table 1: median monthly basic and gross wages of full-time resident employees in common occupations, all industries, June 2025",
  publisher: "Manpower Research & Statistics Department, Ministry of Manpower",
  url: "https://stats.mom.gov.sg/Pages/Occupational-Wages-Tables2025.aspx",
  fileUrl: "https://stats.mom.gov.sg/iMAS_Tables1/Wages/Wages_2025/mrsd_2025Wages_table1.xlsx",
  referencePeriod: "June 2025",
  retrievedAt: new Date().toISOString().slice(0, 10),
  notes: "Gross wage = basic wage plus fixed allowances, overtime and commissions; excludes bonuses and employer CPF. Full-time resident (citizen and PR) employees.",
};

// Careers on the homepage (decided 2026-10-18), with their SSOC 2024 occupations.
const CAREERS = [
  { id: "data-analyst-scientist", title: "Data Analyst / Data Scientist", disciplines: ["ai-data", "it"], ssoc: ["21231", "21222"] },
  { id: "ai-ml-engineer", title: "AI / Machine Learning Engineer", disciplines: ["ai-data", "it"], ssoc: ["25143"] },
  { id: "cybersecurity-analyst", title: "Cybersecurity Analyst", disciplines: ["it"], ssoc: ["25243", "25241"] },
  { id: "financial-analyst-fintech", title: "Financial Analyst / FinTech", disciplines: ["accounting-finance"], ssoc: ["24131"] },
  { id: "digital-marketing-manager", title: "Digital Marketing Manager", disciplines: ["marketing", "business"], ssoc: ["24314", "12222"] },
  { id: "supply-chain-logistics-manager", title: "Supply Chain & Logistics Manager", disciplines: ["business"], ssoc: ["13241"] },
  { id: "software-engineer", title: "Software Engineer", disciplines: ["it"], ssoc: ["25121", "25122"] },
  { id: "registered-nurse", title: "Registered Nurse", disciplines: ["healthcare-nursing"], ssoc: ["22200"] },
  { id: "counsellor-psychology-associate", title: "Counsellor / Psychology Associate", disciplines: ["psychology-counselling"], ssoc: ["26633", "26611"] },
  { id: "communications-pr", title: "Communications / PR", disciplines: ["communication", "marketing"], ssoc: ["24320"] },
];

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(TABLE);
const ws = wb.getWorksheet("T1");
const rows = new Map();
ws.eachRow((r, i) => {
  if (i < 9) return;
  const ssoc = r.getCell(2).text.trim();
  if (!/^\d{5}$/.test(ssoc)) return;
  const num = (c) => (/^\d+$/.test(r.getCell(c).text.trim()) ? Number(r.getCell(c).text.trim()) : null); // "s" = suppressed
  rows.set(ssoc, { ssoc, occupation: r.getCell(3).text.trim(), basicMedian: num(4), grossMedian: num(5), row: i });
});

const careers = CAREERS.map((c, i) => {
  const occupations = c.ssoc.map((code) => {
    const o = rows.get(code);
    if (!o) throw new Error(`SSOC ${code} not in ${TABLE}`);
    return { ...o, sheet: "T1" };
  });
  return { ...c, sortOrder: i + 1, medianGrossWage: occupations[0].grossMedian, occupations, sourceId: SOURCE.id };
});

writeFileSync("data/raw/careers.json", JSON.stringify({ sources: [SOURCE], careers }, null, 2) + "\n");
for (const c of careers) console.log(c.title.padEnd(36), occupations(c));
function occupations(c) {
  return c.occupations.map((o) => `${o.occupation} S$${o.grossMedian}`).join(" · ");
}
