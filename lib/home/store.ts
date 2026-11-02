import { create } from "zustand";
import { ARJUN_BUDGET, DEFAULT_PRIORITIES, type PriorityId } from "./content";

// What the homepage's sections share while it is open: the receipts being read, the rule opened or
// selected, the order of what matters, Arjun's budget in the fine print and the overlays. The student's
// own answers (level, pass, course end) stay in the plan store (lib/workspace/plan-store.ts). Nothing
// here is saved: it lasts as long as the page.

type HomeState = {
  /** The receipts sheet: which receipts, under what title. */
  receipts: { ids: string[]; title: string | null } | null;
  showReceipts: (ids: string[], title?: string | null) => void;
  closeReceipts: () => void;

  /** The rule opened as a dialog. */
  openRule: string | null;
  setOpenRule: (id: string | null) => void;

  /** Rules picked with a box, Ctrl/⌘-click or their checkboxes. */
  selected: string[];
  setSelected: (ids: string[]) => void;
  toggleSelected: (id: string) => void;

  priorities: PriorityId[];
  setPriorities: (p: PriorityId[]) => void;

  /** Arjun's yearly budget in the fine print (S$), edited in place. */
  budget: number;
  setBudget: (n: number) => void;

  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;

  /** The receipt photo opened from the gallery. */
  lightbox: string | null;
  setLightbox: (id: string | null) => void;

  /** The example student whose card is open. */
  student: string | null;
  setStudent: (id: string | null) => void;
};

export const useHome = create<HomeState>()((set) => ({
  receipts: null,
  showReceipts: (ids, title = null) => set({ receipts: ids.length ? { ids, title } : null }),
  closeReceipts: () => set({ receipts: null }),

  openRule: null,
  setOpenRule: (openRule) => set({ openRule }),

  selected: [],
  setSelected: (selected) => set({ selected }),
  toggleSelected: (id) => set((s) => ({ selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id] })),

  priorities: DEFAULT_PRIORITIES,
  setPriorities: (priorities) => set({ priorities }),

  budget: ARJUN_BUDGET,
  setBudget: (budget) => set({ budget }),

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  lightbox: null,
  setLightbox: (lightbox) => set({ lightbox }),

  student: null,
  setStudent: (student) => set({ student }),
}));
