"use client";

import { ReceiptTextIcon, UserRoundSearchIcon } from "lucide-react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { PreviewCard, PreviewCardContent, PreviewCardTrigger } from "@/components/ui/preview-card";
import type { ReceiptView } from "@/lib/receipts/model";
import { useReceiptDrawer } from "@/lib/receipts/store";
import { ReceiptHoverCard } from "./ReceiptHoverCard";
import { FOCUS, R, useViewText } from "./text";

// The compact receipt for the old chip slots (ReceiptChip in components/landing/receipts.tsx): the sources'
// short names and how many receipts. Resting on it previews the first receipt's card; a click or a tap opens
// the drawer on all of them. On the indigo and dark bands use tone "brand".

export function SourceChip({
  views,
  label,
  title,
  tone = "light",
  className,
  onOpen,
}: {
  views: ReceiptView[];
  label?: string;
  /** What the receipts are for: the drawer's title and the chip's accessible name. */
  title?: string;
  tone?: "light" | "brand";
  className?: string;
  /** Replaces opening the drawer. */
  onOpen?: () => void;
}) {
  const t = useT();
  const locale = useIntlLocale();
  const text = useViewText();
  const show = useReceiptDrawer((s) => s.show);
  if (!views.length) return null;
  const names = [...new Set(views.map((v) => text(v).short))];
  const counted = !label && names.length > 3;
  const shown = label ?? (counted ? t(R.count, { n: views.length }) : new Intl.ListFormat(locale, { style: "short", type: "unit" }).format(names));
  const first = views[0];
  const Icon = views.every((v) => v.kind === "person") ? UserRoundSearchIcon : ReceiptTextIcon;
  const name = title ?? shown;
  const aria = views.length === 1 ? t("Show the receipt for {title}", { title: name }) : t("Show {n} receipts for {title}", { n: views.length, title: name });
  return (
    <PreviewCard>
      <PreviewCardTrigger
        href={`#receipt-${first.id}`}
        delay={350}
        closeDelay={120}
        aria-label={aria}
        onClick={(e) => {
          e.preventDefault();
          if (onOpen) onOpen();
          else show(views, 0, title);
        }}
        className={cn(
          "inline-flex h-7 w-fit shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[0.75rem] font-medium whitespace-nowrap [&_svg]:size-3.5",
          tone === "brand" ? "on-dark border-white/30 text-white hover:border-white/60 hover:bg-white/10" : "border-foreground/15 bg-background text-foreground hover:border-foreground/40 hover:bg-muted",
          FOCUS,
          className,
        )}
      >
        <Icon aria-hidden />
        {shown}
        {views.length > 1 && !counted && (
          <span aria-hidden className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-current/12 px-1 text-[0.68rem] tabular-nums">
            {views.length}
          </span>
        )}
      </PreviewCardTrigger>
      <PreviewCardContent className="w-80 max-w-[calc(100vw-2rem)] duration-(--motion-ui-dur) ease-(--motion-ui) motion-reduce:transition-opacity">
        <ReceiptHoverCard view={first} />
      </PreviewCardContent>
    </PreviewCard>
  );
}
