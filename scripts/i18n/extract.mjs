// Lists every English message the site translates, and the ones zh-hans.json is missing.
// Sources: string literals passed to t(), t.rich() and pageMetadata(); label-like properties in
// constant tables the components translate at render (label, short, one, caption); the string
// values of a few lookup maps; and display text from data files (careers, disciplines, countries,
// activities, grading rules). Writes scripts/i18n/missing.json.
// Usage: node scripts/i18n/extract.mjs

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const files = [];
const walk = (d) => {
  for (const f of readdirSync(path.join(ROOT, d))) {
    const p = path.join(d, f);
    if (statSync(path.join(ROOT, p)).isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(f)) files.push(p);
  }
};
["app", "components", "content", "lib"].forEach(walk);

const keys = new Set();
const add = (s) => s && /[A-Za-z]/.test(s) && keys.add(s);

/** String literals ("…" or `…` without ${}) in a stretch of code. */
function literals(code) {
  const out = [];
  const re = /"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.|\$(?!\{))*)`/g;
  for (let m = re.exec(code); m; m = re.exec(code)) out.push((m[1] ?? m[2]).replace(/\\(["`\\])/g, "$1").replace(/\\n/g, "\n"));
  return out;
}

/** The first argument of each call to one of `names` (balanced brackets, strings skipped). */
function firstArgs(src, names) {
  const out = [];
  const re = new RegExp(`(?<![\\w.])(?:${names.join("|")})\\(`, "g");
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let i = re.lastIndex, depth = 0, str = null;
    const start = i;
    for (; i < src.length; i++) {
      const c = src[i];
      if (str) {
        if (c === "\\") i++;
        else if (c === str) str = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") str = c;
      else if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) {
        if (depth === 0) break;
        depth--;
      } else if (c === "," && depth === 0) break;
    }
    out.push(src.slice(start, i));
  }
  return out;
}

for (const f of files) {
  const src = read(f);
  // A ternary inside t(...) gives both branches; a nested t() is collected on its own.
  for (const arg of firstArgs(src, ["t", "t\\.rich", "tr", "pageMetadata", "msg"])) for (const s of literals(arg)) add(s);
  // pageMetadata("title", "description"): both arguments.
  for (const m of src.matchAll(/pageMetadata\(\s*"([^"]+)",\s*"([^"]+)"/g)) [m[1], m[2]].forEach(add);
  // Constant tables rendered through t(x.label) and friends.
  for (const m of src.matchAll(/\b(label|short|one|caption|title)\s*:\s*"([^"]+)"/g)) if (!/^(https?:|\/)/.test(m[2])) add(m[2]);
  for (const m of src.matchAll(/\bcaption:\s*\[([^\]]+)\]/g)) literals(m[1]).forEach(add);
  // Lookup maps whose values are shown: KIND(S), ROUTE, STATE, BASIS, CLASS_LABEL, RANK_NAME, COMPANY_LISTS, GROUPS.
  for (const m of src.matchAll(/const (KINDS?|ROUTE|BASIS|CLASS_LABEL|RANK_NAME|COMPANY_LISTS|DIPLOMA_LEVELS|SHORT)\b[^=]*=\s*([[{][\s\S]*?[\]}]);/g))
    for (const v of m[2].matchAll(/:\s*"([^"]+)"|,\s*"([^"]+)"\]/g)) add(v[1] ?? v[2]);
  // Check labels built in lib/topups.ts and lib/grades.ts.
  if (/lib[\\/](topups|grades|data[\\/]employment)\.ts$/.test(f)) for (const m of src.matchAll(/\b(label|basis|short|region|measure|window|note)\s*:\s*"([^"]+)"/g)) add(m[2]);
}

// Data shown through t().
const json = (p) => JSON.parse(read(p));
const kaplan = json("data/raw/kaplan-programmes.json");
Object.values(kaplan.disciplines).forEach(add);
const careers = json("data/raw/careers.json").careers;
for (const c of careers) [c.title, c.short, ...(c.occupations ?? []).map((o) => o.occupation ?? o.title)].forEach(add);
const inst = json("data/raw/institutions.json").institutions;
new Set(inst.map((i) => i.country)).forEach(add);
for (const a of json("data/raw/plan-activities.json").activities) [a.short, a.note, a.link].forEach(add);
const g = json("data/raw/grading-schemes.json");
for (const e of Object.values(g.equivalences ?? {})) add(e.rule);
["UK classes by mark", "classes by GPA on 4.2", "grades by mark and GPA", "First", "2:1", "2:2", "Third", "High 2:1", "Second Class Honours", "Credit average", "Distinction average", "High Distinction average", "Honours (Merit)", "Honours (Distinction)", "Honours (Highest Distinction)", "average {mark}"].forEach(add);
for (const l of ["Chinese", "Cantonese", "Putonghua", "Mandarin", "Portuguese", "English and Chinese", "Chinese and English", "English or Chinese", "Bilingual"]) add(l);
for (const s of ["optional", "required", "recommended", "not required", "waived"]) add(s);
// Admitted students' first-degree groups and test statuses (components/results/AdmittedCases.tsx).
for (const s of ["985 universities", "211 universities", "Other mainland universities", "Overseas, QS top 50", "Overseas, QS 51–300", "Overseas, QS 301+ or unranked", "985", "211", "Other mainland", "Overseas", "mentioned on the page"]) add(s);
// The reported-admit sources' names and notes (scripts/pipeline/compass-build.ts), shown through t().
for (const s of ["指南者留学 case library","GradCafe admissions survey","飞跃手册 (university handbooks)","金吉列留学 case articles","The agency's published admission cases of its own clients: chosen by it, mostly mainland Chinese applicants, admits only.","Applicants' own reports, mostly to North American programmes: admits, rejections and waiting lists, with GPA and GRE where given.","Graduates' own accounts of all their applications (南方科技大学, 海南大学, 福州大学), admits and rejections.","The agency's published success stories: chosen to advertise, often a modest GPA's success, nearly all admits."]) add(s);

const all = [...keys].sort();
const zh = json("lib/i18n/messages/zh-hans.json");
const missing = all.filter((k) => !(k in zh));
const unused = Object.keys(zh).filter((k) => !keys.has(k));
writeFileSync(path.join(ROOT, "scripts/i18n/missing.json"), JSON.stringify(missing, null, 1) + "\n");
console.log(`${all.length} messages · ${missing.length} missing in zh-hans · ${unused.length} not used`);
if (unused.length) console.log("not used:", unused.slice(0, 20));
