"use client"

import { useMemo, useState } from "react"
import { RotateCcwIcon, SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useData } from "@/lib/data"
import {
  activeFilterCount,
  facetCounts,
  QS_LAST,
  QS_STEPS,
  type EnglishFilter,
} from "@/lib/filter"
import { sgd } from "@/lib/format"
import { COUNTRIES, DISCIPLINES } from "@/lib/labels"
import { useAppStore } from "@/lib/store"
import type { Discipline } from "@/lib/types"

/** Tuition caps in S$ a year; the last step means any. */
const FEE_STEPS = [20_000, 30_000, 40_000, 50_000, 60_000, 70_000, 80_000, null] as const

const ENGLISH_OPTIONS: { value: string; label: string }[] = [
  { value: "any", label: "Don’t filter" },
  { value: "none", label: "No score yet" },
  ...[6, 6.5, 7, 7.5, 8].map((s) => ({ value: String(s), label: `IELTS ${s.toFixed(1)}` })),
]

function qsLabel([low, high]: [number, number]) {
  if (low === 0 && high === QS_LAST) return "Any rank"
  if (low === 0) return `Top ${QS_STEPS[high]}`
  if (high === QS_LAST) return `${QS_STEPS[low]} and below`
  return `${QS_STEPS[low]} to ${QS_STEPS[high]}`
}

function Count({ n }: { n: number }) {
  return <span className="ml-auto text-xs text-muted-foreground tabular-nums">{n}</span>
}

function CheckList<T extends string>({
  legend,
  name,
  options,
  selected,
  counts,
  onToggle,
}: {
  legend: string
  name: string
  options: { id: T; label: string }[]
  selected: T[]
  counts: Record<string, number>
  onToggle: (id: T) => void
}) {
  return (
    <FieldSet className="gap-2.5">
      <FieldLegend variant="label">{legend}</FieldLegend>
      <FieldGroup className="gap-2">
        {options.map((option) => {
          const checked = selected.includes(option.id)
          const n = counts[option.id] ?? 0
          const id = `${name}-${option.id.replace(/\W+/g, "-")}`
          return (
            <Field key={option.id} orientation="horizontal" data-disabled={!n && !checked}>
              <Checkbox
                id={id}
                checked={checked}
                disabled={!n && !checked}
                onCheckedChange={() => onToggle(option.id)}
              />
              <FieldLabel htmlFor={id} className="font-normal">
                {option.label}
              </FieldLabel>
              <Count n={n} />
            </Field>
          )
        })}
      </FieldGroup>
    </FieldSet>
  )
}

function GpaField() {
  const gpa = useAppStore((s) => s.gpa)
  const setGpa = useAppStore((s) => s.setGpa)
  const [text, setText] = useState(gpa === null ? "" : gpa.toFixed(2))

  const commit = (value: string) => {
    setText(value)
    if (!value.trim()) return setGpa(null)
    const n = Number(value)
    if (Number.isFinite(n) && n >= 0 && n <= 4) setGpa(Math.round(n * 100) / 100)
  }

  return (
    <Field>
      <FieldLabel htmlFor="my-gpa">Your GPA</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id="my-gpa"
          inputMode="decimal"
          placeholder="e.g. 3.40"
          value={text}
          onChange={(e) => commit(e.target.value)}
          aria-describedby="my-gpa-help"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>of 4.0</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription id="my-gpa-help">
        Shown as an amber mark on each admitted-GPA band. It doesn’t filter anything.
      </FieldDescription>
    </Field>
  )
}

