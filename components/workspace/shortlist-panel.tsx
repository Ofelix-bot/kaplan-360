"use client";

import { useDndContext, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { ArrowRightIcon, GripVerticalIcon, ListOrderedIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "@/components/i18n/Link";
import { useT } from "@/components/i18n/I18nProvider";
import { useLocalName } from "@/components/results/names";
import { usualText } from "@/components/results/words";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { sortableTransition, transitions } from "@/lib/motion";
import { CompareSheet } from "./compare-sheet";
import { useModel } from "./model";
import { shortId, SHORTLIST_ID } from "./workspace-dnd";

// The shortlist, ranked: rows drop in from the results (or come with +), and drag to reorder; the
// first is the student's first choice. "Make my plan" turns it into a timeline (/plan).

function ShortlistItem({ id, rank, onSelect }: { id: string; rank: number; onSelect: (id: string) => void }) {
  const t = useT();
  const local = useLocalName();
  const { byId, removeFromShortlist } = useModel();
  const { active, over } = useDndContext();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: shortId(id), transition: sortableTransition });
  const row = byId.get(id);
  if (!row) return null;
  const name = local(row.p.name, row.p.zh).name;
  // A result row dragged over this item will be put above it.
  const insertHere = !!active && String(active.id).startsWith("result:") && over?.id === shortId(id);

  return (
    <motion.li
      ref={setNodeRef}
      // dnd-kit owns the transform while sorting; Motion only fades items in and out.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isDragging ? 0.4 : 1 }}
      exit={{ opacity: 0, transition: transitions.exit }}
      transition={transitions.enter}
      className={cn("relative flex items-center gap-1.5 rounded-lg border bg-(--rs-raised) py-1.5 pr-1 pl-1.5", insertHere && "before:absolute before:inset-x-1 before:-top-1 before:h-0.5 before:rounded-full before:bg-primary")}
    >
      <span className="w-5 shrink-0 text-center font-heading text-xs font-semibold text-muted-foreground tabular-nums">{rank}</span>
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("Move {name}, number {n}", { name, n: rank })}
        className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <button type="button" onClick={() => onSelect(id)} className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="block truncate text-xs text-muted-foreground">
          {local(row.u.name, row.u.zh).name} · {t(row.u.country)}
        </span>
        <span className="block truncate text-sm font-medium">{name}</span>
      </button>
      <span className="hidden shrink-0 text-xs text-muted-foreground @[22rem]:inline">
        {row.p.cases?.gpa ? `GPA ${row.p.cases.gpa.median.toFixed(2)}` : usualText(t, row.p.range.usual)}
      </span>
      <Button variant="ghost" size="icon-xs" aria-label={t("Remove {name} from the shortlist", { name })} onClick={() => removeFromShortlist(id)}>
        <XIcon />
      </Button>
    </motion.li>
  );
}

export function ShortlistPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const t = useT();
  const { answers } = useModel();
  const shortlist = answers.shortlist;
  const { setNodeRef } = useDroppable({ id: SHORTLIST_ID });
  const { active, over } = useDndContext();
  const draggingResult = !!active && String(active.id).startsWith("result:");
  const overList = draggingResult && !!over && (over.id === SHORTLIST_ID || String(over.id).startsWith("short:"));

  return (
    <div className="@container flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <h2 className="font-heading text-sm font-semibold">{t("Shortlist")}</h2>
        <Badge variant="secondary" className="tabular-nums">
          {shortlist.length}
        </Badge>
        <span className="ml-auto flex items-center gap-1">
          <CompareSheet />
          <Button size="sm" disabled={!shortlist.length} render={shortlist.length ? <Link href="/plan" /> : undefined} nativeButton={!shortlist.length}>
            {t("Make my plan")}
            <ArrowRightIcon />
          </Button>
        </span>
      </div>
      <div ref={setNodeRef} className={cn("min-h-32 flex-1 overflow-y-auto p-2 transition-colors", draggingResult && "bg-muted/50", overList && "bg-accent ring-2 ring-primary/60 ring-inset")}>
        {shortlist.length === 0 ? (
          <Empty className="h-full border border-dashed border-(--rs-line)">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListOrderedIcon />
              </EmptyMedia>
              <EmptyTitle>{t("Rank your choices")}</EmptyTitle>
              <EmptyDescription>{t("Drag a programme here by its handle, or press + on its row. Drag to reorder: the first is your first choice.")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <SortableContext items={shortlist.map(shortId)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-1.5" aria-label={t("Shortlist, first choice first")}>
              <AnimatePresence initial={false} mode="popLayout">
                {shortlist.map((id, i) => (
                  <ShortlistItem key={id} id={id} rank={i + 1} onSelect={onSelect} />
                ))}
              </AnimatePresence>
            </ol>
          </SortableContext>
        )}
      </div>
    </div>
  );
}
