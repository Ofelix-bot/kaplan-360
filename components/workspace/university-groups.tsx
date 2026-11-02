"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { isAsia, type UniversityGroup } from "@/components/results/facets";
import { useLocalName } from "@/components/results/names";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useModel } from "./model";
import { ProgrammeRow } from "./programme-row";

// The results by university: one row each, with how many programmes it has under the current
// filters, where the student's result sits in them (in the usual range of admitted students, or at
// or over the minimum only) and its fees. A row opens to its programmes; the first starts open.

const UNIS = 12;
const IN_UNI = 6;
const k = (n: number) => Math.round(n / 1000);

function Group({ g, open, onOpenChange, selectedId, onSelect }: { g: UniversityGroup; open: boolean; onOpenChange: (open: boolean) => void; selectedId: string | null; onSelect: (id: string) => void }) {
  const t = useT();
  const local = useLocalName();
  const m = useModel();
  const [limit, setLimit] = useState(IN_UNI);
  const n = g.rows.length;
  const name = local(g.u.name, g.u.zh);
  // A fee the page states but that can't be put per year in S$ (a whole-course fee with no length) is on its programme.
  const fee =
    g.feeMin === null
      ? g.rows.some((r) => r.p.fee)
        ? t("Fees on each programme")
        : t("Fees not stated")
      : k(g.feeMin) === k(g.feeMax!)
        ? t("≈ S${n}k a year", { n: k(g.feeMin) })
        : t("≈ S${a}k–{b}k a year", { a: k(g.feeMin), b: k(g.feeMax!) });
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} render={<li />} className="rounded-xl border bg-(--rs-raised)">
      <h3>
        <CollapsibleTrigger className="group/uni flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="leading-snug font-medium">
              {name.name}
              {name.en && <span className="block text-xs font-normal text-muted-foreground">{g.u.name}</span>}
            </span>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {t(g.u.country)}
              {g.u.qs && <Badge variant="outline" className="h-4 px-1.5 text-[10px] tabular-nums">QS {g.u.qs}</Badge>}
              {g.u.partner && <Badge className="h-4 px-1.5 text-[10px]">{t("Kaplan partner")}</Badge>}
              {isAsia(g.u.country) && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{t("Asia")}</Badge>}
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
              <span>
                <b>{n.toLocaleString("en-SG")}</b> {t(n === 1 ? "programme" : "programmes")}
              </span>
              {g.in + g.reach > 0 && (
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="h-full bg-primary" style={{ width: `${(g.in / n) * 100}%` }} />
                    <span className="h-full bg-primary/30" style={{ width: `${(g.reach / n) * 100}%` }} />
                  </span>
                  {g.in > 0 && (
                    <span title={t("In the admitted range")}>
                      {g.in} <span className="sr-only">{t("where your result is in the admitted range")}</span>
                      <span aria-hidden className="text-muted-foreground">{t("in range")}</span>
                    </span>
                  )}
                  {g.reach > 0 && (
                    <span title={t("At or over the minimum, under the admitted range")} className="text-muted-foreground">
                      {g.reach} <span className="sr-only">{t("where your result meets the minimum only")}</span>
                      <span aria-hidden>{t("over the minimum")}</span>
                    </span>
                  )}
                </span>
              )}
              <span className="text-muted-foreground">{fee}</span>
            </span>
          </span>
          <ChevronDownIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/uni:rotate-180" />
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent>
        <div className="flex flex-col gap-1 border-t px-1.5 pt-1 pb-2">
          <ul className="flex flex-col gap-0.5">
            <AnimatePresence initial={false}>
              {g.rows.slice(0, limit).map((row) => (
                <ProgrammeRow key={row.p.id} row={row} selected={row.p.id === selectedId} onSelect={onSelect} inUniversity you={m.you} youGpa={m.youCases?.gpa ?? null} />
              ))}
            </AnimatePresence>
          </ul>
          {n > limit && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setLimit((l) => l + 12)}>
              {t("Show {n} more at {university}", { n: Math.min(12, n - limit), university: name.name })}
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function UniversityGroups({ groups, selectedId, onSelect }: { groups: UniversityGroup[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const t = useT();
  // Null until the student opens or closes a row: then the first university is the open one.
  const [open, setOpen] = useState<Set<number> | null>(null);
  const [shown, setShown] = useState(UNIS);
  const isOpen = (g: UniversityGroup) => (open ? open.has(g.index) : g === groups[0]);
  const toggle = (g: UniversityGroup, next: boolean) =>
    setOpen((prev) => {
      const s = new Set(prev ?? (groups[0] ? [groups[0].index] : []));
      if (next) s.add(g.index);
      else s.delete(g.index);
      return s;
    });

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {groups.slice(0, shown).map((g) => (
          <Group key={g.index} g={g} open={isOpen(g)} onOpenChange={(o) => toggle(g, o)} selectedId={selectedId} onSelect={onSelect} />
        ))}
      </ol>
      {groups.length > shown && (
        <Button variant="outline" size="sm" className="mx-auto" onClick={() => setShown((s) => s + UNIS)}>
          {t("Show {n} more universities of {rest}", { n: Math.min(UNIS, groups.length - shown), rest: groups.length - shown })}
        </Button>
      )}
    </div>
  );
}
