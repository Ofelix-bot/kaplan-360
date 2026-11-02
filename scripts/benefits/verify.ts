// How a benefit is checked against its page (scripts/benefits/collect.ts, and scripts/changes/diff.ts
// when it compares a refreshed page with what was read before).

// Thousands separators are ignored, so "£3,000" matches a page that writes "£3000".
export const squash = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/\s+/g, " ").trim().toLowerCase();

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/**
 * A described value ("£3,000 tuition fee discount") counts when every amount or percentage in it is in
 * its verified quote ("a scholarship of £3,000 …"), and it has at least one.
 */
export function amountsBacked(value: string, quote: string | undefined): boolean {
  const tokens = squash(value).match(/[£€$]\s?\d[\d.]*|\d[\d.]*\s?%/g);
  return !!quote && !!tokens?.length && tokens.every((t) => squash(quote).replace(/\s/g, "").includes(t.replace(/\s/g, "")));
}

/** A date field counts only when its quote has the day number and the month (name or number). */
export function dateBacked(iso: string, quote: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return false;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const q = quote.toLowerCase();
  return new RegExp(`\\b0?${d}(st|nd|rd|th)?\\b`).test(q) && (q.includes(months[m - 1]) || new RegExp(`\\b0?${m}\\b`).test(q));
}
