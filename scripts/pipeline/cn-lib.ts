import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CACHE_DIR, DATA_DIR } from "./config";
import { decodeEntities } from "./extract-lib";
import { politeFetch, routeThroughBrowser } from "./http";

// Shared by the mainland employment-report steps (cn-discover.ts, cn-reports.ts): cached polite fetches,
// links with their text, the report year a link names, and the PDF a report article carries.

export const CN_DIR = path.join(DATA_DIR, "cn-reports");
export const CN_UNIVERSITIES_FILE = path.join(import.meta.dirname, "lists", "cn-universities.json");
export const CN_CANDIDATES_FILE = path.join(CN_DIR, "candidates.json");

export type CnUniversity = { id: string; zh: string; en: string; domain: string; tier: "985" | "211"; list?: string; report?: string };
export type Fetched = { file: string; pdf: boolean; finalUrl: string };
export type Link = { url: string; text: string };

function cachePath(url: string, pdf: boolean) {
  return path.join(CACHE_DIR, new URL(url).host, createHash("sha1").update(url).digest("hex") + (pdf ? ".pdf" : ".html"));
}

/** A script-challenge page some university firewalls serve to plain HTTP clients (it renders in a browser). */
const CHALLENGE = /\$_ts\s*=|<meta[^>]+id=["']?[0-9A-Za-z]{10,}["']?[^>]+content=["'][^"']{40,}|window\.location\.href\s*=.{0,40}\+|document\.cookie\s*=.{0,200}location/i;

/**
 * A page or file, from the cache or fetched politely; a site that answers with a script challenge is read in the
 * browser. `fresh` skips the cache (a list page that came back without its links, to be read in the browser).
 */
export async function get(url: string, maxBytes = 60_000_000, fresh = false): Promise<Fetched | null> {
  const isPdf = (b: Buffer) => b.subarray(0, 1024).toString("latin1").includes("%PDF-");
  // A file's address answered earlier with a page (a firewall's or an error page) is fetched again, not read from the cache.
  const fileUrl = /\.pdf($|[?#])|virtual_attach_file|download\.jsp|DownloadAttachUrl|downfile/i.test(url);
  for (const pdf of [true, false]) {
    const f = cachePath(url, pdf);
    if (!fresh && existsSync(f) && (pdf ? isPdf(readFileSync(f)) : !fileUrl)) return { file: f, pdf, finalUrl: url };
  }
  let r = await politeFetch(url, maxBytes);
  // Some university servers answer plain HTTP clients with 403/404 for files a browser gets: one try in the browser.
  const challenged = (x: typeof r) =>
    (!x.ok && (x.status === 412 || x.status === 403 || x.status === 404)) ||
    (x.ok && !isPdf(x.body) && x.body.length < 60_000 && (CHALLENGE.test(x.body.toString("utf8")) || /\.pdf($|\?)/i.test(x.finalUrl)));
  if (challenged(r)) {
    routeThroughBrowser([new URL(url).origin]);
    r = await politeFetch(url, maxBytes);
  }
  if (!r.ok) {
    console.log(`  ${url.slice(0, 110)}: ${r.reason} ${r.detail.slice(0, 100)}`);
    return null;
  }
  const pdf = isPdf(r.body);
  const file = cachePath(url, pdf);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, r.body);
  return { file, pdf, finalUrl: r.finalUrl };
}

/** The page's text as a browser would decode it: UTF-8, or GBK when the page declares it. */
export function html(file: string): string {
  const buf = readFileSync(file);
  const head = buf.subarray(0, 4000).toString("latin1");
  const charset = /charset=["']?([\w-]+)/i.exec(head)?.[1]?.toLowerCase();
  if (charset && /gb|gbk|gb2312|gb18030/.test(charset)) return new TextDecoder("gb18030").decode(buf);
  return buf.toString("utf8");
}

export function links(page: string, base: string): Link[] {
  const out: Link[] = [];
  for (const m of page.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]{0,400}?)<\/a>/gi)) {
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, "");
    if (/^(javascript|mailto|tel):/i.test(m[1].trim())) continue;
    try {
      out.push({ url: new URL(m[1].replace(/&amp;/g, "&").trim(), base).toString(), text: text || decodeEntities(/title=["']([^"']+)/.exec(m[0])?.[1] ?? "") });
    } catch {}
  }
  return out;
}

/** The graduating year a report link names: "2025届" → 2025, "2025年度" → 2025, "2024-2025学年" → 2025; 0 when none. */
export function reportYear(text: string): number {
  const cohort = [...text.matchAll(/(20\d\d)\s*届/g)].map((m) => Number(m[1]));
  if (cohort.length) return Math.max(...cohort);
  const years = [...text.matchAll(/(20\d\d)/g)].map((m) => Number(m[1])).filter((y) => y >= 2015 && y <= 2030);
  return years.length ? Math.max(...years) : 0;
}

/** A report article's own PDF (a link, an attachment or a file shown in an embedded PDF viewer), or the article itself. */
export async function reportFile(url: string): Promise<{ file: string; pdf: boolean; url: string } | null> {
  const page = await get(url);
  if (!page) return null;
  if (page.pdf) return { file: page.file, pdf: true, url };
  const body = html(page.file);
  const attrs = [...body.matchAll(/(?:href|src|pdfsrc|data-src|data-file|sudyfile-attr|value|file)\s*=\s*["']([^"']+?\.pdf)(?:[?#][^"']*)?["']/gi)].map((m) => m[1]);
  const viewers = [...body.matchAll(/[?&]file=([^"'&]+?\.pdf)/gi)].map((m) => decodeURIComponent(m[1]));
  // A file named in a script call: the VSB CMS's `Iframe("/virtual_attach_file.vsb?…&e=.pdf", …)` or `Iframe("/__local/….pdf", …)` viewer.
  const scripted = [...body.matchAll(/["']([^"'\s<>]*(?:virtual_attach_file\.vsb\?[^"'\s<>]+|\.pdf))["']/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
  const anchors = links(body, page.finalUrl)
    .filter((l) => /附件|下载|报告|\.pdf/i.test(l.text) && /download|attach|upload|files?\/|\.pdf|DownloadAttachUrl/i.test(l.url))
    .map((l) => l.url);
  for (const candidate of [...attrs, ...viewers, ...scripted, ...anchors]) {
    let abs: string;
    try {
      abs = new URL(candidate.replace(/&amp;/g, "&"), page.finalUrl).toString();
    } catch {
      continue;
    }
    if (/\/(_js|js|static)\/|pdfjs\/build/i.test(abs)) continue;
    const pdf = await get(abs);
    if (pdf?.pdf) return { file: pdf.file, pdf: true, url: abs };
  }
  return { file: page.file, pdf: false, url };
}
