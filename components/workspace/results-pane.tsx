"use client";

import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { SearchXIcon, StarIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { RANK_NAME } from "@/lib/grades";
import type { Sort } from "@/components/results/facets";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { useWorkspace } from "@/lib/workspace/store";
import { AnimatedNumber } from "./animated-number";
import { useModel } from "./model";
import { ProgrammeRow } from "./programme-row";
import { ActiveFilters, SavedSearches } from "./search-chips";
import { SEGMENT, SELECTED } from "./skin";
import { UniversityGroups } from "./university-groups";
import { WhatIf } from "./what-if";

// The middle of the workspace: the live counts and the order on top, then what is filtering, saved
// searches, what-if, and the programmes by university or as one list.

const PAGE = 30;
const n = (v: number) => v.toLocaleString("en-SG");

export function ResultsHeader({ start }: { start?: ReactNode }) {
  const t = useT();
  const { results } = useModel();
  const sort = useWorkspace((s) => s.sort);
  const setScope = useWorkspace((s) => s.setScope);
  const options: { value: Sort; label: string }[] = [
    { value: "fit", label: t("Best match, then QS rank") },
    { value: "asia", label: t("Singapore, Hong Kong and Macau first") },
    { value: "qs", label: t("QS rank") },
    { value: "fee", label: t("Lowest fee first") },
  ];
  const unis = results.groups.length;
  const progs = results.list.length;
  return (
    <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b px-3 py-1.5">
      {start}
      <p className="shrink-0 text-sm">
        <span aria-hidden>
          <AnimatedNumber value={unis} className="font-heading font-semibold tabular-nums" /> <span className="text-muted-foreground">{t(unis === 1 ? "university" : "universities")}</span>{" "}
          <AnimatedNumber value={progs} className="font-heading font-semibold tabular-nums" /> <span className="text-muted-foreground">{t(progs === 1 ? "programme" : "programmes")}</span>
        </span>
        <span className="sr-only" aria-live="polite">
          {t(progs === 1 ? "{n} programme" : "{n} programmes", { n: n(progs) })}, {t(unis === 1 ? "{n} university" : "{n} universities", { n: n(unis) })}
        </span>
      </p>
      <Select items={options} value={sort}onValueChange={(v) => v && setScope({ sort: v as Sort })}>
        <SelectTrigger size="sm" className="ml-auto max-w-full min-w-0" aria-label={t("Sort")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AllProgrammes({ onSelect }: { onSelect: (id: string) => void }) {
  const t = useT();
  const m = useModel();
  const selectedId = useWorkspace((s) => s.selectedId);
  // Back to the first page whenever the filters or the order change.
  const [page, setPage] = useState({ key: m.listKey, shown: PAGE });
  const shown = page.key === m.listKey ? page.shown : PAGE;
  const list = m.results.list;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-0.5">
        <AnimatePresence initial={false} mode="popLayout">
          {list.slice(0, shown).map((row) => (
            <ProgrammeRow key={row.p.id} row={row} selected={row.p.id === selectedId} onSelect={onSelect} you={m.you} youGpa={m.youCases?.gpa ?? null} />
          ))}
        </AnimatePresence>
      </ul>
      {list.length > shown && (
        <Button variant="outline" size="sm" className="mx-auto mb-2" onClick={() => setPage({ key: m.listKey, shown: shown + PAGE })}>
          {t("Show {n} more of {rest}", { n: Math.min(PAGE, list.length - shown), rest: n(list.length - shown) })}
        </Button>
      )}
    </div>
  );
}

export function ResultsBody({ onSelect }: { onSelect: (id: string) => void }) {
  const t = useT();
  const m = useModel();
  const listView = useWorkspace((s) => s.listView);
  const setListView = useWorkspace((s) => s.setListView);
  const onlyStarred = useWorkspace((s) => s.onlyStarred);
  const setScope = useWorkspace((s) => s.setScope);
  const selectedId = useWorkspace((s) => s.selectedId);
  const { results, you } = m;

  return (
    <div className="flex flex-col gap-3 p-3">
      {you && results.list.length > 0 && (
        <p className="text-sm">
          {t.rich("<b>{n}</b> where your result is in the admitted range", { b: (c) => <b className="font-heading tabular-nums">{c}</b> }, { n: n(results.inRange) })}
          {results.near > 0 && <span className="text-muted-foreground"> · {t("{n} of them only if your {grade} is 65% or more: add your average mark to know", { n: n(results.near), grade: t(RANK_NAME[you.rank]) })}</span>}
        </p>
      )}
      <ActiveFilters />
      <SavedSearches />
      {m.degreeId && <WhatIf />}

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={listView} onValueChange={(v) => setListView(v === "list" ? "list" : "unis")}>
          <TabsList aria-label={t("Show results")}>
            <TabsTrigger value="unis" className={SEGMENT}>{t("By university")}</TabsTrigger>
            <TabsTrigger value="list" className={SEGMENT}>{t("All programmes")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Toggle variant="outline" size="sm" className={cn(SELECTED, "aria-pressed:[&_svg]:text-primary")} pressed={onlyStarred} onPressedChange={(on) => setScope({ onlyStarred: on })} aria-label={t("Shortlist")}>
          <StarIcon className={cn(onlyStarred && "fill-current")} />
          {t("Shortlist")} · <span className="tabular-nums">{m.answers.shortlist.length}</span>
        </Toggle>
      </div>

      {results.list.length === 0 ? (
        <Empty className="border border-dashed border-(--rs-line) bg-(--rs-raised) py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{onlyStarred ? t("Star programmes to add them to your shortlist.") : t("No programmes match")}</EmptyTitle>
            {!onlyStarred && <EmptyDescription>{t("Nothing matches every filter. Remove one above.")}</EmptyDescription>}
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={m.on.clear}>
              {t("Clear filters")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : listView === "unis" ? (
        <UniversityGroups key={m.listKey} groups={results.groups} selectedId={selectedId} onSelect={onSelect} />
      ) : (
        <AllProgrammes onSelect={onSelect} />
      )}
    </div>
  );
}
