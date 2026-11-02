// Company logos for "Where Kaplan graduates work": the logo file on Wikimedia Commons for each
// company employer (government agencies stay as names), with its licence and any trademark
// restriction recorded. Files are saved to public/logos/employers/ (served from our own site) and
// the record to data/raw/employer-logos.json. Every file is checked by eye before use.
// Usage: node scripts/data/fetch-employer-logos.mjs [--only=slug1,slug2]

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "Kaplan360pp/0.2 (Kaplan 360++ prototype, AI For Impact 2026; one-off logo lookup)";
const OUT_DIR = new URL("../../public/logos/employers/", import.meta.url);
const RECORD = new URL("../../data/raw/employer-logos.json", import.meta.url);

// The deck's name → the Commons search for the company's logo (file title words).
const COMPANIES = {
  "3M Singapore": "3M wordmark",
  Accenture: "Accenture logo",
  Amazon: "Amazon logo",
  "Apple South Asia": "Apple logo black",
  CapitaLand: "CapitaLand logo",
  Carousell: "Carousell logo",
  "Changi Airport Group": "Changi Airport Group logo",
  Citibank: "Citi logo",
  Deloitte: "Deloitte logo",
  "Dow Jones": "Dow Jones logo",
  Dyson: "Dyson logo",
  Google: "Google 2015 logo",
  GSK: "GSK logo 2022",
  KPMG: "KPMG logo",
  Lazada: "Lazada logo",
  LVMH: "LVMH logo",
  "Marina Bay Sands": "Marina Bay Sands logo",
  "Marriott International": "Marriott International logo",
  Mediacorp: "Mediacorp logo",
  Microsoft: "Microsoft logo 2012",
  Nike: "Logo NIKE",
  "OCBC Bank": "OCBC Bank logo",
  "Procter & Gamble": "Procter & Gamble logo",
  PwC: "PwC logo",
  "Rolls-Royce Singapore": "Rolls-Royce Holdings logo",
  EchoStar: "EchoStar logo",
  "Sembcorp Marine (now Seatrium)": "Seatrium logo",
  Shopee: "Shopee logo",
  "Singapore Airlines": "Singapore Airlines logo",
  "ST Aerospace (ST Engineering)": "ST Engineering logo",
  "Standard Chartered": "Standard Chartered logo",
  "The Ritz-Carlton": "Ritz-Carlton logo",
  "The Walt Disney Company": "The Walt Disney Company logo",
  TikTok: "TikTok logo",
  Twitch: "Twitch logo",
  "UBS Singapore": "UBS logo",
  Visa: "Visa Inc. logo",
};

// Files chosen by hand where the search picks a subsidiary, a product or a symbol-only version.
const FILE = {
  Citibank: "File:Citi logo March 2023.svg",
  "Marriott International": "File:Marriott International.svg",
  "Standard Chartered": "File:Standard Chartered (2021).svg",
  Twitch: "File:Twitch logo (wordmark only).svg",
  Lazada: "File:Lazada (2019).svg",
  "Rolls-Royce Singapore": "File:Rolls royce holdings logo.svg",
};
// No suitable company logo on Commons (only a subsidiary's, a single hotel's or none): shown as a name.
const NAME_ONLY = new Set(["Carousell", "Changi Airport Group", "GSK", "Sembcorp Marine (now Seatrium)", "UBS Singapore", "ST Aerospace (ST Engineering)", "The Ritz-Carlton"]);

const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params })}`;
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers: { "user-agent": UA } });
    if (r.ok) return r.json();
    // Rate limited: wait, as the API asks, and try again.
    if (r.status === 429 && attempt < 4) {
      await sleep(Number(r.headers.get("retry-after") ?? 0) * 1000 || 15_000 * (attempt + 1));
      continue;
    }
    throw new Error(`${r.status} ${url}`);
  }
}

/** Product and sub-brand words: "Amazon Music" or "Google Play" is not the company's logo. */
const PRODUCT = /music|prime|web services|aws|\bpay\b|cloud|play|maps|chrome|drive|news|\btv\b|plus|video|games|studio|store|app\b|icon|favicon|button/i;

const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
mkdirSync(OUT_DIR, { recursive: true });
const record = existsSync(RECORD) ? JSON.parse(readFileSync(RECORD, "utf8")) : { source: "Wikimedia Commons", logos: {} };

for (const [name, query] of Object.entries(COMPANIES)) {
  const id = slug(name);
  if (only && !only.includes(id)) continue;
  if (NAME_ONLY.has(name)) {
    delete record.logos[name];
    continue;
  }
  await sleep(3000); // gentle on the API
  const key = query.split(" ")[0].toLowerCase();
  const titles = FILE[name]
    ? [FILE[name]]
    : (await api({ action: "query", list: "search", srsearch: `${query} filetype:drawing`, srnamespace: "6", srlimit: "12" })).query.search
        .map((s) => s.title)
        .filter((t) => /\.svg$/i.test(t) && /logo|wordmark/i.test(t) && t.toLowerCase().includes(key) && !PRODUCT.test(t.replace(/logo|wordmark/gi, "")));
  if (!titles.length) {
    console.log(`${name}: no SVG logo found`);
    continue;
  }
  const info = await api({ action: "query", titles: titles[0], prop: "imageinfo", iiprop: "url|extmetadata|mime" });
  const ii = info.query.pages[0].imageinfo?.[0];
  if (!ii) continue;
  const meta = ii.extmetadata ?? {};
  const text = (k) => (meta[k]?.value ?? "").replace(/<[^>]+>/g, "").trim();
  const svg = await (await fetch(ii.url, { headers: { "user-agent": UA } })).text();
  writeFileSync(new URL(`${id}.svg`, OUT_DIR), svg);
  record.logos[name] = {
    file: `/logos/employers/${id}.svg`,
    commonsTitle: titles[0],
    commonsPage: ii.descriptionurl,
    licence: text("LicenseShortName"),
    restrictions: text("Restrictions"),
    retrievedAt: new Date().toISOString().slice(0, 10),
  };
  console.log(`${name.padEnd(32)} ${titles[0].slice(0, 50).padEnd(52)} ${record.logos[name].licence} · ${record.logos[name].restrictions}`);
  writeFileSync(RECORD, JSON.stringify(record, null, 2) + "\n");
}
