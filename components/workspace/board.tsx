"use client";

import { useMemo, useState } from "react";
import { closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type UniqueIdentifier } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { PanelRightOpenIcon, SquareKanbanIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { useLocalName } from "@/components/results/names";
import { usualText } from "@/components/results/words";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { monthName } from "@/lib/i18n/format";
import { dropAnimation, sortableTransition, transitions } from "@/lib/motion";
import { boardFor, STAGES, useWorkspace, type Stage } from "@/lib/workspace/store";
import { useModel } from "./model";
import { ProgrammeDetail } from "./programme-detail";

// The shortlist as an application board: each programme moves along, Researching → Preparing →
// Applied → Decision, as its application does. The stages stay in this browser, as the answers do.
// Ids: a card is "card:<programme>", a column "column:<stage>".

const cardId = (id: string) => `card:${id}`;
const columnId = (stage: Stage) => `column:${stage}`;
const programmeOf = (id: UniqueIdentifier) => String(id).replace(/^card:/, "");
/** On wide screens the four columns fill the window: dragging scrolls a column, not the page. Stacked, the page scrolls. */
const autoScroll = { canScroll: (el: Element) => el !== document.scrollingElement || window.innerWidth < 1280 };

function CardBody({ id, onOpen }: { id: string; onOpen?: (id: string) => void }) {
  const t = useT();
  const locale = useIntlLocale();
  const local = useLocalName();
  const { byId } = useModel();
  const row = byId.get(id);
  if (!row) return null;
  const { p, u } = row;
  const name = local(p.name, p.zh).name;
  const starts = p.intake
    ? Array.from({ length: 12 }, (_, i) => i)
        .filter((i) => p.intake & (1 << i))
        .map((i) => monthName(locale, i))
        .join(", ")
    : null;
  return (
    <>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">
            {local(u.name, u.zh).name} · {t(u.country)}
          </p>
          <p className="leading-snug font-medium">{name}</p>
        </div>
        {onOpen && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("Details of {name}", { name })}
            // Keep clicks and Enter on this button from starting a drag of the card.
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onClick={() => onOpen(id)}
          >
            <PanelRightOpenIcon />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {[p.cases?.gpa ? t("GPA {median} median", { median: p.cases.gpa.median.toFixed(2) }) : usualText(t, p.range.usual), p.feeSgd !== null && t("≈ S${n}k a year", { n: Math.round(p.feeSgd / 1000) })].filter(Boolean).join(" · ")}
      </p>
      {starts && <p className="text-xs text-muted-foreground">{t("Starts in {months}", { months: starts })}</p>}
    </>
  );
}

function BoardCard({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const t = useT();
  const local = useLocalName();
  const { byId } = useModel();
  const row = byId.get(id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cardId(id), transition: sortableTransition });
  return (
    <motion.li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isDragging ? 0.35 : 1 }}
      exit={{ opacity: 0, transition: transitions.exit }}
      transition={transitions.enter}
      {...attributes}
      {...listeners}
      aria-label={t("{name}. Press space to move it to another stage.", { name: row ? local(row.p.name, row.p.zh).name : "" })}
      className="flex cursor-grab touch-none flex-col gap-1 rounded-lg border border-(--rs-line) bg-(--rs-raised-2) p-2.5 text-sm transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
    >
      <CardBody id={id} onOpen={onOpen} />
    </motion.li>
  );
}

function Column({ stage, ids, onOpen }: { stage: (typeof STAGES)[number]; ids: string[]; onOpen: (id: string) => void }) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: columnId(stage.id) });
  return (
    <section aria-labelledby={`${stage.id}-title`} className="flex min-h-0 flex-col rounded-xl bg-(--rs-raised) ring-1 ring-(--rs-line)">
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <h2 id={`${stage.id}-title`} className="font-heading text-sm font-semibold">
          {t(stage.label)}
        </h2>
        <Badge variant="outline" className="tabular-nums">
          {ids.length}
        </Badge>
        <span className="ml-auto truncate text-xs text-muted-foreground">{t(stage.hint)}</span>
      </header>
      <SortableContext items={ids.map(cardId)} strategy={verticalListSortingStrategy}>
        <ol ref={setNodeRef} className={cn("flex min-h-28 flex-1 flex-col gap-2 overflow-y-auto rounded-b-xl p-2 transition-colors", isOver && "bg-accent ring-2 ring-primary/50 ring-inset")}>
          <AnimatePresence initial={false} mode="popLayout">
            {ids.map((id) => (
              <BoardCard key={id} id={id} onOpen={onOpen} />
            ))}
          </AnimatePresence>
          {ids.length === 0 && <li className="grid flex-1 place-items-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{t("Drop a programme here")}</li>}
        </ol>
      </SortableContext>
    </section>
  );
}

