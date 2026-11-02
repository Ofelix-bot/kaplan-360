// Who can take each top-up: re-reads the study modes on the official page of every programme that
// collect.ts did not mark as open to international applicants, and lists Kaplan's Murdoch double
// majors, the full-time route Kaplan offers Student's Pass holders when a single major is local only.
// ICA's full-time rule is quoted and checked word for word against its page (the `ica` block).
// Writes data/raw/topup-international.json, which lib/data/topups.ts applies over topups.json.
// Usage: npx tsx scripts/topups/international.ts

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { politeFetch } from "../pipeline/http";

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "data/raw/topup-international.json");
const today = () => new Date().toISOString().slice(0, 10);

type Raw = { id: string; provider: string; kaplanId: string | null; name: string; university: string | null; international: boolean | null; url: string };
/** "full-time": a full-time mode takes international applicants; "part-time-only": the page offers no full-time mode
 * now, and a Student's Pass needs full-time study; "local-only": full-time exists but for local applicants only. */
type Mode = "full-time" | "part-time-only" | "local-only";
type Verdict = { id: string; mode: Mode; quote: string; url: string; checked: string };
type DoubleMajor = { name: string; majors: string[]; url: string; quote: string; feeText: string | null; checked: string };

const lines = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x200B;|&#8203;/g, "")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

/** Kaplan's mode list under "Overview": "Part-time", "(Local Applicants only)", "Full-time", "(Local / International Applicants)". */
function kaplanModes(t: string[]): { mode: Mode; quote: string } | null {
  const i = t.findIndex((s, k) => s === "Overview" && /^(Part|Full)-time$/.test(t[k + 1] ?? ""));
  if (i < 0) return null;
  const modes: [string, string][] = [];
  for (let k = i + 1; /^(Part|Full)-time$/.test(t[k] ?? ""); k += 2) modes.push([t[k], t[k + 1]]);
  const quote = modes.map(([m, who]) => `${m} ${who}`).join(" ");
  const full = modes.find(([m]) => m === "Full-time");
  if (full && /international/i.test(full[1])) return { mode: "full-time", quote };
  return { mode: full ? "local-only" : "part-time-only", quote };
}

/** PSB: "Study Modes" then "Full-Time* / Part-Time" and "*Mode currently unavailable". */
function psbModes(t: string[]): { mode: Mode; quote: string } | null {
  const i = t.findIndex((s) => /^Study Modes?$/i.test(s));
  if (i < 0) return null;
  const quote = [t[i], t[i + 1], /unavailable/i.test(t[i + 2] ?? "") ? t[i + 2] : null].filter(Boolean).join(" ");
  const fullNow = /full[- ]time(?!\*)/i.test(t[i + 1]);
  return { mode: fullNow ? "full-time" : "part-time-only", quote };
}

/** SIM: the duration line before "Campus location", e.g. "Part-time, 3 years" or "Full-time, 2 years". */
function simModes(t: string[]): { mode: Mode; quote: string } | null {
  const i = t.findIndex((s) => s === "Campus location");
  if (i < 1) return null;
  const quote = t[i - 1];
  return { mode: /full-time/i.test(quote) ? "full-time" : "part-time-only", quote };
}

/** Curtin: "Study mode" then "Full-time or part-time", with a fee for international students. */
function curtinModes(t: string[]): { mode: Mode; quote: string } | null {
  const i = t.findIndex((s) => /^Study mode$/i.test(s));
  if (i < 0) return null;
  const intl = t.find((s) => /fee for international students/i.test(s));
  const full = /full-time/i.test(t[i + 1]);
  return { mode: full && intl ? "full-time" : full ? "local-only" : "part-time-only", quote: [t[i], t[i + 1], intl].filter(Boolean).join(" · ") };
}

/** ICA's rule, quoted: a Student's Pass needs full-time study (the reason part-time-only is not open). */
const ICA = {
  url: "https://www.ica.gov.sg/reside/STP/apply",
  quotes: [
    "To apply for a Student’s Pass, you must be accepted into an approved full-time course in Singapore.",
    "Part-time courses and courses conducted in the evening or on weekends are not eligible.",
  ],
};
type Ica = { url: string; quotes: string[]; checked: string };

const squash = (s: string) => s.replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();

const READERS: Record<string, (t: string[]) => { mode: Mode; quote: string } | null> = {
  kaplan: kaplanModes,
  "psb-academy": psbModes,
  sim: simModes,
  "curtin-singapore": curtinModes,
};

/** Murdoch majors, longest first so "Hospitality and Tourism Management" wins over "Management". */
const MAJORS = [
  "Artificial Intelligence and Autonomous Systems",
  "Hospitality and Tourism Management",
  "Communication and Media Studies",
  "Human Resources Management",
  "Cyber Security and Forensics",
  "Business Information Systems",
  "Games Design and Development",
  "Strategic Communication",
  "Digital Communication",
  "International Business",
  "Business Intelligence",
  "Psychological Science",
  "Tourism and Events",
  "Computer Science",
  "Business Law",
  "Data Science",
  "Criminology",
  "Accounting",
  "Management",
  "Marketing",
  "Banking",
  "Finance",
  "FinTech",
];