export function FilterPanel() {
  const data = useData((s) => s.data)
  const filters = useAppStore((s) => s.filters)
  const setFilter = useAppStore((s) => s.setFilter)
  const toggle = useAppStore((s) => s.toggleFilterValue)
  const resetFilters = useAppStore((s) => s.resetFilters)
  const counts = useMemo(() => (data ? facetCounts(data, filters) : null), [data, filters])
  if (!counts) return null

  const active = activeFilterCount(filters)
  const feeIndex = FEE_STEPS.indexOf(filters.feeMax as (typeof FEE_STEPS)[number])
  const feeStep = feeIndex === -1 ? FEE_STEPS.length - 1 : feeIndex
  const english = String(filters.english)

  return (
    <div className="flex flex-col gap-5 p-4">
      <Field>
        <FieldLabel htmlFor="search" className="sr-only">
          Search programmes
        </FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            id="search"
            placeholder="Programme or university"
            value={filters.query}
            onChange={(e) => setFilter("query", e.target.value)}
          />
          {filters.query && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => setFilter("query", "")}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </Field>

      <GpaField />
      <Separator />

      <CheckList
        legend="Country"
        name="country"
        options={COUNTRIES}
        selected={filters.countries}
        counts={counts.countries}
        onToggle={(id) => toggle("countries", id)}
      />

      <CheckList<Discipline>
        legend="Field"
        name="field"
        options={DISCIPLINES}
        selected={filters.disciplines}
        counts={counts.disciplines}
        onToggle={(id) => toggle("disciplines", id)}
      />

      <Separator />

      <Field>
        <div className="flex items-baseline justify-between gap-2">
          <FieldLabel id="qs-label">QS World University Rankings</FieldLabel>
          <span className="text-xs text-muted-foreground tabular-nums">{qsLabel(filters.qs)}</span>
        </div>
        <Slider
          aria-labelledby="qs-label"
          min={0}
          max={QS_LAST}
          step={1}
          minStepsBetweenValues={1}
          value={filters.qs}
          onValueChange={(value) => setFilter("qs", value as [number, number])}
        />
      </Field>

      <Field>
        <div className="flex items-baseline justify-between gap-2">
          <FieldLabel id="fee-label">Tuition a year</FieldLabel>
          <span className="text-xs text-muted-foreground tabular-nums">
            {filters.feeMax === null ? "Any" : `Up to ${sgd(filters.feeMax)}`}
          </span>
        </div>
        <Slider
          aria-labelledby="fee-label"
          min={0}
          max={FEE_STEPS.length - 1}
          step={1}
          value={feeStep}
          onValueChange={(value) => setFilter("feeMax", FEE_STEPS[value as number])}
        />
        <FieldDescription>Programmes that state no fee stay in.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="english">English test</FieldLabel>
        <Select
          items={ENGLISH_OPTIONS}
          value={english}
          onValueChange={(value) => {
            if (!value) return
            const next: EnglishFilter = value === "any" || value === "none" ? value : Number(value)
            setFilter("english", next)
          }}
        >
          <SelectTrigger id="english" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENGLISH_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          Hides programmes whose IELTS minimum is higher. Where a programme accepts an
          English-taught degree from Singapore instead, it stays in.
        </FieldDescription>
      </Field>

      <Separator />

      <FieldGroup className="gap-3">
        <Field orientation="horizontal">
          <Switch
            id="partner"
            checked={filters.partnerOnly}
            onCheckedChange={(checked) => setFilter("partnerOnly", checked)}
          />
          <FieldLabel htmlFor="partner" className="font-normal">
            Kaplan partner universities
          </FieldLabel>
          <Count n={counts.partner} />
        </Field>
        <Field orientation="horizontal">
          <Switch
            id="no-work"
            checked={filters.hideWork}
            onCheckedChange={(checked) => setFilter("hideWork", checked)}
          />
          <FieldLabel htmlFor="no-work" className="font-normal">
            No work experience asked for
          </FieldLabel>
          <Count n={counts.noWork} />
        </Field>
      </FieldGroup>

      {active > 0 && (
        <Button variant="outline" size="sm" onClick={resetFilters} className="self-start">
          <RotateCcwIcon />
          Clear {active === 1 ? "1 filter" : `${active} filters`}
        </Button>
      )}
    </div>
  )
}
