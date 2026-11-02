import type { Dataset, Discipline, Programme, University } from "@/lib/types"

/** QS World University Rankings steps for the rank range; the last one means "and below". */
export const QS_STEPS = [1, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500] as const
export const QS_LAST = QS_STEPS.length - 1

export type SortKey = "qs" | "admits" | "gpa" | "fee"
export const SORTS: { id: SortKey; label: string }[] = [
  { id: "qs", label: "QS rank" },
  { id: "admits", label: "Most admits reported" },
  { id: "gpa", label: "Admitted GPA, low to high" },
  { id: "fee", label: "Tuition, low to high" },
]

/** "any": no English filter. "none": no score yet. A number: the student's IELTS overall. */
export type EnglishFilter = "any" | "none" | number

export type Filters = {
  query: string
  countries: string[]
  disciplines: Discipline[]
  /** Two indexes into QS_STEPS. */
  qs: [number, number]
  /** S$ a year; null for any. */
  feeMax: number | null
  english: EnglishFilter
  hideWork: boolean
  partnerOnly: boolean
}

export const DEFAULT_FILTERS: Filters = {
  query: "",
  countries: [],
  disciplines: [],
  qs: [0, QS_LAST],
  feeMax: null,
  english: "any",
  hideWork: false,
  partnerOnly: false,
}

/** A first visit opens on Singapore and Hong Kong, where Kaplan students look first. */
export const FIRST_VISIT_FILTERS: Filters = {
  ...DEFAULT_FILTERS,
  countries: ["Singapore", "Hong Kong SAR"],
}

type Test = (p: Programme, u: University) => boolean

/** One test per filter in use. Programmes that state no fee or no English minimum stay in. */
function tests(f: Filters): Partial<Record<keyof Filters, Test>> {
  const t: Partial<Record<keyof Filters, Test>> = {}
  const words = f.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length) {
    t.query = (p, u) => {
      const text = `${p.name} ${u.name}`.toLowerCase()
      return words.every((w) => text.includes(w))
    }
  }
  if (f.countries.length) t.countries = (_, u) => f.countries.includes(u.country)
  if (f.disciplines.length) t.disciplines = (p) => f.disciplines.includes(p.discipline)
  if (f.qs[0] > 0 || f.qs[1] < QS_LAST) {
    const low = QS_STEPS[f.qs[0]]
    const high = f.qs[1] === QS_LAST ? Infinity : QS_STEPS[f.qs[1]]
    t.qs = (_, u) => u.qs !== null && u.qs >= low && u.qs <= high
  }
  const feeMax = f.feeMax
  if (feeMax !== null) t.feeMax = (p) => p.feeSgd === null || p.feeSgd <= feeMax
  const english = f.english
  if (english === "none") t.english = (p) => p.ielts === null || p.waiver
  else if (typeof english === "number") {
    t.english = (p) => p.ielts === null || p.waiver || p.ielts <= english
  }
  if (f.hideWork) t.hideWork = (p) => p.work === null
  if (f.partnerOnly) t.partnerOnly = (_, u) => u.partner
  return t
}

export function filterProgrammes(data: Dataset, f: Filters) {
  const active = Object.values(tests(f))
  return data.programmes.filter((p) => {
    const u = data.universities[p.u]
    return active.every((test) => test(p, u))
  })
}

/** How many programmes each option would leave, with every other filter applied. */
export function facetCounts(data: Dataset, f: Filters) {
  const all = Object.entries(tests(f)) as [keyof Filters, Test][]
  const passes = (p: Programme, u: University, skip: keyof Filters) =>
    all.every(([key, test]) => key === skip || test(p, u))

  const countries: Record<string, number> = {}
  const disciplines: Record<string, number> = {}
  let partner = 0
  let noWork = 0
  for (const p of data.programmes) {
    const u = data.universities[p.u]
    if (passes(p, u, "countries")) countries[u.country] = (countries[u.country] ?? 0) + 1
    if (passes(p, u, "disciplines")) disciplines[p.discipline] = (disciplines[p.discipline] ?? 0) + 1
    if (u.partner && passes(p, u, "partnerOnly")) partner++
    if (p.work === null && passes(p, u, "hideWork")) noWork++
  }
  return { countries, disciplines, partner, noWork }
}

export function sortProgrammes(list: Programme[], data: Dataset, key: SortKey) {
  const qs = (p: Programme) => data.universities[p.u].qs ?? Infinity
  const byQs = (a: Programme, b: Programme) => qs(a) - qs(b) || b.cases.n - a.cases.n
  const compare: Record<SortKey, (a: Programme, b: Programme) => number> = {
    qs: byQs,
    admits: (a, b) => b.cases.n - a.cases.n || byQs(a, b),
    gpa: (a, b) =>
      (a.cases.gpa?.median ?? Infinity) - (b.cases.gpa?.median ?? Infinity) || byQs(a, b),
    fee: (a, b) => (a.feeSgd ?? Infinity) - (b.feeSgd ?? Infinity) || byQs(a, b),
  }
  return [...list].sort(compare[key])
}

export function activeFilterCount(f: Filters) {
  return Object.keys(tests(f)).length
}
