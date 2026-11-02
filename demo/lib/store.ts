import type { Layout } from "react-resizable-panels"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { DEFAULT_FILTERS, FIRST_VISIT_FILTERS, type Filters, type SortKey } from "@/lib/filter"

export type Stage = "researching" | "preparing" | "applied" | "decision"

export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "researching", label: "Researching", hint: "Reading the official pages" },
  { id: "preparing", label: "Preparing", hint: "Tests, transcripts, references" },
  { id: "applied", label: "Applied", hint: "Waiting to hear back" },
  { id: "decision", label: "Decision", hint: "Offer, waiting list or no" },
]

const EMPTY_BOARD: Record<Stage, string[]> = {
  researching: [],
  preparing: [],
  applied: [],
  decision: [],
}

type View = "workspace" | "board"

type State = {
  filters: Filters
  sort: SortKey
  /** The student's GPA on the 4-point scale, shown as a marker on admitted-GPA bands. */
  gpa: number | null
  selectedId: string | null
  /** Ranked: the first is the student's first choice. */
  shortlist: string[]
  board: Record<Stage, string[]>
  /** Panel layouts by group id (react-resizable-panels). */
  layouts: Record<string, Layout>
  view: View
  /** Saved state has been read from this browser. */
  hydrated: boolean
}

type Actions = {
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  toggleFilterValue: (key: "countries" | "disciplines", value: string) => void
  resetFilters: () => void
  setSort: (sort: SortKey) => void
  setGpa: (gpa: number | null) => void
  select: (id: string | null) => void
  addToShortlist: (id: string, index?: number) => void
  removeFromShortlist: (id: string) => void
  reorderShortlist: (from: number, to: number) => void
  moveCard: (id: string, stage: Stage, index: number) => void
  saveLayout: (group: string, layout: Layout) => void
  setView: (view: View) => void
  resetDemo: () => void
}

const withoutId = (board: Record<Stage, string[]>, id: string) =>
  Object.fromEntries(
    Object.entries(board).map(([stage, ids]) => [stage, ids.filter((x) => x !== id)])
  ) as Record<Stage, string[]>

const insert = <T,>(list: T[], item: T, index = list.length) => [
  ...list.slice(0, index),
  item,
  ...list.slice(index),
]

/** Everything the student does stays in this browser (localStorage); nothing is sent anywhere. */
export const useAppStore = create<State & Actions>()(
  persist(
    (set) => ({
      filters: FIRST_VISIT_FILTERS,
      sort: "qs",
      gpa: null,
      selectedId: null,
      shortlist: [],
      board: EMPTY_BOARD,
      layouts: {},
      view: "workspace",
      hydrated: false,

      setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
      toggleFilterValue: (key, value) =>
        set((s) => {
          const current = s.filters[key] as string[]
          const next = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value]
          return { filters: { ...s.filters, [key]: next } }
        }),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      setSort: (sort) => set({ sort }),
      setGpa: (gpa) => set({ gpa }),
      select: (selectedId) => set({ selectedId }),

      addToShortlist: (id, index) =>
        set((s) => {
          if (s.shortlist.includes(id)) return s
          const onBoard = Object.values(s.board).some((ids) => ids.includes(id))
          return {
            shortlist: insert(s.shortlist, id, index),
            board: onBoard ? s.board : { ...s.board, researching: [...s.board.researching, id] },
          }
        }),
      removeFromShortlist: (id) =>
        set((s) => ({
          shortlist: s.shortlist.filter((x) => x !== id),
          board: withoutId(s.board, id),
        })),
      reorderShortlist: (from, to) =>
        set((s) => {
          const next = [...s.shortlist]
          const [moved] = next.splice(from, 1)
          next.splice(to, 0, moved)
          return { shortlist: next }
        }),
      moveCard: (id, stage, index) =>
        set((s) => {
          const board = withoutId(s.board, id)
          return { board: { ...board, [stage]: insert(board[stage], id, index) } }
        }),

      saveLayout: (group, layout) => set((s) => ({ layouts: { ...s.layouts, [group]: layout } })),
      setView: (view) => set({ view }),
      resetDemo: () =>
        set({
          filters: FIRST_VISIT_FILTERS,
          sort: "qs",
          gpa: null,
          selectedId: null,
          shortlist: [],
          board: EMPTY_BOARD,
          layouts: {},
        }),
    }),
    {
      name: "kaplan360-stack-demo",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Read after the first render, so the static HTML and the first client render match.
      skipHydration: true,
      partialize: (s) => ({
        filters: s.filters,
        sort: s.sort,
        gpa: s.gpa,
        selectedId: s.selectedId,
        shortlist: s.shortlist,
        board: s.board,
        layouts: s.layouts,
        view: s.view,
      }),
      onRehydrateStorage: () => () => useAppStore.setState({ hydrated: true }),
    }
  )
)

export function stageOf(board: Record<Stage, string[]>, id: string) {
  return STAGES.find((s) => board[s.id].includes(id))?.id ?? null
}
