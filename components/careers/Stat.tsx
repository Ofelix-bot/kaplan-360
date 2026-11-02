"use client";

import { useT } from "@/components/i18n/I18nProvider";
import { Fn } from "@/components/shared/receipt";
import type { IndustryNowStat } from "@/lib/careers/types";
import { FigureText } from "./FigureText";

// One "<Industry> now" figure (Q12): a short amber dash (32×3, --accent), the value in the source's words
// (FigureText sets the number large and its words small, so "4.3 per cent" stays on one line), a one-line
// label (at most 30 characters, sentence case, untracked) and its footnote numeral.
// Rendered inside IndustryNow's ReceiptSection, which numbers the Fn. A list item: IndustryNow wraps the
// stats in a <ul>. Data labels keep lang="en" until a translation exists.

export function Stat({ stat }: { stat: IndustryNowStat }) {
  const t = useT();
  const translated = t.has(stat.label);
  return (
    <li className="flex min-w-0 flex-col">
      <span aria-hidden className="block h-[3px] w-8 bg-(--accent)" />
      <p className="m-0 mt-5 flex min-w-0 items-start font-heading text-[clamp(36px,4.2vw,56px)] [font-stretch:var(--display-stretch)] leading-none font-bold tracking-[-0.02em] tabular-nums">
        <FigureText value={stat.fact.value} className="min-w-0" />
        <span className="ml-1 shrink-0 font-sans text-[22px] leading-none font-semibold tracking-normal [font-stretch:normal]">
          <Fn id={stat.factId} />
        </span>
      </p>
      <p className="m-0 mt-3 text-[15px] leading-[1.4] text-pretty text-(--land-night-body)" lang={translated ? undefined : "en"}>
        {t(stat.label)}
      </p>
    </li>
  );
}
