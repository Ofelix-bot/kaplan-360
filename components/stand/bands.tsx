"use client";

import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { msg } from "@/lib/i18n/translate";
import { BAND_LABEL } from "@/lib/stand/score";
import type { Outcome } from "@/lib/stand/types";

// The six outcomes as the page words and colours them. A band is always named in words beside its
// colour; the colours are the site's status tokens, each at AA or better on the page's grounds in both
// themes (scripts/check-stand-page.ts computes them).

export const OUTCOME_LABEL: Record<Outcome, string> = { ...BAND_LABEL, missing: msg("Missing"), "not-eligible": msg("Not eligible") };

/** Text colour per outcome. */
export const OUTCOME_TEXT: Record<Outcome, string> = {
  safe: "text-success",
  match: "text-(--brand-ink)",
  reach: "text-(--accent-ink)",
  far: "text-destructive",
  missing: "text-muted-foreground",
  "not-eligible": "text-muted-foreground",
};

/** The bands with a score, best first. */
export const BANDS = ["safe", "match", "reach", "far"] as const;

export const n = (v: number) => v.toLocaleString("en-SG");

/** A band (or "Missing", "Not eligible") as a small outlined word in its colour. */
export function BandWord({ outcome, className }: { outcome: Outcome; className?: string }) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full border border-current px-2 text-xs font-semibold whitespace-nowrap",
        outcome === "missing" && "border-dashed",
        OUTCOME_TEXT[outcome],
        className,
      )}
    >
      {t(OUTCOME_LABEL[outcome])}
    </span>
  );
}

/** A visible focus ring at full contrast (the shadcn default is half-transparent). */
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
