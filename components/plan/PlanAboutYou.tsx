"use client";

import { useId, useSyncExternalStore } from "react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { monthName } from "@/lib/i18n/format";
import type { StudentStatus } from "@/lib/plan-storage";
import { usePlan } from "@/lib/use-plan";

// What only the timeline needs, asked where it is used (the graduation date on /pathway): when the student
// graduates, their status in Singapore (internships on a Student's Pass), and when they took their English test
// (results last two years). Programmes for you asks everything else. /plan asks the same three in its Edit sheet
// and inline (components/plan/road/AboutYouFields.tsx, on the site's shadcn controls).

export const STATUSES: { value: StudentStatus; label: string }[] = [
  { value: "student-pass", label: "Student’s Pass" },
  { value: "citizen-pr", label: "Citizen or PR" },
  { value: "other-pass", label: "Another pass" },
];
const noSubscribe = () => () => {};
const thisYear = () => new Date().getFullYear();

export default function PlanAboutYou({ only }: { only?: "graduation" }) {
  const t = useT();
  const locale = useIntlLocale();
  const id = useId();
  const { ready, answers, update } = usePlan();
  const year = useSyncExternalStore(noSubscribe, thisYear, () => null);
  if (!ready || year === null) return null;
  const years = Array.from({ length: 6 }, (_, i) => year + i);
  const tested = !!answers.englishTest && answers.englishTest !== "none" && answers.englishScore !== null;
  const num = (v: string) => (v ? Number(v) : null);
  return (
    <div className="pl-about" role="group" aria-label={t("About you")}>
      <div className="pl-about-field">
        <span className="pl-about-label" id={`${id}-grad`}>
          {t("You graduate")}
        </span>
        <span className="field-pair" role="group" aria-labelledby={`${id}-grad`}>
          <select className="select" aria-label={t("Month")} value={answers.graduationMonth ?? ""} onChange={(e) => update({ graduationMonth: num(e.target.value) })}>
            <option value="">{t("Month")}</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>
                {monthName(locale, i)}
              </option>
            ))}
          </select>
          <select className="select" aria-label={t("Year")} value={answers.graduationYear ?? ""} onChange={(e) => update({ graduationYear: num(e.target.value) })}>
            <option value="">{t("Year")}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </span>
      </div>
      {only !== "graduation" && (
        <div className="pl-about-field">
          <label className="pl-about-label" htmlFor={`${id}-status`}>
            {t("Status in Singapore")}
          </label>
          <select id={`${id}-status`} className="select" value={answers.status ?? ""} onChange={(e) => update({ status: (e.target.value || null) as StudentStatus | null })}>
            <option value="">{t("Choose…")}</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.label)}
              </option>
            ))}
          </select>
        </div>
      )}
      {only !== "graduation" && tested && (
        <div className="pl-about-field">
          <span className="pl-about-label" id={`${id}-test`}>
            {t("English test taken")}
          </span>
          <span className="field-pair" role="group" aria-labelledby={`${id}-test`}>
            <select className="select" aria-label={t("Month you took the test")} value={answers.englishTestMonth ?? ""} onChange={(e) => update({ englishTestMonth: num(e.target.value) })}>
              <option value="">{t("Taken in… (month)")}</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {monthName(locale, i)}
                </option>
              ))}
            </select>
            <select className="select" aria-label={t("Year you took the test")} value={answers.englishTestYear ?? ""} onChange={(e) => update({ englishTestYear: num(e.target.value) })}>
              <option value="">{t("Year")}</option>
              {Array.from({ length: 4 }, (_, i) => year - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </span>
        </div>
      )}
    </div>
  );
}
