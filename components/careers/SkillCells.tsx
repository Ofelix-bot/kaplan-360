"use client";

import { useState } from "react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DRAFT } from "@/content/draft";
import type { SkillCell, SkillCellState } from "@/lib/careers/cells";

// The 8-cell key-skill bar (plan E, Q20, Q21): one cell per key skill, in key-skill order, each in the look of
// its state (lib/careers/cells). Every cell is a button named "<skill>: <state>"; resting on it, focusing it
// and pressing it, or a tap on a phone, shows the skill's name in a popover (the receipt footnotes' pattern).
// The state never rests on colour alone: "none" is hatched and outlined, and the legend names each look.
// A new state (the master's rows) is one entry in CELL_LOOK plus its label.

const C = DRAFT.careers.skillCells;

const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--focus-ring)";

/** Each state's fill (theme-following tokens) and its label, also the legend's. */
export const CELL_LOOK: Record<SkillCellState, { fill: string; label: string }> = {
  have: { fill: "bg-(--brand-ink)", label: C.have },
  add: { fill: "bg-(--mix-other)", label: C.add },
  none: { fill: "cr-cell-none", label: C.none },
  // The role page's master's rows (RoleMasters): ◆ a master's adds, ★ it adds an edge skill (amber), □ still missing.
  master: { fill: "bg-(--brand-ink)/45 shadow-[inset_0_0_0_1.5px_var(--brand-ink)]", label: DRAFT.careers.masters.cellMaster },
  edge: { fill: "bg-(--accent) shadow-[inset_0_0_0_1.5px_var(--accent-ink)]", label: DRAFT.careers.masters.cellEdge },
  missing: { fill: "bg-transparent shadow-[inset_0_0_0_1.5px_var(--land-line)]", label: DRAFT.careers.masters.cellMissing },
};

/** One cell's look on its own: the legend's key and the entry page's illustration. */
export function CellSwatch({ state, className }: { state: SkillCellState; className?: string }) {
  return <span aria-hidden className={cn("block h-3 rounded-full motion-safe:transition-colors motion-safe:duration-300", CELL_LOOK[state].fill, className)} />;
}

function Cell({ cell }: { cell: SkillCell }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const label = t(CELL_LOOK[cell.state].label);
  return (
    <li className="flex min-w-0 flex-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          openOnHover
          delay={150}
          closeDelay={100}
          aria-label={t(C.cell, { skill: cell.skill, state: label })}
          data-state={cell.state}
          className={cn("flex h-7 w-full min-w-0 cursor-pointer items-center rounded-md border-0 bg-transparent p-0", FOCUS)}
        >
          <CellSwatch state={cell.state} className="w-full" />
        </PopoverTrigger>
        <PopoverContent side="top" sideOffset={6} className="w-auto max-w-64 gap-0.5 rounded-lg bg-(--land-card) px-3 py-2 text-(--text) ring-(--land-line)">
          <span lang="en" className="text-[14px] leading-snug font-semibold">
            {cell.skill}
          </span>
          <span className="text-[13px] leading-snug text-(--land-body)">{label}</span>
        </PopoverContent>
      </Popover>
    </li>
  );
}

/** The states present, in CELL_LOOK's order, as swatch + short label. */
export function SkillCellLegend({ states, className }: { states: readonly SkillCellState[]; className?: string }) {
  const t = useT();
  const shown = (Object.keys(CELL_LOOK) as SkillCellState[]).filter((s) => states.includes(s));
  return (
    <p className={cn("m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-(--land-body)", className)}>
      {shown.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <CellSwatch state={s} className="w-4" />
          {t(CELL_LOOK[s].label)}
        </span>
      ))}
    </p>
  );
}

/** The bar: the cells in the order given, then (unless `legend` is false) the legend of the states shown. */
export function SkillCells({ cells, label, legend = true, className }: { cells: readonly SkillCell[]; label: string; legend?: boolean; className?: string }) {
  if (!cells.length) return null;
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {/* Up to 12 cells share the row; more (SWDA lists up to 74 skills for a role) wrap as fixed-size cells. */}
      <ul aria-label={label} className={cn("m-0 flex w-full list-none items-center gap-1 p-0", cells.length > 12 ? "max-w-2xl flex-wrap [&>li]:w-5 [&>li]:flex-none" : "max-w-md")}>
        {cells.map((c, i) => (
          <Cell key={`${i}-${c.skill}`} cell={c} />
        ))}
      </ul>
      {legend && <SkillCellLegend states={cells.map((c) => c.state)} />}
    </div>
  );
}
