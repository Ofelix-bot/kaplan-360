// Step 3: extract programme details from the cached official pages with rules (no network, no AI).
// Usage: npx tsx scripts/pipeline/extract.ts [--only=aston-university]

import { existsSync, readFileSync } from "node:fs";
import { CANDIDATES_FILE, DATA_DIR, EXTRACTED_FILE, FETCH_LOG_FILE, INSTITUTIONS_FILE } from "./config";
import path from "node:path";
import type { Discovery } from "./discover";
import { applyName, extractProgramme, type Extracted } from "./extract-lib";
import type { FetchEntry } from "./fetch";
import { groupProgrammes } from "./group";
import { SOURCES } from "./sources";
import { args, readJson, writeJson } from "./util";

export type ExtractedRecord = {
  source: string;
  base: string;
  /** Pages the details were read from (fetched successfully). */
  pages: string[];
  fetchedAt: string | null;
  failures: { url: string; reason: string; detail: string }[];
  result: Extracted | null;
};

function main() {
  const a = args();
  const candidates = readJson<Record<string, Discovery>>(CANDIDATES_FILE, {});
  const log = readJson<Record<string, FetchEntry>>(FETCH_LOG_FILE, {});
  const roster = readJson<{ institutions: { id: string; country: string | null }[] }>(INSTITUTIONS_FILE, { institutions: [] });
  const countryOf = new Map(roster.institutions.map((r) => [r.id, r.country]));
  const prev = readJson<ExtractedRecord[]>(EXTRACTED_FILE, []);
  // Names Claude read for pages the rules could not name (name-ai.ts).
  const aiNames = readJson<Record<string, { name: string }>>(path.join(DATA_DIR, "ai-names.json"), {});
  const out: ExtractedRecord[] = a.only ? prev.filter((r) => !a.only!.includes(r.source)) : [];
  for (const src of SOURCES) {
    if (a.only && !a.only.includes(src.id)) continue;
    const d = candidates[src.id];
    if (!d?.urls.length) continue;
    const country = countryOf.get(src.id) ?? null;
    for (const g of groupProgrammes(d.urls, src.keepQuery)) {
      const entries = g.pages.map((url) => ({ url, e: log[url] }));
      const ok = entries.filter((x) => x.e?.ok && x.e.file && existsSync(x.e.file));
      const failures = entries.filter((x) => x.e && !x.e.ok).map((x) => ({ url: x.url, reason: x.e!.reason ?? "?", detail: x.e!.detail ?? "" }));
      if (!entries.some((x) => x.e)) continue; // Not fetched yet.
      let result = ok.length
        ? extractProgramme(ok.map((x) => ({ url: x.url, html: readFileSync(x.e!.file!, "utf8") })), country)
        : null;
      if (result && !result.name && aiNames[g.base]) result = applyName(result, aiNames[g.base].name);
      out.push({ source: src.id, base: g.base, pages: ok.map((x) => x.url), fetchedAt: ok[0]?.e?.fetchedAt ?? null, failures, result });
    }
  }
  writeJson(EXTRACTED_FILE, out);
  const withName = out.filter((r) => r.result?.name).length;
  const inScope = out.filter((r) => r.result?.discipline && r.result.degreeType).length;
  console.log(`Programme groups: ${out.length} · with a programme name: ${withName} · taught master's in Kaplan's disciplines: ${inScope}`);
}

main();
