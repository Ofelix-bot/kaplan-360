"use client";

import { BriefcaseBusinessIcon, FlameIcon, GraduationCapIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Fn } from "@/components/shared/receipt";
import { DRAFT } from "@/content/draft";
import { exampleHref, openExampleNow } from "@/lib/example-link";
import { breakable } from "@/lib/careers/industries";
import { industryHref } from "@/lib/careers/links";
import type { Industry } from "@/lib/careers/types";

// The entry page's 16 industries (Q23), as cards in 2 / 3 / 4 columns. The student's own industries
// (those their degree links to) come first, in their link order, marked "Your degree leads here"; the rest
// follow the map's order. Each card's title is a stretched link to the industry page; its count
// ("{n} hot roles", Kaplan 360++'s count, footnoted) sits above the link. An industry with no hot role
// shows its entry and early-career roles instead (footnoted to that rule).

const C = DRAFT.careers;

/** The rule receipt ids the cards use (build-spec §2). The section's ReceiptSection lists both. */
export const GRID_RULES = { hot: "rule:count:hot", entry: "rule:entry-roles" } as const;

export function IndustryGrid({
  industries,
  mine,
  hotCounts,
  example = null,
  className,
}: {
  industries: Industry[];
  /** The student's industry ids, in link order. */
  mine: string[];
  /** Hot roles per industry id. */
  hotCounts: Record<string, number>;
  /** The open example's id: the cards then carry ?example= and open it on click. */
  example?: string | null;
  className?: string;
}) {
  const t = useT();
  const rank = new Map(mine.map((id, i) => [id, i]));
  const sorted = [...industries].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99) || a.sortOrder - b.sortOrder);

  return (
    <ul className={cn("m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4", className)}>
      {sorted.map((i) => {
        const yours = rank.has(i.id);
        const hot = hotCounts[i.id] ?? 0;
        const path = industryHref(i.id);
        return (
          <li key={i.id} className="min-w-0">
            <article
              className={cn(
                "relative flex h-full min-w-0 flex-col gap-3 rounded-2xl border bg-(--land-card) p-4 transition-[translate,border-color] duration-(--motion-ui-dur) ease-(--motion-ui) hover:-translate-y-0.5 hover:border-(--brand-ink) motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-5",
                yours ? "border-(--brand-ink)" : "border-(--land-line)",
              )}
            >
              {yours && (
                <p className="m-0 inline-flex items-center gap-1.5 self-start rounded-full bg-(--tile-brand) px-2.5 py-1 text-[12px] leading-none font-semibold text-white">
                  <GraduationCapIcon aria-hidden className="size-3.5 shrink-0 text-(--accent)" />
                  {t(C.entry.yours)}
                </p>
              )}
              <h3 className="m-0 min-w-0 font-heading text-[17px] leading-tight font-bold text-balance wrap-break-word text-(--text) sm:text-[19px]">
                <Link
                  href={example ? exampleHref(path, example) : path}
                  onClick={example ? () => openExampleNow(example) : undefined}
                  lang="en"
                  className="text-inherit no-underline outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-(--focus-ring)"
                >
                  {breakable(i.short)}
                </Link>
              </h3>
              <p className="relative z-10 m-0 mt-auto inline-flex items-center gap-1.5 self-start text-[14px] leading-snug text-(--land-body)">
                {hot > 0 ? (
                  <>
                    <FlameIcon aria-hidden className="size-4 shrink-0 text-(--accent-ink)" />
                    {hot === 1 ? t(C.entry.hotCountOne) : t(C.entry.hotCount, { n: hot })}
                    <Fn id={GRID_RULES.hot} />
                  </>
                ) : (
                  <>
                    <BriefcaseBusinessIcon aria-hidden className="size-4 shrink-0" />
                    {i.entryRoleCount === 1 ? t(C.entry.roleCountOne) : t(C.entry.roleCount, { n: i.entryRoleCount })}
                    <Fn id={GRID_RULES.entry} />
                  </>
                )}
              </p>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
