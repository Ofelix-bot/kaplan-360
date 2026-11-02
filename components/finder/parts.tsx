"use client";

import { useId, type ReactNode } from "react";
import { CheckIcon, InfoIcon, MinusIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Toggle } from "@/components/ui/toggle";

// Small pieces the finder's three pages share: the page head, a chip, a numbered step on the rail, and the
// requirement pill (met, gap, not required, not filled in).

export function PageHead({ eyebrow, title, lede, wide }: { eyebrow?: string; title: string; lede?: ReactNode; wide?: boolean }) {
  return (
    <header className={cn("flex flex-col gap-2", wide ? "" : "")}>
      {eyebrow && <p className="text-sm font-semibold text-muted-foreground">{eyebrow}</p>}
      <h1 className="text-[28px] leading-tight font-bold tracking-tight sm:text-[32px]">{title}</h1>
      {lede && <p className="text-[15px] text-muted-foreground">{lede}</p>}
    </header>
  );
}

/** A choice chip: a pressed one is filled with the ink colour and carries a check. */
export function Chip({ pressed, onPressedChange, children, disabled, className }: { pressed: boolean; onPressedChange: (on: boolean) => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <Toggle
      variant="outline"
      pressed={pressed}
      onPressedChange={onPressedChange}
      disabled={disabled}
      className={cn(
        "h-11 gap-1.5 rounded-full border-border bg-card px-4 text-[15px] font-medium text-foreground hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:font-semibold aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90",
        className,
      )}
    >
      {pressed && <CheckIcon aria-hidden className="size-4" strokeWidth={2.5} />}
      {children}
    </Toggle>
  );
}

/** One numbered question on the rail. `done` fills the number and the rail below it. */
export function Step({ n, title, hint, optional, done, last, children }: { n: number; title: string; hint?: string; optional?: boolean; done: boolean; last?: boolean; children: ReactNode }) {
  const t = useT();
  const id = useId();
  return (
    <section aria-labelledby={id} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-5">
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums",
            optional && !done ? "border border-border bg-card text-muted-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {n}
        </span>
        {!last && <span aria-hidden className={cn("mt-1 w-0.5 flex-1", done && !optional ? "bg-primary" : "bg-border")} />}
      </div>
      <div className={cn("flex min-w-0 flex-col gap-3", last ? "" : "pb-10")}>
        <div className="flex flex-col gap-1">
          <h2 id={id} className="flex items-center gap-2 text-[17px] leading-7 font-bold">
            {title}
            {optional && <span className="rounded-full border border-border px-2 py-px text-xs font-medium text-muted-foreground">{t("Optional")}</span>}
          </h2>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export type PillState = "met" | "gap" | "none" | "unset" | "unknown";

const PILL: Record<PillState, { icon: LucideIcon | null; className: string }> = {
  met: { icon: CheckIcon, className: "bg-(--fd-met-bg) text-(--fd-met)" },
  gap: { icon: null, className: "bg-(--fd-gap-bg) text-(--fd-gap)" },
  none: { icon: MinusIcon, className: "bg-(--fd-none-bg) text-muted-foreground" },
  unset: { icon: null, className: "border border-dashed border-border text-muted-foreground" },
  unknown: { icon: InfoIcon, className: "bg-(--fd-none-bg) text-muted-foreground" },
};

/** A requirement's state as a pill: ✓ met, ! a gap, – not required, not filled in, not stated. */
export function Pill({ state, children, title }: { state: PillState; children: ReactNode; title?: string }) {
  const { icon: Icon, className } = PILL[state];
  return (
    <span title={title} className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap", className)}>
      {state === "gap" ? (
        <span aria-hidden className="font-bold">
          !
        </span>
      ) : (
        Icon && <Icon aria-hidden className="size-3" strokeWidth={2.5} />
      )}
      {children}
    </span>
  );
}
