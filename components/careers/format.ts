// Display helpers for career and programme figures. A missing value is shown as such, never guessed.

const SYMBOL: Record<string, string> = { GBP: "£", EUR: "€", AUD: "A$", SGD: "S$", NZD: "NZ$", HKD: "HK$", USD: "US$", CAD: "C$" };

export const sgd = (v: number) => `S$${Math.round(v).toLocaleString("en-SG")}`;

export function money(amount: number | null, currency: string | null): string | null {
  if (amount === null || !currency) return null;
  return `${SYMBOL[currency] ?? `${currency} `}${Math.round(amount).toLocaleString("en-SG")}`;
}

/** "£25,500 per year", or null when the page gave no international fee. */
export function tuitionText(p: { tuition_amount: number | null; tuition_currency: string | null; tuition_basis: string | null; tuition_international: boolean }): string | null {
  if (!p.tuition_international) return null;
  const m = money(p.tuition_amount, p.tuition_currency);
  if (!m) return null;
  return p.tuition_basis ? `${m} ${p.tuition_basis}` : m;
}

export function qsText(rank: string | null): string | null {
  return rank ? `QS ${rank}` : null;
}
