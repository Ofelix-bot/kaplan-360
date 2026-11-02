"use client"

import { useState } from "react"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "cn"
import { PanelRightOpenIcon, SquareKanbanIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { ProgrammeDetail } from "@/components/app/programme-detail"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useData } from "@/lib/data"
import { gpa as formatGpa, intakeMonths, score, sgd } from "@/lib/format"
import { COUNTRY_CODE } from "@/lib/labels"
import { dropAnimation, sortableTransition, transitions } from "@/lib/motion"
import { STAGES, useAppStore, type Stage } from "@/lib/store"

// Ids: a card is "card:<programme>", a column "column:<stage>".
const cardId = (id: string) => `card:${id}`
const columnId = (stage: Stage) => `column:${stage}`
const programmeOf = (id: UniqueIdentifier) => String(id).replace(/^card:/, "")

function CardBody({ id, onOpen }: { id: string; onOpen?: (id: string) => void }) {
  const programme = useData((s) => s.byId.get(id))
  const university = useData((s) => (programme ? s.data?.universities[programme.u] : undefined))
  if (!programme || !university) return null
  const c = programme.cases
  const starts = intakeMonths(programme.intake)
  return (
    <>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">
            {university.name} · {COUNTRY_CODE[university.country]}
          </p>
          <p className="leading-snug font-medium">{programme.name}</p>
        </div>
        {onOpen && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Details of ${programme.name}`}
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
        {[
          c.gpa && `GPA ${formatGpa(c.gpa.median)}`,
          c.ielts && `IELTS ${score(c.ielts.median)}`,
          programme.feeSgd !== null && `${sgd(programme.feeSgd)} a year`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {starts && <p className="text-xs text-muted-foreground">Starts {starts}</p>}
    </>
  )
}

function BoardCard({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const name = useData((s) => s.byId.get(id)?.name ?? "programme")
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardId(id),
    transition: sortableTransition,
  })
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
      aria-label={`${name}. Press space to move it to another stage.`}
      className="flex cursor-grab touch-none flex-col gap-1 rounded-lg border bg-card p-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
    >
      <CardBody id={id} onOpen={onOpen} />
    </motion.li>
  )
}

function Column({ stage, ids, onOpen }: { stage: (typeof STAGES)[number]; ids: string[]; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(stage.id) })
  return (
    <section
      aria-labelledby={`${stage.id}-title`}
      className="flex min-h-0 flex-col rounded-xl bg-muted/60 ring-1 ring-foreground/5"
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <h2 id={`${stage.id}-title`} className="font-heading text-sm font-semibold">
          {stage.label}
        </h2>
        <Badge variant="outline" className="tabular-nums">
          {ids.length}
        </Badge>
        <span className="ml-auto truncate text-xs text-muted-foreground">{stage.hint}</span>
      </header>
      <SortableContext items={ids.map(cardId)} strategy={verticalListSortingStrategy}>
        <ol
          ref={setNodeRef}
          className={cn(
            "flex min-h-28 flex-1 flex-col gap-2 overflow-y-auto rounded-b-xl p-2 transition-colors",
            isOver && "bg-accent"
          )}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {ids.map((id) => (
              <BoardCard key={id} id={id} onOpen={onOpen} />
            ))}
          </AnimatePresence>
          {ids.length === 0 && (
            <li className="grid flex-1 place-items-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              Drop a programme here
            </li>
          )}
        </ol>
      </SortableContext>
    </section>
  )
}

/** The shortlist as an application board: drag each programme along as the application moves. */
export function Board() {
  const board = useAppStore((s) => s.board)
  const moveCard = useAppStore((s) => s.moveCard)
  const setView = useAppStore((s) => s.setView)
  const select = useAppStore((s) => s.select)
  const byId = useData((s) => s.byId)
  const [active, setActive] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const stageOf = (id: UniqueIdentifier): Stage | null => {
    const key = String(id)
    if (key.startsWith("column:")) return key.slice(7) as Stage
    const programme = programmeOf(key)
    return STAGES.find((s) => board[s.id].includes(programme))?.id ?? null
  }

  // Across columns the card moves while it is dragged, so the target column opens a gap for it.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const from = stageOf(active.id)
    const to = stageOf(over.id)
    if (!from || !to || from === to) return
    const index = String(over.id).startsWith("card:")
      ? board[to].indexOf(programmeOf(over.id))
      : board[to].length
    moveCard(programmeOf(active.id), to, index === -1 ? board[to].length : index)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null)
    if (!over) return
    const stage = stageOf(active.id)
    if (!stage || stage !== stageOf(over.id)) return
    const ids = board[stage]
    const from = ids.indexOf(programmeOf(active.id))
    const to = String(over.id).startsWith("card:") ? ids.indexOf(programmeOf(over.id)) : ids.length - 1
    if (from !== -1 && to !== -1 && from !== to) moveCard(programmeOf(active.id), stage, to)
  }

  const open = (id: string) => {
    select(id)
    setOpenId(id)
  }

  const total = STAGES.reduce((n, s) => n + board[s.id].length, 0)
  if (!total) {
    return (
      <Empty className="m-4 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SquareKanbanIcon />
          </EmptyMedia>
          <EmptyTitle>No applications yet</EmptyTitle>
          <EmptyDescription>
            Shortlist programmes in Programmes, then move each one along here as the application goes.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" onClick={() => setView("workspace")}>
            Find programmes
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const name = (id: UniqueIdentifier) => byId.get(programmeOf(id))?.name ?? "The programme"
  const label = (id: UniqueIdentifier) => STAGES.find((s) => s.id === stageOf(id))?.label ?? "the board"

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActive(programmeOf(active.id))}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
          onDragOver: ({ active, over }) => (over ? `${name(active.id)} is in ${label(over.id)}.` : ""),
          onDragEnd: ({ active, over }) => (over ? `${name(active.id)} was dropped in ${label(over.id)}.` : `${name(active.id)} was dropped.`),
          onDragCancel: ({ active }) => `Moving ${name(active.id)} was cancelled.`,
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
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: 1.03 }}
            transition={transitions.enter}
            className="flex cursor-grabbing flex-col gap-1 rounded-lg border bg-popover p-2.5 text-sm shadow-lg ring-1 ring-primary/20"
          >
            <CardBody id={active} />
          </motion.div>
        ) : null}
      </DragOverlay>
      <Sheet open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetTitle className="sr-only">Programme details</SheetTitle>
          <div className="min-h-0 flex-1 overflow-y-auto pt-6">
            <ProgrammeDetail id={openId} />
          </div>
        </SheetContent>
      </Sheet>
    </DndContext>
  )
}
