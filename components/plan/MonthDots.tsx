"use client";

import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { monthName } from "@/lib/i18n/format";

// Twelve months as a strip of cells, the ones in `mask` (bit 0 = January) filled. Chinese pages
// number the cells (1–12); English uses initials.

export default function MonthDots({ mask, label }: { mask: number; label?: string }) {
  const t = useT();
  const locale = useIntlLocale();
  const months = Array.from({ length: 12 }, (_, i) => monthName(locale, i, "long"));
  const on = months.filter((_, i) => mask & (1 << i));
  const cell = (m: string, i: number) => (locale.startsWith("en") ? m[0] : String(i + 1));
  return (
    <span className="mdots" role="img" aria-label={label ?? (on.length ? t("Starts in {months}", { months: on.join(", ") }) : t("No start month stated"))}>
      {months.map((m, i) => (
        <span key={m} className={mask & (1 << i) ? "on" : undefined} aria-hidden="true">
          {cell(m, i)}
        </span>
      ))}
    </span>
  );
}