/** `onFind`: where "Find programmes" goes (on /plan, the finder); by default the workspace's Programmes tab. */
export function Board({ onFind }: { onFind?: () => void } = {}) {
  const t = useT();
  const local = useLocalName();
  const { answers, byId } = useModel();
  const stored = useWorkspace((s) => s.board);
  const moveCard = useWorkspace((s) => s.moveCard);
  const setView = useWorkspace((s) => s.setView);
  const select = useWorkspace((s) => s.select);
  const board = useMemo(() => boardFor(stored, answers.shortlist), [stored, answers.shortlist]);
  const [active, setActive] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const stageOf = (id: UniqueIdentifier): Stage | null => {
    const key = String(id);
    if (key.startsWith("column:")) return key.slice(7) as Stage;
    const programme = programmeOf(key);
    return STAGES.find((s) => board[s.id].includes(programme))?.id ?? null;
  };

  // Across columns the card moves while it is dragged, so the target column opens a gap for it.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = stageOf(active.id);
    const to = stageOf(over.id);
    if (!from || !to || from === to) return;
    const index = String(over.id).startsWith("card:") ? board[to].indexOf(programmeOf(over.id)) : board[to].length;
    moveCard(programmeOf(active.id), to, index === -1 ? board[to].length : index);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    if (!over) return;
    const stage = stageOf(active.id);
    if (!stage || stage !== stageOf(over.id)) return;
    const ids = board[stage];
    const from = ids.indexOf(programmeOf(active.id));
    const to = String(over.id).startsWith("card:") ? ids.indexOf(programmeOf(over.id)) : ids.length - 1;
    if (from !== -1 && to !== -1 && from !== to) moveCard(programmeOf(active.id), stage, to);
  };

  const open = (id: string) => {
    select(id);
    setOpenId(id);
  };

  if (!answers.shortlist.length) {
    return (
      <Empty className="m-4 w-auto border border-(--rs-line) bg-(--rs-raised)">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SquareKanbanIcon />
          </EmptyMedia>
          <EmptyTitle>{t("No applications yet")}</EmptyTitle>
          <EmptyDescription>{t("Shortlist programmes in Programmes, then move each one along here as the application goes.")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" onClick={onFind ?? (() => setView("programmes"))}>
            {t("Find programmes")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const name = (id: UniqueIdentifier) => {
    const row = byId.get(programmeOf(id));
    return row ? local(row.p.name, row.p.zh).name : t("The programme");
  };
  const label = (id: UniqueIdentifier) => {
    const s = STAGES.find((x) => x.id === stageOf(id));
    return s ? t(s.label) : t("the board");
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      autoScroll={autoScroll}
      onDragStart={({ active }) => setActive(programmeOf(active.id))}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => t("Picked up {name}.", { name: name(active.id) }),
          onDragOver: ({ active, over }) => (over ? t("{name} is in {stage}.", { name: name(active.id), stage: label(over.id) }) : ""),
          onDragEnd: ({ active, over }) => (over ? t("{name} was dropped in {stage}.", { name: name(active.id), stage: label(over.id) }) : t("{name} was dropped.", { name: name(active.id) })),
          onDragCancel: ({ active }) => t("Moving {name} was cancelled.", { name: name(active.id) }),
        },
        screenReaderInstructions: {
          draggable: t("To move a programme, press space or enter to lift it, use the arrow keys to move it, and press space or enter again to drop it. Press escape to cancel."),
        },
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:h-full xl:grid-cols-4 xl:grid-rows-[minmax(0,1fr)]">
          {STAGES.map((stage) => (
            <Column key={stage.id} stage={stage} ids={board[stage.id]} onOpen={open} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {active ? (
          <motion.div initial={{ scale: 1 }} animate={{ scale: 1.03 }} transition={transitions.enter} className="flex cursor-grabbing flex-col gap-1 rounded-lg border bg-(--rs-raised-2) p-2.5 text-sm text-foreground shadow-(--rs-shadow) ring-1 ring-primary/40">
            <CardBody id={active} />
          </motion.div>
        ) : null}
      </DragOverlay>
      <Sheet open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" overlayClassName="bg-black/40 dark:bg-black/70" className="gap-0 border-(--rs-line-soft) p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetTitle className="sr-only">{t("Programme details")}</SheetTitle>
          <div className="min-h-0 flex-1 overflow-y-auto pt-6">
            <ProgrammeDetail id={openId} />
          </div>
        </SheetContent>
      </Sheet>
    </DndContext>
  );
}
