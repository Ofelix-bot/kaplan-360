"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { monthYear } from "@/lib/i18n/format";

/** The next 18 months as a grid in a popover that stays on screen (it flips and shifts at the edges). */
export function MonthPicker({
  today,
  value,
  onPick,
  labelledBy,
  tone = "light",
}: {
  today: Date;
  value: number;
  onPick: (t: number) => void;
  labelledBy: string;
  /** "brand" sits on dark bars. */
  tone?: "light" | "brand";
}) {
  const locale = useIntlLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const now = today.getFullYear() * 12 + today.getMonth();
  const months = Array.from({ length: 18 }, (_, i) => now + i);
  const years = [...new Set(months.map((m) => Math.floor(m / 12)))];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-labelledby={`${labelledBy} ${labelledBy}-value`}
        className={cn(
          "inline-flex h-9 min-w-44 items-center justify-between gap-3 rounded-full pr-3 pl-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          tone === "brand" ? "bg-white/10 ring-1 ring-white/20 hover:bg-white/15" : "border bg-background hover:bg-muted aria-expanded:bg-muted",
        )}
      >
        <span id={`${labelledBy}-value`}>{monthYear(locale, value, "long")}</span>
        <ChevronDownIcon aria-hidden className={cn("size-4", tone === "brand" ? "opacity-60" : "text-muted-foreground")} />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-[19rem] gap-3 p-3">
        {years.map((y) => (
          <div key={y} className="flex flex-col gap-1.5">
            <p className="px-1 text-xs font-semibold text-muted-foreground tabular-nums">{y}</p>
            <div className="grid grid-cols-4 gap-1" role="group" aria-label={String(y)}>
              {months
                .filter((m) => Math.floor(m / 12) === y)
                .map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={m === value}
                    onClick={() => {
                      onPick(m);
                      setOpen(false);
                    }}
                    className={cn(
                      "h-8 rounded-md text-[0.8rem] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      m === value ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {new Date(y, m % 12, 1).toLocaleDateString(locale, { month: "short" })}
                  </button>
                ))}
            </div>
          </div>
        ))}
        <p className="px-1 text-xs text-muted-foreground">{t("Kept with your Start planning answers, in this browser only.")}</p>
      </PopoverContent>
    </Popover>
  );
}

