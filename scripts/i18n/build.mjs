// Builds the site's dictionaries from the hand-written Simplified Chinese parts:
// lib/i18n/messages/zh-hans.json (merged from scripts/i18n/zh-hans/*.json) and zh-hant.json
// (converted with OpenCC, Simplified to Hong Kong Traditional, then scripts/i18n/zh-hant-overrides.json
// for wording that differs beyond the characters). Checks that every translation keeps its
// placeholders and tags. Usage: node scripts/i18n/build.mjs

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as OpenCC from "opencc-js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const dir = path.join(ROOT, "scripts/i18n/zh-hans");
const hans = {};
for (const f of readdirSync(dir).sort()) Object.assign(hans, JSON.parse(readFileSync(path.join(dir, f), "utf8")));

// Every {placeholder} and <tag> in the English must survive in the translation.
const marks = (s) => [...s.matchAll(/\{\w+\}|<\/?\w+>/g)].map((m) => m[0]).sort().join(" ");
const broken = Object.entries(hans).filter(([en, zh]) => marks(en) !== marks(zh));
if (broken.length) {
  for (const [en, zh] of broken) console.error(`placeholders differ:\n  ${en}\n  ${zh}`);
  process.exit(1);
}

const toHant = OpenCC.Converter({ from: "cn", to: "hk" });
const overrides = JSON.parse(readFileSync(path.join(ROOT, "scripts/i18n/zh-hant-overrides.json"), "utf8"));
// Hong Kong usage beyond the characters: corner quotes, and words that differ.
const HK = [
  [/“/g, "「"],
  [/”/g, "」"],
  [/信息/g, "資訊"],
  [/設備/g, "裝置"],
  [/鏈接/g, "連結"],
  [/加載/g, "載入"],
  [/日曆文件/g, "日曆檔案"],
  [/默認/g, "預設"],
  [/屏幕/g, "螢幕"],
  // The site's terms: a Kaplan degree is 學士 in Traditional (本科 in Simplified).
  [/本科生/g, "學士學生"],
  [/本科/g, "學士"],
];
const hk = (s) => HK.reduce((x, [re, to]) => x.replace(re, to), s);
const hant = Object.fromEntries(Object.entries(hans).map(([en, zh]) => [en, overrides[en] ?? hk(toHant(zh))]));

const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(path.join(ROOT, "lib/i18n/messages/zh-hans.json"), JSON.stringify(sorted(hans), null, 1) + "\n");
writeFileSync(path.join(ROOT, "lib/i18n/messages/zh-hant.json"), JSON.stringify(sorted(hant), null, 1) + "\n");
console.log(`${Object.keys(hans).length} messages · ${Object.keys(overrides).length} Traditional overrides`);
