// Who each programme admits, beyond its minimum, from its own cached official pages: what the page
// says about successful applicants ("Nearly all successful applicants hold a First"), a preferred
// result ("preferably 2nd Upper and above"), official applications and places (LSE's programme pages,
// Oxford's course pages), and whether it says entry is competitive. Every value keeps the page's
// words. The results page works its admission range out of these (lib/admit-range.ts).
// Reads the page cache only (no fetching). Usage: npx tsx scripts/pipeline/admit-evidence.ts

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { levelNamed, type AdmitEvidence } from "../../lib/admit-range";
import { CACHE_DIR, ROOT } from "./config";
import { pageText } from "./extract-lib";
import { readJson, today, writeJson } from "./util";

/** The cached copy of a page, as scripts/pipeline/fetch.ts names it (that module runs a fetch when imported). */
const cacheFile = (url: string) => path.join(CACHE_DIR, new URL(url).host, createHash("sha1").update(url).digest("hex") + ".html");
const PROGRAMMES = path.join(ROOT, "data/raw/programmes.json");
const OUT = path.join(ROOT, "data/raw/admission-evidence.json");

type Programme = { id: string; sourceUrl: string; evidence?: { url: string }[] };

/** A sentence about who is admitted: the people it is about, and how many of them. */
const WHO =
  /\b(?:nearly all|almost all|most|the majority of|majority of|typically|usually|generally|tend to)\b[^.]{0,60}?\b(?:successful (?:applicants|candidates)|admitted students|students (?:accepted|admitted|offered)|accepted students|applicants (?:accepted|admitted|offered)|those (?:admitted|accepted|offered))\b|\b(?:successful (?:applicants|candidates)|admitted students|students (?:accepted|admitted)|accepted students|strong applicants|competitive applicants)\b[^.]{0,40}?\b(?:typically|usually|generally|tend to|mostly|will also have)\b/i;
/** "The mean undergraduate grade point average of entering students is 3.6". */
const CLASS_FIGURE = /\b(?:mean|average|median)\b[^.]{0,50}\b(?:of|for|among) (?:our |the )?(?:entering|admitted|incoming|enrolled|accepted|current) (?:students|class|cohort)\b/i;
/** UK pages label their minimum "Typical offer": that is the requirement, not who is admitted. */
const TYPICAL_OFFER = /typical offer/i;
const PREFERRED = /\bpreferabl[ey]\b[^.;)]{0,90}/i;
/**
 * The programme or university says entry is competitive ("Entry to this programme is competitive",
 * "Competition for places at LSE is strong", "selection is on a competitive basis"). A disclaimer
 * alone ("meeting the minimum requirements does not guarantee admission") is not counted: nearly every
 * university prints one.
 */
const COMPETITIVE =
  /\b(?:highly|very|extremely|intensely|increasingly)\s+competitive\b|\bcompetition for (?:places|admission|entry)\b[^.]{0,30}\b(?:strong|intense|high|fierce|keen)\b|\b(?:entry|entrance|admission|admissions|selection)\b[^.]{0,40}\b(?:is|are) (?:highly |very )?competitive\b|\bcompetitive (?:entry|admission|selection|basis)\b|\blimited number of places\b|\bmany more applications than\b|\bnumber of places (?:is|are) limited\b/i;
/** Competition for something else: scholarships, jobs, the industry. */
const NOT_ADMISSION = /scholarship|bursar|funding|studentship|award|prize|grant|job|career|employ|industry|market|salary|graduates|internship|placement|opportunit|transfer|sport|team|deposit|environment|world|landscape|economy|co-op|option|positions|exchange|elective/i;

