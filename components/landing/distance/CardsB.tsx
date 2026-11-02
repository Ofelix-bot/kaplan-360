"use client";

import type { ReactNode } from "react";
import { BriefcaseIcon, GlobeIcon, GraduationCapIcon, PauseCircleIcon, ShuffleIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { StillChip } from "@/components/shared/StatusChip";
import { CARDS, type Door } from "@/content/landing.en";
import { DRAFT } from "@/content/draft";
import { DRAWER } from "@/content/move.en";
import type { RoadId } from "@/content/roads.en";
import { receiptsOf } from "@/lib/home/receipts";
import { DrawerPart } from "../move/MoveDrawer";
import { ReceiptChip } from "../receipts";

// The six doors the visitor's degree opens (CARDS.rows), once 01 Look's cards, now listed in the drawer
// of their road on /move (components/landing/roads/RoadCard.tsx): a better-ranked school, a different
// field and a different country under Study; work first under Work; a year to breathe under Gap. Each
// door shows its icon, kind and name, what it holds, a receipt chip that opens the sources and, where a
// part has no receipt yet, "Still to check". Kicker is the small first line of a card's heading, shared
// with the roads.

/** The icon of each kind of door. */
const DOOR: Record<Door, LucideIcon> = {
  school: GraduationCapIcon,
  field: ShuffleIcon,
  region: GlobeIcon,
  work: BriefcaseIcon,
  breathe: PauseCircleIcon,
};

/** The road whose drawer holds each kind of door. */
export const DOOR_ROAD: Record<Door, Exclude<RoadId, "qualify">> = {
  school: "study",
  field: "study",
  region: "study",
  work: "work",
  breathe: "gap",
};

/** Per door, in CARDS.rows order: receipts behind what it says when they differ from the row's. The year to breathe has its ACCA and CFA sentences. */
const RECEIPTS: (string[] | undefined)[] = [undefined, undefined, undefined, undefined, undefined, ["acca-faq", "cfa-policy"]];

/** The heading's first line: the kind of door, in the body face, one step smaller, sentence case, untracked. */
export function Kicker({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("mb-2 block font-sans text-[13px] leading-5 font-semibold tracking-normal [font-stretch:100%]", className)}>{children}</span>;
}

/** The doors of one road, for its drawer. Nothing when the road has none. */
export function DoorList({ road }: { road: RoadId }) {
  const t = useT();
  const rows = CARDS.rows.map((row, i) => ({ row, i })).filter(({ row }) => DOOR_ROAD[row.door] === road);
  if (!rows.length) return null;
  return (
    <DrawerPart title={t(DRAWER.doors)}>
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map(({ row, i }) => (
          <DoorItem key={row.kind} index={i} {...row} />
        ))}
      </ul>
    </DrawerPart>
  );
}

function DoorItem({ index, door, kind, name, tag, check, receipts }: { index: number; door: Door; kind: string; name: string; tag?: string; check?: string; receipts: string[] }) {
  const t = useT();
  const Icon = DOOR[door];
  const ids = receiptsOf(RECEIPTS[index] ?? receipts).map((r) => r.id);
  const title = `${t(kind)} — ${t(name)}`;
  return (
    <li className="flex gap-3 border-0 border-t border-solid border-border py-3 first:border-t-0 first:pt-0">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-(--brand-ink)" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[13px] leading-snug font-semibold text-muted-foreground">{t(kind)}</span>
        <span className="text-[15px] leading-snug font-bold text-balance">{t(name)}</span>
        <span className="text-[13px] leading-snug text-pretty text-muted-foreground">
          {tag && <span className="font-semibold text-foreground">{t(tag)}. </span>}
          {t(DRAFT.move.doors[index])}
        </span>
        {(ids.length > 0 || check) && (
          <span className="mt-1 flex flex-wrap items-center gap-2">
            {ids.length > 0 && <ReceiptChip ids={ids} title={title} />}
            {check && <StillChip label={check} />}
          </span>
        )}
      </div>
    </li>
  );
}
