"use client";

import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { msg } from "@/lib/i18n/translate";
import type { Match, MatchBand } from "@/lib/admit-model";

// "Where you are": the match rate (lib/admit-model.ts) in its band's colour, with the band's name under it and what it
// means on hover. Red under 30%, amber 30–60%, green above 60%.

const BAND: Record<MatchBand, { label: string; hint: string; color: string }> = {
  gap: { label: msg("Gap to close"), hint: msg("There are hard requirements to make up before this programme is within range."), color: "text-(--fd-match-gap)" },
  range: { label: msg("In range"), hint: msg("You are within the application range; adding to your profile can make you more competitive."), color: "text-(--fd-match-range)" },
  strong: { label: msg("Strong position"), hint: msg("Keep doing what you are doing; success is within reach."), color: "text-(--fd-match-strong)" },
};

export function MatchRate({ match }: { match: Match | null }) {
  const t = useT();
  if (!match) {
    return (
      <span className="flex h-6 items-center text-sm text-muted-foreground" title={t("Add your result to see the match rate")}>
        {t("Add your result")}
      </span>
    );
  }
  const b = BAND[match.band];
  const value = match.rate < 0.01 ? "<1%" : `${Math.round(match.rate * 100)}%`;
  return (
    <span title={t(b.hint)} className={cn("flex flex-col leading-tight", b.color)}>
      <span className="text-[22px] font-bold tabular-nums">{value}</span>
      <span className="text-xs font-semibold">{t(b.label)}</span>
      <span className="sr-only">{t(b.hint)}</span>
    </span>
  );
}
