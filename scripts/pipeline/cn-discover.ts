// Finds each mainland university's newest graduate employment quality report (毕业生就业质量年度报告): its
// disclosure site (信息公开) and careers site (就业网) are read for links naming 就业质量, two levels deep, and every
// report link found is kept with its year. The full report (with tables of where graduates went) is usually on the
// careers site; the disclosure site often has only a summary, so both are kept and cn-reports.ts reads the longest.
// Polite fetches, robots.txt honoured; a site that answers with a script challenge is read in the browser.
// Writes data/pipeline/cn-reports/candidates.json. Usage: npx tsx scripts/pipeline/cn-discover.ts [--only=pku,fudan] [--refresh]

import { mkdirSync } from "node:fs";
import { closeBrowser } from "./browser";
import { CN_CANDIDATES_FILE, CN_DIR, CN_UNIVERSITIES_FILE, get, html, links, reportYear, type CnUniversity, type Link } from "./cn-lib";
import { args, keepRunning, readJson, today, writeJson } from "./util";

export type Candidate = { url: string; text: string; year: number; via: string };
export type Discovery = { id: string; checked: string; entries: string[]; candidates: Candidate[] };

/** Where universities keep the report: the disclosure site, the careers site (hosts vary), and the home page's links to them. */
const entryPages = (d: string) => [
  `https://xxgk.${d}/`,
  `https://gk.${d}/`,
  `https://www.${d}/xxgk/`,
  `https://career.${d}/`,
  `https://job.${d}/`,
  `https://jy.${d}/`,
  `https://jyzx.${d}/`,
  `https://scc.${d}/`,
  `https://jyw.${d}/`,
  `https://jiuye.${d}/`,
  `https://www.${d}/`,
];
const REPORT = /就业质量|就业年度报告|就业质量年度报告|毕业生就业报告/;
/** Links on a home page that lead to the disclosure or careers site. */
const GATEWAY = /信息公开|就业信息网|就业指导|就业创业|学生就业|就业服务|招生就业/;

async function discover(u: CnUniversity): Promise<Discovery> {
  const seen = new Set<string>();
  const found = new Map<string, Candidate>();
  const entries: string[] = [];
  const own = (url: string) => {
    try {
      const h = new URL(url).hostname;
      return h === u.domain || h.endsWith(`.${u.domain}`);
    } catch {
      return false;
    }
  };
  const add = (l: Link, via: string) => {
    const year = reportYear(l.text) || reportYear(decodeURIComponent(l.url));
    const prev = found.get(l.url);
    if (!prev || (l.text.length > prev.text.length && REPORT.test(l.text))) found.set(l.url, { url: l.url, text: l.text.slice(0, 120), year, via });
  };
  // Level 0: entry pages (and a given disclosure list); level 1: pages they link to that name the report (lists or
  // articles); level 2: report links on those.
  let frontier: { url: string; via: string }[] = [...(u.list ? [{ url: u.list, via: "list" }] : []), ...entryPages(u.domain).map((url) => ({ url, via: "entry" }))];
  for (let depth = 0; depth < 3 && frontier.length; depth++) {
    const next: { url: string; via: string }[] = [];
    for (const { url, via } of frontier) {
      if (seen.has(url)) continue;
      seen.add(url);
      const page = await get(url);
      if (!page || page.pdf) continue;
      if (depth === 0) entries.push(page.finalUrl);
      for (const l of links(html(page.file), page.finalUrl)) {
        if (!own(l.url)) continue;
        if (REPORT.test(l.text)) {
          add(l, via === "entry" ? new URL(url).host : via);
          if (depth < 2 && !/\.pdf($|\?)/i.test(l.url)) next.push({ url: l.url, via: new URL(url).host });
        } else if (depth === 0 && via === "entry" && GATEWAY.test(l.text) && l.text.length <= 12) next.push({ url: l.url, via: `${new URL(url).host} → ${l.text}` });
      }
    }
    frontier = next.slice(0, 40);
  }
  const candidates = [...found.values()].filter((c) => c.year >= 2019).sort((a, b) => b.year - a.year);
  return { id: u.id, checked: today(), entries, candidates };
}

async function main() {
  const a = args();
  mkdirSync(CN_DIR, { recursive: true });
  const all = readJson<{ universities: CnUniversity[] }>(CN_UNIVERSITIES_FILE, { universities: [] }).universities;
  const out = readJson<Record<string, Discovery>>(CN_CANDIDATES_FILE, {});
  const todo = all.filter((u) => (!a.only || a.only.includes(u.id)) && (a.refresh || !out[u.id]));
  // Universities run side by side (each host keeps its own polite pace).
  let i = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (i < todo.length) {
        const u = todo[i++];
        try {
          out[u.id] = await discover(u);
          const best = out[u.id].candidates[0];
          console.log(`${u.id.padEnd(9)} ${String(out[u.id].candidates.length).padStart(3)} links · newest ${best?.year ?? "-"} ${best?.text.slice(0, 40) ?? ""} · ${best?.url.slice(0, 90) ?? ""}`);
        } catch (e) {
          console.log(`${u.id}: error ${(e as Error).message.slice(0, 120)}`);
        }
        writeJson(CN_CANDIDATES_FILE, out);
      }
    }),
  );
  const withReport = all.filter((u) => out[u.id]?.candidates.some((c) => c.year >= 2024)).length;
  console.log(`Universities: ${all.length} · with a 2024 or newer report link: ${withReport}`);
  await closeBrowser();
}

keepRunning();
main();
