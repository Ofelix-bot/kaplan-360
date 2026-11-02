"use client";

import { useState } from "react";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { AutofillInput, type ReadSource } from "@/components/shared/autofill-input";
import { Button } from "@/components/ui/button";
import type { KaplanDegree } from "@/lib/careers/types";
import { closeExampleNow } from "@/lib/example-link";
import { monthName } from "@/lib/i18n/format";
import { msg } from "@/lib/i18n/translate";
import { EMPTY_ANSWERS, getPlanSnapshot, parsePlan, savePlan, type PlanAnswers } from "@/lib/plan-storage";
import { autofill, type Autofill, type Conflict, type FillGroup } from "@/lib/profile/autofill";
import { SG_STATUSES } from "@/lib/profile/options";
import { usePlan } from "@/lib/use-plan";

// /profile's "Autofill" card, above Part 1: the shared box (a sentence typed or spoken, Kaplan360 screenshots, school
// emails; components/shared/autofill-input.tsx) read into the answers not given yet (lib/profile/autofill.ts). It
// says what it filled; where the reading disagrees with an answer already there it lists both, with "Use this" to
// take the reading. An open worked example is closed first, so the reading goes into the visitor's own profile.

const ERRORS = {
  unavailable: msg("This shortcut isn’t available right now. Fill in the form below."),
  busy: msg("Too many tries in a row. Wait a minute, or fill in the form below."),
  failed: msg("That didn’t work. Try again, or fill in the form below."),
};

const GROUP_LABEL: Record<FillGroup, string> = {
  degree: msg("Degree"),
  status: msg("Nationality and status"),
  grades: msg("Grades"),
  directions: msg("Master’s direction"),
  english: msg("English and tests"),
  budget: msg("Budget and region"),
};

const CONFLICT_LABEL: Record<Conflict["id"], string> = {
  degree: msg("Degree"),
  graduation: msg("Graduation"),
  status: msg("Status in Singapore"),
  nationality: msg("Nationality"),
  birthYear: msg("Year of birth"),
  grade: msg("Grade"),
  english: msg("English test"),
};

export function AutofillCard({ degrees, onFilled }: { degrees: KaplanDegree[]; onFilled: (source: ReadSource, groups: FillGroup[], answers: PlanAnswers) => void }) {
  const t = useT();
  const locale = useLocale();
  const names = useSiteNames();
  const { example, update } = usePlan();
  const [result, setResult] = useState<Autofill | null>(null);
  const [used, setUsed] = useState<Set<number>>(new Set());
  const sep = locale === "en" ? ", " : "、";
  const regionName = new Intl.DisplayNames([locale === "en" ? "en" : locale === "zh-hant" ? "zh-Hant" : "zh-Hans"], { type: "region" });

  const onRead = (reading: Parameters<Parameters<typeof AutofillInput>[0]["onRead"]>[0], text: string, source: ReadSource) => {
    // The reading goes into the visitor's own answers, never into an example's.
    if (example) closeExampleNow();
    const own = parsePlan(getPlanSnapshot());
    const answers = own?.answers ?? EMPTY_ANSWERS;
    const r = autofill(answers, reading, text, (id) => degrees.find((d) => d.id === id)?.university ?? null);
    const next = { ...answers, ...r.patch };
    if (Object.keys(r.patch).length) savePlan(next, own?.remember ?? true);
    setResult(r);
    setUsed(new Set());
    onFilled(source, r.filled, next);
  };

  /** A conflict's value as the form shows it. */
  const word = (c: Conflict, v: string) => {
    if (!v) return "–";
    if (c.id === "degree") {
      const d = degrees.find((x) => x.id === v);
      return d ? names.degree(d.name).name : v;
    }
    if (c.id === "status") return t(SG_STATUSES.find((s) => s.value === v)?.label ?? v);
    if (c.id === "nationality") return regionName.of(v) ?? v;
    if (c.id === "graduation") {
      const [y, m] = v.split("-").map(Number);
      return `${monthName(locale === "en" ? "en-SG" : locale === "zh-hant" ? "zh-HK" : "zh-CN", m - 1, "short")} ${y}`;
    }
    if (c.id === "english") return v.replace(/^(ielts|toefl|pte|duolingo|none)/, (x) => (x === "none" ? t("Not yet") : x.toUpperCase()));
    return v;
  };

  return (
    <section aria-label={t("Autofill your profile")} className="flex flex-col gap-3">
      <AutofillInput
        title={t("Autofill your profile")}
        hint={t("Type or say a sentence about yourself, or add a Kaplan360 screenshot or your school’s course email. Only empty answers are filled.")}
        placeholder={t("I study a UCD finance top-up at Kaplan on a Student’s Pass, I’m Indian, GPA 3.4, IELTS 7 in March, and I want a finance master’s.")}
        button={t("Autofill my profile")}
        errors={ERRORS}
        onRead={onRead}
        className="rounded-[20px] border-(--border) bg-(--land-card)"
      />
      {result && (
        <div role="status" className="flex flex-col gap-2 rounded-2xl border border-(--border) bg-(--land-card) px-5 py-4 text-sm">
          <p className="m-0 flex items-start gap-2">
            <SparklesIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-(--brand-ink)" />
            {result.filled.length
              ? t("Filled {n}: {list}", {
                  n: result.filled.length,
                  list: result.filled.map((g) => t(GROUP_LABEL[g])).join(sep),
                })
              : t("Nothing new to fill: what it read is already in your profile, or it read nothing.")}
          </p>
          {result.conflicts.length > 0 && (
            <>
              <p className="m-0 font-semibold">{t("Your answer is kept where the reading says otherwise:")}</p>
              <ul className="m-0 flex flex-col gap-1.5 p-0">
                {result.conflicts.map((c, i) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      {t("{field}: yours {was}, read {read}", {
                        field: t(CONFLICT_LABEL[c.id]),
                        was: word(c, c.was),
                        read: word(c, c.read),
                      })}
                    </span>
                    {used.has(i) ? (
                      <span className="inline-flex items-center gap-1 text-(--land-body)">
                        <CheckIcon aria-hidden className="size-3.5" />
                        {t("Used")}
                      </span>
                    ) : (
                      <Button variant="outline" size="sm" className="bg-(--land-card)" onClick={() => (update(c.patch), setUsed((s) => new Set(s).add(i)))}>
                        {t("Use this")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
