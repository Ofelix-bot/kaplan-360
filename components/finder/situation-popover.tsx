"use client";

import { useId, useState, type ReactElement } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TESTS } from "@/lib/english-tests";
import type { EnglishTest, StudentStatus } from "@/lib/plan-storage";
import { usePlanStore } from "@/lib/workspace/plan-store";

// "Your situation · Change": the English score, the years of work and the pass, which the finder's questions leave
// out but its fixed requirements need (part-time only is not for a Student's Pass). Written to the plan answers as
// /results' filters write them.

const NONE = "-";
/** Each test's scores, from a little under to a little over what master's programmes ask. */
const SCORES: Record<Exclude<EnglishTest, "none">, number[]> = {
  ielts: [5.5, 6, 6.5, 7, 7.5, 8, 8.5],
  toefl: [72, 79, 85, 90, 94, 100, 105, 110],
  pte: [50, 58, 62, 65, 70, 76, 80],
  duolingo: [95, 100, 105, 110, 115, 120, 125, 130],
};
const WORK = [0, 1, 2, 3, 5];
const STATUSES: { value: StudentStatus; label: string }[] = [
  { value: "student-pass", label: "Student’s Pass" },
  { value: "citizen-pr", label: "Citizen or PR" },
  { value: "other-pass", label: "Another pass" },
];

export function SituationPopover({ trigger }: { trigger: ReactElement }) {
  const t = useT();
  const ids = { test: useId(), score: useId(), work: useId(), status: useId() };
  const [open, setOpen] = useState(false);
  const a = usePlanStore((s) => s.answers);
  const update = usePlanStore((s) => s.update);
  const test = a.englishTest && a.englishTest !== "none" ? a.englishTest : null;
  const scores = test ? [...new Set([...SCORES[test], ...(a.englishScore !== null ? [a.englishScore] : [])])].sort((x, y) => x - y) : [];
  const testItems = [{ value: NONE, label: t("Not set") }, ...TESTS.map((x) => ({ value: x.value as string, label: t(x.label) }))];
  const scoreItems = [{ value: NONE, label: t("No score yet") }, ...scores.map((s) => ({ value: String(s), label: String(s) }))];
  const years = a.workYears ?? (a.workExperience === "none" ? 0 : null);
  const workItems = [{ value: NONE, label: t("Not set") }, ...WORK.map((n) => ({ value: String(n), label: n === 0 ? t("None yet") : n === 5 ? t("5 years or more") : t(n === 1 ? "1 year" : "{n} years", { n }) }))];
  const statusItems = [{ value: NONE, label: t("Not set") }, ...STATUSES.map((s) => ({ value: s.value as string, label: t(s.label) }))];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" className="w-80 gap-4 rounded-xl p-4">
        <div className="flex flex-col gap-1.5">
          <label id={ids.test} className="text-sm font-semibold">
            {t("English test")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Select items={testItems} value={a.englishTest ?? NONE} onValueChange={(v) => update({ englishTest: !v || v === NONE ? null : (v as EnglishTest), englishScore: null })}>
              <SelectTrigger className="w-full" aria-labelledby={ids.test}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {testItems.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {test && (
              <Select items={scoreItems} value={a.englishScore === null ? NONE : String(a.englishScore)} onValueChange={(v) => update({ englishScore: !v || v === NONE ? null : Number(v) })}>
                <SelectTrigger className="w-full" aria-label={t("Score")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {scoreItems.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label id={ids.work} className="text-sm font-semibold">
            {t("Full-time work experience")}
          </label>
          <Select
            items={workItems}
            value={years === null ? NONE : String(Math.min(5, Math.floor(years)))}
            onValueChange={(v) => {
              const n = !v || v === NONE ? null : Number(v);
              update({ workYears: n, workExperience: n === null ? null : n === 0 ? "none" : "have" });
            }}
          >
            <SelectTrigger className="w-full" aria-labelledby={ids.work}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {workItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label id={ids.status} className="text-sm font-semibold">
            {t("Your pass in Singapore")}
          </label>
          <Select items={statusItems} value={a.status ?? NONE} onValueChange={(v) => update({ status: !v || v === NONE ? null : (v as StudentStatus) })}>
            <SelectTrigger className="w-full" aria-labelledby={ids.status}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {statusItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {a.status !== "citizen-pr" && a.status !== "other-pass" && <p className="text-xs text-muted-foreground">{t("Part-time-only programmes are left out: a Student’s Pass is for full-time study.")}</p>}
        </div>
        <Button variant="outline" size="sm" className="self-end" onClick={() => setOpen(false)}>
          {t("Done")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
