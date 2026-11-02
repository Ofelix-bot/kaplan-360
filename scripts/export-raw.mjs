// Exports every data/raw/*.json dataset to exports/kaplan360-raw-data.xlsx,
// one worksheet per dataset plus a Sources sheet. Run: npm run export:raw

import { readdir, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

const RAW_DIR = path.resolve("data/raw");
const OUT = path.resolve("exports/kaplan360-raw-data.xlsx");

const flatten = (value) =>
  value == null ? "" : typeof value === "object" ? JSON.stringify(value) : value;

const files = (await readdir(RAW_DIR)).filter((f) => f.endsWith(".json")).sort();
const wb = new ExcelJS.Workbook();
wb.creator = "Kaplan 360++";
const sourceRows = [];

for (const file of files) {
  const data = JSON.parse(await readFile(path.join(RAW_DIR, file), "utf8"));
  const name = path.basename(file, ".json");
  const records = data.records ?? [];
  const columns = [...new Set(records.flatMap((r) => Object.keys(r)))];

  const ws = wb.addWorksheet(name.slice(0, 31));
  ws.columns = columns.map((key) => ({ header: key, key, width: key === "verbatimQuote" ? 80 : 22 }));
  for (const r of records) ws.addRow(Object.fromEntries(columns.map((c) => [c, flatten(r[c])])));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const [id, s] of Object.entries(data.sources ?? {})) {
    sourceRows.push({ dataset: name, id, ...s });
  }
}

const sources = wb.addWorksheet("sources");
sources.columns = ["dataset", "id", "name", "url", "kind", "published", "caution"].map((key) => ({
  header: key,
  key,
  width: key === "name" || key === "url" || key === "caution" ? 60 : 18,
}));
sourceRows.forEach((r) => sources.addRow(r));
sources.getRow(1).font = { bold: true };

await mkdir(path.dirname(OUT), { recursive: true });
await wb.xlsx.writeFile(OUT);
console.log(`Wrote ${OUT} (${files.length} dataset(s), ${sourceRows.length} sources)`);
