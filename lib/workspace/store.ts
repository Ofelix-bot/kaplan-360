import type { Layout } from "react-resizable-panels";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { msg } from "@/lib/i18n/translate";
import { LAST_QS, type Sort, type Stand } from "@/components/results/facets";
import { DEFAULT_CRITERIA, criteriaOf, type Criterion } from "@/lib/finder/criteria";
import { MAX_AGE_DAYS } from "@/lib/plan-storage";
import { usePlanStore } from "./plan-store";

// The /results workspace's own state. The student's answers (background, tests, countries, budget,
// start, shortlist, saved searches) stay in the plan store; here are the filters the page adds (field,
// rank range, universities, usual range, order), what is open and selected, the panel sizes, and the
// stage of each shortlisted application. Panel sizes, the selection and the stages are kept in this
// browser, as the answers are: on this device or for the session, never sent anywhere.

export type Stage = "researching" | "preparing" | "applied" | "decision";

export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "researching", label: "Researching", hint: msg("Reading the official pages") },
  { id: "preparing", label: "Preparing", hint: msg("Tests, transcripts, references") },
  { id: "applied", label: "Applied", hint: msg("Waiting to hear back") },
  { id: "decision", label: "Decision", hint: msg("Offer, waiting list or no") },
];

export type Board = Record<Stage, string[]>;
const EMPTY_BOARD: Board = { researching: [], preparing: [], applied: [], decision: [] };

/** The filters the page adds to the student's answers. */
export type Scope = {
  /** The master's field; null until the student picks one (then their degree's field, or every field). */
  fieldChoice: string | null;
  qsMin: number;
  qsMax: number;
  unranked: boolean;
  universities: string[];
  onlyStarred: boolean;
  stand: Stand;
  sort: Sort;
};

export const DEFAULT_SCOPE: Scope = { fieldChoice: null, qsMin: 0, qsMax: LAST_QS, unranked: true, universities: [], onlyStarred: false, stand: "all", sort: "fit" };

type State = Scope & {
  view: "programmes" | "applications";
  /** Results by university, or one list. */
  listView: "unis" | "list";
  /** The finder's order: one criterion, or several averaged (lib/finder/criteria.ts). */
  finderSort: Criterion[];
  /** The finder's list: every programme, or only the master's taught at Kaplan Singapore. */
  finderTab: "all" | "kaplan";
  /** The filter panel's tabs: the filters, or one sentence that sets them. */
  tab: "quick" | "ask";
  /** Set when the page opens on the sentence box (/results?start=idea): its field takes focus once. */
  askFocus: boolean;
  setAskFocus: (on: boolean) => void;
  /** Set when the page opens on one programme (/results?programme=…, from Where you stand): the phone layout opens its detail once. */
  openDetail: boolean;
  setOpenDetail: (on: boolean) => void;
  /** Set when the page opens on a comparison (/results?compare=a,b,c, from a careers role page): the Compare sheet opens on these once. Not kept. */
  compare: string[] | null;
  setCompare: (ids: string[] | null) => void;
  /** Bumped to bring the filters into view (the /results hero's button): the wide layout expands the panel, phones open the sheet. Not kept. */
  filtersRequest: number;
  requestFilters: () => void;
  selectedId: string | null;
  /** Panel layouts by group id (react-resizable-panels). */
  layouts: Record<string, Layout>;
  board: Board;
  savedAt: number;
  /** The kept state has been read from this browser. */
  hydrated: boolean;
};

type Actions = {
  setScope: (patch: Partial<Scope>) => void;
  setView: (view: State["view"]) => void;
  setListView: (listView: State["listView"]) => void;
  setTab: (tab: State["tab"]) => void;
  select: (id: string | null) => void;
  saveLayout: (group: string, layout: Layout) => void;
  /** Moves a shortlisted programme to a stage, at a place in its column. */
  moveCard: (id: string, stage: Stage, index: number) => void;
};

const insert = <T,>(list: T[], item: T, index = list.length) => [...list.slice(0, index), item, ...list.slice(index)];
const without = (board: Board, id: string) => Object.fromEntries(Object.entries(board).map(([s, ids]) => [s, ids.filter((x) => x !== id)])) as Board;

