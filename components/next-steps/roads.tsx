"use client";

import type { CSSProperties } from "react";
import {
  ArrowUpRightIcon,
  AwardIcon,
  BadgeCheckIcon,
  BookOpenIcon,
  BriefcaseBusinessIcon,
  CalculatorIcon,
  FileCheckIcon,
  GraduationCapIcon,
  HourglassIcon,
  HouseIcon,
  IdCardIcon,
  LandmarkIcon,
  LaptopIcon,
  PresentationIcon,
  ScrollTextIcon,
  ShuffleIcon,
  SignpostIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { FOCUS } from "@/components/stand/bands";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { msg } from "@/lib/i18n/translate";
import { RULE_LABEL, sayAt, type Basis, type LeafKey, type Measure, type Msg, type RoadKey } from "@/lib/next-steps";

// What every part of /next-steps shares: each road's colour (app/[lang]/next-steps/roads.css: the chart
// tokens, with a lighter tint for the gradient tiles and the icon colour that reads on both ends), its
// icon and its leaves' icons (the map's Gap group, ./groups.ts, is drawn with the other road's), the Msg
// renderer, and the basis chip that opens a number's source.

export const ROAD_ICON: Record<RoadKey, LucideIcon> = { study: GraduationCapIcon, work: BriefcaseBusinessIcon, qualify: AwardIcon, other: SignpostIcon };

export const LEAF_ICON: Record<LeafKey, LucideIcon> = {
  "same-field": BookOpenIcon,
  conversion: ShuffleIcon,
  mba: PresentationIcon,
  ep: IdCardIcon,
  careers: TrendingUpIcon,
  home: HouseIcon,
  acca: CalculatorIcon,
  isca: LandmarkIcon,
  "cpa-australia": FileCheckIcon,
  cai: ScrollTextIcon,
  cfa: BadgeCheckIcon,
  "work-first": HourglassIcon,
  "internship-first": LaptopIcon,
};

/** A road's colours as --r (the mark), --r-tint (the gradient's light end) and --r-on (icons and words on the gradient). */
export const roadVars = (road: RoadKey) => ({ "--r": `var(--road-${road})`, "--r-tint": `var(--road-${road}-tint)`, "--r-on": `var(--road-${road}-on)` }) as CSSProperties;

/** A gradient tile in the road's colours (set roadVars on it or an ancestor). */
export const TILE = "flex shrink-0 items-center justify-center bg-linear-to-br from-(--r) to-(--r-tint) text-(--r-on)";

/** Every Msg in the page's language, months included (lib/next-steps sayAt). */
export function useSay() {
  const t = useT();
  const locale = useIntlLocale();
  return (m: Msg) => sayAt(t, locale, m);
}

/** "26 Oct 2026" from YYYY-MM-DD, in the page's language. */
export function useDay() {
  const locale = useIntlLocale();
  return (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export const KIND_LABEL: Record<Basis["kind"], string> = { official: msg("Official"), rule: RULE_LABEL, yours: msg("Your answer") };

/** The basis a measure shows first, or null ("Missing: data"). */
export const basisOf = (m: Measure): Basis | null => m.basis ?? null;

/** The words a measure carries for a screen reader and the panel. */
export function useMeasureWords() {
  const say = useSay();
  return (m: Measure) => (m.kind === "ring" ? `${say(m.shown)} ${say(m.label)}` : say(m.text));
}

/** A link out of the site, with the arrow that says so. */
export function OutLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-0.5 font-medium text-(--brand-ink) underline-offset-4 hover:underline", FOCUS, "rounded-sm", className)}>
      {children}
      <ArrowUpRightIcon aria-hidden className="size-3.5 shrink-0" />
    </a>
  );
}

/** A quote in curly marks, unless it already opens with them (quotes that hold several of the page's own). */
const quoted = (q: string) => (q.startsWith("“") ? q : `“${q}”`);

/**
 * The chip beside a number: its kind ("Official", "Estimated", "Your answer") and, on a tap, every basis
 * behind it with where on the page the words are (plain, ours), the official words verbatim and the page
 * they come from. An estimate's own rule is not spelt out (no explanatory text on the page). `aside` adds
 * the data's own English note (a professional body's facts).
 */
export function BasisChip({ bases, aside, className }: { bases: (Basis | null | undefined)[]; aside?: string | null; className?: string }) {
  const t = useT();
  const say = useSay();
  const day = useDay();
  const list = bases.filter((b): b is Basis => !!b).filter((b, i, all) => all.findIndex((c) => c.text.key === b.text.key && c.quote === b.quote) === i);
  if (!list.length) return null;
  // The chip names the kind of the first basis, and a rule wherever one is part of the number.
  const kinds = [...new Set(list.map((b) => b.kind))];
  const label = kinds.includes("rule") && kinds[0] !== "rule" ? `${t(KIND_LABEL[kinds[0]])} + ${t(RULE_LABEL)}` : t(KIND_LABEL[kinds[0]]);
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex min-h-5 max-w-full shrink-0 items-center rounded-[10px] border px-2 py-px text-left text-[11px] leading-tight font-semibold",
          kinds.includes("rule") ? "border-dashed border-(--accent-ink) text-(--accent-ink)" : "border-(--land-line) text-(--land-body)",
          FOCUS,
          className,
        )}
        aria-label={t("Basis: {basis}", { basis: label })}
      >
        <span>{label}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(360px,calc(100vw-32px))] gap-3 p-3 text-xs">
        {list.map((b, i) => (
          <div key={i} className="flex flex-col gap-1">
            <p className="font-semibold">{t(KIND_LABEL[b.kind])}</p>
            {b.kind !== "rule" && <p className="text-pretty text-(--land-body)">{say(b.text)}</p>}
            {b.path && (
              <p lang="en" className="text-pretty text-muted-foreground">
                {b.path}
              </p>
            )}
            {b.quote && (
              <blockquote lang="en" className="border-l-2 border-(--land-line) pl-2 text-pretty text-(--land-body)">
                {quoted(b.quote)}
              </blockquote>
            )}
            {(b.url || b.read) && (
              <p className="flex flex-wrap items-center gap-x-3 text-muted-foreground">
                {b.url && <OutLink href={b.url}>{t("Official page")}</OutLink>}
                {b.read && <span>{t("Read {date}", { date: day(b.read) })}</span>}
              </p>
            )}
          </div>
        ))}
        {aside && (
          <p lang="en" className="border-t border-(--land-line) pt-2 text-pretty text-(--land-body)">
            {aside}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Kaplan's partner universities as the page's badge names them ("Kaplan × UCD"). */
const SHORT_UNIVERSITY: Record<string, string> = {
  "University College Dublin": "UCD",
  "Murdoch University": "Murdoch",
  "Northumbria University at Newcastle": "Northumbria",
  "Birmingham City University": "BCU",
  "University of Portsmouth": "Portsmouth",
  "Monash University": "Monash",
};
export const shortUniversity = (name: string) => SHORT_UNIVERSITY[name] ?? name;
