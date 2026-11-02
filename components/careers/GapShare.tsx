"use client";

import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Fn } from "@/components/shared/receipt";
import { DRAFT } from "@/content/draft";
import { shareWords } from "@/lib/careers/cells";
import { RULE_IDS } from "@/lib/careers/match";
import { CellSwatch, SkillCellLegend } from "./SkillCells";

// The entry page's headline over every role's key skills (plan E, Q21): "About a third of these key skills: no
// Kaplan degree's core modules cover them", the words read from the computed share (lib/careers/cells
// uncoveredShare), footnoted to Kaplan 360++'s count (RULE_IDS.uncovered, which the caller lists in its
// ReceiptSection), beside 8 cells of which the share's part is hatched. The cells are a picture of the share,
// not of any one role, so they are decorative; the sentence carries the figure.

const C = DRAFT.careers;
const CELLS = 8;

export function GapShare({ share, className }: { share: number; className?: string }) {
  const t = useT();
  const none = Math.min(CELLS, Math.max(0, Math.round(share * CELLS)));
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 rounded-2xl border border-(--land-line) bg-(--land-card) p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6", className)}>
      <span aria-hidden className="flex w-full max-w-56 shrink-0 items-center gap-1">
        {Array.from({ length: CELLS }, (_, i) => (
          <CellSwatch key={i} state={i < CELLS - none ? "add" : "none"} className="h-4 min-w-0 flex-1" />
        ))}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="m-0 text-[17px] leading-snug font-semibold text-pretty text-(--text) sm:text-[19px]">
          {t(C.gapShare.headline, { share: t(shareWords(share)) })}
          <Fn id={RULE_IDS.uncovered} />
        </p>
        <SkillCellLegend states={["add", "none"]} />
      </div>
    </div>
  );
}
