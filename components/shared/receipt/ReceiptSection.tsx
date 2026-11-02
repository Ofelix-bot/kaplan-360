"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { uniqueViews, type ReceiptView } from "@/lib/receipts/model";

// Numbers a section's receipts 1..n in the order the server passed them (duplicates dropped), so the
// static HTML and the client agree. Every Fn inside reads its numeral from here; the section's SourceList
// lists the same views in the same order. Numbering restarts in each section.

export type ReceiptSectionValue = {
  views: ReceiptView[];
  index: ReadonlyMap<string, number>;
  /** The drawer's title when it is opened from this section. */
  title?: string;
};

const SectionCtx = createContext<ReceiptSectionValue | null>(null);

export function ReceiptSection({ receipts, title, children }: { receipts: ReceiptView[]; title?: string; children: ReactNode }) {
  const value = useMemo<ReceiptSectionValue>(() => {
    const views = uniqueViews(receipts);
    return { views, index: new Map(views.map((v, i) => [v.id, i])), ...(title ? { title } : {}) };
  }, [receipts, title]);
  return <SectionCtx.Provider value={value}>{children}</SectionCtx.Provider>;
}

/** The enclosing section's receipts, or null outside one. */
export const useReceiptSection = () => useContext(SectionCtx);

/** The footnote numeral (1-based) of a receipt in the enclosing section, or null. */
export function useReceiptNumber(id: string): number | null {
  const i = useContext(SectionCtx)?.index.get(id);
  return i == null ? null : i + 1;
}