function majorsOf(name: string): string[] {
  let rest = name.replace(/\(Double Major\)/i, "");
  const out: string[] = [];
  for (const m of MAJORS) {
    const re = new RegExp(`\\b${m}\\b`, "i");
    if (re.test(rest)) {
      out.push(m);
      rest = rest.replace(re, " ");
    }
  }
  return out;
}

async function main() {
  const raw = JSON.parse(readFileSync(path.join(ROOT, "data/raw/topups.json"), "utf8")).programmes as Raw[];
  const verdicts: Verdict[] = [];
  const failures: { url: string; reason: string }[] = [];

  for (const p of raw.filter((x) => x.international !== true && READERS[x.provider])) {
    const r = await politeFetch(p.url);
    if (!r.ok) {
      failures.push({ url: p.url, reason: `${r.reason} ${r.detail}` });
      continue;
    }
    const v = READERS[p.provider](lines(r.body.toString("utf8")));
    if (!v) failures.push({ url: p.url, reason: "study modes not found on the page" });
    else verdicts.push({ id: p.id, ...v, url: p.url, checked: today() });
    console.log(v?.mode ?? "?", p.id);
  }

  // Murdoch double majors from Kaplan's sitemap: the pages whose name says "(Double Major)".
  const doubles: DoubleMajor[] = [];
  const sm = await politeFetch("https://www.kaplan.com.sg/sitemap.xml", 40_000_000);
  if (!sm.ok) failures.push({ url: "https://www.kaplan.com.sg/sitemap.xml", reason: `${sm.reason} ${sm.detail}` });
  else {
    const known = new Set(raw.map((x) => x.url));
    const urls = [...sm.body.toString("utf8").matchAll(/<loc>(https:\/\/www\.kaplan\.com\.sg\/bachelors-degrees?\/[^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .filter((u) => !known.has(u) && /-and-/.test(u) && !/top-up|honours/.test(u));
    for (const url of [...new Set(urls)]) {
      const r = await politeFetch(url);
      if (!r.ok) {
        failures.push({ url, reason: `${r.reason} ${r.detail}` });
        continue;
      }
      const t = lines(r.body.toString("utf8"));
      const title = /^Bachelor of/i.test(t[0]) ? t[0] : t.find((s) => /^Bachelor of/i.test(s));
      if (!title || !t.some((s) => /Murdoch University/.test(s)) || majorsOf(title).length < 2) {
        console.log("skip", url);
        continue;
      }
      const v = kaplanModes(t);
      const name = title.replace(/\s*\|.*$/, "").trim();
      // The international fee: the first "S$… payable" line after "Full-time (International Applicants)".
      const at = t.findIndex((s) => /^Full-time \(International Applicants\)/i.test(s));
      const feeText = at >= 0 ? (t.slice(at, at + 40).find((s) => /^S\$[\d,.]+ payable/i.test(s)) ?? null) : null;
      console.log(v?.mode ?? "?", name);
      if (v?.mode === "full-time") doubles.push({ name, majors: majorsOf(name), url, quote: v.quote, feeText, checked: today() });
    }
  }

  // ICA's quotes, checked word for word; when the page cannot be read, the last checked block stays.
  let ica: Ica | null = null;
  const ir = await politeFetch(ICA.url);
  if (!ir.ok) failures.push({ url: ICA.url, reason: `${ir.reason} ${ir.detail}` });
  else {
    const page = squash(lines(ir.body.toString("utf8")).join(" ").replace(/&rsquo;|&#8217;|&#39;/g, "'"));
    const missing = ICA.quotes.filter((q) => !page.includes(squash(q)));
    if (missing.length) failures.push({ url: ICA.url, reason: `quotes not on the page: ${missing.join(" | ")}` });
    else ica = { url: ICA.url, quotes: ICA.quotes, checked: today() };
  }
  if (!ica) {
    try {
      ica = (JSON.parse(readFileSync(OUT, "utf8")) as { ica?: Ica }).ica ?? null;
    } catch {
      ica = null;
    }
  }

  writeFileSync(
    OUT,
    JSON.stringify(
      {
        note: "Study modes read from each programme's official page. A Student's Pass needs full-time study, so a part-time-only programme is not open to Student's Pass holders. Murdoch single majors at Kaplan are local only; Kaplan offers them to international applicants as double majors (full-time).",
        ...(ica ? { ica } : {}),
        builtAt: today(),
        verdicts,
        murdochDoubleMajors: doubles.sort((a, b) => a.name.localeCompare(b.name)),
        failures,
      },
      null,
      1,
    ) + "\n",
  );
  console.log(`${verdicts.length} verdicts · ${doubles.length} double majors · ${failures.length} failures`);
}

main();
