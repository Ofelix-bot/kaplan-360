"use client";

import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "cn";
import { CircleAlertIcon, CircleCheckIcon, CircleHelpIcon, GripVerticalIcon, TriangleAlertIcon } from "lucide-react";
import { motion } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { campusLabel, type Row } from "@/components/results/facets";
import { useLocalName } from "@/components/results/names";
import { GPA_MIN, rangeBasis, usualText } from "@/components/results/words";
import { Badge } from "@/components/ui/badge";
import { LEVELS, levelOf, RANK_LEVEL, type Level } from "@/lib/admit-range";
import { rankOfLevel, type Converted } from "@/lib/grades";
import { transitions } from "@/lib/motion";
import { GpaBand } from "./admitted-figures";
import { ShortlistToggle } from "./shortlist-toggle";

// One programme in the results list: dragged by its handle onto the shortlist, or opened in the
// detail panel. A small strip shows where most admitted students are and, in amber, the student's
// own result: data, not a sentence about their chances.

/** Where most admitted students are, on the UK class scale, with the student's own level(s) marked. */
function RangeStrip({ row, you }: { row: Row; you: Converted | null }) {
  const t = useT();
  const r = row.p.range;
  const mine = you ? (you.mark !== null ? [levelOf(you.mark)] : LEVELS.filter((l) => rankOfLevel(l) === you.rank && l >= RANK_LEVEL[you.rank])) : [];
  const tone = (l: Level) => (r.floor !== null && l < r.floor ? "bg-muted" : l >= r.usual ? "bg-primary" : "bg-primary/30");
  return (
    <span className="flex items-center gap-2" title={t("Admitted range · {basis}", { basis: rangeBasis(t, r) })}>
      <span className="flex w-24 shrink-0 gap-0.5" aria-hidden>
        {LEVELS.map((l) => (
          <span key={l} className={cn("h-1.5 flex-1 rounded-full", tone(l), mine.includes(l) && "outline-2 outline-offset-1 outline-amber")} />
        ))}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        <span className="sr-only">{t("Admitted range · {basis}", { basis: rangeBasis(t, r) })}: </span>
        {usualText(t, r.usual)}
      </span>
    </span>
  );
}

function CheckCounts({ row }: { row: Row }) {
  const t = useT();
  const n = { meets: 0, below: 0, unknown: 0 };
  for (const c of row.c) if (c.state !== "info") n[c.state]++;
  if (!n.meets && !n.below && !n.unknown) return null;
  return (
    <span className="inline-flex items-center gap-2 text-xs tabular-nums">
      {n.meets > 0 && (
        <span className="inline-flex items-center gap-0.5 text-(--rs-safe)" title={t("meets the published minimum")}>
          <CircleCheckIcon className="size-3" aria-hidden />
          {n.meets}
          <span className="sr-only">{t(": meets the published minimum")}</span>
        </span>
      )}
      {n.below > 0 && (
        <span className="inline-flex items-center gap-0.5 text-destructive" title={t("below the published minimum")}>
          <CircleAlertIcon className="size-3" aria-hidden />
          {n.below}
          <span className="sr-only">{t(": below the published minimum")}</span>
        </span>
      )}
      {n.unknown > 0 && (
        <span className="inline-flex items-center gap-0.5 text-muted-foreground" title={t("check the official wording")}>
          <CircleHelpIcon className="size-3" aria-hidden />
          {n.unknown}
          <span className="sr-only">{t(": check the official wording")}</span>
        </span>
      )}
    </span>
  );
}

function facts(row: Row, t: ReturnType<typeof useT>) {
  const { p } = row;
  return [
    p.feeSgd !== null ? t("≈ S${n}k a year", { n: Math.round(p.feeSgd / 1000) }) : p.fee ? null : t("Fee not stated"),
    p.months ? t("{n} months", { n: p.months }) : null,
    p.ielts !== null ? `IELTS ${p.ielts}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

type Props = {
  row: Row;
  selected: boolean;
  onSelect: (id: string) => void;
  /** Leave out the university line: the row sits under its university. */
  inUniversity?: boolean;
  you: Converted | null;
  youGpa: { low: number; high: number } | null;
};

export const ProgrammeRow = memo(function ProgrammeRow({ row, selected, onSelect, inUniversity, you, youGpa }: Props) {
  const t = useT();
  const local = useLocalName();
  const { p, u } = row;
  const title = local(p.name, p.zh);
  const campus = campusLabel(p, t);
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `result:${p.id}`, data: { programmeId: p.id } });
  const cases = p.cases;
  const variance = !!cases?.flags.some((f) => f !== "few");

  return (
    <motion.li
      ref={setNodeRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: isDragging ? 0.4 : 1 }}
      exit={{ opacity: 0, transition: transitions.exit }}
      transition={transitions.enter}
      className={cn("group/row grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-1.5 rounded-lg py-2 pr-1.5 pl-1 transition-colors", selected ? "bg-accent shadow-[inset_2px_0_0_var(--rs-accent)] ring-1 ring-primary/40" : "hover:bg-muted")}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("Drag {name} to the shortlist", { name: title.name })}
        className="mt-0.5 flex size-6 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onSelect(p.id)}
        aria-current={selected || undefined}
        className="flex min-w-0 flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {!inUniversity && (
          <span className="truncate text-xs text-muted-foreground">
            {local(u.name, u.zh).name}
            {u.qs && ` · QS ${u.qs}`} · {t(u.country)}
          </span>
        )}
        <span className="leading-snug font-medium">
          {title.name}
          {title.en && <span className="block text-xs font-normal text-muted-foreground">{title.en}</span>}
        </span>
        {cases?.gpa && cases.gpa.n >= GPA_MIN ? (
          <span className="flex items-center gap-2">
            <span className="w-24 shrink-0">
              <GpaBand spread={cases.gpa} you={youGpa} />
            </span>
            <span className="truncate text-xs text-muted-foreground tabular-nums">{t("GPA {median} median · {n} reported admits", { median: cases.gpa.median.toFixed(2), n: cases.n })}</span>
          </span>
        ) : (
          <RangeStrip row={row} you={you} />
        )}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="tabular-nums">{facts(row, t)}</span>
          <CheckCounts row={row} />
          {u.partner && !inUniversity && <Badge className="h-4 px-1.5 text-[10px]">{t("Kaplan partner")}</Badge>}
          {campus && <Badge variant="secondary" className={cn("h-4 px-1.5 text-[10px]", p.kaplan && "bg-amber text-amber-text")}>{campus}</Badge>}
          {p.any && <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{t("Open to any subject")}</Badge>}
          {p.mode === "part-time" && <Badge variant="outline" className="h-4 border-destructive/50 px-1.5 text-[10px] text-destructive">{t("Part-time only")}</Badge>}
          {variance && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              <TriangleAlertIcon className="size-2.5!" />
              {t("Wide spread")}
            </Badge>
          )}
        </span>
      </button>
      <ShortlistToggle id={p.id} name={title.name} />
    </motion.li>
  );
});
