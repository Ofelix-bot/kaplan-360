"use client";

import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { DRAFT } from "@/content/draft";
import type { MatchBand, MatchResult } from "@/lib/careers/types";

// The match as a picture and as words (Q11, Q20). MatchMeter: m cells, n of them filled in the band's colour,
// decorative (aria-hidden): the words come from MatchBandText ("High match, 6 of 17 skills"), never from
// colour alone and never as a probability. No state: it renders on the server too. A cell fills with
// transform only (scaleX), so ticking a chip animates the change; reduced motion shows the final state.

const C = DRAFT.careers.match;

/** The band's ink: theme-following tokens, so both themes keep their contrast. */
export const BAND_INK: Record<MatchBand, string> = {
  high: "bg-(--brand-ink)",
  medium: "bg-(--accent-ink)",
  low: "bg-(--land-body)",
};
export const BAND_TEXT: Record<MatchBand, string> = {
  high: "text-(--brand-ink)",
  medium: "text-(--accent-ink)",
  low: "text-(--land-body)",
};

/** Above this many skills the meter is one bar filled to n/m (SWDA lists up to 74 for a role), not a cell each. */
const MAX_CELLS = 12;

export function MatchMeter({ n, m, band, className, barClassName }: { n: number; m: number; band: MatchBand | null; className?: string; barClassName?: string }) {
  const cells = Math.max(0, m);
  const filled = Math.min(Math.max(0, n), cells);
  if (cells > MAX_CELLS)
    return (
      <span aria-hidden className={cn("relative block h-2 w-full max-w-60 overflow-hidden rounded-full bg-(--land-line)", barClassName)}>
        <span
          style={{ transform: `scaleX(${cells ? filled / cells : 0})` }}
          className={cn(
            "absolute inset-0 origin-left rounded-full motion-safe:transition-transform motion-safe:duration-(--motion-ui-dur) motion-safe:ease-(--motion-ui)",
            band ? BAND_INK[band] : "bg-(--land-body)",
          )}
        />
      </span>
    );
  return (
    <span aria-hidden className={cn("flex w-full max-w-60 items-center gap-1", className)}>
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-(--land-line)">
          <span
            style={{ transitionDelay: `${i * 40}ms` }}
            className={cn(
              "absolute inset-0 origin-left rounded-full motion-safe:transition-transform motion-safe:duration-(--motion-ui-dur) motion-safe:ease-(--motion-ui)",
              band ? BAND_INK[band] : "bg-(--land-body)",
              i < filled ? "scale-x-100" : "scale-x-0",
            )}
          />
        </span>
      ))}
    </span>
  );
}

/** "High match, 6 of 17 skills", or "Pick a degree to see a match" with no degree. */
export function MatchBandText({ result, className }: { result: MatchResult | null; className?: string }) {
  const t = useT();
  if (!result) return <span className={cn("text-(--land-body)", className)}>{t(DRAFT.careers.entry.empty)}</span>;
  return (
    <span className={cn("text-(--land-body)", className)}>
      {t.rich(C.full, {}, { band: <span className={cn("font-semibold", BAND_TEXT[result.band])}>{t(C[result.band])}</span>, n: result.n, m: result.m })}
    </span>
  );
}

/** The same words as one string, for an accessible name. */
export function useMatchWords() {
  const t = useT();
  return (result: MatchResult | null) => (result ? t(C.full, { band: t(C[result.band]), n: result.n, m: result.m }) : t(DRAFT.careers.entry.empty));
}
