import type { T } from "@/lib/i18n/translate";

// The tuition budget choices on /results (and in its what-if suggestions).

export const BUDGETS: { value: number | null; label: string; short: string }[] = [
  { value: 30000, label: "Up to S$30,000 a year", short: "S$30k" },
  { value: 45000, label: "Up to S$45,000 a year", short: "S$45k" },
  { value: 60000, label: "Up to S$60,000 a year", short: "S$60k" },
  { value: null, label: "No limit", short: "No limit" },
];

type Budget = (typeof BUDGETS)[number] & { own?: boolean };

/** The budget choices, with the student's own amount among them when it isn't one (read from their sentence). */
export function budgetChoices(current: number | null): Budget[] {
  if (current === null || BUDGETS.some((b) => b.value === current)) return BUDGETS;
  const own: Budget = { value: current, label: "", short: `S$${Math.round(current / 1000)}k`, own: true };
  return [...BUDGETS.filter((b) => b.value !== null && b.value < current), own, ...BUDGETS.filter((b) => b.value === null || b.value > current)];
}

/** A budget choice's full label in the page's language. */
export const budgetLabel = (t: T, b: Budget) => (b.own ? t("Up to {amount} a year", { amount: `S$${b.value!.toLocaleString("en-SG")}` }) : t(b.label));