const sentences = (lines: string[]) => lines.flatMap((l) => l.split(/(?<=[.!?])\s+(?=[A-Z(])/)).map((s) => s.trim());
const clip = (s: string) => (s.length > 260 ? `${s.slice(0, 257).trimEnd()}…` : s);

function evidenceFor(p: Programme): AdmitEvidence | null {
  const urls = [...new Set([p.sourceUrl, ...(p.evidence ?? []).map((e) => e.url)])];
  const e: AdmitEvidence = {};
  for (const url of urls) {
    let file: string;
    try {
      file = cacheFile(url);
    } catch {
      continue;
    }
    if (!existsSync(file)) continue;
    const html = readFileSync(file, "utf8");
    const text = pageText({ url, html });
    // LSE: the "Applications / Places / Ratio" box, from the page's own data.
    const lse = /"infographicApplicationsPlacesRatio":(\{[^{}]*\})/.exec(html);
    if (lse && !e.stats) {
      try {
        const v = JSON.parse(lse[1]) as { places?: number; year?: string; applications?: number; ratio?: string };
        if (v.places && v.applications)
          e.stats = { applications: v.applications, places: v.places, year: v.year ?? null, quote: `Applications ${v.applications} · Places ${v.places}${v.year ? ` · ${v.year}` : ""}${v.ratio ? ` · Ratio ${v.ratio}` : ""}`, url };
      } catch {
        // Not the shape we know: leave it.
      }
    }
    // Oxford: "Places in 2027-28 c. 28 · Applications/year* 238 · *Three-year average (applications for entry in 2024-25 to 2026-27)".
    // Variants: "Places 2027-28", a † or * before "c.", full-time and part-time columns (the first is
    // full time). Places shared with another course ("Combined places for…") don't compare with one
    // course's applications, and a new course has none ("N/A - new course").
    const joined = text.lines.join(" ");
    const block = joined.slice(Math.max(0, joined.indexOf("Number of places and applications")));
    const op = /Places(?: in)?\s*(\d{4}[-–]\d{2})\s*[*†]?\s*(?:c\.\s*)?(\d+)(?:\s*[-–]\s*(\d+))?/i.exec(block);
    const oa = /Applications\/year\s*[*†]?\s*(\d[\d,]*)/i.exec(block);
    if (op && oa && !e.stats && !/\bcombined (?:places|figure)\b/i.test(block.slice(0, 700))) {
      const avg = /[*†]\s*((?:Three|Two)-year average \([^)]*\))/i.exec(joined.slice(oa.index));
      e.stats = {
        applications: Number(oa[1].replace(/,/g, "")),
        // A range of places ("c. 15-20"): the larger, so applications per place are not overstated.
        places: Number(op[3] ?? op[2]),
        year: op[1],
        quote: `Places in ${op[1]} c. ${op[3] ? `${op[2]}-${op[3]}` : op[2]} · Applications/year ${oa[1]}${avg ? ` · ${avg[1]}` : ""}`,
        url,
      };
    }
    for (const s of sentences(text.lines)) {
      if (!e.stated && (WHO.test(s) || CLASS_FIGURE.test(s)) && !TYPICAL_OFFER.test(s)) {
        const level = levelNamed(s);
        if (level !== null) e.stated = { level, quote: clip(s), url };
      }
      const pref = !e.stated && PREFERRED.exec(s);
      if (pref) {
        const level = levelNamed(pref[0]);
        if (level !== null) e.stated = { level, quote: clip(s), url };
      }
      if (!e.competitive && COMPETITIVE.test(s) && !NOT_ADMISSION.test(s)) e.competitive = { quote: clip(s), url };
    }
  }
  return e.stated || e.stats || e.competitive ? e : null;
}

function main() {
  const data = readJson<{ programmes: Programme[] }>(PROGRAMMES, { programmes: [] });
  const out: Record<string, AdmitEvidence> = {};
  const n = { stated: 0, stats: 0, competitive: 0 };
  for (const p of data.programmes) {
    const e = evidenceFor(p);
    if (!e) continue;
    out[p.id] = e;
    if (e.stated) n.stated++;
    if (e.stats) n.stats++;
    if (e.competitive) n.competitive++;
  }
  writeJson(OUT, {
    builtAt: today(),
    notes: [
      "From each programme's cached official pages (data/pipeline/cache), by scripts/pipeline/admit-evidence.ts. Quotes are the page's own sentences.",
      "stated: what the page says about who is admitted, or a preferred result; level on the UK scale (lib/admit-range.ts LEVELS).",
      "stats: official applications and places (LSE programme pages' figures box; Oxford course pages' 'Number of places and applications').",
      "competitive: the page says entry is competitive or that meeting the minimum does not guarantee a place.",
    ],
    counts: { programmes: Object.keys(out).length, ...n },
    programmes: out,
  });
  console.log(`${Object.keys(out).length} programmes with evidence · stated ${n.stated} · stats ${n.stats} · competitive ${n.competitive} → ${path.relative(ROOT, OUT)}`);
}

main();
