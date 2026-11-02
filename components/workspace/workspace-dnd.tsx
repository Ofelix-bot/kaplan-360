"use client";

import { useState } from "react";
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
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GripVerticalIcon } from "lucide-react";
import { motion } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { useLocalName } from "@/components/results/names";
import { dropAnimation, transitions } from "@/lib/motion";
import { useModel } from "./model";

// One drag-and-drop context for the workspace: result rows drag onto the shortlist, and shortlist
// items reorder (the first is the student's first choice). Keyboard: space to lift, arrows to move,
// space to drop. Ids: a result row is "result:<programme>", a shortlist item "short:<programme>",
// and the shortlist itself "shortlist".

export const SHORTLIST_ID = "shortlist";
export const shortId = (id: string) => `short:${id}`;
const programmeOf = (id: UniqueIdentifier) => String(id).replace(/^(result|short):/, "");
const isResult = (id: UniqueIdentifier) => String(id).startsWith("result:");
const isShort = (id: UniqueIdentifier) => String(id).startsWith("short:");

/** Dragging near an edge scrolls the panels, never the page: the workspace fills the window. */
const autoScroll = { canScroll: (el: Element) => el !== document.scrollingElement };

/** Over the shortlist, prefer the item under the pointer to the list around it; the keyboard falls back to the nearest. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length) {
    const item = hits.find((h) => isShort(h.id));
    return item ? [item] : hits;
  }
  return closestCenter(args);
};

function DragCard({ id }: { id: string }) {
  const { byId } = useModel();
  const local = useLocalName();
  const row = byId.get(id);
  if (!row) return null;
  return (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: 1.03 }}
      transition={transitions.enter}
      className="flex w-72 cursor-grabbing items-start gap-2 rounded-lg border bg-(--rs-raised-2) p-2.5 text-sm text-foreground shadow-(--rs-shadow) ring-1 ring-primary/40"
    >
      <GripVerticalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{local(row.u.name, row.u.zh).name}</p>
        <p className="leading-snug font-medium">{local(row.p.name, row.p.zh).name}</p>
      </div>
    </motion.div>
  );
}

export function WorkspaceDnd({ children }: { children: React.ReactNode }) {
  const t = useT();
  const local = useLocalName();
  const { answers, byId, addToShortlist, reorderShortlist } = useModel();
  const shortlist = answers.shortlist;
  const [active, setActive] = useState<string | null>(null);
  // Kept after the drop, when the overlay decides how to animate out.
  const [fromResults, setFromResults] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const name = (id: UniqueIdentifier) => {
    const row = byId.get(programmeOf(id));
    return row ? local(row.p.name, row.p.zh).name : t("The programme");
  };
  const place = (id: UniqueIdentifier) => (id === SHORTLIST_ID ? t("the shortlist") : t("position {n} of the shortlist", { n: shortlist.indexOf(programmeOf(id)) + 1 }));

  const announcements: Announcements = {
    onDragStart: ({ active }) => t("Picked up {name}.", { name: name(active.id) }),
    onDragOver: ({ active, over }) => (over ? t("{name} is over {place}.", { name: name(active.id), place: place(over.id) }) : t("{name} is not over the shortlist.", { name: name(active.id) })),
    onDragEnd: ({ active, over }) => (over ? t("{name} was dropped on {place}.", { name: name(active.id), place: place(over.id) }) : t("{name} was dropped.", { name: name(active.id) })),
    onDragCancel: ({ active }) => t("Moving {name} was cancelled.", { name: name(active.id) }),
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActive(programmeOf(active.id));
    setFromResults(isResult(active.id));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    if (!over) return;
    const id = programmeOf(active.id);
    const overIndex = isShort(over.id) ? shortlist.indexOf(programmeOf(over.id)) : -1;
    if (isResult(active.id)) {
      if (over.id === SHORTLIST_ID) addToShortlist(id);
      else if (overIndex !== -1) addToShortlist(id, overIndex);
    } else if (isShort(active.id) && overIndex !== -1) {
      const from = shortlist.indexOf(id);
      if (from !== overIndex) reorderShortlist(from, overIndex);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      autoScroll={autoScroll}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: t("To move a programme, press space or enter to lift it, use the arrow keys to move it, and press space or enter again to drop it. Press escape to cancel."),
        },
      }}
    >
      {children}
      {/* A row dropped on the shortlist is copied there, so the card doesn't fly back to its row. */}
      <DragOverlay dropAnimation={fromResults ? null : dropAnimation}>{active ? <DragCard id={active} /> : null}</DragOverlay>
    </DndContext>
  );
}
