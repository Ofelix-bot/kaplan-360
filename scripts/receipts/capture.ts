import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { extractText, getDocumentProxy } from "unpdf";
import { RECEIPTS, type Receipt } from "../../lib/home/receipts";
import { ROOT, USER_AGENT } from "../pipeline/config";
import { politeFetch, robotsFor } from "../pipeline/http";
import { mayFetch } from "../pipeline/robots";
import { today as localDay } from "../pipeline/util";

// The homepage's receipts, checked and photographed: each official quote is looked up on its live
// page (word for word, ignoring only spacing and curly versus straight quotes), and where it is found
// on a web page the sentence is photographed where it stands, highlighted, for the hover previews and
// the receipts gallery. robots.txt is honoured (our own user agent, as in the pipeline); a page that
// blocks us or doesn't have the sentence is reported and gets no photo. PDFs are checked as text.
//
//   npx tsx scripts/receipts/capture.ts            all official receipts
//   npx tsx scripts/receipts/capture.ts murdoch    one receipt

const OUT_DIR = path.join(ROOT, "public", "receipts");
const DATA_FILE = path.join(ROOT, "data", "raw", "receipt-shots.json");
// The day where the site is read (Singapore), as the crawlers date their reads (scripts/pipeline/util.ts).
const today = localDay();

export type Shot = {
  id: string;
  url: string;
  /** Checked on (YYYY-MM-DD). */
  checked: string;
  status: "found" | "not-found" | "blocked" | "robots" | "error";
  detail?: string;
  /** The photo, when there is one. */
  file?: string;
  width?: number;
  height?: number;
  /** A collapsed section was opened to show the sentence. */
  opened?: boolean;
};

const norm = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[‘’ʼ′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

async function checkPdf(r: Receipt): Promise<Shot> {
  const res = await politeFetch(r.url, 30_000_000);
  if (!res.ok) return { id: r.id, url: r.url, checked: today, status: res.reason === "robots" ? "robots" : "blocked", detail: res.detail };
  const pdf = await getDocumentProxy(new Uint8Array(res.body));
  const { text } = await extractText(pdf, { mergePages: true });
  const found = norm(text).includes(norm(r.quote!));
  return { id: r.id, url: r.url, checked: today, status: found ? "found" : "not-found", detail: found ? "PDF text" : "quote not in the PDF's text" };
}

/** Finds the quote on the page, highlights it and returns the area to photograph (page coordinates). */
async function locate(page: Page, quote: string) {
  return page.evaluate((q) => {
    const normalise = (s: string) =>
      s
        .normalize("NFKC")
        .replace(/[‘’ʼ′]/g, "'")
        .replace(/[“”″]/g, '"');
    // Every text node, with a running index into the normalised text (whitespace collapsed).
    const nodes: { node: Text; start: number; map: number[] }[] = [];
    let text = "";
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      const raw = normalise(n.data);
      const map: number[] = [];
      const start = text.length;
      for (let i = 0; i < raw.length; i++) {
        const c = /\s/.test(raw[i]) ? " " : raw[i];
        if (c === " " && (text.endsWith(" ") || text.length === 0)) continue;
        map.push(i);
        text += c;
      }
      nodes.push({ node: n, start, map });
    }
    const needle = normalise(q).replace(/\s+/g, " ").trim();
    let at = text.indexOf(needle);
    if (at < 0) at = text.toLowerCase().indexOf(needle.toLowerCase());
    if (at < 0) return null;
    const end = at + needle.length;
    const pos = (idx: number, isEnd: boolean) => {
      for (const { node, start, map } of nodes) {
        if (idx >= start && idx < start + map.length) return { node, offset: map[idx - start] + (isEnd ? 1 : 0) };
      }
      return null;
    };
    const a = pos(at, false);
    const b = pos(end - 1, true);
    if (!a || !b) return null;
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);

    (window as unknown as { k360Range: Range }).k360Range = range;

    // Open whatever hides it: a closed <details>, or an accordion or tab panel, by its own button
    // (aria-controls) where there is one, else by showing the panel.
    let opened = false;
    for (let el: HTMLElement | null = range.commonAncestorContainer.parentElement; el; el = el.parentElement) {
      if (el instanceof HTMLDetailsElement && !el.open) {
        el.open = true;
        opened = true;
        continue;
      }
      const cs = getComputedStyle(el);
      const hidden = el.hidden || cs.display === "none" || cs.visibility === "hidden" || (cs.maxHeight === "0px" && cs.overflow !== "visible") || el.getAttribute("aria-hidden") === "true";
      if (!hidden) continue;
      const button = el.id ? document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(el.id)}"]`) : null;
      if (button && button.getAttribute("aria-expanded") !== "true") button.click();
      else {
        el.hidden = false;
        el.style.setProperty("display", cs.display === "none" ? "block" : cs.display, "important");
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("max-height", "none", "important");
        el.style.setProperty("height", "auto", "important");
        el.style.setProperty("overflow", "visible", "important");
      }
      opened = true;
    }
    return { opened };
  }, quote);
}

