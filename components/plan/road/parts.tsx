"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ArrowUpRightIcon, ChevronDownIcon, CircleAlertIcon } from "lucide-react";
import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { itemWhen } from "@/lib/plan-road";
import type { Basis, PlanItem, PlanRule } from "@/lib/plan-timeline";

// Small pieces every part of /plan's road uses: the basis word, a date line, official links, the
// disclosures that keep official quotes one tap away, a key-date flag and the chevron of a row.

const BASIS = { official: "Official", typical: "Estimated", yours: "Yours" } as const;

/** A visible focus ring at full contrast (the shadcn default is half-transparent). */
export const FOCUS = "rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The day the plan was made for (the visitor's own), for items' date lines. */
export const TodayContext = createContext("");

/** An item's own date line, worded like the road's rows. */
export function useItemWhen() {
  const today = useContext(TodayContext);
  const t = useT();
  const locale = useIntlLocale();
  return (i: PlanItem) => itemWhen(i, today, { t, locale });
}

/** Official, Estimated or Yours: always shown beside a date. */
export function BasisWord({ basis }: { basis: Basis }) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-1.5 text-xs leading-[18px] font-semibold",
        basis === "official" ? "border-(--brand-ink)/40 text-(--brand-ink)" : basis === "typical" ? "border-dashed border-muted-foreground/60 text-muted-foreground" : "border-(--land-line) text-muted-foreground",
      )}
    >
      {t(BASIS[basis])}
    </span>
  );
}

/** "Jan – Jul 2029 · Estimated". */
export function When({ when, basis, className }: { when: string; basis: Basis | null; className?: string }) {
  return (
    <span className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] leading-5 font-medium text-muted-foreground tabular-nums", className)}>
      <span>{when}</span>
      {basis && <BasisWord basis={basis} />}
    </span>
  );
}

/** A key date beside a headline ("Your 6.5 expires Mar 2028"), in the readable amber. */
export function Flag({ text, basis }: { text: string; basis?: Basis }) {
  return (
    <span className="block text-[13px] leading-5 font-semibold text-pretty text-(--accent-ink)">
      <CircleAlertIcon aria-hidden className="mr-1 inline size-3.5 align-[-2.5px]" />
      {text}
      {basis && (
        <>
          {" "}
          <BasisWord basis={basis} />
        </>
      )}
    </span>
  );
}

/** The chevron at a row's end; turns when its panel is open (the trigger carries `group/row`). */
export function Chevron({ className }: { className?: string }) {
  return (
    <ChevronDownIcon
      aria-hidden
      className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-180 ease-out group-data-[panel-open]/row:rotate-180 motion-reduce:transition-none", className)}
    />
  );
}

/** A link to an official page (new tab, named after its item for screen readers), or to a page of the site. */
export function OutLink({ href, children, item, onClick, className, lang }: { href: string; children: ReactNode; item?: string; onClick?: () => void; className?: string; lang?: string }) {
  const cls = cn("text-[14px] font-medium text-(--brand-ink) underline decoration-(--brand-ink)/30 underline-offset-4 hover:decoration-(--brand-ink)", FOCUS, className);
  const label = item && <span className="sr-only">: {item}</span>;
  if (!/^https?:/.test(href))
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {children}
        {label}
      </Link>
    );
  // The arrow stays on the line of the last word (the last character in Chinese).
  const text = typeof children === "string" ? children : null;
  const cut = text ? text.lastIndexOf(" ") + 1 || Math.max(0, text.length - 1) : 0;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick} lang={lang}>
      {text ? text.slice(0, cut) : children}
      <span className="whitespace-nowrap">
        {text?.slice(cut)}
        {label}
        <ArrowUpRightIcon aria-hidden className="ml-0.5 inline size-3.5 align-[-2px]" />
      </span>
    </a>
  );
}

/** "Official page ↗" for an item's own link, "See it" for a page of the site. */
export function ItemLink({ url, item }: { url: string; item: string }) {
  const t = useT();
  return (
    <OutLink href={url} item={item}>
      {/^https?:/.test(url) ? t("Official page") : t("See it")}
    </OutLink>
  );
}

/** A label that opens what it names in place: "Aston University’s rule ▾", "What to prepare ▾". */
export function Disclosure({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <Collapsible className={className}>
      <CollapsibleTrigger className={cn("group/row inline-flex min-h-6 items-center gap-1 text-left text-[14px] font-medium text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground", FOCUS)}>
        {label}
        <Chevron className="mt-0 size-3.5" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** An official page's own words, kept as published (in English), with its link (unless the row already shows that page). */
export function RuleQuote({ rule, lead, link = true }: { rule: PlanRule; lead?: string | null; link?: boolean }) {
  const t = useT();
  return (
    <Disclosure label={rule.label}>
      <div className="flex flex-col gap-1.5 border-l-2 border-(--land-line) pl-3 text-[14px] text-(--land-body)">
        {lead && <p>{lead}</p>}
        <blockquote lang="en" className="text-pretty">
          “{rule.quote}”
        </blockquote>
        {rule.url && link && (
          <span>
            <OutLink href={rule.url} item={rule.label}>
              {t("Official page")}
            </OutLink>
          </span>
        )}
      </div>
    </Disclosure>
  );
}
