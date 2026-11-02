"use client";

import { useId } from "react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { EditProfileLink } from "@/components/profile/EditProfileLink";
import { DRAFT } from "@/content/draft";
import type { StudentContext } from "@/lib/careers/types";
import { msg } from "@/lib/i18n/translate";
import { plannedDegree, type PlanAnswers } from "@/lib/plan-storage";
import { usePlan } from "@/lib/use-plan";
import { degreeShort } from "./DegreePicker";

// "You" (Q21, plan D): the student's situation from the shared answers as one line (degree, grade, internships,
// work, certificates) and "Edit", which opens /profile, where all of it is filled in (and back here after).
// What covers a key skill is shown, with its receipts, on each role's match. While the worked example is open
// the line is the example's. `showDegree={false}` leaves the degree out where the page shows it already.

const C = DRAFT.careers.you;

// Words not in content/draft/careers.ts yet.
const W = {
  gpa: msg("GPA {gpa}"),
  mark: msg("Average {mark}"),
  first: msg("First"),
  third: msg("Third"),
  internships: msg("{n} internships"),
  internshipOne: msg("1 internship"),
  certificates: msg("{n} certificates"),
  certificateOne: msg("1 certificate"),
  empty: msg("Nothing added yet"),
};

function gradeText(a: PlanAnswers, t: (k: string, v?: Record<string, string | number>) => string): string | null {
  if (a.degreeGpa != null) return t(W.gpa, { gpa: a.degreeGpa });
  if (a.averageMark != null) return t(W.mark, { mark: a.averageMark });
  if (a.classification === "first") return t(W.first);
  if (a.classification === "third") return t(W.third);
  if (a.classification === "2:1" || a.classification === "2:2") return a.classification;
  return null;
}

export function YouStrip({ ctx, showDegree = true, headingLevel = 2, className }: { ctx: StudentContext; showDegree?: boolean; headingLevel?: 2 | 3; className?: string }) {
  const t = useT();
  const { answers: a, ready } = usePlan();
  const headingId = useId();
  const H = headingLevel === 2 ? "h2" : "h3";
  const degree = showDegree ? ctx.degrees.find((d) => d.id === plannedDegree(a)) : undefined;
  const internships = a.internshipsSame !== null || a.internshipsOther !== null ? (a.internshipsSame ?? 0) + (a.internshipsOther ?? 0) : null;
  const certificates = a.certificates.length;
  // Before the browser is read (and with scripting off) the line is empty: nothing is guessed.
  const parts = ready
    ? [
        degree ? (
          <span key="d" lang="en">
            {degreeShort(degree.name)}
          </span>
        ) : null,
        gradeText(a, t),
        internships !== null ? (internships === 1 ? t(W.internshipOne) : t(W.internships, { n: internships })) : null,
        a.workYears !== null && a.workYears > 0 ? `${t(C.work)} ${a.workYears === 1 ? t(C.workYearsOne) : t(C.workYears, { n: a.workYears })}` : null,
        certificates ? (certificates === 1 ? t(W.certificateOne) : t(W.certificates, { n: certificates })) : null,
      ].filter((p) => p !== null)
    : [];

  return (
    <section aria-labelledby={headingId} className={cn("flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-(--land-line) bg-(--land-card) px-4 py-3", className)}>
      <H id={headingId} className="m-0 text-sm font-semibold text-(--text)">
        {t(C.title)}
      </H>
      <p className="m-0 min-w-0 flex-1 text-sm text-(--land-body) tabular-nums">
        {ready && parts.length === 0
          ? t(W.empty)
          : parts.map((p, i) => (
              <span key={i}>
                {i > 0 && <span aria-hidden> · </span>}
                {i > 0 && <span className="sr-only">, </span>}
                {p}
              </span>
            ))}
      </p>
      <EditProfileLink />
    </section>
  );
}
