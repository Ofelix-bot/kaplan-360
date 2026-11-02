// Downloads the official Skills Framework Dataset from the Jobs-Skills Portal (SWDA), whose
// download button works by script: opens the page in Edge, clicks the button, saves the file to
// data/sources/skills-framework/. Usage: npx tsx scripts/data/fetch-skills-framework.ts
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const PAGE = "https://jobsandskills.swda.gov.sg/frameworks/skills-frameworks";
const BUTTON = /^Skills-Framework-Dataset-/;
const OUT_DIR = path.resolve("data/sources/skills-framework");
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find((p) => existsSync(p))!;
const PORT = 9344;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const profile = path.resolve("data/pipeline/cache", `browser-profile-${PORT}`);
  const proc = spawn(EDGE, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--window-position=-2400,0", "about:blank"], { stdio: "ignore" });
  let browser;
  for (let i = 0; i < 120 && !browser; i++) {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`).catch(() => new Promise<undefined>((r) => setTimeout(r, 500)));
  }
  if (!browser) throw new Error("Edge did not start");
  try {
    const page = await browser.contexts()[0].newPage();
    await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const button = page.getByRole("button", { name: BUTTON }).or(page.getByRole("link", { name: BUTTON })).first();
    await button.waitFor({ timeout: 60_000 });
    const label = (await button.textContent())?.trim();
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 180_000 }), button.click()]);
    const file = path.join(OUT_DIR, download.suggestedFilename());
    await download.saveAs(file);
    console.log(`${label} → ${file} (from ${download.url()})`);
  } finally {
    const cdp = await browser.newBrowserCDPSession();
    await cdp.send("Browser.close").catch(() => {});
    spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
  }
}

main();
