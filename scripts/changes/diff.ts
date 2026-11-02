// "What changed": what a refresh found on the official pages since the last one, for the homepage's
// benefits section and /benefits. Compares the snapshot taken before a refresh (data/snapshots/<date>/)
// with the refreshed files, and keeps only changes the refreshed page text confirms:
// - no longer listed: the title is gone from its page, and the page was read this time;
// - a deadline, date or value changed: the old quote is gone from the page, and the new one is on it
//   (the crawler checked it); a passed deadline followed by a later one is the next round;
// - newly listed: an item this refresh found that the snapshot didn't have.
// The crawlers read pages with Claude, which can miss an item on one run: an item still on its page
// (or whose page couldn't be read) is carried over unchanged, and so is the old wording of an item
// whose facts didn't change. Only items the site shows are reported.
//
// Usage: npx tsx scripts/changes/diff.ts snapshot   before a refresh: copies the files below
//        (then npm run benefits:collect -- --refresh, benefits:checklists, plan:dates)
//        npx tsx scripts/changes/diff.ts            after it: writes data/raw/changes.json

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { shownBenefit } from "../data/benefit-display.mjs";
import { squash as squashBenefit } from "../benefits/verify";
import type { Benefit } from "../benefits/collect";
import { readJson, today, writeJson } from "../pipeline/util";
import { squash as squashDate } from "../plan/verify";
import type { PlanDate } from "../plan/dates";
import type { Change, ChangesFile } from "../../lib/changes";
import { forStudentsInSingapore } from "../../lib/plan-events";

const SNAPSHOTS = "data/snapshots";
const FILES = { benefits: "data/raw/benefits.json", dates: "data/raw/plan-dates.json" };
const PAGES = { benefits: "data/pipeline/benefits/pages-latest.json", dates: "data/pipeline/plan/pages-latest.json" };
const OUT = "data/raw/changes.json";
/** Entries older than this are dropped from the file. */
const KEEP_DAYS = 120;

type Stored = Benefit & Record<string, unknown>;

const latestSnapshot = () =>
  existsSync(SNAPSHOTS)
    ? readdirSync(SNAPSHOTS)
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
        .at(-1)
    : undefined;

function snapshot() {
  const dir = path.join(SNAPSHOTS, today());
  mkdirSync(dir, { recursive: true });
  for (const f of Object.values(FILES)) copyFileSync(f, path.join(dir, path.basename(f)));
  console.log(`snapshot: ${dir}`);
}

/** A newly found record worth adding: an award, discount or waiver with its value or a date, or a dated
 * deadline or event, under a title that names it (not a heading such as "Key dates:" or "Apply now"). */
const substantive = (b: Stored) =>
  b.title.length <= 90 &&
  !/[:*]\s*$/.test(b.title) &&
  !/^[£$€\d]/.test(b.title) &&
  !/^(apply now|payment terms|scholarship information|deadline for|key dates|how to)\b/i.test(b.title) &&
  (b.kind === "deadline" || b.kind === "event" ? !!(b.deadline || b.eventDate) : !!(b.value || b.deadline));

/** On the site: the display rules, and the ones lib/data/benefits.ts applies (international, taught). */
const onSite = (b: Stored) => shownBenefit(b) && (b.forInternational !== false || /alumni/i.test(b.title)) && b.postgraduateTaught !== false;

/** A planner date whose title is only a heading ("Key dates:"): kept for /plan, too vague to report. */
const GENERIC = /^(key|important) dates?:?$/i;

/** The same award read under a slightly different title ("X" and "X - £10,000"). */
const sameAward = (a: Stored, b: Stored) => {
  // Without brackets or a trailing amount: "X (Postgraduate) - £10,000" is X.
  const core = (t: string) =>
    squashBenefit(t)
      .replace(/\(.*?\)/g, " ")
      .replace(/\s+-\s+[£$€]?\s?\d[\d.,]*.*$/, "")
      .replace(/\s+/g, " ")
      .trim();
  const x = core(a.title), y = core(b.title);
  return a.institutionId === b.institutionId && a.kind === b.kind && !!x && !!y && (x.includes(y) || y.includes(x));
};

/** The crawler's own output for this refresh, kept on the first run after a crawl so the diff can run again. */
function crawled<T>(file: string, pages: string, name: string): T {
  const saved = `data/pipeline/${name}/crawled-latest.json`;
  const at = existsSync(pages) ? statSync(pages).mtimeMs : 0;
  const kept = readJson<{ crawledAt: number; data: T } | null>(saved, null);
  if (kept && kept.crawledAt === at) return kept.data;
  const data = readJson<T>(file, null as T);
  writeJson(saved, { crawledAt: at, data });
  return data;
}

