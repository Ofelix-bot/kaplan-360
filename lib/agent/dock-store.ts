import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PageContext } from "@/lib/agent/types";

// The adviser's right-hand dock (components/agent/AdviserDock.tsx): open or closed and its width, kept in this
// browser, and the page it was opened on. A page that offers the adviser says so with <AdviserContext page=…/>; a
// page that doesn't (the homepage, /move) leaves `context` null and the dock stays shut there.

export const DOCK_MIN = 360;
export const DOCK_MAX = 560;
export const DOCK_DEFAULT = 420;
/** The dock shows from this width up; below it the adviser opens as its own page (/adviser). */
export const DOCK_FROM = 1024;

type DockState = {
  open: boolean;
  width: number;
  context: PageContext | null;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setContext: (context: PageContext | null) => void;
};

export const useDock = create<DockState>()(
  persist(
    (set) => ({
      open: false,
      width: DOCK_DEFAULT,
      context: null,
      setOpen: (open) => set({ open }),
      setWidth: (width) => set({ width: Math.round(Math.min(DOCK_MAX, Math.max(DOCK_MIN, width))) }),
      setContext: (context) => set({ context }),
    }),
    { name: "kaplan360:adviser-dock", partialize: (s) => ({ open: s.open, width: s.width }), skipHydration: true },
  ),
);

let hydrated = false;
/** Reads the stored open state and width; call after the first render. */
export function startDock() {
  if (hydrated) return;
  hydrated = true;
  void useDock.persist.rehydrate();
}

/** True when the dock can show: a wide screen and a page that offers the adviser. */
export const dockable = (context: PageContext | null) =>
  !!context && context.page !== "adviser" && typeof window !== "undefined" && window.matchMedia(`(min-width: ${DOCK_FROM}px)`).matches;
