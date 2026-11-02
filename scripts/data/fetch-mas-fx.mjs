// Exchange rates from the Monetary Authority of Singapore (official): the end-of-month S$ rate for
// each currency a programme's fee is quoted in, for the latest month MAS has published. Used only to
// show fees in S$ as an approximation. Reads the public "Exchange Rates" form the way a visitor
// would (choose monthly, tick currencies, Display) in a real browser, once.
// Usage: node scripts/data/fetch-mas-fx.mjs   → data/raw/fx-mas.json

import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const PAGE = "https://eservices.mas.gov.sg/Statistics/msb/ExchangeRates.aspx";
const OUT = new URL("../../data/raw/fx-mas.json", import.meta.url);
// MAS names → ISO codes. "Per 100 units" currencies are divided by 100.
const WANT = {
  Euro: "EUR", "Pound Sterling": "GBP", "US Dollar": "USD",
  "Australian Dollar": "AUD", "Canadian Dollar": "CAD", "Hong Kong Dollar": "HKD", "New Zealand Dollar": "NZD",
  "Chinese Renminbi": "CNY", "Japanese Yen": "JPY", "Korean Won": "KRW", "Swiss Franc": "CHF", "Swedish Krona": "SEK",
  "Danish Krone": "DKK", "Norwegian Krone": "NOK", "Malaysian Ringgit": "MYR", "New Taiwan Dollar": "TWD",
};

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
await page.goto(PAGE, { waitUntil: "load", timeout: 90_000 });
await page.selectOption("#ContentPlaceHolder1_FrequencyDropDownList", "M");
await page.waitForLoadState("load");
const now = new Date();
const year = String(now.getFullYear());
await page.selectOption("#ContentPlaceHolder1_StartYearDropDownList", year).catch(() => {});
await page.selectOption("#ContentPlaceHolder1_EndYearDropDownList", year).catch(() => {});
await page.selectOption("#ContentPlaceHolder1_StartMonthDropDownList", "1").catch(() => {});
await page.selectOption("#ContentPlaceHolder1_EndMonthDropDownList", String(now.getMonth() + 1)).catch(() => {});

// Tick the end-of-period boxes for the currencies we need.
const boxes = await page.$$eval("input[type=checkbox][id*=EndOfPeriod]", (els) =>
  els.map((e) => ({ id: e.id, label: (e.labels?.[0]?.innerText ?? "").trim(), per100: /Per100/.test(e.id) })),
);
const picked = boxes.filter((b) => b.label in WANT);
// The labels sit over the boxes, so tick them directly.
await page.$$eval("input[type=checkbox][id*=EndOfPeriod]", (els, ids) => els.forEach((e) => { if (ids.includes(e.id)) e.checked = true; }), picked.map((b) => b.id));
await Promise.all([page.waitForLoadState("load"), page.click("#ContentPlaceHolder1_DisplayButton")]);
await page.waitForTimeout(1500);

// The result table: a header row of currency names, then one row per month (latest last).
const table = await page.$$eval("table", (tables) => {
  const t = tables.find((x) => /Pound Sterling|Euro/.test(x.innerText) && x.rows.length > 2);
  return t ? [...t.rows].map((r) => [...r.cells].map((c) => c.innerText.trim())) : null;
});
await browser.close();
if (!table) throw new Error("No exchange-rate table on the MAS page");
// Header: "End of Period", then "S$ Per Unit of\nEuro", "S$ Per 100\nUnits of\nAustralian Dollar" …
// Rows: year (only on a year's first row), month, then one value per currency.
const header = table[0].slice(1).map((c) => ({ name: c.split("\n").at(-1).trim(), per100: /Per 100/i.test(c) }));
let rowYear = "";
const rows = table.slice(1).map((r) => {
  if (r[0]) rowYear = r[0];
  return { period: `${r[1]} ${rowYear}`, values: r.slice(2) };
}).filter((r) => r.values.some((v) => /^\d+(\.\d+)?$/.test(v)));
const last = rows.at(-1);
const period = last.period;
const rates = {};
header.forEach(({ name, per100 }, i) => {
  if (!(name in WANT)) return;
  const v = Number(last.values[i]);
  if (!Number.isFinite(v) || v <= 0) return;
  rates[WANT[name]] = Number((per100 ? v / 100 : v).toFixed(6));
});
rates.SGD = 1;

writeFileSync(
  OUT,
  JSON.stringify(
    {
      dataset: "S$ exchange rates, end of month (Monetary Authority of Singapore)",
      source: PAGE,
      publisher: "Monetary Authority of Singapore",
      period,
      retrievedAt: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
      note: "S$ per 1 unit of each currency; MAS publishes some per 100 units, divided here. Used only to show fees in S$ as an approximation.",
      rates,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Period ${period}:`, rates);
