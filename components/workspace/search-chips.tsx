"use client";

import { BookmarkIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { qsAll, qsRange, sameSearch } from "@/components/results/facets";
import { MAX_SAVED } from "@/components/results/words";
import { Button } from "@/components/ui/button";
import type { SavedSearch } from "@/lib/plan-storage";
import { transitions } from "@/lib/motion";
import { useWorkspace } from "@/lib/workspace/store";
import { useModel } from "./model";

// Above the results: what is filtering the list now, each removable, and up to five saved searches
// with their live counts. Saved searches stay with the student's answers in this browser.

type Search = Omit<SavedSearch, "id">;

const chipClass =
  "inline-flex max-w-full items-center gap-1 rounded-full border bg-(--rs-raised) py-0.5 pr-1 pl-2.5 text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

export function ActiveFilters() {
  const t = useT();
  const { current, fieldName, on } = useModel();
  const onlyStarred = useWorkspace((s) => s.onlyStarred);
  const intake = (w: Search["intake"]) => (w === "jan-mar" ? t("Starts January to March") : w === "jul-oct" ? t("Starts July to October") : null);
  const budget = (n: number | null) => (n === null ? null : t("≤ S${n}k a year", { n: Math.round(n / 1000) }));
  const qs = (s: Search) => (qsAll(s) ? null : t("QS {range}", { range: qsRange(s) }));
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(current.field ? [{ key: "field", label: fieldName(current.field), remove: () => on.removeFilter("field") }] : []),
    ...current.countries.map((c) => ({ key: `c-${c}`, label: t(c), remove: () => on.removeFilter("country", c) })),
    ...(qs(current) ? [{ key: "qs", label: qs(current)!, remove: () => on.removeFilter("qs") }] : []),
    ...(current.unranked ? [] : [{ key: "unranked", label: t("Ranked universities only"), remove: () => on.removeFilter("unranked") }]),
    ...current.universities.map((u) => ({ key: `u-${u}`, label: u, remove: () => on.removeFilter("university", u) })),
    ...(intake(current.intake) ? [{ key: "intake", label: intake(current.intake)!, remove: () => on.removeFilter("intake") }] : []),
    ...(current.budget !== null ? [{ key: "budget", label: budget(current.budget)!, remove: () => on.removeFilter("budget") }] : []),
    ...(onlyStarred ? [{ key: "starred", label: t("Shortlist"), remove: () => on.removeFilter("starred") }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("Filters in use")}>
      {chips.length === 0 && <span className="text-xs text-muted-foreground">{t("No filters: every field, country, rank and budget")}</span>}
      <AnimatePresence initial={false} mode="popLayout">
        {chips.map((c) => (
          <motion.span key={c.key} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: transitions.exit }} transition={transitions.popup}>
            <button type="button" className={chipClass} onClick={c.remove} aria-label={t("Remove filter: {name}", { name: c.label })}>
              <span className="truncate">{c.label}</span>
              <XIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      {chips.length > 1 && (
        <Button variant="link" size="xs" className="h-auto px-1" onClick={on.clear}>
          {t(chips.length === 1 ? "Clear {n} filter" : "Clear {n} filters", { n: chips.length })}
        </Button>
      )}
    </div>
  );
}

export function SavedSearches() {
  const t = useT();
  const { answers, current, fieldName, results, on } = useModel();
  const saved = answers.searches;
  const intake = (w: Search["intake"]) => (w === "jan-mar" ? t("Starts January to March") : w === "jul-oct" ? t("Starts July to October") : null);
  const describe = (s: Search) =>
    [
      s.field ? fieldName(s.field) : t("Every field"),
      s.countries.length ? s.countries.map((c) => t(c)).join(", ") : t("All countries"),
      qsAll(s) ? null : t("QS {range}", { range: qsRange(s) }),
      s.unranked ? null : t("Ranked universities only"),
      s.universities.length ? (s.universities.length === 1 ? s.universities[0] : t("{n} universities", { n: s.universities.length })) : null,
      intake(s.intake),
      s.budget === null ? null : t("≤ S${n}k a year", { n: Math.round(s.budget / 1000) }),
    ]
      .filter(Boolean)
      .join(" · ");

  if (!saved.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <BookmarkIcon className="size-3.5 text-muted-foreground" aria-hidden />
        {t("Saved searches")} <span className="text-muted-foreground tabular-nums">{saved.length}/{MAX_SAVED}</span>
      </p>
      <ul className="flex flex-col gap-1" aria-label={t("Saved searches")}>
        <AnimatePresence initial={false}>
          {saved.map((s) => {
            const isOn = sameSearch(s, current);
            const label = describe(s);
            return (
              <motion.li
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: transitions.exit }}
                transition={transitions.enter}
                className={`flex items-center gap-1 rounded-lg border ${isOn ? "border-primary bg-accent" : "bg-(--rs-raised)"}`}
              >
                <button type="button" aria-pressed={isOn} title={label} onClick={() => on.apply(s)} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <span className="shrink-0 font-medium tabular-nums">{(results.saved[s.id] ?? 0).toLocaleString("en-SG")}</span>
                </button>
                <Button variant="ghost" size="icon-xs" className="mr-1" onClick={() => on.deleteSearch(s.id)} aria-label={t("Delete saved search: {name}", { name: label })}>
                  <XIcon />
                </Button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
