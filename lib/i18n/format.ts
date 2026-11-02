import type { T } from "./translate";

// Dates and lengths in the page's language. Month numbers are 0-based; "t" values are year * 12 + month.

export function monthYear(locale: string, t: number, month: "short" | "long" = "short"): string {
  return new Date(Date.UTC(Math.floor(t / 12), t % 12, 1)).toLocaleDateString(locale, { month, year: "numeric", timeZone: "UTC" });
}

export function monthName(locale: string, m: number, month: "short" | "long" = "short"): string {
  return new Date(Date.UTC(2026, m, 1)).toLocaleDateString(locale, { month, timeZone: "UTC" });
}

/** "1 year 3 months". */
export function duration(t: T, months: number): string {
  const y = Math.floor(months / 12);
  const r = months % 12;
  const parts = [y && t(y === 1 ? "{n} year" : "{n} years", { n: y }), r && t(r === 1 ? "{n} month" : "{n} months", { n: r })].filter(Boolean);
  return parts.join(" ") || t("{n} months", { n: 0 });
}
