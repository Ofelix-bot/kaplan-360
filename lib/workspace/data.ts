import { create } from "zustand";
import type { ResultsData, ResultsProgramme } from "@/lib/results-types";

// The programme data behind /results (app/data/programmes: one static file, matched against the
// student's answers in the browser), and the "Before applying" steps, loaded per field the first time
// a student opens one (the request names a field only, never the student's answers).

type DataState = {
  status: "idle" | "loading" | "ready" | "error";
  data: ResultsData | null;
  byId: Map<string, ResultsProgramme>;
  load: () => void;
  /** Steps by field, then by programme. */
  prepare: Record<string, Record<string, string[]>>;
  loadingFields: string[];
  loadPrepare: (discipline: string) => void;
};

export const useResultsData = create<DataState>()((set, get) => ({
  status: "idle",
  data: null,
  byId: new Map(),
  load: () => {
    if (get().status === "loading" || get().status === "ready") return;
    set({ status: "loading" });
    fetch("/data/programmes")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: ResultsData) => set({ status: "ready", data, byId: new Map(data.programmes.map((p) => [p.id, p])) }))
      .catch(() => set({ status: "error" }));
  },
  prepare: {},
  loadingFields: [],
  loadPrepare: (discipline) => {
    const { prepare, loadingFields } = get();
    if (prepare[discipline] || loadingFields.includes(discipline)) return;
    set({ loadingFields: [...loadingFields, discipline] });
    fetch(`/data/prepare/${discipline}`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((steps: Record<string, string[]>) =>
        set((s) => ({ prepare: { ...s.prepare, [discipline]: steps }, loadingFields: s.loadingFields.filter((d) => d !== discipline) })),
      );
  },
}));
