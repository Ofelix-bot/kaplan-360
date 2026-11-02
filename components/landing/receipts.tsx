"use client";

import { useMemo } from "react";
import { BadgeCheckIcon, NewspaperIcon, UserRoundSearchIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Quote, ReceiptFull, ReceiptHost, ShotFrame, SourceChip, useDay, useSourceName } from "@/components/shared/receipt";
import shotsFile from "@/data/raw/receipt-shots.json";
import { RECEIPTS, receiptsOf, type Receipt, type ReceiptKind } from "@/lib/home/receipts";
import { msg } from "@/lib/i18n/translate";
import { REVEAL, transitions } from "@/lib/motion";
import { fromRegistry } from "@/lib/receipts/model";

// Receipts: the sentence behind a rule, as the official page has it. Since the receipt redesign (plan §4,
// decisions Q18 and C6) every export here is a thin wrapper over the shared receipt UI in
// components/shared/receipt, with the same names and props as before: a chip is a SourceChip, the sheet is
// the one ReceiptHost drawer, a card is the full receipt.

export { Quote, useDay, useSourceName };

type Shot = { id: string; status: string; checked: string; file?: string; width?: number; height?: number };
const SHOTS = new Map((shotsFile as { shots: Shot[] }).shots.map((s) => [s.id, s]));

/** The photo of a receipt's sentence on its page, if there is one. */
export const shotOf = (id: string) => {
  const s = SHOTS.get(id);
  return s?.file && s.width && s.height ? { src: s.file, width: s.width, height: s.height } : null;
};

/** When the quote was last found on its page (the check's date), else when it was read. */
export const checkedOn = (r: Receipt) => {
  const s = SHOTS.get(r.id);
  return s?.status === "found" ? s.checked : r.read;
};

export const RECEIPT_KIND: Record<ReceiptKind, { label: string; check: string; icon: typeof BadgeCheckIcon; className: string }> = {
  official: { label: msg("Official page"), check: msg("Copied word for word"), icon: BadgeCheckIcon, className: "bg-success/12 text-success" },
  reported: { label: msg("Report of an official notice"), check: msg("Not the notice itself"), icon: NewspaperIcon, className: "bg-amber/20 text-amber-ink" },
  person: { label: msg("Checked by a person"), check: msg("Read and transcribed by a person"), icon: UserRoundSearchIcon, className: "bg-info/12 text-info" },
};

/** A photo that shows a placeholder of its own shape until it has loaded. */
export function ShotImage({ id, sizes, className, priority = false }: { id: string; sizes: string; className?: string; priority?: boolean }) {
  const shot = shotOf(id);
  if (!shot) return null;
  return <ShotFrame shot={shot} sizes={sizes} className={className} priority={priority} />;
}

/**
 * The chip under a rule: its sources and how many receipts. Click opens them all in the drawer; resting on
 * it previews the first. On the indigo bands use tone "brand".
 */
export function ReceiptChip({ ids, title, label, tone = "light", className }: { ids: string[]; title?: string; label?: string; tone?: "light" | "brand"; className?: string }) {
  const views = receiptsOf(ids).map(fromRegistry);
  if (!views.length) return null;
  return <SourceChip views={views} label={label} title={title} tone={tone} className={className} />;
}

/** One receipt in full: what it's about, the quote (or why there's none), the check's steps and the source. */
export function ReceiptCard({ receipt, index = 0, withPhoto = true }: { receipt: Receipt; index?: number; withPhoto?: boolean }) {
  const reduce = useReducedMotion();
  const view = useMemo(() => fromRegistry(receipt), [receipt]);
  return (
    <motion.article
      id={`receipt-${receipt.id}`}
      initial={reduce ? false : { opacity: 0, y: REVEAL.y / 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.ui, delay: reduce ? 0 : 0.04 + index * 0.05 }}
      className="relative overflow-hidden rounded-xl border bg-card"
    >
      <ReceiptFull view={view} frame="card" withPhoto={withPhoto} />
    </motion.article>
  );
}

/**
 * The receipts drawer. It is now the site's one ReceiptHost (right-side on every screen size): pages that
 * still render it get the drawer until the layout mounts its own host, after which this renders nothing.
 */
export function ReceiptsSheet() {
  return <ReceiptHost />;
}

export const ALL_RECEIPTS = Object.values(RECEIPTS);