function main() {
  if (process.argv[2] === "snapshot") return snapshot();
  const snap = latestSnapshot();
  if (!snap) throw new Error("No snapshot yet: run `npx tsx scripts/changes/diff.ts snapshot` before a refresh.");
  const checked = today();
  const names = new Map((readJson<{ institutions: { id: string; name: string }[] }>("data/raw/institutions.json", { institutions: [] }).institutions).map((i) => [i.id, i.name]));
  names.set("kaplan", "Kaplan Singapore");
  const university = (id: string) => names.get(id) ?? id;
  const entries: Change[] = [];
  const add = (c: Omit<Change, "id" | "checked" | "university">) =>
    entries.push({ ...c, university: university(c.institutionId), id: `${checked}-${c.source}-${c.change}-${c.institutionId}-${squashDate(c.title).replace(/[^a-z0-9]+/g, "-")}-${c.to ?? c.from ?? ""}`, checked });

  // Benefits: each earlier record against this crawl's reading of it (by id, or the same award retitled).
  const benefitPages = readJson<{ pages: Record<string, string> }>(PAGES.benefits, { pages: {} }).pages;
  const prevFileB = readJson<{ builtAt: string; items: Stored[] }>(path.join(SNAPSHOTS, snap, "benefits.json"), { builtAt: snap, items: [] });
  const prevB = prevFileB.items;
  const fileB = crawled<{ note: string; builtAt: string; items: Stored[]; dropped: unknown[] }>(FILES.benefits, PAGES.benefits, "benefits");
  const crawledB = new Map(fileB.items.map((b) => [b.id, b]));
  const prevIds = new Set(prevB.map((b) => b.id));
  const paired = new Set<string>();
  const result = new Map<string, Stored>();
  const onPage = (url: string, text: string | null | undefined) => (benefitPages[url] && text ? benefitPages[url].includes(squashBenefit(text)) : null);
  for (const p of prevB) {
    const c = crawledB.get(p.id) ?? fileB.items.find((x) => !prevIds.has(x.id) && !paired.has(x.id) && sameAward(p, x));
    if (!c) {
      if (benefitPages[p.url] && onPage(p.url, p.title) === false) {
        if (onSite(p)) add({ source: "benefits", change: "removed", kind: p.kind, institutionId: p.institutionId, title: p.title, from: p.value, to: null, quote: null, url: p.url });
      } else result.set(p.id, p); // missed this time, or its page wasn't read: carried over
      continue;
    }
    paired.add(c.id);
    let changed = false;
    for (const field of ["deadline", "eventDate"] as const) {
      if (!c[field] || p[field] === c[field]) continue;
      const gone = onPage(c.url, p.quotes?.[field]) === false;
      const next = field === "deadline" && !!p.deadline && p.deadline < checked && c[field]! > p.deadline;
      if (!gone && !next) continue;
      changed = true;
      if (onSite(c))
        add({ source: "benefits", change: field === "deadline" ? (gone ? "deadline" : "next-deadline") : "date", kind: c.kind, institutionId: c.institutionId, title: p.title, from: p[field], to: c[field], quote: c.quotes?.[field] ?? null, url: c.url });
    }
    if (c.value && p.value && c.value !== p.value && onPage(c.url, p.quotes?.value ?? p.value) === false) {
      changed = true;
      if (onSite(c)) add({ source: "benefits", change: "value", kind: c.kind, institutionId: c.institutionId, title: p.title, from: p.value, to: c.value, quote: c.quotes?.value ?? null, url: c.url });
    }
    // A verified change takes the new reading under the old id; otherwise the old record (and its
    // checklist) stays, confirmed today.
    result.set(p.id, changed ? { ...c, id: p.id, title: p.title } : { ...p, retrievedAt: c.retrievedAt });
  }
  for (const c of fileB.items) {
    if (prevIds.has(c.id) || paired.has(c.id) || !substantive(c)) continue;
    if ([...result.values()].some((x) => sameAward(x, c))) continue;
    result.set(c.id, c);
    const when = c.deadline ?? c.eventDate;
    if (onSite(c) && !(when && when < checked)) add({ source: "benefits", change: "added", kind: c.kind, institutionId: c.institutionId, title: c.title, from: null, to: c.value ?? c.deadline ?? c.eventDate, quote: null, url: c.url });
  }
  writeJson(FILES.benefits, { ...fileB, items: [...result.values()].sort((x, y) => x.id.localeCompare(y.id)) });

  // Planner dates: a title can have several dates (sessions, intakes), so compare each title's dates.
  const datePages = readJson<{ pages: Record<string, string> }>(PAGES.dates, { pages: {} }).pages;
  const prevFileD = readJson<{ builtAt: string; items: PlanDate[] }>(path.join(SNAPSHOTS, snap, "plan-dates.json"), { builtAt: snap, items: [] });
  const fileD = crawled<{ note: string; builtAt: string; items: PlanDate[]; dropped: unknown[]; failures: unknown[] }>(FILES.dates, PAGES.dates, "plan");
  const key = (d: PlanDate) => `${d.institutionId}|${d.kind}|${squashDate(d.title)}`;
  const group = (list: PlanDate[]) => list.reduce((m, d) => m.set(key(d), [...(m.get(key(d)) ?? []), d]), new Map<string, PlanDate[]>());
  const prevG = group(prevFileD.items);
  const curG = group(fileD.items);
  const kept = new Map<string, PlanDate>();
  const keep = (d: PlanDate) => {
    if (!kept.has(`${key(d)}|${d.date}`)) kept.set(`${key(d)}|${d.date}`, d);
  };
  const dateOnPage = (d: PlanDate) => (datePages[d.url] ? datePages[d.url].includes(squashDate(d.quotes?.date ?? d.date)) && datePages[d.url].includes(squashDate(d.title)) : null);
  for (const [k, before] of prevG) {
    const now = curG.get(k) ?? [];
    const shown = forStudentsInSingapore(before[0]);
    const found = now.filter((d) => !before.some((x) => x.date === d.date));
    for (const d of before.filter((x) => x.date >= checked)) {
      const same = now.find((x) => x.date === d.date);
      if (same) keep({ ...d, retrievedAt: same.retrievedAt });
      // Still on its page, or the page wasn't read: the model missed it, carried over.
      else if (dateOnPage(d) !== false) keep(d);
      else {
        const moved = found.shift();
        if (shown) add({ source: "dates", change: moved ? "date" : "removed", kind: d.kind, institutionId: d.institutionId, title: d.title, from: d.date, to: moved?.date ?? null, quote: moved?.quotes?.date ?? null, url: (moved ?? d).url });
        if (moved) keep(moved);
      }
    }
    for (const d of found) {
      keep(d);
      if (shown && d.date >= checked && !GENERIC.test(d.title)) add({ source: "dates", change: "added", kind: d.kind, institutionId: d.institutionId, title: d.title, from: null, to: d.date, quote: d.quotes?.date ?? null, url: d.url });
    }
  }
  for (const [k, now] of curG) {
    if (prevG.has(k)) continue;
    for (const d of now) {
      keep(d);
      if (d.date >= checked && forStudentsInSingapore(d) && !GENERIC.test(d.title)) add({ source: "dates", change: "added", kind: d.kind, institutionId: d.institutionId, title: d.title, from: null, to: d.date, quote: d.quotes?.date ?? null, url: d.url });
    }
  }
  writeJson(FILES.dates, { ...fileD, items: [...kept.values()].sort((p, q) => p.date.localeCompare(q.date)) });

  // The file: this refresh's entries replace any from a run of the same day, oldest dropped.
  const prev = readJson<ChangesFile>(OUT, { note: "", builtAt: checked, checks: [], entries: [] });
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
  const order: Record<Change["change"], number> = { deadline: 0, "next-deadline": 1, date: 2, value: 3, added: 4, removed: 5 };
  const since = [prevFileB.builtAt, prevFileD.builtAt].sort();
  writeJson(OUT, {
    note: "Changes on official university pages between two refreshes, each confirmed against the refreshed page (scripts/changes/diff.ts).",
    builtAt: checked,
    checks: [
      { checked, since: since[0], sinceLatest: since[1], pages: { benefits: Object.keys(benefitPages).length, dates: Object.keys(datePages).length }, entries: entries.length },
      ...prev.checks.filter((c) => c.checked !== checked),
    ].slice(0, 26),
    entries: [
      ...entries.sort((a, b) => order[a.change] - order[b.change] || a.university.localeCompare(b.university) || a.title.localeCompare(b.title)),
      ...prev.entries.filter((e) => e.checked !== checked && e.checked >= cutoff),
    ],
  });
  const count = entries.reduce<Record<string, number>>((m, e) => ((m[`${e.source} ${e.change}`] = (m[`${e.source} ${e.change}`] ?? 0) + 1), m), {});
  console.log(`since ${since.join(" / ")}: ${entries.length} changes`, count);
}

main();
