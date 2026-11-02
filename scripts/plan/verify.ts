// How a planner date is checked against its page (scripts/plan/dates.ts, and scripts/changes/diff.ts
// when it compares a refreshed page with what was read before).

export const squash = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
export const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A date counts when its quote has the day and the month (name or number). */
export function dateBacked(iso: string, quote: string | undefined): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || !quote) return false;
  const q = quote.toLowerCase();
  return new RegExp(`\\b0?${d}(st|nd|rd|th)?\\b`).test(q) && (q.includes(MONTHS[m - 1]) || new RegExp(`\\b0?${m}\\b`).test(q));
}
