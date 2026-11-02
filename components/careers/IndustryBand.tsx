"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DRAFT } from "@/content/draft";
import { INDUSTRIES, industryName } from "@/lib/careers/industries";
import { careersHref, industryHref } from "@/lib/careers/links";
import type { IndustryMeta, Region } from "@/lib/careers/types";
import { RegionToggle } from "./RegionToggle";

// The industry page's sticky purple band (Q12, the brief's Accenture-style band; not the light SectionBand):
// under the header at --header-h, --band-h tall, on --tile-brand with .on-dark (amber focus ring). Left: the
// industry's name as the trigger of a dropdown listing all 16 industries (links, the current one marked
// aria-current="page"), plus "All industries". Right: the region toggle. On phones the dropdown spans the
// width and the region toggle folds into its foot. Not a heading: the page's only H1 is IndustryLead.

const C = DRAFT.careers;

const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--focus-ring)";

export function IndustryBand({ industry, regions }: { industry: IndustryMeta; regions: Record<Region, boolean> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const name = industryName(t, industry.short);

  return (
    <div className="on-dark sticky top-(--header-h) z-40 h-(--band-h) bg-(--tile-brand) text-white shadow-[inset_0_-1px_0_var(--tile-line)]">
      <div className="home-wrap flex h-full items-center justify-between gap-4">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            aria-label={`${t(C.band.switchTo)}: ${name}`}
            className={cn(
              "-ml-2 inline-flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-white",
              "transition-[background-color] duration-200 hover:bg-white/10 motion-reduce:transition-none",
              FOCUS,
            )}
          >
            <span className="truncate font-heading text-[17px] [font-stretch:var(--display-stretch)] leading-none font-bold sm:text-[19px]">{name}</span>
            <ChevronDownIcon
              aria-hidden
              className="size-4 shrink-0 transition-transform duration-(--motion-ui-dur) ease-(--motion-ui) in-data-[popup-open]:rotate-180 motion-reduce:transition-none"
            />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={10}
            className="w-[min(600px,var(--available-width))] gap-0 rounded-xl bg-(--land-card) p-2 text-(--text) ring-(--land-line)"
          >
            <nav aria-label={t(C.band.industries)}>
              <ul className="m-0 grid list-none grid-cols-1 gap-0.5 p-0 sm:grid-cols-2">
                {INDUSTRIES.map((i) => {
                  const here = i.id === industry.id;
                  return (
                    <li key={i.id} className="flex">
                      <Link
                        href={industryHref(i.id)}
                        aria-current={here ? "page" : undefined}
                        onClick={close}
                        className={cn(
                          "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[15px] text-(--text) no-underline",
                          "transition-[background-color] duration-150 hover:bg-(--land-ground) motion-reduce:transition-none",
                          "aria-[current=page]:font-bold aria-[current=page]:text-(--brand-ink)",
                          FOCUS,
                          "focus-visible:outline-offset-0",
                        )}
                      >
                        <span className="min-w-0">{industryName(t, i.short)}</span>
                        {here && <CheckIcon aria-hidden className="size-4 shrink-0" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-1 border-t border-solid border-(--land-line) pt-1">
                <Link
                  href={careersHref()}
                  onClick={close}
                  className={cn(
                    "flex min-h-10 items-center rounded-lg px-3 py-2 text-[15px] font-semibold text-(--brand-ink) no-underline",
                    "transition-[background-color] duration-150 hover:bg-(--land-ground) motion-reduce:transition-none",
                    FOCUS,
                    "focus-visible:outline-offset-0",
                  )}
                >
                  {t(C.band.all)}
                </Link>
              </div>
            </nav>
            {/* Phones: the region toggle lives here, at the foot of the dropdown. */}
            <div className="mt-1 flex flex-col gap-2 border-t border-solid border-(--land-line) px-3 pt-3 pb-2 md:hidden">
              <p className="m-0 text-[13px] font-semibold text-(--land-body)">{t(C.region.label)}</p>
              <RegionToggle regions={regions} tone="light" />
            </div>
          </PopoverContent>
        </Popover>

        <RegionToggle regions={regions} className="hidden justify-end md:flex" />
      </div>
    </div>
  );
}