/** Cookie notices, sticky headers, tours and chat buttons would cover the sentence. */
async function hideOverlays(page: Page) {
  await page.evaluate(() => {
    // A native modal dialog (a cookie notice, say) dims the page with a ::backdrop: close it.
    for (const d of document.querySelectorAll("dialog[open]")) (d as HTMLDialogElement).close();
    if (!document.getElementById("k360-no-overlays")) {
      const style = document.createElement("style");
      style.id = "k360-no-overlays";
      style.textContent = "::backdrop{display:none!important}html,body{overflow:visible!important;filter:none!important}";
      document.head.append(style);
    }
    // Consent notices built as custom elements keep their overlay in a shadow root: hide the element.
    for (const el of document.querySelectorAll<HTMLElement>("body *"))
      if (el.tagName.includes("-") && /consent|cookie/i.test(el.tagName)) el.style.setProperty("display", "none", "important");
    document.body.classList.remove("modal-open");
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const p = getComputedStyle(el).position;
      if (p === "fixed" || p === "sticky" || el.matches("[role=dialog],[aria-modal=true],[class*=tour],[class*=cookie],[id*=cookie],[id*=onetrust],[class*=onetrust],[class*=consent],[id*=consent]"))
        el.style.setProperty("visibility", "hidden", "important");
    }
  });
}

/**
 * After any opening has settled: highlights the quote, centres it in the window and measures it, in
 * window coordinates. The photo is then taken of the window, not the whole page: a full-page capture
 * lays the page out again at full height, and sections sized to the window move.
 */
async function measure(page: Page) {
  await hideOverlays(page);
  // Centre the sentence at once (many sites scroll smoothly, which would still be moving when measured).
  await page.evaluate(() => {
    const range = (window as unknown as { k360Range: Range }).k360Range;
    document.documentElement.style.setProperty("scroll-behavior", "auto", "important");
    document.body.style.setProperty("scroll-behavior", "auto", "important");
    const r = range.getBoundingClientRect();
    window.scrollTo({ top: r.top + window.scrollY - (window.innerHeight - r.height) / 2, behavior: "instant" });
  });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const range = (window as unknown as { k360Range: Range }).k360Range;
    // The highlight: the CSS Custom Highlight API marks the range without changing the page's markup.
    const style = document.createElement("style");
    style.textContent = "::highlight(k360-receipt){background-color:#ffb547;color:#1a0a00;}";
    document.head.append(style);
    const api = window as unknown as { CSS: { highlights: Map<string, unknown> }; Highlight: new (r: Range) => unknown };
    api.CSS.highlights.set("k360-receipt", new api.Highlight(range));

    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) return null;
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    // The block the sentence sits in, to frame it with its neighbours.
    let block: HTMLElement | null = range.commonAncestorContainer.parentElement;
    while (block && getComputedStyle(block).display.startsWith("inline")) block = block.parentElement;
    const b = (block ?? document.body).getBoundingClientRect();
    return {
      page: window.innerWidth,
      view: window.innerHeight,
      range: { x: left, y: top, w: right - left, h: bottom - top },
      block: { x: b.left, y: b.top, w: b.width, h: b.height },
    };
  });
}

/** The area to photograph: the sentence whole, with its paragraph around it where that fits. */
function frame(m: NonNullable<Awaited<ReturnType<typeof measure>>>) {
  const { range, block } = m;
  const W = Math.round(Math.min(1240, Math.max(640, Math.min(block.w + 48, 1240), range.w + 96)));
  // Centred on the paragraph when it fits, else from the paragraph's left edge (lines are read from
  // the left); never cutting the sentence.
  let x = block.w + 48 <= W ? block.x - 24 - (W - block.w - 48) / 2 : block.x - 24;
  if (range.x - 16 < x) x = range.x - 16;
  if (range.x + range.w + 16 > x + W) x = range.x + range.w + 16 - W;
  x = Math.max(0, Math.min(m.page - W, x));
  const H = Math.round(Math.min(400, Math.max(170, Math.min(block.h, 400) + 48, range.h + 64)));
  const y = Math.max(0, Math.min(m.view - H, range.y + range.h / 2 - H / 2));
  return { x: Math.round(x), y: Math.round(y), width: W, height: H };
}

