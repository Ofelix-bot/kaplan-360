"use client";

import { CheckIcon, CircleDotIcon, FileTextIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { SOURCES } from "@/content/move.en";
import { getReadCount } from "@/lib/read-count";
import { PagesCard } from "../distance/Closing";
import { Settle } from "../Settle";
import { Overline } from "./Overline";

// Sources on the English /move (#sources), between 03 and the closing band: how every fact is checked.
// On the left the pages card that sat in 03 (../distance/Closing.tsx PagesCard, without its info tip: the
// steps say it); on the right the four steps of the homepage's "The analysis" tile (Read, Pick out,
// Match, Drop), one under the other, each on a ring joined to the next by a thin line; Drop's is red.
// Nothing else in the section.

const ICONS = [FileTextIcon, CircleDotIcon, CheckIcon, XIcon];

export function SourcesSection() {
  const t = useT();
  const locale = useIntlLocale();
  const reads = getReadCount();
  return (
    <section id="sources" aria-labelledby="sources-title" className="scroll-mt-16 bg-(--land-card) py-20 sm:py-28">
      <div className="home-wrap flex flex-col gap-10 sm:gap-14">
        <Settle className="flex flex-col gap-4">
          <Overline>{t(SOURCES.eyebrow)}</Overline>
          <h2 id="sources-title" className="m-0 min-w-0 font-heading text-[clamp(32px,4.2vw,60px)] [font-stretch:var(--display-stretch)] leading-[1.04] font-extrabold tracking-[-0.02em] text-balance wrap-break-word">
            {t(SOURCES.title)}
          </h2>
        </Settle>
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center md:gap-16">
          <PagesCard tip={false} />
          <ol className="m-0 flex list-none flex-col p-0">
            {SOURCES.steps.map((s, i) => {
              const Icon = ICONS[i];
              const drop = i === SOURCES.steps.length - 1;
              const body = t(s.body, { pages: reads.pages.total.toLocaleString(locale), api: reads.api.total.toLocaleString(locale) });
              return (
                <li key={s.title} className="relative flex gap-6 pb-8 last:pb-0">
                  {/* The thin line down to the next step's ring. */}
                  {!drop && <span aria-hidden className="absolute top-[60px] bottom-1 left-[27.5px] w-px bg-(--land-line)" />}
                  <span
                    aria-hidden
                    className={cn("flex size-14 shrink-0 items-center justify-center rounded-full border-[1.5px] border-solid bg-(--land-card)", drop ? "border-[#c0362c] text-[#c0362c] dark:border-[#f08a80] dark:text-[#f08a80]" : "border-(--brand-ink) text-(--brand-ink)")}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 pt-3">
                    <h3 className="m-0 text-[18px] leading-snug font-bold">{t(s.title)}</h3>
                    <p className="m-0 mt-2 text-[16px] leading-[1.6] text-pretty text-(--land-body)">{body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
