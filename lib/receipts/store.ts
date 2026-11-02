import { create } from "zustand";
import type { ReceiptView } from "./model";

// The one receipt drawer of the site (components/shared/receipt/ReceiptDrawer.tsx): which receipts it shows,
// which one is in front and the group's title. Footnotes, source lists and chips call show(); the drawer
// mounted by ReceiptHost reads it. Nothing here is saved: it lasts as long as the page.

export type ReceiptDrawerOpen = { views: ReceiptView[]; focus: number; title?: string };

type ReceiptDrawerState = {
  open: ReceiptDrawerOpen | null;
  /** Opens the drawer on `views`, with `views[focus]` in front. An empty list closes it. */
  show: (views: ReceiptView[], focus?: number, title?: string) => void;
  close: () => void;
};

export const useReceiptDrawer = create<ReceiptDrawerState>()((set) => ({
  open: null,
  show: (views, focus = 0, title) =>
    set({ open: views.length ? { views, focus: Math.min(Math.max(0, focus), views.length - 1), ...(title ? { title } : {}) } : null }),
  close: () => set({ open: null }),
}));

type ReceiptHostState = {
  /** Mounted ReceiptHost instances, first mounted first: only hosts[0] renders the drawer. */
  hosts: string[];
  claim: (id: string) => void;
  release: (id: string) => void;
};

/** Keeps ReceiptHost idempotent: a second instance (a page's ReceiptsSheet beside the layout's host) renders nothing. */
export const useReceiptHosts = create<ReceiptHostState>()((set) => ({
  hosts: [],
  claim: (id) => set((s) => (s.hosts.includes(id) ? s : { hosts: [...s.hosts, id] })),
  release: (id) => set((s) => ({ hosts: s.hosts.filter((h) => h !== id) })),
}));