async function capture(page: Page, r: Receipt): Promise<Shot> {
  const u = new URL(r.url);
  const robots = await robotsFor(u.origin);
  if (robots === "unreachable") return { id: r.id, url: r.url, checked: today, status: "robots", detail: "robots.txt unreachable" };
  if (!mayFetch(robots, u.pathname + u.search)) return { id: r.id, url: r.url, checked: today, status: "robots", detail: "disallowed by robots.txt" };
  let res;
  try {
    res = await page.goto(r.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1500);
  } catch (e) {
    return { id: r.id, url: r.url, checked: today, status: "error", detail: (e as Error).message.split("\n")[0] };
  }
  const status = res?.status() ?? 0;
  if (status === 401 || status === 403 || status === 429) return { id: r.id, url: r.url, checked: today, status: "blocked", detail: `HTTP ${status} (not bypassed)` };
  if (status >= 400) return { id: r.id, url: r.url, checked: today, status: "error", detail: `HTTP ${status}` };
  const landed = new URL(page.url());
  if (landed.origin !== u.origin) {
    const lr = await robotsFor(landed.origin);
    if (lr === "unreachable" || !mayFetch(lr, landed.pathname + landed.search)) return { id: r.id, url: r.url, checked: today, status: "robots", detail: "redirected to a disallowed page" };
  }
  const where = await locate(page, r.quote!);
  if (!where) return { id: r.id, url: r.url, checked: today, status: "not-found", detail: "the quote isn't on the page as written" };
  await page.waitForTimeout(where.opened ? 1200 : 300);
  const m = await measure(page);
  const shot: Shot = { id: r.id, url: r.url, checked: today, status: "found", opened: where.opened || undefined };
  // On the page but not shown (still collapsed, off to one side, or not scrolled to the middle): checked, with no photo.
  if (!m || m.range.y < 40 || m.range.y + m.range.h > m.view - 20) return { ...shot, detail: "on the page, but not visible to photograph" };
  await page.waitForTimeout(500);
  await hideOverlays(page);
  const clip = frame(m);
  mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${r.id}.jpg`), type: "jpeg", quality: 82, clip });
  return { ...shot, file: `/receipts/${r.id}.jpg`, width: clip.width * 2, height: clip.height * 2 };
}

async function main() {
  const only = process.argv[2];
  const list = Object.values(RECEIPTS).filter((r) => r.kind === "official" && r.quote && (!only || r.id === only));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, userAgent: USER_AGENT, locale: "en-SG", colorScheme: "light" });
  // tsx keeps function names with a helper (__name) that the page doesn't have.
  await context.addInitScript({ content: "globalThis.__name = (f) => f;" });
  const page = await context.newPage();
  const shots: Shot[] = [];
  for (const r of list) {
    const shot = r.url.toLowerCase().endsWith(".pdf") ? await checkPdf(r) : await capture(page, r);
    shots.push(shot);
    console.log(`${shot.status.padEnd(9)} ${r.id}${shot.detail ? `: ${shot.detail}` : ""}${shot.opened ? " (opened a collapsed section)" : ""}`);
    await new Promise((res) => setTimeout(res, 2500));
  }
  await browser.close();

  let previous: Shot[] = [];
  try {
    previous = JSON.parse(readFileSync(DATA_FILE, "utf8")).shots;
  } catch {}
  const merged = [...previous.filter((p) => !shots.some((s) => s.id === p.id)), ...shots].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(
    DATA_FILE,
    JSON.stringify(
      {
        note: "Homepage receipts checked against their live pages by scripts/receipts/capture.ts. status found = the quote is on the page word for word (spacing and quote marks aside); file = a photo of it there, highlighted.",
        shots: merged,
      },
      null,
      1,
    ) + "\n",
  );
  console.log(`${shots.filter((s) => s.status === "found").length}/${shots.length} found; written ${path.relative(ROOT, DATA_FILE)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
