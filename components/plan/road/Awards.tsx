"use client";

import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { RoadAward, RoadAwards, RoadAwardSection } from "@/lib/plan-road";
import { Chevron, Disclosure, FOCUS, OutLink, When } from "./parts";

// Scholarships inside the stop of the application they go with: one closed row per university (how
// many awards, the largest), opening in place to its awards by date, then those with no date, then the
// automatic ones. Rounds that have passed wait behind "{n} closed", for next year's reference. Titles,
// values and "What to prepare" are the pages' own (English by design).

export function Awards({ groups }: { groups: RoadAwards[] }) {
  const t = useT();
  return (
    <section className="flex flex-col">
      <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{t("Scholarships")}</h3>
      <ul className="mt-1 divide-y divide-(--land-line)">
        {groups.map((g) => (
          <li key={g.university}>
            <AwardGroup group={g} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AwardGroup({ group: g }: { group: RoadAwards }) {
  const t = useT();
  return (
    <Collapsible className="py-2.5">
      <CollapsibleTrigger className={cn("group/row flex w-full items-start gap-3 text-left", FOCUS)}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] leading-snug font-medium text-foreground">{g.university}</span>
          <span className="text-[13px] leading-5 text-muted-foreground">{g.count ? g.summary : t("{n} closed", { n: g.closed.length })}</span>
        </span>
        <Chevron />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2.5 flex flex-col gap-4 border-l-2 border-(--land-line) pl-3">
          {g.open.map((s) => (
            <Section key={s.kind} section={s} said={g.count === 1 ? g.top : null} />
          ))}
          {g.closed.length > 0 &&
            (g.count ? (
              <Disclosure label={t("{n} closed", { n: g.closed.length })}>
                <AwardList awards={g.closed} dated />
              </Disclosure>
            ) : (
              <AwardList awards={g.closed} dated />
            ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Dated awards each with their date; the others under one heading ("No date: apply with your programme"). */
function Section({ section: s, said }: { section: RoadAwardSection; said: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      {s.label && <p className="text-[13px] font-semibold text-muted-foreground">{s.label}</p>}
      <AwardList awards={s.awards} dated={s.kind === "dated"} said={said} />
    </div>
  );
}

/** Each award by its title, linked to its official page; `said` is a value the group's row already shows. */
function AwardList({ awards, dated, said = null }: { awards: RoadAward[]; dated: boolean; said?: string | null }) {
  const t = useT();
  return (
    <ul className="flex flex-col gap-3">
      {awards.map(({ card: c, when, basis }) => (
        <li key={c.id} className="flex flex-col gap-0.5">
          {c.url ? (
            <span>
              <OutLink href={c.url} lang="en" className="text-[15px] leading-snug text-pretty">
                {c.title}
              </OutLink>
            </span>
          ) : (
            <p lang="en" className="text-[15px] leading-snug font-medium text-pretty text-foreground">
              {c.title}
            </p>
          )}
          {c.value && c.value !== said && (
            <p lang="en" className="text-[14px] leading-snug font-semibold text-foreground">
              {c.value}
            </p>
          )}
          {/* A duplicate merged into this award keeps its page here. */}
          {c.also.length > 0 && (
            <span className="flex flex-wrap gap-x-3">
              {c.also.map((u) => (
                <OutLink key={u} href={u} item={c.title} className="text-[13px]">
                  {t("Another official page")}
                </OutLink>
              ))}
            </span>
          )}
          {dated && <When when={when} basis={basis} />}
          {c.note && <p className="text-[13px] text-muted-foreground">{c.note}</p>}
          {c.prepare.length > 0 && (
            <Disclosure className="mt-0.5" label={c.status === "automatic" ? t("What the page says") : t("What to prepare")}>
              <ul lang="en" className="flex list-disc flex-col gap-1 pl-5 text-[14px] text-(--land-body) marker:text-muted-foreground">
                {c.prepare.slice(0, 5).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </Disclosure>
          )}
        </li>
      ))}
    </ul>
  );
}
