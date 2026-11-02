"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type Announcements, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRightIcon, GripVerticalIcon, RotateCcwIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { toast } from "@/components/ui/toast";
import { DEFAULT_PRIORITIES, PRIORITIES, type PriorityId, type Residency } from "@/lib/home/content";
import { useHome } from "@/lib/home/store";
import { sortableTransition } from "@/lib/motion";
import { useMediaQuery } from "@/lib/use-media-query";
import { ReceiptChip } from "../receipts";
import { SectionHead } from "./section-head";

// 04 Your moves: a small workspace. On the left, what matters to the student, in their order (drag
// by the handle, or focus it and use Space and the arrow keys); on the right, the first three moves
// that order gives, each with its rule's receipt. The divider between the two can be dragged.

export function Moves({ residency }: { residency: Residency }) {
  const t = useT();
  const wide = useMediaQuery("(min-width: 1024px)", true);
  return (
    <section id="moves" aria-labelledby="moves-title" className="border-b bg-muted/60">
      <div className="home-wrap flex flex-col gap-10 py-16 lg:py-24">
        <SectionHead
          id="moves-title"
          index="04"
          eyebrow={t("Your moves")}
          title={t("What do you actually need? Put it in order.")}
          lede={t("Drag what matters most to the top. Your first three moves change with it, each with the rule it comes from.")}
        />
        {wide ? (
          <ResizablePanelGroup id="home-moves" orientation="horizontal" className="h-auto items-stretch overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
            <ResizablePanel id="priorities" defaultSize="40" minSize={300} maxSize="55">
              <Priorities residency={residency} />
            </ResizablePanel>
            <ResizableHandle withHandle className="bg-border" />
            <ResizablePanel id="first-moves" defaultSize="60" minSize={380}>
              <FirstMoves residency={residency} />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
            <Priorities residency={residency} />
            <div className="border-t" />
            <FirstMoves residency={residency} />
          </div>
        )}
      </div>
    </section>
  );
}

function Priorities({ residency }: { residency: Residency }) {
  const t = useT();
  const priorities = useHome((s) => s.priorities);
  const setPriorities = useHome((s) => s.setPriorities);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const label = (id: string | number) => t(PRIORITIES[id as PriorityId].label[residency]);
  const at = (id: string | number) => priorities.indexOf(id as PriorityId) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t("Picked up {item}, number {n} of {total}.", { item: label(active.id), n: at(active.id), total: priorities.length }),
    onDragOver: ({ active, over }) => (over ? t("{item} is over number {n}.", { item: label(active.id), n: at(over.id) }) : t("{item} is not over the list.", { item: label(active.id) })),
    onDragEnd: ({ active, over }) => (over ? t("{item} dropped at number {n}.", { item: label(active.id), n: at(over.id) }) : t("{item} dropped.", { item: label(active.id) })),
    onDragCancel: ({ active }) => t("Moving {item} was cancelled.", { item: label(active.id) }),
  };
  const changed = priorities.some((p, i) => p !== DEFAULT_PRIORITIES[i]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = priorities.indexOf(active.id as PriorityId);
    const to = priorities.indexOf(over.id as PriorityId);
    const next = arrayMove(priorities, from, to);
    setPriorities(next);
    if (to < 3 || from < 3)
      toast.add({ title: t("Your first move is now: {move}", { move: t(PRIORITIES[next[0]].move[residency].title) }), description: t("{item} moved to number {n}.", { item: label(active.id), n: to + 1 }) });
  };

  return (
    <div className="flex h-full flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-base font-semibold">{t("What matters to me")}</h3>
        <p className="text-sm text-muted-foreground">{t("Most important first. Use the handle, or focus it and press Space, then the arrow keys.")}</p>
      </div>
      <DndContext
        // A fixed id keeps dnd-kit's own ids the same on the server and in the browser.
        id="home-priorities"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{ announcements, screenReaderInstructions: { draggable: t("To move an item, press Space. Use the arrow keys to move it, Space to drop it, or Escape to cancel.") } }}
      >
        <SortableContext items={priorities} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-1.5">
            {priorities.map((id, i) => (
              <Item key={id} id={id} rank={i + 1} residency={residency} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {changed && (
        <button
          type="button"
          onClick={() => {
            setPriorities(DEFAULT_PRIORITIES);
            toast.add({ title: t("Order reset") });
          }}
          className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcwIcon aria-hidden className="size-3.5" />
          {t("Reset the order")}
        </button>
      )}
    </div>
  );
}

function Item({ id, rank, residency }: { id: PriorityId; rank: number; residency: Residency }) {
  const t = useT();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, transition: sortableTransition });
  const p = PRIORITIES[id];
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-2.5 py-2 text-sm transition-shadow",
        rank <= 3 ? "border-primary/30" : "border-border",
        isDragging && "relative z-10 shadow-lg ring-2 ring-ring/40",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={t("Move {item}, now number {n}", { item: t(p.label[residency]), n: rank })}
        {...attributes}
        {...listeners}
        className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVerticalIcon aria-hidden className="size-4" />
      </button>
      <span className={cn("w-4 shrink-0 font-heading text-xs font-bold tabular-nums", rank <= 3 ? "text-primary" : "text-muted-foreground")}>{rank}</span>
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{t(p.label[residency])}</span>
        <span className="truncate text-xs text-muted-foreground">{t(p.hint[residency])}</span>
      </span>
    </li>
  );
}

function FirstMoves({ residency }: { residency: Residency }) {
  const t = useT();
  const reduce = useReducedMotion();
  const top = useHome((s) => s.priorities).slice(0, 3);
  return (
    <div className="flex h-full flex-col gap-3 p-5 sm:p-6">
      <h3 className="text-[0.72rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{t("Your first three moves")}</h3>
      <ol className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {top.map((id, i) => {
            const move = PRIORITIES[id].move[residency];
            return (
              <motion.li
                key={`${id}-${residency}`}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                className="flex items-start gap-4 rounded-xl border bg-background p-4"
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg font-heading text-sm font-bold", i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="text-xs text-muted-foreground">{t("For: {item}", { item: t(PRIORITIES[id].label[residency]) })}</p>
                  <h4 className="font-heading text-base leading-snug font-semibold tracking-tight text-balance">{t(move.title)}</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{t(move.body)}</p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <ReceiptChip ids={move.receipts} title={t(move.title)} />
                    <Link href={move.cta.href} className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
                      {t(move.cta.label)}
                      <ArrowUpRightIcon aria-hidden className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </div>
  );
}
