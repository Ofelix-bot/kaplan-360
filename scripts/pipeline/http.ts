import http from "node:http";
import https from "node:https";
import { gunzipSync } from "node:zlib";
import { browserGet, browserPaginate, type BrowserResponse } from "./browser";
import { BOT_TOKEN, MAX_CRAWL_DELAY_S, MIN_INTERVAL_MS, RETRIES, TIMEOUT_MS, USER_AGENT } from "./config";
import { mayFetch, parseRobots, type Robots } from "./robots";

// Polite HTTP for the pipeline: robots.txt is checked before every request (including each redirect
// hop), one request at a time per host with at least MIN_INTERVAL_MS (or the site's Crawl-delay)
// between them, a timeout, and retries with backoff for transient errors. 401/403 responses are
// treated as "blocked" and never retried or worked around.

export type FailReason = "robots" | "crawl-delay" | "http" | "blocked" | "network" | "timeout" | "too-large" | "redirects";

export type FetchOk = { ok: true; url: string; finalUrl: string; status: number; contentType: string; body: Buffer };
export type FetchFail = { ok: false; url: string; status: number | null; reason: FailReason; detail: string };
export type FetchResult = FetchOk | FetchFail;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const robotsCache = new Map<string, Promise<Robots | "unreachable">>();
const nextSlot = new Map<string, number>();
const browserHosts = new Set<string>();

/** Hosts that reject scripted clients: their requests (robots.txt included) go through browser.ts. */
export function routeThroughBrowser(origins: string[]) {
  for (const o of origins) browserHosts.add(new URL(o).host);
}

function get(url: string, maxBytes: number) {
  return browserHosts.has(new URL(url).host) ? browserGet(url, maxBytes) : rawGet(url, maxBytes);
}
const intervals = new Map<string, number>();

/** Waits for this host's next free slot and reserves it. */
async function waitTurn(host: string) {
  const gap = intervals.get(host) ?? MIN_INTERVAL_MS;
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + gap);
  if (at > now) await sleep(at - now);
}

type RawResponse = { status: number; headers: Headers; body: Buffer };

/** One GET with node:http(s) (no automatic redirects), a timeout and a size cap. */
function rawGet(url: string, maxBytes: number): Promise<RawResponse | { error: "timeout" | "network" | "too-large"; detail: string }> {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === "http:" ? http : https;
    let settled = false;
    const done = (v: RawResponse | { error: "timeout" | "network" | "too-large"; detail: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v);
    };
    const req = lib.get(
      u,
      {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5", "Accept-Language": "en" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy();
            done({ error: "too-large", detail: `over ${maxBytes} bytes` });
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          const headers = new Headers();
          for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
          done({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks) });
        });
        res.on("error", (e) => done({ error: "network", detail: e.message }));
      },
    );
    const timer = setTimeout(() => {
      req.destroy();
      done({ error: "timeout", detail: `no response in ${TIMEOUT_MS} ms` });
    }, TIMEOUT_MS);
    req.on("error", (e) => done({ error: "network", detail: e.message }));
  });
}

/** robots.txt for an origin. 4xx means no rules (RFC 9309); 5xx or unreachable means don't crawl. */
export function robotsFor(origin: string): Promise<Robots | "unreachable"> {
  let p = robotsCache.get(origin);
  if (!p) {
    p = (async () => {
      const host = new URL(origin).host;
      for (let attempt = 0; attempt < RETRIES; attempt++) {
        await waitTurn(host);
        // robots.txt is read with a plain request first (some browsers treat it as a download);
        // the browser is used when a browser-only site rejects that request.
        let r: Awaited<ReturnType<typeof get>> = await rawGet(origin + "/robots.txt", 2_000_000);
        const rejected = "error" in r || r.status === 202 || r.status === 401 || r.status === 403 || r.status === 429;
        if (rejected && browserHosts.has(host)) r = await browserGet(origin + "/robots.txt", 2_000_000);
        if ("error" in r) {
          await sleep(2000 * 2 ** attempt);
          continue;
        }
        if (r.status >= 300 && r.status < 400) {
          const loc = r.headers.get("location");
          // Follow a redirect to the same site's robots.txt once (e.g. http→https, bare→www).
          if (loc) {
            const target = new URL(loc, origin);
            if (target.pathname === "/robots.txt" && target.origin !== origin) return robotsFor(target.origin);
          }
          return { rules: { allow: [], disallow: [], crawlDelay: null }, aiAgents: [], sitemaps: [] };
        }
        if (r.status >= 400 && r.status < 500) return { rules: { allow: [], disallow: [], crawlDelay: null }, aiAgents: [], sitemaps: [] };
        if (r.status >= 500) {
          await sleep(2000 * 2 ** attempt);
          continue;
        }
        const robots = parseRobots(r.body.toString("utf8"), BOT_TOKEN);
        const delay = robots.rules.crawlDelay;
        if (delay !== null) intervals.set(host, Math.max(MIN_INTERVAL_MS, delay * 1000));
        return robots;
      }
      return "unreachable" as const;
    })();
    robotsCache.set(origin, p);
  }
  return p;
}

