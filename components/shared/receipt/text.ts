"use client";

import { CheckIcon, ImageIcon, NewspaperIcon, ScaleIcon, UserRoundSearchIcon } from "lucide-react";
import { DRAFT } from "@/content/draft";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { RECEIPTS, SOURCES, UNIVERSITY_SOURCES, type SourceId } from "@/lib/home/receipts";
import { msg } from "@/lib/i18n/translate";
import type { ReceiptView } from "@/lib/receipts/model";

// What every part of the receipt UI says about a ReceiptView: its dates, its source's names in the page's
// language, and its match line. Copy comes from DRAFT.careers.receipt; the few strings below are the drawer's
// "Picked out" step per quote kind (see the builder's note: they belong in DRAFT.careers.receipt).

export const R = DRAFT.careers.receipt;

/** The drawer's "Picked out" step when the receipt names no table, sheet or page. */
export const PICKED: Record<ReceiptView["quoteKind"], string> = {
  sentence: msg("The sentence"),
  "table-row": msg("The table row"),
  "table-text": msg("The table text"),
  "table-image": msg("The table, read from the image"),
  "xlsx-row": msg("The spreadsheet row"),
  "chart-label": msg("The chart label"),
  "infographic-label": msg("The infographic label"),
  rule: msg("The rule as written"),
};

/** Shared classes: the focus ring (instant, no transition) and the icon nudge inside a hovered link. */
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)";
export const NUDGE =
  "[&_svg]:transition-transform [&_svg]:duration-(--motion-ui-dur) [&_svg]:ease-(--motion-ui) hover:[&_svg]:translate-x-0.5 focus-visible:[&_svg]:translate-x-0.5 motion-reduce:[&_svg]:transition-none motion-reduce:hover:[&_svg]:translate-x-0 motion-reduce:focus-visible:[&_svg]:translate-x-0";

const ISO = /^\d{4}(-\d{2}){0,2}$/;

/** Formats an ISO date ("2026-10", "2026-10-21", or a bare year) in the page's language; anything else is shown as printed. */
export function useDay() {
  const locale = useIntlLocale();
  return (iso: string) => {
    if (!ISO.test(iso)) return iso;
    if (iso.length === 4) return new Date(`${iso}-01-01T00:00:00`).toLocaleDateString(locale, { year: "numeric" });
    return new Date(`${iso.length === 7 ? `${iso}-01` : iso}T00:00:00`).toLocaleDateString(
      locale,
      iso.length === 7 ? { month: "short", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" },
    );
  };
}

/** A source's short label and full name in the page's language. */
export function useSourceName() {
  const t = useT();
  const names = useSiteNames();
  return (id: SourceId) => {
    const s = SOURCES[id];
    return UNIVERSITY_SOURCES.has(id) ? { label: t(s.label), name: names.school(s.name).name } : { label: t(s.label), name: t(s.name) };
  };
}

/** `lang` for a string shown as `shown`: inherit when it was translated, else the language it is written in. */
export function langOf(original: string, shown: string = original): string | undefined {
  if (shown !== original) return undefined;
  return /[一-鿿]/.test(original) ? "zh" : "en";
}

export type ViewText = {
  /** The publisher's full name. */
  publisher: string;
  /** Its short label (a registry source's label, else the full name). */
  short: string;
  title: string;
  context: string | null;
  note: string | null;
  lang: { publisher?: string; title?: string; note?: string };
};

/** A view's words in the page's language. Registry receipts take their source's localised names. */
export function useViewText() {
  const t = useT();
  const source = useSourceName();
  return (v: ReceiptView): ViewText => {
    const reg = RECEIPTS[v.id];
    const names = reg && reg.sourceTitle === v.title ? source(reg.source) : null;
    const publisher = names ? names.name : t(v.publisher);
    const title = t(v.title);
    const note = v.note ? t(v.note) : null;
    return {
      publisher,
      short: names ? names.label : publisher,
      title,
      context: v.context ? t(v.context) : null,
      note,
      lang: {
        publisher: names ? undefined : langOf(v.publisher, publisher),
        title: langOf(v.title, title),
        note: v.note && note ? langOf(v.note, note) : undefined,
      },
    };
  };
}

export type MatchLine = { label: string; icon: typeof CheckIcon; checked: boolean };

/** The match line: word for word / cell by cell / read from the page image / our rule; a report or a transcription says so instead. */
export function useMatchLine() {
  const t = useT();
  return (v: ReceiptView): MatchLine => {
    if (v.kind === "reported") return { label: t(R.reported), icon: NewspaperIcon, checked: false };
    if (v.kind === "person") return { label: t(R.person), icon: UserRoundSearchIcon, checked: false };
    switch (v.match) {
      case "word-for-word":
        return { label: t(R.matched), icon: CheckIcon, checked: true };
      case "row":
        return { label: t(R.matchedRow), icon: CheckIcon, checked: true };
      case "page-image":
        return { label: t(R.pageImage), icon: ImageIcon, checked: false };
      default:
        return { label: t(R.rule), icon: ScaleIcon, checked: false };
    }
  };
}
