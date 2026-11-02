"use client";

import { useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon, GraduationCapIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Command, CommandCollection, CommandEmpty, CommandGroup, CommandGroupLabel, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DRAFT } from "@/content/draft";
import type { KaplanDegree } from "@/lib/careers/types";
import { pickDegree } from "@/lib/careers/use-student";
import { plannedDegree } from "@/lib/plan-storage";
import { usePlan } from "@/lib/use-plan";

// The degree picker (Q3, Q4, C1): the 56 bachelor's degrees, grouped by university and then by field,
// searchable by name, university or field (Base UI's autocomplete in its command form, in a popover).
// Picking one is the visitor's own input: it closes the worked example and goes into their own answers;
// a diploma student's pick is the degree they move on to (lib/careers/use-student.ts pickDegree).
// Degree and university names are data and stay in English (lang="en").

const C = DRAFT.careers.picker;

/** Universities as the trigger names them (their names are data and stay in English). */
const UNI_SHORT: Record<string, string> = {
  "Murdoch University": "Murdoch",
  "Northumbria University at Newcastle": "Northumbria",
  "Birmingham City University": "BCU",
  "University of Portsmouth": "Portsmouth",
  "University College Dublin": "UCD",
  "Monash University": "Monash",
};
export const uniShort = (u: string) => UNI_SHORT[u] ?? u;

/** The degree's name without "(Top-up)" and "(Honours)" style suffixes, for the trigger. */
export const degreeShort = (name: string) =>
  name
    .replace(/\s*\((?:Top-up|Honours|Hons)\)/gi, "")
    .replace(/\s+with Honours\b/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

type Item = { value: string; label: string; degree: KaplanDegree };
type Group = { value: string; university: string; field: string; first: boolean; items: Item[] };

/** Lower case, accents dropped. */
const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Every word typed appears in the degree's name, university or field. */
const matches = (item: Item, query: string) => {
  const hay = fold(`${item.degree.name} ${item.degree.university} ${uniShort(item.degree.university)} ${item.degree.disciplineLabel}`);
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
};

function groupsOf(degrees: KaplanDegree[]): Group[] {
  const sorted = [...degrees].sort(
    (a, b) => a.university.localeCompare(b.university) || a.disciplineLabel.localeCompare(b.disciplineLabel) || a.name.localeCompare(b.name),
  );
  const out: Group[] = [];
  for (const d of sorted) {
    const key = `${d.university}|${d.disciplineLabel}`;
    let g = out.at(-1);
    if (!g || g.value !== key) {
      g = { value: key, university: d.university, field: d.disciplineLabel, first: out.at(-1)?.university !== d.university, items: [] };
      out.push(g);
    }
    g.items.push({ value: d.id, label: d.name, degree: d });
  }
  return out;
}

const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)";

export function DegreePicker({ degrees, className }: { degrees: KaplanDegree[]; className?: string }) {
  const t = useT();
  const { answers } = usePlan();
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupsOf(degrees), [degrees]);
  const currentId = plannedDegree(answers);
  const current = degrees.find((d) => d.id === currentId) ?? null;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={current ? t(C.current, { degree: current.name }) : t(C.pick)}
          className={cn(
            "group/pick flex w-full min-w-0 items-center gap-3 rounded-xl border border-(--land-line) bg-(--land-card) px-3 py-2.5 text-left text-(--text)",
            "transition-[background-color,border-color] duration-150 hover:border-(--brand-ink) aria-expanded:border-(--brand-ink)",
            FOCUS,
          )}
        >
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--land-ground) text-(--brand-ink)">
            <GraduationCapIcon className="size-4.5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            {current ? (
              <>
                <span lang="en" className="truncate text-sm font-semibold">
                  {degreeShort(current.name)}
                </span>
                <span className="truncate text-xs text-(--land-body)">
                  <span lang="en">{uniShort(current.university)}</span>
                  <span className="sr-only">. </span>
                  <span className="ml-2 font-medium text-(--brand-ink)">{t(C.change)}</span>
                </span>
              </>
            ) : (
              <span className="text-sm font-semibold">{t(C.pick)}</span>
            )}
          </span>
          <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-(--land-body) motion-safe:transition-transform motion-safe:duration-150 group-aria-expanded/pick:rotate-180" />
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-[min(34rem,calc(100vw-2rem))] gap-0 p-0">
          <Command open inline items={groups} filter={matches} autoHighlight="always" keepHighlight>
            <div className="flex items-center gap-2 border-b px-3">
              <SearchIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <CommandInput aria-label={t(C.search)} placeholder={t(C.search)} className="h-11 text-sm" />
            </div>
            <div className="max-h-[min(26rem,60dvh)] overflow-y-auto overscroll-contain">
              <CommandEmpty>{t(C.none)}</CommandEmpty>
              <CommandList>
                {(group: Group) => (
                  <CommandGroup key={group.value} items={group.items}>
                    <CommandGroupLabel className="flex flex-col gap-0.5 pt-2">
                      {group.first && (
                        <span lang="en" className="text-[13px] font-semibold text-foreground">
                          {group.university}
                        </span>
                      )}
                      <span>{t(group.field)}</span>
                    </CommandGroupLabel>
                    <CommandCollection>
                      {(item: Item) => (
                        <CommandItem
                          key={item.value}
                          value={item}
                          onClick={() => {
                            setOpen(false);
                            pickDegree(item.value);
                          }}
                        >
                          <span lang="en" className="min-w-0 flex-1 text-pretty">
                            {item.label}
                          </span>
                          {item.value === currentId && <CheckIcon aria-hidden className="text-(--brand-ink)" />}
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                )}
              </CommandList>
            </div>
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">{t(C.diplomaNote)}</p>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
