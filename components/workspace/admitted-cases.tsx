"use client";

import { ChevronDownIcon, ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { BY_NAME, GPA_MIN, SOURCE_NAME, TEST_STATUS, type YouOnCases } from "@/components/results/words";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { aside, type T } from "@/lib/i18n/translate";
import type { CasesSource, CasesSourceCounts, ResultsCases, ResultsData, ResultsProgramme, TestStatus } from "@/lib/results-types";
import { CAMBRIDGE, QS_TIER_A, QS_TIER_B, TIERS } from "@/lib/tiers";
import { GpaBand, MixBar, share, TierBar } from "./admitted-figures";

// Applicants' reported results (lib/results-types.ts ResultsCases): the admits' GPA on the 4-point
// scale, English and admission test scores, experience and first degree (its tier, A to C, and the six
// groups used before under details), with the visitor's own result and degree placed among them;
// reported rejections apart; and, marked apart, signs that the figures vary too much to lean on. It
// describes who reported being admitted; it never says whether the visitor will be.

/** "指南者 120 · GradCafe 30": the sources that reported any. */
const bySource = (s: CasesSourceCounts) =>
  (Object.keys(SOURCE_NAME) as CasesSource[])
    .filter((k) => s[k] > 0)
    .map((k) => `${SOURCE_NAME[k]} ${s[k]}`)
    .join(" · ");

const fmt = (n: number, digits = 2) => n.toFixed(digits);

/** The visitor's degree among the tiers: its awarding university, and tier C for a private school's degree (lib/tiers.ts privateSchoolTier). */
function tierText(t: T, university: NonNullable<YouOnCases["university"]>) {
  return t("You: {university} ({qs})", { university: university.name, qs: university.qs ? `QS ${university.qs}` : t("not QS-ranked") });
}

/** The student's result as a figure on the same scale: data, not a verdict. */
function youText(t: T, you: { low: number; high: number }, result: string) {
  const v = you.low === you.high ? fmt(you.low) : `${fmt(you.low)}–${fmt(you.high)}`;
  return t("You: {v} · your {result}", { v, result });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs font-medium">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-1 text-xs leading-relaxed">{children}</dd>
    </div>
  );
}

const Sub = ({ children }: { children: React.ReactNode }) => <span className="text-muted-foreground">{children}</span>;

