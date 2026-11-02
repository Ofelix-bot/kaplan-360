import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/** Writes through a temporary file so an interrupted run never leaves half a file behind. */
export function writeJson(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  renameSync(tmp, file);
}

export function args() {
  const argv = process.argv.slice(2);
  const get = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  return {
    refresh: argv.includes("--refresh"),
    only: get("only")?.split(",").filter(Boolean) ?? null,
    limit: get("limit") ? Number(get("limit")) : null,
    flag: (name: string) => argv.includes(`--${name}`),
  };
}

/** Runs tasks with at most `n` in flight. */
export async function pool<T>(items: T[], n: number, task: (item: T, index: number) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await task(items[i], i);
    }
  });
  await Promise.all(workers);
}

/** Today's date on this machine's clock (YYYY-MM-DD), not UTC's: a build in Singapore before 08:00 is dated that day. */
export function today(): string {
  return new Date().toLocaleDateString("sv");
}

/** A socket error outside any request's handlers must not end a long run; that request times out instead. */
export function keepRunning() {
  process.on("uncaughtException", (e) => console.error("uncaught (continuing):", e.message));
}
