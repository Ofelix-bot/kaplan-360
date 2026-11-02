"use client"

import { useState } from "react"
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { GripVerticalIcon } from "lucide-react"
import { motion } from "motion/react"

import { useData } from "@/lib/data"
import { dropAnimation, transitions } from "@/lib/motion"
import { useAppStore } from "@/lib/store"

// Ids: a result row is "result:<programme>", a shortlist item "short:<programme>",
// and the shortlist itself "shortlist".
export const SHORTLIST_ID = "shortlist"
export const shortId = (id: string) => `short:${id}`
const programmeOf = (id: UniqueIdentifier) => String(id).replace(/^(result|short):/, "")
const isResult = (id: UniqueIdentifier) => String(id).startsWith("result:")
const isShort = (id: UniqueIdentifier) => String(id).startsWith("short:")

/** Over the shortlist, prefer the item under the pointer to the list around it; keyboard falls back to the nearest. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  if (hits.length) {
    const item = hits.find((h) => isShort(h.id))
    return item ? [item] : hits
  }
  return closestCenter(args)
}

function DragCard({ id }: { id: string }) {
  const programme = useData((s) => s.byId.get(id))
  const university = useData((s) => (programme ? s.data?.universities[programme.u] : undefined))
  if (!programme || !university) return null
  return (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: 1.03 }}
      transition={transitions.enter}
      className="flex w-72 cursor-grabbing items-start gap-2 rounded-lg border bg-popover p-2.5 text-sm shadow-lg ring-1 ring-primary/20"
    >
      <GripVerticalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{university.name}</p>
        <p className="leading-snug font-medium">{programme.name}</p>
      </div>
    </motion.div>
  )
}

/**
 * One drag-and-drop context for the workspace: rows drag from the results onto the shortlist,
 * and shortlist items reorder. Keyboard: space to lift, arrows to move, space to drop.
 */
export function WorkspaceDnd({ children }: { children: React.ReactNode }) {
  const shortlist = useAppStore((s) => s.shortlist)
  const add = useAppStore((s) => s.addToShortlist)
  const reorder = useAppStore((s) => s.reorderShortlist)
  const byId = useData((s) => s.byId)
  const [active, setActive] = useState<string | null>(null)
  // Kept after the drop, when the overlay decides how to animate out.
  const [fromResults, setFromResults] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const name = (id: UniqueIdentifier) => byId.get(programmeOf(id))?.name ?? "The programme"
  const place = (id: UniqueIdentifier) =>
    id === SHORTLIST_ID
      ? "the shortlist"
      : `position ${shortlist.indexOf(programmeOf(id)) + 1} of the shortlist`

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.id)} is over ${place(over.id)}.` : `${name(active.id)} is not over the shortlist.`,
    onDragEnd: ({ active, over }) =>
      over ? `${name(active.id)} was dropped on ${place(over.id)}.` : `${name(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${name(active.id)} was cancelled.`,
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    setActive(programmeOf(active.id))
    setFromResults(isResult(active.id))
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null)
    if (!over) return
    const id = programmeOf(active.id)
    const overIndex = isShort(over.id) ? shortlist.indexOf(programmeOf(over.id)) : -1
    if (isResult(active.id)) {
      if (over.id === SHORTLIST_ID) add(id)
      else if (overIndex !== -1) add(id, overIndex)
    } else if (isShort(active.id) && overIndex !== -1) {
      const from = shortlist.indexOf(id)
      if (from !== overIndex) reorder(from, overIndex)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move a programme, press space or enter to lift it, use the arrow keys to move it, and press space or enter again to drop it. Press escape to cancel.",
        },
      }}
    >
      {children}
      {/* A row dropped on the shortlist is copied there, so the card doesn't fly back to its row. */}
      <DragOverlay dropAnimation={fromResults ? null : dropAnimation}>
        {active ? <DragCard id={active} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