/** Fetches a URL politely. Follows up to 5 redirects, checking robots.txt for every hop. */
/** A course list that pages by script (browser only): every page state, each click paced like a request. */
export async function paginatedListing(url: string, nextSelector: string, maxPages = 60): Promise<{ ok: true; pages: string[]; detail: string } | FetchFail> {
  const u = new URL(url);
  const robots = await robotsFor(u.origin);
  if (robots === "unreachable") return { ok: false, url, status: null, reason: "robots", detail: `robots.txt unreachable at ${u.origin}` };
  if (robots.rules.crawlDelay !== null && robots.rules.crawlDelay > MAX_CRAWL_DELAY_S)
    return { ok: false, url, status: null, reason: "crawl-delay", detail: `Crawl-delay ${robots.rules.crawlDelay}s at ${u.host}` };
  if (!mayFetch(robots, u.pathname + u.search)) return { ok: false, url, status: null, reason: "robots", detail: `disallowed by robots.txt: ${u.pathname}` };
  await waitTurn(u.host);
  const r = await browserPaginate(url, nextSelector, maxPages, () => waitTurn(u.host));
  if ("error" in r) return { ok: false, url, status: null, reason: "network", detail: r.detail };
  return { ok: true, ...r };
}

export async function politeFetch(url: string, maxBytes = 12_000_000): Promise<FetchResult> {
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    const u = new URL(current);
    const robots = await robotsFor(u.origin);
    if (robots === "unreachable") return { ok: false, url, status: null, reason: "robots", detail: `robots.txt unreachable at ${u.origin}` };
    if (robots.rules.crawlDelay !== null && robots.rules.crawlDelay > MAX_CRAWL_DELAY_S)
      return { ok: false, url, status: null, reason: "crawl-delay", detail: `Crawl-delay ${robots.rules.crawlDelay}s at ${u.host}` };
    if (!mayFetch(robots, u.pathname + u.search)) return { ok: false, url, status: null, reason: "robots", detail: `disallowed by robots.txt: ${u.pathname}` };

    let result: Awaited<ReturnType<typeof get>> | null = null;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      await waitTurn(u.host);
      result = await get(current, maxBytes);
      if ("error" in result) {
        if (result.error === "too-large") return { ok: false, url, status: null, reason: "too-large", detail: result.detail };
        if (attempt < RETRIES) await sleep(2000 * 2 ** attempt);
        continue;
      }
      if (result.status === 429 || result.status >= 500) {
        const retryAfter = Number(result.headers.get("retry-after"));
        if (attempt < RETRIES) await sleep(Math.min(60_000, isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000 * 2 ** attempt));
        continue;
      }
      break;
    }
    if (!result) return { ok: false, url, status: null, reason: "network", detail: "no response" };
    if ("error" in result) return { ok: false, url, status: null, reason: result.error, detail: result.detail };
    const { status, headers } = result;
    if (status >= 300 && status < 400) {
      const loc = headers.get("location");
      if (!loc) return { ok: false, url, status, reason: "http", detail: "redirect without location" };
      current = new URL(loc, current).toString();
      continue;
    }
    if (status === 401 || status === 403) return { ok: false, url, status, reason: "blocked", detail: `HTTP ${status} (not bypassed)` };
    if (status >= 400) return { ok: false, url, status, reason: "http", detail: `HTTP ${status}` };
    // The browser follows redirects itself; its landing page must also be allowed by robots.txt.
    const landed = "finalUrl" in result ? (result as BrowserResponse).finalUrl : current;
    if (landed !== current) {
      const f = new URL(landed);
      const fr = await robotsFor(f.origin);
      if (fr === "unreachable" || !mayFetch(fr, f.pathname + f.search))
        return { ok: false, url, status: null, reason: "robots", detail: `redirected to a page robots.txt disallows: ${f.pathname}` };
      current = landed;
    }
    let body = result.body;
    if (body[0] === 0x1f && body[1] === 0x8b) body = gunzipSync(body);
    return { ok: true, url, finalUrl: current, status, contentType: headers.get("content-type") ?? "", body };
  }
  return { ok: false, url, status: null, reason: "redirects", detail: "more than 5 redirects" };
}
