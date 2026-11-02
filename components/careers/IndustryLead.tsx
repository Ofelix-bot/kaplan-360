"use client";

import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { DRAFT } from "@/content/draft";
import { hasIndustryHead } from "@/lib/careers/art";
import { industryById, industryName } from "@/lib/careers/industries";
import { IndustryArt } from "./art/IndustryArt";

// The industry page's only H1 (Q12): one sentence per industry from the draft copy, no figures, in Archivo
// at its expanded width. The size follows the lead's own width (container units), so the longest lead holds
// two lines from tablet width up. The industry's name opens the heading for screen readers only: the purple
// band above already shows it. A client component because it renders inside IndustryPage's client tree;
// it is server-rendered there like the rest. The industry's line drawing (plan §C) sits right of the
// headline from 720px, under it on phones (at most 420px, centred); the size still follows the whole row.

export function IndustryLead({ industryId }: { industryId: string }) {
  const t = useT();
  const industry = industryById(industryId);
  const lead = DRAFT.careers.leads[industryId];
  const art = hasIndustryHead(industryId);
  return (
    <div className="home-wrap pt-14 pb-14 sm:pt-20 sm:pb-20">
      <div
        className={cn(
          "@container",
          art ? "grid items-center gap-8 min-[720px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] min-[720px]:gap-10" : "max-w-[1100px]",
        )}
      >
        <h1 className="m-0 min-w-0 font-heading text-[clamp(30px,3.9cqi,56px)] [font-stretch:var(--display-stretch)] leading-[1.08] font-bold tracking-[-0.02em] text-balance wrap-break-word text-(--text)">
          {lead ? (
            <>
              {industry && <span className="sr-only">{industryName(t, industry.short)}: </span>}
              {t(lead)}
            </>
          ) : (
            <span lang="en">{industry?.sector ?? industryId}</span>
          )}
        </h1>
        {art && <IndustryArt industryId={industryId} className="w-full max-w-[420px] justify-self-center min-[720px]:max-w-none" />}
      </div>
    </div>
  );
}