/** The board for a shortlist: its stages kept, and programmes newly shortlisted in Researching. */
export function boardFor(board: Board, shortlist: string[]): Board {
  const on = new Set(shortlist);
  const out = Object.fromEntries(Object.entries(board).map(([s, ids]) => [s, ids.filter((id) => on.has(id))])) as Board;
  const placed = new Set(Object.values(out).flat());
  out.researching = [...out.researching, ...shortlist.filter((id) => !placed.has(id))];
  return out;
}

/**
 * Where the kept state goes: the same storage as the answers (this device, or this session when
 * "remember on this device" is off). While an example student is open nothing is written, so the
 * visitor's own board stays as it was.
 */
const storage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name) ?? window.sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    const { remember, example } = usePlanStore.getState();
    if (example) return;
    try {
      (remember ? window.localStorage : window.sessionStorage).setItem(name, value);
      (remember ? window.sessionStorage : window.localStorage).removeItem(name);
    } catch {}
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
      window.sessionStorage.removeItem(name);
    } catch {}
  },
};

const MAX_AGE_MS = MAX_AGE_DAYS * 86_400_000;

export const useWorkspace = create<State & Actions>()(
  persist(
    (set) => ({
      ...DEFAULT_SCOPE,
      view: "programmes",
      listView: "unis",
      finderSort: DEFAULT_CRITERIA,
      finderTab: "all",
      tab: "quick",
      askFocus: false,
      openDetail: false,
      compare: null,
      filtersRequest: 0,
      selectedId: null,
      layouts: {},
      board: EMPTY_BOARD,
      savedAt: 0,
      hydrated: false,
      setScope: (patch) => set(patch),
      setView: (view) => set({ view, savedAt: Date.now() }),
      setListView: (listView) => set({ listView, savedAt: Date.now() }),
      setTab: (tab) => set({ tab }),
      setAskFocus: (askFocus) => set({ askFocus }),
      setOpenDetail: (openDetail) => set({ openDetail }),
      setCompare: (compare) => set({ compare }),
      requestFilters: () => set((s) => ({ filtersRequest: s.filtersRequest + 1 })),
      select: (selectedId) => set({ selectedId, savedAt: Date.now() }),
      saveLayout: (group, layout) => set((s) => ({ layouts: { ...s.layouts, [group]: layout }, savedAt: Date.now() })),
      // On the board as shown (boardFor), so places count the newly shortlisted too.
      moveCard: (id, stage, index) =>
        set((s) => {
          const board = without(boardFor(s.board, usePlanStore.getState().answers.shortlist), id);
          return { board: { ...board, [stage]: insert(board[stage], id, index) }, savedAt: Date.now() };
        }),
    }),
    {
      name: "kaplan360:workspace",
      version: 1,
      storage: createJSONStorage(() => storage),
      // Read after the first render, so the static HTML and the first client render match.
      skipHydration: true,
      partialize: (s) => ({ view: s.view, listView: s.listView, finderSort: s.finderSort, finderTab: s.finderTab, selectedId: s.selectedId, layouts: s.layouts, board: s.board, savedAt: s.savedAt }),
      // Like the answers, kept state unused for 90 days is dropped; an example student starts with an empty board.
      merge: (kept, current) => {
        const k = (kept ?? {}) as Partial<State>;
        if (!k.savedAt || Date.now() - k.savedAt > MAX_AGE_MS) return current;
        return {
          ...current,
          ...k,
          finderSort: criteriaOf(k.finderSort),
          finderTab: k.finderTab === "kaplan" ? "kaplan" : "all",
          board: usePlanStore.getState().example ? EMPTY_BOARD : { ...EMPTY_BOARD, ...k.board },
        };
      },
      onRehydrateStorage: () => () => useWorkspace.setState({ hydrated: true }),
    },
  ),
);

let started = false;

/** Reads the kept state (after the plan store, so an open example is known) and follows examples opening and closing. */
export function startWorkspaceStore() {
  if (started) return;
  started = true;
  void useWorkspace.persist.rehydrate();
  usePlanStore.subscribe((s, prev) => {
    if (s.example === prev.example) return;
    if (s.example) useWorkspace.setState({ board: EMPTY_BOARD });
    else void useWorkspace.persist.rehydrate();
  });
}
