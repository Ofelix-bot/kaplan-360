"use client";

import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { monthName } from "@/lib/i18n/format";

// Twelve months as a strip of cells, the ones in `mask` (bit 0 = January) filled. Chinese pages
// number the cells (1–12); English uses initials.

export function MonthDots({ mask }: { mask: number }) {
  const t = useT();
  const locale = useIntlLocale();
  const months = Array.from({ length: 12 }, (_, i) => monthName(locale, i, "long"));
  const on = months.filter((_, i) => mask & (1 << i));
  return (
    <span role="img" aria-label={on.length ? t("Starts in {months}", { months: on.join(", ") }) : t("No start month stated")} className="inline-flex gap-0.5">
      {months.map((m, i) => (
        <span
          key={m}
          aria-hidden
          className={cn("grid h-4 w-3.5 place-items-center rounded-[3px] text-[9px] leading-none font-medium tabular-nums", mask & (1 << i) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
        >
          {locale.startsWith("en") ? m[0] : i + 1}
        </span>
      ))}
    </span>
  );
}
