"use client";

import { useState } from "react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { useReceiptDrawer } from "@/lib/receipts/store";
import { ReceiptHoverPopup } from "./ReceiptHoverCard";
import { useReceiptSection } from "./ReceiptSection";
import { FOCUS, R, useViewText } from "./text";

// The footnote numeral beside a figure (decisions Q18). Resting on it opens the receipt card after 350ms
// (closing 120ms after the pointer leaves); a tap or a click opens it too, so it works on phones. "View the
// page" in the card opens the drawer on this section's receipts with this one in front. Outside a
// ReceiptSection, or for an id the section does not list, it renders nothing. Its size follows the text
// up to 13px, so beside a big figure it stays a footnote and is not read as another digit.

export function Fn({ id, className }: { id: string; className?: string }) {
  const t = useT();
  const text = useViewText();
  const section = useReceiptSection();
  const show = useReceiptDrawer((s) => s.show);
  const [open, setOpen] = useState(false);
  const i = section?.index.get(id);
  if (!section || i == null) return null;
  const view = section.views[i];
  const n = i + 1;
  const words = text(view);
  return (
    <sup className={cn("ml-0.5 align-super text-[length:min(0.62em,0.8125rem)] leading-none", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          openOnHover
          delay={350}
          closeDelay={120}
          aria-label={t(R.source, { n, publisher: words.publisher, title: words.title })}
          className={cn(
            "inline-flex h-[1.6em] min-w-[1.6em] cursor-pointer items-center justify-center rounded-[0.35em] bg-current/10 px-[0.35em] font-semibold text-inherit tabular-nums hover:bg-current/20 data-popup-open:bg-current/20",
            FOCUS,
          )}
        >
          {n}
        </PopoverTrigger>
        <ReceiptHoverPopup
          view={view}
          onView={() => {
            setOpen(false);
            show(section.views, i, section.title);
          }}
        />
      </Popover>
    </sup>
  );
}
