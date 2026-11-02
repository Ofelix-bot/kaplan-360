// Checks /where-you-stand's own words and colours (components/stand, and the goal wording in
// lib/plan-timeline.ts goalWords):
// - no hedging word in any English message or its zh-hans translation (the owner's rule);
// - every message has a zh-hans translation;
// - the page says the index is not an admission probability once, in the footnote beside the index's
//   name, and the breakdown keeps the rules' grounds (the minimum + one class step, the awarding country);
// - each band colour reaches 4.5:1 on the page's grounds (--land-ground, --land-card) in light and
//   dark, computed from the CSS variables in app/globals.css and app/ui.css.
// Exits non-zero on a failure. Usage: npx tsx scripts/check-stand-page.ts

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f: string) => readFileSync(path.join(ROOT, f), "utf8");
const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  if (!ok) failures.push(what);
};

// ---------- Words ----------

const HEDGE_EN = /\b(may|might|could|likely|unlikely|probably|perhaps|possibly|usually|typically|generally|tend to)\b/i;
const HEDGE_ZH = /可能|或许|也许|大概|应该会|一般来说|通常|可以考虑|不妨/;
const sources = readdirSync(path.join(ROOT, "components/stand")).map((f) => read(`components/stand/${f}`));
const timeline = read("lib/plan-timeline.ts");
sources.push(timeline.slice(timeline.indexOf("export function goalWords"), timeline.indexOf("export function buildPlan")));
const keys = new Set<string>();
for (const src of sources) for (const m of src.matchAll(/(?<![\w.])(?:t|t\.rich|msg)\(\s*(?:[^"()]*\?\s*)?"((?:[^"\\]|\\.)*)"/g)) if (/[A-Za-z]/.test(m[1])) keys.add(m[1]);
const zh: Record<string, string> = {};
for (const f of readdirSync(path.join(ROOT, "scripts/i18n/zh-hans"))) Object.assign(zh, JSON.parse(read(`scripts/i18n/zh-hans/${f}`)));
for (const k of keys) {
  check(!HEDGE_EN.test(k), `hedging word in "${k}"`);
  check(k in zh, `no zh-hans translation for "${k}"`);
  if (zh[k]) check(!HEDGE_ZH.test(zh[k]), `hedging word in the translation of "${k}": ${zh[k]}`);
}
console.log(`${keys.size} messages checked for hedging words and translations`);

// The method section went on 2026-10-29 (no explanatory text on service pages): the not-a-probability
// sentence is the one footnote beside the index's name, said nowhere else, and the breakdown keeps the
// grounds of each rule in its steps (lib/stand/score.ts).
const breakdown = read("components/stand/breakdown.tsx");
const score = read("lib/stand/score.ts");
check(breakdown.includes("<IndexNote />") && breakdown.includes("t(NOT_PROBABILITY)"), "the index's name lacks its not-a-probability footnote");
check(sources.filter((src) => src.includes("NOT_PROBABILITY)")).length === 1, "the not-a-probability sentence is said outside the breakdown's footnote");
const RULES: [string, boolean][] = [
  ["the minimum + one class step", breakdown.includes("indexLevel") && score.includes("tr(MIN_STEP_RULE, MIN_STEP_VARS)")],
  ["the awarding country's reading", breakdown.includes("gate.note")],
];
for (const [what, ok] of RULES) check(ok, `the page does not state ${what}`);
check(!sources.some((src) => /tier of universities not in the QS ranking/.test(src)), "components/stand still describes tier C as universities not in the QS ranking");
console.log(`${RULES.length} rules stated on the page`);

// ---------- Contrast ----------

/** A stylesheet's custom properties: the first :root block (light) and the dark media block's :root. */
function vars(css: string): { light: Record<string, string>; dark: Record<string, string> } {
  const grab = (block: string) => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
  const light = grab(/:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "");
  const dark = grab(/prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/.exec(css)?.[1] ?? "");
  return { light, dark };
}
const site = vars(read("app/globals.css"));
const ui = vars(read("app/ui.css").replace(/@layer base\s*\{/, ""));
const theme = (mode: "light" | "dark") => ({ ...site.light, ...ui.light, ...(mode === "dark" ? { ...site.dark, ...ui.dark } : {}) });

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** components/stand/bands.tsx OUTCOME_TEXT, as variables. */
const BAND_VAR = { safe: "--ui-success", match: "--brand-ink", reach: "--accent-ink", far: "--danger", muted: "--muted" };
for (const mode of ["light", "dark"] as const) {
  const v = theme(mode);
  const rows: string[] = [];
  for (const ground of ["--land-ground", "--land-card", "--land-tint"]) {
    for (const [band, name] of Object.entries(BAND_VAR)) {
      const fg = v[name];
      const bg = v[ground];
      check(!!fg && !!bg, `${mode}: ${name} or ${ground} not found`);
      if (!fg || !bg) continue;
      const r = ratio(fg, bg);
      check(r >= 4.5, `${mode}: ${band} (${name} ${fg}) on ${ground} (${bg}) is ${r.toFixed(2)}:1`);
      rows.push(`${band} ${r.toFixed(1)}`);
    }
  }
  console.log(`${mode}: ${rows.join(" · ")} (on ground, card, tint)`);
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("check-stand-page: all checks passed");
