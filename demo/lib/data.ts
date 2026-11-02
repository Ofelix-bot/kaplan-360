import { create } from "zustand"

import type { Dataset, Programme } from "@/lib/types"

type DataState = {
  status: "idle" | "loading" | "ready" | "error"
  data: Dataset | null
  byId: Map<string, Programme>
  load: () => void
}

/** The programme file, fetched once per visit from public/data. Never changes while the page is open. */
export const useData = create<DataState>()((set, get) => ({
  status: "idle",
  data: null,
  byId: new Map(),
  load: () => {
    if (get().status === "loading" || get().status === "ready") return
    set({ status: "loading" })
    fetch("/data/programmes.json")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<Dataset>
      })
      .then((data) =>
        set({
          status: "ready",
          data,
          byId: new Map(data.programmes.map((p) => [p.id, p])),
        })
      )
      .catch(() => set({ status: "error" }))
  },
}))

export function useProgramme(id: string | null) {
  return useData((s) => (id ? (s.byId.get(id) ?? null) : null))
}

export function useUniversity(programme: Programme | null) {
  return useData((s) => (programme && s.data ? s.data.universities[programme.u] : null))
}
