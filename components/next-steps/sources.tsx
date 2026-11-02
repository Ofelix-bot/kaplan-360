"use client";

import { useMemo, type ReactNode } from "react";
import { BadgeCheckIcon, ChartColumnIcon, GaugeIcon, LandmarkIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Fn, ReceiptSection, registryViews, SourceList } from "@/components/shared/receipt";
import { FOCUS, n } from "@/components/stand/bands";
import { Card } from "@/components/ui/card";
import { RECEIPTS, SOURCES } from "@/lib/home/receipts";
import type { NextStepsFacts, RoadKey } from "@/lib/next-steps";
import { fromRegistry, hostOf, type ReceiptView } from "@/lib/receipts/model";
import { roadVars, TILE, useDay } from "./roads";

// "Where the numbers come from": the four sources the map reads, each as an icon card with what it
// gives and when it was read, a footnote numeral on each figure, and the section's numbered sources
// below (the shared receipt UI, decisions Q18 and C6). Four columns on a desktop, one on a phone; not animated.

/** When the sources were read, from the server (data/raw). */
export type SourceDates = { swda: string; cscse: string };

type Source = { icon: LucideIcon; road: RoadKey; name: string; gives: string; date: string; receipts: string[]; link: ReactNode };

/** MOM's EP eligibility page: the pass mark and the C2 row for a private school's degree (hand-checked registry receipts). */
const MOM_RECEIPTS = ["compass-40", "c2-pei"];
const SWDA_RECEIPT = "kaplan-ges-2024-25";
const CSCSE_RECEIPT = "next-steps:cscse-notice";

export function Sources({ facts, dates, index, mom }: { facts: NextStepsFacts; dates: SourceDates; index: { n: number; built: string } | null; mom: { url: string; read: string } | null }) {
  const t = useT();
  const day = useDay();
  const respondents = facts.kaplan.respondents;
  const views = useMemo<ReceiptView[]>(() => {
    const out = registryViews(MOM_RECEIPTS);
    // The SWDA survey row, when the registry's checked row is the row these facts were read from.
    const ges = RECEIPTS[SWDA_RECEIPT];
    if (ges?.quote && ges.quote === facts.kaplan.quote) out.push({ ...fromRegistry(ges), mark: [String(respondents)] });
    // CSCSE's notice is a list a person read and transcribed: no quote, and the card says so.
    out.push({
      id: CSCSE_RECEIPT,
      kind: "person",
      quote: null,
      mark: [],
      quoteKind: "table-text",
      publisher: SOURCES.cscse.name,
      title: facts.cscse.title,
      published: facts.cscse.published,
      read: dates.cscse,
      url: facts.cscse.url,
      host: hostOf(facts.cscse.url),
      where: t("The notice’s list of schools"),
      shot: null,
      match: "page-image",
    });
    return out;
  }, [facts.kaplan.quote, facts.cscse, respondents, dates.cscse, t]);
  const listed = new Set(views.map((v) => v.id));
  const list: Source[] = [
    {
      icon: GaugeIcon,
      road: "study",
      name: t("Competitiveness Index"),
      gives: index ? t("{n} programmes scored", { n: n(index.n) }) : t("Every programme scored"),
      date: index ? t("Built {date}", { date: day(index.built) }) : "",
      receipts: [],
      link: (
        <Link href="/results" className={cn("inline-flex items-center gap-0.5 font-medium text-(--brand-ink) underline-offset-4 hover:underline", FOCUS, "rounded-sm")}>
          {t("Programme finder")}
        </Link>
      ),
    },
    {
      icon: LandmarkIcon,
      road: "work",
      name: t("MOM"),
      gives: t("EP eligibility · COMPASS C2"),
      date: mom ? t("Read {date}", { date: day(mom.read) }) : "",
      receipts: MOM_RECEIPTS,
      link: null,
    },
    {
      icon: ChartColumnIcon,
      road: "work",
      name: t("SWDA survey {cohort}", { cohort: facts.kaplan.cohort }),
      gives: t("{n} Kaplan graduates", { n: respondents }),
      date: t("Read {date}", { date: day(dates.swda) }),
      receipts: [SWDA_RECEIPT],
      link: null,
    },
    {
      icon: BadgeCheckIcon,
      road: "work",
      name: t("CSCSE notice"),
      gives: t("Published {date}", { date: day(facts.cscse.published) }),
      date: t("Read {date}", { date: day(dates.cscse) }),
      receipts: [CSCSE_RECEIPT],
      link: null,
    },
  ];
  return (
    <section aria-labelledby="sources" className="flex flex-col gap-4">
      <h2 id="sources" className="font-heading text-2xl font-bold tracking-[-0.01em]">
        {t("Where the numbers come from")}
      </h2>
      <ReceiptSection receipts={views} title={t("Where the numbers come from")}>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((s) => (
            <li key={s.name}>
              <Card style={roadVars(s.road)} className="h-full gap-2 rounded-2xl bg-(--land-card) px-4">
                <span aria-hidden className={cn(TILE, "size-10 rounded-xl")}>
                  <s.icon className="size-5" />
                </span>
                <p className="font-heading text-base leading-tight font-bold">{s.name}</p>
                <p className="text-sm text-(--land-body)">
                  {s.gives}
                  {s.receipts.filter((id) => listed.has(id)).map((id) => (
                    <Fn key={id} id={id} />
                  ))}
                </p>
                {s.date && <p className="text-xs text-muted-foreground">{s.date}</p>}
                {s.link && <div className="text-sm">{s.link}</div>}
              </Card>
            </li>
          ))}
        </ul>
        <SourceList className="mt-2" />
      </ReceiptSection>
    </section>
  );
}
