"use client"

import { useMemo, useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { cn } from "cn"
import { GripVerticalIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { GpaBand } from "@/components/app/admitted-figures"
import { AnimatedNumber } from "@/components/app/animated-number"
import { ShortlistToggle } from "@/components/app/shortlist-toggle"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useData } from "@/lib/data"
import { filterProgrammes, SORTS, sortProgrammes, type Filters, type SortKey } from "@/lib/filter"
import { duration, gpa as formatGpa, plural, score, sgd } from "@/lib/format"
import { COUNTRY_CODE } from "@/lib/labels"
import { transitions } from "@/lib/motion"
import { useAppStore } from "@/lib/store"
import type { Dataset, Programme, University } from "@/lib/types"

const PAGE = 40

// The header, the list and the workspace all read the results: work them out once per change.
let last: { data: Dataset; filters: Filters; sort: SortKey; results: Programme[] } | null = null

function resultsFor(data: Dataset, filters: Filters, sort: SortKey) {
  if (last?.data !== data || last.filters !== filters || last.sort !== sort) {
    last = { data, filters, sort, results: sortProgrammes(filterProgrammes(data, filters), data, sort) }
  }
  return last.results
}

/** The programmes the filters leave, sorted. */
export function useResults() {
  const data = useData((s) => s.data)
  const filters = useAppStore((s) => s.filters)
  const sort = useAppStore((s) => s.sort)
  return useMemo(() => (data ? resultsFor(data, filters, sort) : []), [data, filters, sort])
}

export function ResultsHeader({ start }: { start?: React.ReactNode }) {
  const total = useData((s) => s.data?.programmes.length ?? 0)
  const results = useResults()
  const sort = useAppStore((s) => s.sort)
  const setSort = useAppStore((s) => s.setSort)
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      {start}
      <p className="text-sm whitespace-nowrap">
        <span aria-hidden>
          <AnimatedNumber value={results.length} className="font-heading font-semibold" />{" "}
          <span className="text-muted-foreground">of {total} programmes</span>
        </span>
        <span className="sr-only" aria-live="polite">
          {results.length} of {total} programmes
        </span>
      </p>
      <Select
        items={SORTS.map((s) => ({ value: s.id, label: s.label }))}
        value={sort}
        onValueChange={(value) => value && setSort(value as SortKey)}
      >
        <SelectTrigger size="sm" className="ml-auto" aria-label="Sort by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {SORTS.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function facts(p: Programme) {
  return [
    p.feeSgd !== null && `${sgd(p.feeSgd)} a year`,
    duration(p.months),
    p.ielts !== null && `IELTS ${score(p.ielts)}`,
  ]
    .filter(Boolean)
    .join(" · ")
}

function ProgrammeRow({
  programme,
  university,
  selected,
  onSelect,
}: {
  programme: Programme
  university: University
  selected: boolean
  onSelect: (id: string) => void
}) {
  const mine = useAppStore((s) => s.gpa)
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `result:${programme.id}`,
    data: { programmeId: programme.id },
  })
  const c = programme.cases
  const variance = c.flags.some((f) => f !== "few")

  return (
    <motion.li
      ref={setNodeRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: isDragging ? 0.4 : 1 }}
      exit={{ opacity: 0, transition: transitions.exit }}
      transition={transitions.enter}
      className={cn(
        "group/row grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-1.5 rounded-lg py-2 pr-1.5 pl-1 transition-colors",
        selected ? "bg-accent ring-1 ring-primary/20" : "hover:bg-muted/70"
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${programme.name} to the shortlist`}
        className="mt-0.5 flex size-6 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onSelect(programme.id)}
        aria-current={selected || undefined}
        className="flex min-w-0 flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="truncate text-xs text-muted-foreground">
          {university.name}
          {university.qs !== null && ` · QS ${university.qs}`} · {COUNTRY_CODE[university.country]}
        </span>
        <span className="leading-snug font-medium">{programme.name}</span>
        {c.gpa ? (
          <span className="flex items-center gap-2">
            <span className="w-28 shrink-0">
              <GpaBand spread={c.gpa} mine={mine} />
            </span>
            <span className="truncate text-xs text-muted-foreground tabular-nums">
              GPA {formatGpa(c.gpa.median)} median · {plural(c.n, "admit")}
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {plural(c.n, "admit")} reported, no GPAs
          </span>
        )}
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {facts(programme)}
          {university.partner && <Badge className="h-4 px-1.5 text-[10px]">Kaplan partner</Badge>}
          {variance && (
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              <TriangleAlertIcon className="size-2.5!" />
              Wide spread
            </Badge>
          )}
        </span>
      </button>
      <ShortlistToggle id={programme.id} name={programme.name} />
    </motion.li>
  )
}

export function ResultsList({ onSelect }: { onSelect: (id: string) => void }) {
  const data = useData((s) => s.data)
  const results = useResults()
  const filters = useAppStore((s) => s.filters)
  const sort = useAppStore((s) => s.sort)
  const selectedId = useAppStore((s) => s.selectedId)
  const resetFilters = useAppStore((s) => s.resetFilters)

  // Back to the first page whenever the filters or the order change.
  const key = `${JSON.stringify(filters)}|${sort}`
  const [page, setPage] = useState({ key, shown: PAGE })
  const shown = page.key === key ? page.shown : PAGE

  if (!data) return null
  if (!results.length) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>No programmes match</EmptyTitle>
          <EmptyDescription>Loosen a filter, or start again from every programme.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-1.5">
      <ul className="flex flex-col gap-0.5">
        <AnimatePresence initial={false} mode="popLayout">
          {results.slice(0, shown).map((p) => (
            <ProgrammeRow
              key={p.id}
              programme={p}
              university={data.universities[p.u]}
              selected={p.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </AnimatePresence>
      </ul>
      {shown < results.length && (
        <Button
          variant="outline"
          size="sm"
          className="mx-auto mb-2"
          onClick={() => setPage({ key, shown: shown + PAGE })}
        >
          Show {Math.min(PAGE, results.length - shown)} more
        </Button>
      )}
    </div>
  )
}
