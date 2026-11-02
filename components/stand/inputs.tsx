"use client";

import { useId, useMemo } from "react";
import { ChevronsUpDownIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { EditProfileLink } from "@/components/profile/EditProfileLink";
import { BUDGETS } from "@/components/results/budget";
import { ASIA } from "@/components/results/facets";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TESTS } from "@/lib/english-tests";
import { FieldLabel, NONE, Pick } from "./fields";
import { CLASSES } from "./grade";
import { useStand } from "./model";

// The first screen: the student's answers the index reads as one line, with "Edit" to /profile, where they
// are filled in (plan D: degree, grade, English, internships and work, research, awards, projects); then
// what this page alone asks: the start year and the scope (tuition and countries). Read from and written
// back to the planner's answers (lib/plan-storage.ts), so /results and /plan stay in step.

const thisYear = () => new Date().getFullYear();

/** Where the student would study (optional): every country with programmes, Singapore, Hong Kong and Macau first. */
function CountryPicker() {
  const t = useT();
  const { data, answers, update } = useStand();
  const id = useId();
  const countries = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of data.programmes) {
      const c = p.campus?.country ?? data.universities[p.u].country;
      if (c) m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m].sort((a, b) => Number(ASIA.includes(b[0])) - Number(ASIA.includes(a[0])) || b[1] - a[1]);
  }, [data]);
  const chosen = answers.countries;
  const toggle = (c: string) => update({ countries: chosen.includes(c) ? chosen.filter((x) => x !== c) : [...chosen, c] });
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <FieldLabel id={id} hint={t("optional")}>
        {t("Countries")}
      </FieldLabel>
      <Popover>
        <PopoverTrigger render={<Button variant="outline" aria-labelledby={id} className="w-full min-w-0 justify-between bg-(--land-card) font-normal" />}>
          <span className="truncate">{chosen.length === 0 ? t("Every country") : chosen.length === 1 ? t(chosen[0]) : t("{n} countries", { n: chosen.length })}</span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 gap-1 p-2">
          <ScrollArea className="h-64">
            <ul className="flex flex-col pr-2">
              {countries.map(([c, count]) => (
                <li key={c}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted">
                    <Checkbox checked={chosen.includes(c)} onCheckedChange={() => toggle(c)} />
                    <span className="min-w-0 flex-1 truncate">{t(c)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{count.toLocaleString("en-SG")}</span>
                  </label>
                </li>
              ))}
            </ul>
          </ScrollArea>
          {chosen.length > 0 && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => update({ countries: [] })}>
              {t("Every country")}
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function Inputs() {
  const t = useT();
  const names = useSiteNames();
  const m = useStand();
  const { answers: a, update, school, degree, start } = m;
  const years = Array.from({ length: 6 }, (_, i) => thisYear() + i);
  const budgetItems = BUDGETS.map((b) => ({ value: b.value === null ? NONE : String(b.value), label: t(b.short) }));

  const test = a.englishTest && a.englishTest !== "none" ? TESTS.find((x) => x.value === a.englishTest) : null;
  const internships = a.internshipsSame !== null || a.internshipsOther !== null ? (a.internshipsSame ?? 0) + (a.internshipsOther ?? 0) : null;
  const cls = CLASSES.find((c) => c.value === a.classification);
  const parts = [
    school !== "kaplan" ? (a.schoolAwarder ? names.school(a.schoolAwarder).name : null) : degree?.name ? names.degree(degree.name).name : null,
    a.degreeGpa !== null ? t("GPA {gpa}", { gpa: a.degreeGpa }) : a.averageMark !== null ? t("Average {mark}", { mark: a.averageMark }) : cls ? t(cls.label) : null,
    test ? (a.englishScore !== null ? `${t(test.short)} ${a.englishScore}` : t(test.short)) : a.englishTest === "none" ? t("No English test yet") : null,
    internships !== null ? (internships === 1 ? t("1 internship") : t("{n} internships", { n: internships })) : null,
    a.workYears !== null ? (a.workYears === 1 ? t("1 year of full-time work") : t("{n} years of full-time work", { n: a.workYears })) : null,
  ].filter((p): p is string => !!p);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-(--land-line) bg-(--land-card) px-3 py-2.5">
        <p className="m-0 min-w-0 flex-1 text-sm text-(--text) tabular-nums">{parts.length ? parts.join(" · ") : t("Nothing added yet")}</p>
        <EditProfileLink />
      </div>
      <div className="grid grid-cols-6 gap-x-2 gap-y-2.5">
        <Pick
          className="col-span-2"
          label={t("Start year")}
          value={String(start.year)}
          items={years.map((y) => ({ value: String(y), label: String(y) }))}
          onChange={(v) => update({ startYear: Number(v) })}
        />
        <Pick
          className="col-span-2"
          label={t("Tuition a year")}
          value={a.budget === null ? NONE : String(a.budget)}
          items={[...budgetItems, ...(a.budget !== null && !BUDGETS.some((b) => b.value === a.budget) ? [{ value: String(a.budget), label: `S$${Math.round(a.budget / 1000)}k` }] : [])]}
          onChange={(v) => update({ budget: v === NONE ? null : Number(v) })}
        />
        <div className="col-span-2">
          <CountryPicker />
        </div>
      </div>
    </div>
  );
}