/** A small disclosure inside a row, in the muted style of "About these figures". */
function More({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group/more flex items-center gap-1 rounded-md text-left font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
        <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-data-[panel-open]/more:rotate-180 motion-reduce:transition-none" />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 flex flex-col gap-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const You = ({ children }: { children: React.ReactNode }) => (
  <span className="flex items-center gap-1.5 font-medium">
    <span className="inline-block size-2 shrink-0 rounded-full bg-amber" aria-hidden />
    {children}
  </span>
);

export function AdmittedCasesView({ cases: c, p, you, source }: { cases: ResultsCases; p: ResultsProgramme; you: YouOnCases | null; source: ResultsData["cases"] }) {
  const t = useT();
  const locale = useIntlLocale();
  const known = c.status.fresh + c.status.graduated + c.status.working + c.status.other;
  // Shares of first degrees are of the admits whose first degree is reported (GradCafe gives none).
  const withDegree = TIERS.reduce((s, x) => s + c.mix[x], 0);
  // Signs of high variance, each in words with its figures.
  const variance = [
    c.flags.includes("gpaWide") && c.gpa && t("Admitted GPAs spread widely: middle 80% {low}–{high}, middle half {q1}–{q3}.", { low: fmt(c.gpa.p10), high: fmt(c.gpa.p90), q1: fmt(c.gpa.p25), q3: fmt(c.gpa.p75) }),
    c.flags.includes("ieltsWide") && c.ielts && t("IELTS scores spread widely: middle 80% {low}–{high}.", { low: fmt(c.ielts.p10, 1), high: fmt(c.ielts.p90, 1) }),
    c.flags.includes("sourcesDiffer") && t("The sources disagree: median GPA {list}.", { list: c.gpaBySource.map((s) => `${SOURCE_NAME[s.source]} ${fmt(s.median)} (${s.n})`).join(" · ") }),
    c.flags.includes("rejectedHigher") && c.rejected?.gpa && c.gpa && t("Rejected applicants reported GPAs as high as admitted ones: median {rejected} against {admitted}.", { rejected: fmt(c.rejected.gpa.median), admitted: fmt(c.gpa.median) }),
  ].filter((x): x is string => !!x);

  const test = (name: "GRE" | "GMAT", reported: { n: number; median: number } | null, req: TestStatus | null) => {
    const status = req ? t(TEST_STATUS[req.status]) : t("not stated");
    // GMAT: the median of the scores each put on the Focus Edition scale (compass-build).
    return reported
      ? t(name === "GMAT" ? "{test}: {k} of {n} reported a score (median {m} on the Focus Edition scale, GMAC’s concordance) · the programme: {status}" : "{test}: {k} of {n} reported a score (median {m}) · the programme: {status}", { test: name, k: reported.n, n: c.n, m: reported.median, status })
      : t("{test}: none reported a score · the programme: {status}", { test: name, status });
  };

  return (
    <div className="flex flex-col gap-4" aria-label={t("Admitted students")} role="group">
      {(variance.length > 0 || c.flags.includes("few")) && (
        <Alert>
          <TriangleAlertIcon />
          {variance.length > 0 && <AlertTitle>{t("High variance")}</AlertTitle>}
          <AlertDescription>
            <ul className="flex flex-col gap-1">
              {variance.map((v) => (
                <li key={v}>{v}</li>
              ))}
              {c.flags.includes("few") && <li>{t("Only {n} reported admits", { n: c.n })}</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <dl className="flex flex-col gap-4">
        {c.gpa && c.gpa.n < GPA_MIN && (
          <Row label={t("GPA (4-point)")}>
            <span>{c.gpa.n === 1 ? t("One reported a GPA: {v}", { v: fmt(c.gpa.low) }) : t("{n} reported a GPA: {low} to {high}", { n: c.gpa.n, low: fmt(c.gpa.low), high: fmt(c.gpa.high) })}</span>
          </Row>
        )}
        {c.gpa && c.gpa.n >= GPA_MIN && (
          <Row label={t("GPA (4-point)")}>
            <GpaBand spread={c.gpa} you={you?.gpa ?? null} size="lg" />
            <span className="tabular-nums">{t("Middle 80%: {low}–{high} · median {median}", { low: fmt(c.gpa.p10), high: fmt(c.gpa.p90), median: fmt(c.gpa.median) })}</span>
            {you?.gpa && you.result && <You>{youText(t, you.gpa, you.result)}</You>}
          </Row>
        )}
        <Row label={t("English and tests")}>
          {c.ielts && c.ielts.n >= 5 && (
            <span>
              {t("IELTS: median {m}, middle 80% {low}–{high} ({k} reported)", { m: fmt(c.ielts.median, 1), low: fmt(c.ielts.p10, 1), high: fmt(c.ielts.p90, 1), k: c.ielts.n })}
              {p.ielts !== null && <> · {t("minimum {n}", { n: p.ielts })}</>}
            </span>
          )}
          {c.toefl && c.toefl.n >= 5 && (
            <span>
              {t("TOEFL: median {m}, middle 80% {low}–{high} ({k} reported)", { m: fmt(c.toefl.median, 0), low: fmt(c.toefl.p10, 0), high: fmt(c.toefl.p90, 0), k: c.toefl.n })}
              {p.toefl !== null && <> · {t("minimum {n}", { n: p.toefl })}</>}
            </span>
          )}
          <Sub>{test("GRE", c.gre, p.gre)}</Sub>
          <Sub>{test("GMAT", c.gmat, p.gmat)}</Sub>
        </Row>
        <Row label={t("Experience")}>
          {known > 0 && (
            <span>
              {t("{fresh} applied in their final year · {graduated} after graduating · {working} with work experience", {
                fresh: share(c.status.fresh, known),
                graduated: share(c.status.graduated, known),
                working: share(c.status.working, known),
              })}
              {c.status.workYears !== null && c.status.working > 0 && aside(c.status.workYears === 1 ? t("(median 1 year)") : t("(median {n} years)", { n: c.status.workYears }))}
            </span>
          )}
          {c.experience && c.experience.sampled > 0 && (
            <Sub>
              {t("Of the {n} newest cases, listing: internships {i} · research {r} · work {w} · competitions {c}", {
                n: c.experience.sampled,
                i: c.experience.internship,
                r: c.experience.research,
                w: c.experience.work,
                c: c.experience.competition,
              })}
            </Sub>
          )}
          <Sub>{p.work ? t("The programme asks for {n} years of work experience.", { n: p.work }) : t("The programme asks for no work experience.")}</Sub>
        </Row>
        {withDegree > 0 && (
          <Row label={t("First degree")}>
            <TierBar mix={c.mix} you={you?.tier ?? null} />
            {withDegree < c.n && <Sub>{t("Of the {n} admits whose first degree is reported.", { n: withDegree })}</Sub>}
            {c.gpaByTier.length > 0 && <Sub>{t("Median GPA by tier (5 or more GPAs): {list}", { list: c.gpaByTier.map((g) => `${g.tier} ${fmt(g.median)}`).join(" · ") })}</Sub>}
            {you?.tier && you.university && <You>{tierText(t, you.university)}</You>}
            <More label={t("What the tiers mean")}>
              <ul className="flex flex-col gap-0.5 text-muted-foreground">
                <li>{t("Tier A: QS top {a}; mainland China: Cambridge Group A", { a: QS_TIER_A })}</li>
                <li>{t("Tier B: QS {from}–{b}; mainland China: Cambridge Group B", { from: QS_TIER_A + 1, b: QS_TIER_B })}</li>
                <li>{t("Tier C: QS {c}+ or unranked; mainland China: on neither Cambridge list", { c: QS_TIER_B + 1 })}</li>
              </ul>
              <a href={CAMBRIDGE.url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-0.5 font-medium text-primary underline-offset-4 hover:underline">
                {t("University of Cambridge: international qualifications")}
                <ExternalLinkIcon className="size-3" />
              </a>
            </More>
            <More label={t("Details: 985, 211 and QS bands")}>
              <MixBar mix={c.groups} you={you?.group ?? null} />
              {c.gpaByGroup.length > 1 && <Sub>{t("Median by first degree: {list}", { list: c.gpaByGroup.map((g) => `${t(BY_NAME[g.group])} ${fmt(g.median)}`).join(" · ") })}</Sub>}
            </More>
          </Row>
        )}
        {c.rejected && (
          <Row label={t("Rejections reported")}>
            <span>{t("{n} reported rejections ({sources})", { n: c.rejected.n, sources: bySource(c.rejected.sources) })}</span>
            {c.rejected.gpa && <Sub>{t("Their GPA: median {median}, middle 80% {low}–{high}", { median: fmt(c.rejected.gpa.median), low: fmt(c.rejected.gpa.p10), high: fmt(c.rejected.gpa.p90) })}</Sub>}
            {c.waitlisted > 0 && <Sub>{t("{n} reported a waiting list", { n: c.waitlisted })}</Sub>}
          </Row>
        )}
      </dl>
      {source && (
        <Collapsible>
          <CollapsibleTrigger className="group/about flex items-center gap-1 rounded-md text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronDownIcon className="size-3.5 transition-transform group-data-[panel-open]/about:rotate-180" />
            {t("Sources")}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
              {(Object.keys(SOURCE_NAME) as CasesSource[])
                .filter((k) => c.sources[k] > 0 || (c.rejected?.sources[k] ?? 0) > 0)
                .map((k) => (
                  <p key={k}>
                    <a href={source.sources[k].url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-4 hover:underline">
                      {t(source.sources[k].name)}
                      <ExternalLinkIcon className="size-3" />
                    </a>
                    : {t(source.sources[k].note)}
                  </p>
                ))}
              <p>{t("checked {date}", { date: new Date(`${source.checked}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })}</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
