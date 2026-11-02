"use client";

import { useEffect, useId } from "react";
import { RECEIPTS, receiptsOf } from "@/lib/home/receipts";
import { useHome } from "@/lib/home/store";
import { fromRegistry } from "@/lib/receipts/model";
import { useReceiptDrawer, useReceiptHosts } from "@/lib/receipts/store";
import { ReceiptDrawer } from "./ReceiptDrawer";

// The site's one receipt drawer plus the bridge from the homepage store: callers that still call
// useHome().showReceipts(ids, title) (CardsB, Check, ReceiptsTicker, the v1 landing) open the shared drawer
// on those registry receipts. Idempotent: only the first mounted instance renders, so the layout's host and
// a page's ReceiptsSheet never open two drawers (also across pages kept in an Activity).

function HomeBridge() {
  const pending = useHome((s) => s.receipts);
  const closeHome = useHome((s) => s.closeReceipts);
  const show = useReceiptDrawer((s) => s.show);
  useEffect(() => {
    if (!pending) return;
    const views = receiptsOf(pending.ids).map(fromRegistry);
    show(views, 0, pending.title ?? undefined);
    closeHome();
  }, [pending, show, closeHome]);
  return null;
}

export function ReceiptHost() {
  const id = useId();
  const claim = useReceiptHosts((s) => s.claim);
  const release = useReceiptHosts((s) => s.release);
  const owner = useReceiptHosts((s) => s.hosts[0] === id);
  useEffect(() => {
    claim(id);
    return () => release(id);
  }, [id, claim, release]);
  if (!owner) return null;
  return (
    <>
      <HomeBridge />
      <ReceiptDrawer />
    </>
  );
}

/** Registry receipts as views, for client callers that hold ids (unknown ids are dropped). */
export const registryViews = (ids: readonly string[]) => receiptsOf(ids).map(fromRegistry);

/** Whether an id names a registry receipt. */
export const isRegistryId = (id: string) => Object.hasOwn(RECEIPTS, id);
