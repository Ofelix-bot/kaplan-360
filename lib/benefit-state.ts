import type { BenefitRow } from "@/lib/data/benefits";

// Whether a benefit is open, worked out in the browser against the visitor's date (the site never
// stores a "status"): past deadlines are closed; awards listed for an intake or academic year that
// has passed are "last cycle".

export type BenefitState = "open" | "no-date" | "last-cycle" | "closed";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function stateOf(b: Pick<BenefitRow, "deadline" | "event_date" | "intake">, today: string): BenefitState {
  const date = b.deadline ?? b.event_date;
  if (date) return date >= today ? "open" : "closed";
  const text = (b.intake ?? "").toLowerCase();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  // "September 2027", "January 2027": the latest intake named.
  const intakes = [...text.matchAll(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d\d)/g)].map(
    (m) => Number(m[2]) * 12 + MONTHS.indexOf(m[1]) + 1,
  );
  if (intakes.length) return Math.max(...intakes) >= year * 12 + month ? "no-date" : "last-cycle";
  // "2026/27", "2026/2027", "2026-27": current until the end of August of the second year.
  const ay = /(20\d\d)\s*[/-]\s*(?:20)?\d\d/.exec(text);
  if (ay) return year * 12 + month <= (Number(ay[1]) + 1) * 12 + 8 ? "no-date" : "last-cycle";
  const lone = /\b(20\d\d)\b/.exec(text);
  if (lone) return Number(lone[1]) >= year ? "no-date" : "last-cycle";
  return "no-date";
}

/** Today in the visitor's own time zone, as YYYY-MM-DD (toISOString would give the UTC date). */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
