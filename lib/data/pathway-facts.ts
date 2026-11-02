// The partner universities' intake months and degree lengths from Kaplan's Degree Enrolment Day deck
// (March 2026), keyed by universityKey(): used by /pathway and /plan to estimate when a degree
// starts and ends.

import deck from "@/data/raw/kaplan-degree-enrolment-day-2026-03.json";
import { universityKey, type UniversityFacts } from "@/lib/pathway";

/** Months (1–12) named in the deck's 2026 intake dates ("2026-04-28", "2026-09 (mid)"). */
const monthsOf = (dates: string[]) => [...new Set(dates.map((d) => Number(d.slice(5, 7))).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);

// The partner universities' facts from Kaplan's Degree Enrolment Day deck (March 2026), with pages.
export const FACTS: Record<string, UniversityFacts> = Object.fromEntries(
  deck.universities.map((u) => {
    const raw = u as unknown as {
      intake?: { date: string; page?: number };
      intakes?: { date: string }[] | { dates: string[]; page?: number };
      duration?: { months: number | number[]; page: number };
    };
    const dates = raw.intake ? [raw.intake.date] : Array.isArray(raw.intakes) ? raw.intakes.map((i) => i.date) : raw.intakes ? raw.intakes.dates : [];
    const months = raw.duration ? [raw.duration.months].flat() : null;
    return [
      universityKey(u.university),
      { intakeMonths: monthsOf(dates), lengthMonths: months ? [Math.min(...months), Math.max(...months)] : null, page: raw.duration?.page ?? null },
    ];
  }),
);
