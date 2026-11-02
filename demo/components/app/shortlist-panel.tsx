"use client"

import { useState } from "react"
import { useDndContext, useDroppable } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "cn"
import { GripVerticalIcon, ListOrderedIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { shortId, SHORTLIST_ID } from "@/components/app/workspace-dnd"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from "@/lib/data"
import { gpa as formatGpa, score, sgd } from "@/lib/format"
import { COUNTRY_CODE } from "@/lib/labels"
import { sortableTransition, transitions } from "@/lib/motion"
import { useAppStore } from "@/lib/store"

function ShortlistItem({ id, rank, onSelect }: { id: string; rank: number; onSelect: (id: string) => void }) {
  const programme = useData((s) => s.byId.get(id))
  const university = useData((s) => (programme ? s.data?.universities[programme.u] : undefined))
  const remove = useAppStore((s) => s.removeFromShortlist)
  const { active, over } = useDndContext()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shortId(id), transition: sortableTransition })
  if (!programme || !university) return null

  // A result row dragged over this item will be inserted above it.
  const insertHere = !!active && String(active.id).startsWith("result:") && over?.id === shortId(id)

  return (
    <motion.li
      ref={setNodeRef}
      // dnd-kit owns the transform while sorting; Motion only fades items in and out.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      initial={{ opacity: 0 }}
      animate={{ opacity: isDragging ? 0.4 : 1 }}
      exit={{ opacity: 0, transition: transitions.exit }}
      transition={transitions.enter}
      className={cn(
        "relative flex items-center gap-1.5 rounded-lg border bg-card py-1.5 pr-1 pl-1.5",
        insertHere && "before:absolute before:inset-x-1 before:-top-1 before:h-0.5 before:rounded-full before:bg-primary"
      )}
    >
      <span className="w-5 shrink-0 text-center font-heading text-xs font-semibold text-muted-foreground tabular-nums">
        {rank}
      </span>
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Move ${programme.name}, number ${rank}`}
        className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onSelect(id)}
        className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="block truncate text-xs text-muted-foreground">
          {university.name} · {COUNTRY_CODE[university.country]}
        </span>
        <span className="block truncate text-sm font-medium">{programme.name}</span>
      </button>
      {programme.cases.gpa && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatGpa(programme.cases.gpa.median)}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Remove ${programme.name} from the shortlist`}
        onClick={() => remove(id)}
      >
        <XIcon />
      </Button>
    </motion.li>
  )
}

function CompareTable({ ids, onSelect }: { ids: string[]; onSelect: (id: string) => void }) {
  const data = useData((s) => s.data)
  const byId = useData((s) => s.byId)
  if (!data) return null
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead className="w-6">#</TableHead>
          <TableHead>Programme</TableHead>
          <TableHead className="text-right">GPA median</TableHead>
          <TableHead className="text-right">IELTS median</TableHead>
          <TableHead className="text-right">Tuition</TableHead>
          <TableHead className="text-right">Admits</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ids.map((id, i) => {
          const p = byId.get(id)
          if (!p) return null
          const u = data.universities[p.u]
          return (
            <TableRow key={id} className="cursor-pointer" onClick={() => onSelect(id)}>
              <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
              <TableCell className="max-w-48">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-muted-foreground">{u.name}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {p.cases.gpa ? formatGpa(p.cases.gpa.median) : "–"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {p.cases.ielts ? score(p.cases.ielts.median) : "–"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {p.feeSgd !== null ? sgd(p.feeSgd) : "–"}
              </TableCell>
              <TableCell className="text-right tabular-nums">{p.cases.n}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function ShortlistPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const shortlist = useAppStore((s) => s.shortlist)
  const [tab, setTab] = useState("ranked")
  const { setNodeRef } = useDroppable({ id: SHORTLIST_ID })
  const { active, over } = useDndContext()
  const draggingResult = !!active && String(active.id).startsWith("result:")
  const overList = draggingResult && !!over && (over.id === SHORTLIST_ID || String(over.id).startsWith("short:"))

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="h-full gap-0">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <h2 className="font-heading text-sm font-semibold">Shortlist</h2>
        <Badge variant="secondary" className="tabular-nums">
          {shortlist.length}
        </Badge>
        <TabsList className="ml-auto h-7!">
          <TabsTrigger value="ranked" className="text-xs">
            Ranked
          </TabsTrigger>
          <TabsTrigger value="compare" className="text-xs" disabled={shortlist.length < 2}>
            Compare
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="ranked" className="min-h-0">
        <div
          ref={setNodeRef}
          className={cn(
            "h-full min-h-32 overflow-y-auto p-2 transition-colors",
            draggingResult && "bg-muted/50",
            overList && "bg-accent ring-2 ring-primary/30 ring-inset"
          )}
        >
          {shortlist.length === 0 ? (
            <Empty className="h-full border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ListOrderedIcon />
                </EmptyMedia>
                <EmptyTitle>Rank your choices</EmptyTitle>
                <EmptyDescription>
                  Drag a programme here by its handle, or press + on its row. Drag to reorder.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <SortableContext items={shortlist.map(shortId)} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-1.5" aria-label="Shortlist, first choice first">
                <AnimatePresence initial={false} mode="popLayout">
                  {shortlist.map((id, i) => (
                    <ShortlistItem key={id} id={id} rank={i + 1} onSelect={onSelect} />
                  ))}
                </AnimatePresence>
              </ol>
            </SortableContext>
          )}
        </div>
      </TabsContent>
      <TabsContent value="compare" className="min-h-0 overflow-y-auto">
        <CompareTable ids={shortlist} onSelect={onSelect} />
      </TabsContent>
    </Tabs>
  )
}
