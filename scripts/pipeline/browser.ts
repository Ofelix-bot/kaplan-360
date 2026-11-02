import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import { DATA_DIR, TIMEOUT_MS } from "./config";

// A real, visible Edge window for sites that reject scripted HTTP clients (sources with
// `browser: true`). It is the installed browser as it ships: its own user agent, no fingerprint
// changes, no CAPTCHA solving, no proxies. Pacing and robots.txt stay with http.ts, which calls
// browserGet() for these hosts (one page at a time per host). The window opens off-screen.

const EDGE_PATHS = [
  process.env.PIPELINE_BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter((p): p is string => !!p);
const PORT = Number(process.env.PIPELINE_BROWSER_PORT ?? 9335);
// One profile per port, so two pipeline runs can each have their own window.
const PROFILE_DIR = path.join(DATA_DIR, "cache", `browser-profile-${PORT}`);

export type BrowserResponse = {
  status: number;
  headers: Headers;
  body: Buffer;
  finalUrl: string;
};

let session: Promise<{ browser: Browser; proc: ChildProcess }> | null = null;

async function open() {
  const exe = EDGE_PATHS.find((p) => existsSync(p));
  if (!exe)
    throw new Error(
      "Microsoft Edge not found; set PIPELINE_BROWSER to a Chromium-based browser",
    );
  mkdirSync(PROFILE_DIR, { recursive: true });
  const proc = spawn(
    exe,
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      "--no-first-run",
      "--window-position=-2400,0",
      "--window-size=1280,900",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 120; i++) {
    try {
      return {
        browser: await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`),
        proc,
      };
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  proc.kill();
  throw new Error(`Edge did not open its debugging port ${PORT}`);
}

async function newPage() {
  session ??= open();
  const { browser } = await session;
  const context = browser.contexts()[0] ?? (await browser.newContext());
  // A window left over from an earlier run can accept the connection and then hang: give up after 20 s.
  return Promise.race([
    context.newPage(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("browser did not open a page in 20 s")), 20_000)),
  ]);
}

/** Loads a URL in the browser. HTML comes back as the rendered page; other types as sent. */
export async function browserGet(
  url: string,
  maxBytes: number,
): Promise<
  | BrowserResponse
  | { error: "timeout" | "network" | "too-large"; detail: string }
> {
  let page;
  try {
    page = await newPage();
  } catch {
    // The window was closed or crashed: open a fresh one once.
    await closeBrowser();
    try {
      page = await newPage();
    } catch (e) {
      session = null;
      return { error: "network" as const, detail: `browser unavailable: ${(e as Error).message}` };
    }
  }
  try {
    let res = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS * 2,
    });
    // 202 is a CDN's browser check (e.g. AWS WAF): let the page's script finish it, then load again.
    if (res?.status() === 202) {
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(2000);
      res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS * 2 });
    }
    if (!res) return { error: "network" as const, detail: "no response" };
    const headers = new Headers();
    // Some CDNs send multi-line values (e.g. server-timing); join the lines, skip what Headers still rejects.
    for (const [k, v] of Object.entries(res.headers())) {
      try {
        headers.append(k, v.replace(/\s*\n\s*/g, ", "));
      } catch {}
    }
    const type = headers.get("content-type") ?? "";
    // Rendered DOM for HTML pages; robots.txt and sitemaps exactly as sent.
    const rendered = /html/i.test(type) && !/\.(txt|xml)$/i.test(new URL(url).pathname);
    // How long to wait for the page's own requests to settle (PIPELINE_BROWSER_IDLE_MS): pages with ads or
    // analytics never go quiet, and a server-rendered page has its content at DOMContentLoaded.
    if (rendered)
      await page
        .waitForLoadState("networkidle", { timeout: Number(process.env.PIPELINE_BROWSER_IDLE_MS) || 15_000 })
        .catch(() => {});
    // A CDN's script check that answers 200 with a near-empty page (Imperva: a NOINDEX stub that
    // reloads itself): give the browser's own script time to finish, as it would for a visitor.
    // Nothing is solved or worked around; a page that stays a stub is returned as it is.
    for (let i = 0; rendered && i < 5; i++) {
      const html = await page.content().catch(() => "");
      if (html.length > 3000 || !/NOINDEX, NOFOLLOW|_Incapsula_|challenge-platform|cf-chl/i.test(html)) break;
      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    }
    const body = rendered
      ? Buffer.from(await page.content(), "utf8")
      : await res.body();
    if (body.length > maxBytes)
      return { error: "too-large" as const, detail: `over ${maxBytes} bytes` };
    return { status: res.status(), headers, body, finalUrl: page.url() };
  } catch (e) {
    const msg = (e as Error).message;
    return {
      error: /timeout/i.test(msg) ? ("timeout" as const) : ("network" as const),
      detail: msg.split("\n")[0],
    };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * A course list that pages by script: loads it, then clicks its "next" / "load more" control until
 * the control is gone or disabled or nothing changes, keeping each state's HTML. `beforeClick`
 * waits for the host's next request slot, so clicks are paced like page loads.
 */
export async function browserPaginate(
  url: string,
  nextSelector: string,
  maxPages: number,
  beforeClick: () => Promise<void>,
): Promise<{ pages: string[]; detail: string } | { error: "network"; detail: string }> {
  let page;
  try {
    page = await newPage();
  } catch (e) {
    session = null;
    return { error: "network", detail: `browser unavailable: ${(e as Error).message}` };
  }
  const settle = () => page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS * 2 });
    await settle();
    const pages = [await page.content()];
    let detail = "end of list";
    for (let i = 1; i < maxPages; i++) {
      const next = page.locator(nextSelector).first();
      const usable = (await next.count()) > 0 && (await next.isVisible().catch(() => false)) && !(await next.isDisabled().catch(() => false)) && (await next.getAttribute("disabled")) === null;
      if (!usable) break;
      await beforeClick();
      // A DOM click, so a cookie banner covering the control doesn't swallow it.
      await next.evaluate((el) => (el as HTMLElement).click()).catch(() => {});
      await settle();
      await page.waitForTimeout(800);
      const html = await page.content();
      if (html === pages[pages.length - 1]) {
        detail = "no change after click";
        break;
      }
      pages.push(html);
      if (i === maxPages - 1) detail = `stopped at ${maxPages} pages`;
    }
    return { pages, detail };
  } catch (e) {
    return { error: "network", detail: (e as Error).message.split("\n")[0] };
  } finally {
    await page.close().catch(() => {});
  }
}

/** Closes the browser window. Call once at the end of a run. */
export async function closeBrowser() {
  if (!session) return;
  const { browser, proc } = await session.catch(() => ({
    browser: null,
    proc: null,
  }));
  session = null;
  if (browser) {
    const cdp = await browser.newBrowserCDPSession().catch(() => null);
    await cdp?.send("Browser.close").catch(() => {});
  }
  if (proc?.pid && proc.exitCode === null) {
    if (process.platform === "win32")
      spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    else proc.kill();
  }
}
