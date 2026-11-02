import file from "@/data/raw/changes.json";

// "What changed": the changes each refresh confirmed on official university pages
// (scripts/changes/diff.ts writes data/raw/changes.json), shown on the homepage and /benefits.

export type Change = {
  id: string;
  /** The refresh that found it (YYYY-MM-DD). */
  checked: string;
  source: "benefits" | "dates";
  change: "added" | "removed" | "deadline" | "next-deadline" | "date" | "value";
  /** The item's kind: scholarship, fee-reduction, application-fee-waiver, deadline, event, applications-open, application-deadline. */
  kind: string;
  institutionId: string;
  university: string;
  title: string;
  /** Dates are YYYY-MM-DD; values are the page's own words. */
  from: string | null;
  to: string | null;
  /** The refreshed page's words for the new value, when there is one. */
  quote: string | null;
  url: string;
};

/** A refresh: when it ran, the dates of the readings it was compared with (scholarships and planner dates can differ), and the pages read. */
export type ChangeCheck = { checked: string; since: string; sinceLatest?: string; pages: { benefits: number; dates: number }; entries: number };
/**
 * A quick re-check (scripts/changes/quick-check.ts): the last full read's pages fetched again without Claude;
 * `confirmed` pages were read and still have every quote the site shows from them.
 */
export type QuickCheck = { checked: string; pages: number; confirmed: number };
export type ChangesFile = { note: string; builtAt: string; checks: ChangeCheck[]; entries: Change[]; quick?: QuickCheck };

const CHANGES = file as ChangesFile;

/** The latest refresh, and the changes it found (newest refresh first for `all`). */
export function getChanges(): { latest: ChangeCheck | null; entries: Change[]; checks: ChangeCheck[] } {
  const latest = CHANGES.checks[0] ?? null;
  return { latest, entries: CHANGES.entries, checks: CHANGES.checks };
}

/** The last quick re-check, when there is one. */
export const getQuickCheck = (): QuickCheck | null => CHANGES.quick ?? null;

/**
 * What the "official pages" lines say: the newer of the last full read (its pages, "last full read") and
 * the last quick re-check (its confirmed pages, "last checked").
 */
export function pagesLine(): { n: number; date: string; kind: "read" | "checked" } | null {
  const latest = CHANGES.checks[0] ?? null;
  const quick = CHANGES.quick ?? null;
  if (quick && (!latest || quick.checked > latest.checked)) return { n: quick.confirmed, date: quick.checked, kind: "checked" };
  return latest ? { n: latest.pages.benefits + latest.pages.dates, date: latest.checked, kind: "read" } : null;
}
