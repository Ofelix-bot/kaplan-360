"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "cn";
import { ExternalLinkIcon, MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { campusLabel, isAsia, studyCountry } from "@/components/results/facets";
import { useLocalName } from "@/components/results/names";
import { yoursText } from "@/components/results/words";
import { MatchCurve, pct, STRONG_FROM } from "@/components/shared/match-curve";
import { NumberField } from "@/components/stand/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdmitRangeView } from "@/components/workspace/admit-range";
import { useModel } from "@/components/workspace/model";
import { CheckPills, ClassProfileView, PrepareView, RequirementQuotes } from "@/components/workspace/programme-parts";
import { bandOf, careerFromCounts, matchRate, type MatchBand, type MatchInput } from "@/lib/admit-model";
import { EXPERIENCE_WEIGHT, mbaWorkGate } from "@/lib/admit-weights";
import { drawRates, THETA_SE_PREDICTED } from "@/lib/algorithm/sample";
import { admittedGpa, type AdmittedGpa } from "@/lib/finder/admitted-gpa";
import { ceilingFor, cushionFor, inputFor, resultOf, resultScale, waysToStrong, withResult, type ResultScale, type ResultValue, type Way, type WhatIfContext } from "@/lib/finder/what-if";
import { studentRank } from "@/lib/grades";
import { msg, type T } from "@/lib/i18n/translate";
import type { Classification, PlanAnswers } from "@/lib/plan-storage";
import { useResultsData } from "@/lib/workspace/data";
import type { FinderRow } from "./use-finder";

// A programme's details in the Finder, opened in place (components/finder/programme-card.tsx): the official page as a
// button; where the student stands, as the Core Algorithm page draws it (components/shared/match-curve.tsx), from
// reported admits where the database has them and the matching algorithm's fit where it doesn't; the admitted range,
// English and tests, and experience, one tab each (the first degree's tier is not shown); and a what-if that lists the
// smallest changes reaching Strong position (lib/finder/what-if.ts) and lets the student try them. The what-if keeps
// its changes in this card only: the student's saved answers never change.

const BAND: Record<MatchBand, { label: string; text: string; pill: string }> = {
  gap: { label: msg("Gap to close"), text: "text-(--fd-match-gap)", pill: "bg-(--fd-match-gap)/12 text-(--fd-match-gap)" },
  range: { label: msg("In range"), text: "text-(--fd-match-range)", pill: "bg-(--fd-match-range)/12 text-(--fd-match-range)" },
  strong: { label: msg("Strong position"), text: "text-(--fd-match-strong)", pill: "bg-(--fd-match-strong)/12 text-(--fd-match-strong)" },
};
const CLASS_LABEL: Record<Exclude<Classification, "unsure">, string> = { first: msg("First"), "2:1": "2:1", "2:2": "2:2", third: msg("Third") };
const EXP_LABEL = {
  "mba-exec": [msg("MBA / Executive"), msg("Work counts most here (up to +0.15 GPA points), and under two years of full-time work scales the match rate: ×0.2 under a year, ×0.5 at one.")],
  required: [msg("Asks for work experience"), msg("Up to +0.12 GPA points for a full career.")],
  preferred: [msg("Prefers work experience"), msg("Up to +0.08 GPA points for a full career.")],
  none: [msg("Doesn’t ask for work experience"), msg("Up to +0.05 GPA points; an internship counts at 0.45 of a job.")],
} as const;
const TEST_STATUS: Record<string, string> = {
  required: msg("Required · full weight"),
  optional: msg("Optional · half weight"),
  recommended: msg("Recommended · half weight"),
  mentioned: msg("Mentioned · half weight"),
  "not-required": msg("Not required"),
};

const domain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
/** A change in match-rate points: "+1.5 points", "no change". */
function pointsText(t: T, d: number) {
  if (Math.abs(d) < 0.0005) return t("no change");
  return t("{sign}{n} points", { sign: d > 0 ? "+" : "−", n: Math.abs(d * 100).toFixed(1) });
}
function resultText(t: T, scale: ResultScale, v: ResultValue) {
  if (!scale) return "";
  if (scale.kind === "gpa") return t("GPA {gpa} / {max}", { gpa: Number(v).toFixed(2), max: scale.max });
  if (scale.kind === "mark") return t("an average of {mark}", { mark: v });
  return t(CLASS_LABEL[v as Exclude<Classification, "unsure">]);
}
function wayText(t: T, scale: ResultScale, w: Way) {
  const years = (n: number) => (n === 1 ? t("1 year of full-time work") : t("{n} years of full-time work", { n }));
  switch (w.key) {
    case "result":
      return t("Raise your result to {result}", { result: resultText(t, scale, w.result!) });
    case "work":
      return years(w.work!);
    case "internships":
      return w.internships === 1 ? t("1 internship in your field") : t("{n} internships in your field", { n: w.internships! });
    case "ielts":
      return t("IELTS {score}", { score: w.ielts! });
    case "gre":
      return t("GRE {score}", { score: w.gre! });
    case "gmat":
      return t("GMAT {score}", { score: w.gmat! });
    case "result+work":
      return t("{work} and {result}", { work: years(w.work!), result: resultText(t, scale, w.result!) });
  }
}

function Panel({ title, extra, children, className }: { title: string; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-3 rounded-xl border border-border p-4", className)}>
      <h4 className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
        {title}
        {extra}
      </h4>
      {children}
    </section>
  );
}

/** A label and value row, with a line of detail under it. */
function Row({ k, v, d }: { k: ReactNode; v?: ReactNode; d?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 bg-card px-3 py-2.5">
      <span className="text-sm font-semibold">{k}</span>
      <span className="flex flex-wrap items-center justify-end gap-1.5 text-sm tabular-nums">{v}</span>
      {d && <span className="col-span-2 text-xs text-muted-foreground">{d}</span>}
    </div>
  );
}
const Rows = ({ children }: { children: ReactNode }) => <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">{children}</div>;

/** The admitted GPA as a strip: reported admits' spread, or the algorithm's fit drawn dashed. */
function AdmittedStrip({ q, you, rmse }: { q: AdmittedGpa; you: number | null; rmse: number }) {
  const t = useT();
  const x = (v: number) => 20 + ((Math.min(Math.max(v, 2.8), 4.0) - 2.8) / 1.2) * 600;
  const dash = q.fitted ? "5 4" : undefined;
  const f2 = (v: number) => v.toFixed(2);
  return (
    <Panel
      title={t("Admitted GPA")}
      extra={
        <span className={cn("rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground", q.fitted && "border-dashed")}>
          {q.fitted ? t("Algorithm fit · 4-point scale") : t("{n} reported admits · {years} · 4-point scale", { n: q.n ?? 0, years: q.years ? (q.years[0] === q.years[1] ? q.years[0] : `${q.years[0]}–${q.years[1]}`) : "" })}
        </span>
      }
    >
      <svg viewBox="0 0 640 74" role="img" aria-label={t("Admitted GPA: middle half {low} to {high}, median {median}", { low: f2(q.p25), high: f2(q.p75), median: f2(q.median) })} className="h-auto w-full text-[17px] sm:text-[11px]">
        {[2.8, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0].map((v) => (
          <text key={v} x={x(v)} y={70} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
            {v.toFixed(1)}
          </text>
        ))}
        <line x1={x(q.p10)} x2={x(q.p90)} y1={30} y2={30} stroke="currentColor" strokeOpacity={0.5} strokeWidth={2} strokeDasharray={dash} />
        <rect x={x(q.p25)} y={18} width={Math.max(2, x(q.p75) - x(q.p25))} height={24} rx={5} fill="var(--chart-poly)" fillOpacity={q.fitted ? 0.15 : 0.3} stroke="var(--chart-poly)" strokeDasharray={dash} />
        <line x1={x(q.median)} x2={x(q.median)} y1={14} y2={46} stroke="currentColor" strokeWidth={3} />
        <text x={x(q.median)} y={10} textAnchor="middle" fill="currentColor" fontWeight={700}>
          {t("median {gpa}", { gpa: f2(q.median) })}
        </text>
        {you !== null && (
          <g>
            <circle cx={x(you)} cy={30} r={7} fill="var(--chart-pei)" />
            <text x={x(you)} y={58} textAnchor="middle" fill="var(--chart-pei)" fontWeight={700}>
              {t("you {gpa}", { gpa: f2(you) })}
            </text>
          </g>
        )}
      </svg>
      <p className="text-xs text-muted-foreground">
        {t("Middle half {p25}–{p75}; 80% between {p10} and {p90}.", { p25: f2(q.p25), p75: f2(q.p75), p10: f2(q.p10), p90: f2(q.p90) })}{" "}
        {q.fitted ? (
          <b className="font-semibold text-foreground">{t("Fitted by the matching algorithm, not reported admits: actual admissions may differ (typically by ±{rmse} GPA points).", { rmse: rmse.toFixed(2) })}</b>
        ) : (
          t("Source: Kaplan 360++ database.")
        )}
      </p>
    </Panel>
  );
}

/** A − n + control for the what-if. */
function Step({ label, value, step, min, max, onChange, format }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const t = useT();
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 10) / 10)));
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex h-9 items-center justify-between rounded-lg border border-input bg-card">
        <Button variant="ghost" size="icon" className="size-9" aria-label={t("One less: {label}", { label })} disabled={value <= min} onClick={() => set(value - step)}>
          <MinusIcon />
        </Button>
        <output aria-live="polite" className="text-sm font-semibold tabular-nums">
          {format ? format(value) : value}
        </output>
        <Button variant="ghost" size="icon" className="size-9" aria-label={t("One more: {label}", { label })} disabled={value >= max} onClick={() => set(value + step)}>
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}

export function ProgrammeDetails({ r }: { r: FinderRow }) {
  const t = useT();
  const m = useModel();
  const steps = useResultsData((s) => s.prepare[r.p.discipline]?.[r.p.id]);
  const loading = useResultsData((s) => s.loadingFields.includes(r.p.discipline));
  const loadPrepare = useResultsData((s) => s.loadPrepare);
  const { p, u, c } = r;
  const others = c.filter((x) => x.label !== "Degree");
  const uni = useLocalName()(u.name, u.zh);
  const campus = campusLabel(p, t);
  const [tab, setTab] = useState<"admitted" | "english" | "experience">("admitted");
  const [what, setWhat] = useState<PlanAnswers | null>(null);
  const answers = what ?? m.answers;
  const awarderQs = m.university ? (m.data.universities.find((x) => x.name === m.university)?.qsValue ?? null) : null;
  const ctx: WhatIfContext | null = p.fit ? { fit: p.fit, g: m.data.match, university: m.university, awarderQs } : null;
  const scale = resultScale(m.university, m.answers);
  const view = useMemo(() => {
    if (!ctx) return null;
    const input = inputFor(answers, ctx.university, ctx.awarderQs);
    const base = inputFor(m.answers, ctx.university, ctx.awarderQs);
    if (!input || !base) return null;
    const match = matchRate(ctx.fit, ctx.g, input);
    const now = matchRate(ctx.fit, ctx.g, base);
    const draws = drawRates(ctx.fit, ctx.g, input, ctx.g.deltaSd ?? 0.07, ctx.fit.thetaSe ?? THETA_SE_PREDICTED);
    const strong = !match.belowMinimum && match.rate >= STRONG_FROM;
    return {
      input,
      base,
      match,
      now,
      draws,
      ways: strong ? [] : waysToStrong(ctx, answers),
      ceiling: strong ? 1 : ceilingFor(ctx, answers),
      cushion: strong ? cushionFor(ctx, answers) : null,
    };
    // the context's parts are listed; `ctx` itself is rebuilt each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.fit, m.data.match, m.university, awarderQs, answers, m.answers]);
  const touched = what !== null && JSON.stringify(what) !== JSON.stringify(m.answers);
  const youNow = studentRank(m.university, answers);
  const admitted = admittedGpa(p.fit, p.cases, m.data.fittedGpa, m.data.match.tierShift);
  const reported = !!admitted && !admitted.fitted;

  return (
    <div className="flex flex-col gap-5 border-t border-border px-5 pt-5 pb-6 sm:pl-[100px]">
      <div className="flex flex-wrap items-center gap-1.5">
        {u.partner && <Badge variant="secondary">{t("Kaplan partner")}</Badge>}
        {campus && <Badge variant="secondary">{campus}</Badge>}
        {!p.kaplan && isAsia(studyCountry({ p, u })) && <Badge variant="secondary">{t("Asia")}</Badge>}
        {p.any && <Badge variant="outline">{t("Open to any subject")}</Badge>}
        {p.language && !/^english$/i.test(p.language.trim()) && <Badge variant="outline">{t("Taught in {language}", { language: t(p.language) })}</Badge>}
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-(--fd-ink) px-4 text-[15px] font-bold text-(--fd-canvas) outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-(--fd-met)/50 sm:ml-auto sm:w-auto"
        >
          {t("Official page")}
          <span className="sr-only">: {p.name}</span>
          <ExternalLinkIcon aria-hidden className="size-4" />
          <span className="text-xs font-medium opacity-70">{domain(p.url)}</span>
        </a>
      </div>

      {view && ctx && (
        <Panel
          title={t("Where you are")}
          extra={
            <>
              <span className={cn("rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground", !reported && "border-dashed")}>
                {reported ? t("From {n} reported admits", { n: admitted!.n ?? 0 }) : t("Algorithm fit · actual results may differ")}
              </span>
              {touched && <span className="rounded-full border border-(--chart-pei) px-2 py-0.5 text-xs font-medium text-(--chart-pei)">{t("Showing your what-if")}</span>}
            </>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start [--mc-curve:var(--fd-ink)] [--mc-strong:var(--fd-match-strong)]">
            <div className="flex flex-col gap-2">
              <span className={cn("text-5xl leading-none font-extrabold tracking-tight tabular-nums", view.match.belowMinimum ? "text-muted-foreground" : BAND[bandOf(view.match.rate)].text)}>
                {view.match.belowMinimum ? t("Not met") : pct(view.match.rate)}
              </span>
              {view.match.belowMinimum ? (
                <span className="text-xs text-muted-foreground">{t("Below the stated minimum class")}</span>
              ) : (
                <>
                  <span className={cn("self-start rounded-full px-2 py-0.5 text-xs font-bold", BAND[bandOf(view.match.rate)].pill)}>{t(BAND[bandOf(view.match.rate)].label)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{t("80% range {low}–{high}", { low: pct(view.draws.p10), high: pct(view.draws.p90) })}</span>
                </>
              )}
            </div>
            <MatchCurve fit={ctx.fit} g={ctx.g} you={view.input} draws={view.draws} ghost={touched ? view.base : null} strongZone />
          </div>
        </Panel>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-3">
        <TabsList className="h-10! self-start rounded-xl p-1">
          <TabsTrigger value="admitted" className="px-3 font-semibold">
            {t("Admitted range")}
          </TabsTrigger>
          <TabsTrigger value="english" className="px-3 font-semibold">
            {t("English and tests")}
          </TabsTrigger>
          <TabsTrigger value="experience" className="px-3 font-semibold">
            {t("Experience")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="admitted" className="flex flex-col gap-4">
          <AdmitRangeView range={p.range} minBasis={p.minBasis} university={{ name: uni.name, good: u.good }} you={youNow} tier={null} cases={null} />
          {admitted && <AdmittedStrip q={admitted} you={view ? view.input.gpa4 : null} rmse={m.data.fittedGpa.medianRmse} />}
        </TabsContent>
        <TabsContent value="english" className="flex flex-col gap-3">
          {others.length > 0 && <CheckPills checks={others} />}
          {view && ctx && <EnglishRows r={r} input={view.input} />}
        </TabsContent>
        <TabsContent value="experience" className="flex flex-col gap-3">
          {view && ctx && <ExperienceRows r={r} input={view.input} />}
        </TabsContent>
      </Tabs>

      {view && ctx && (
        <section aria-label={t("What if")} className="overflow-hidden rounded-xl border border-border">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-muted px-4 py-3">
            <h4 className="text-[15px] font-bold">{t("What if · reaching Strong position (61%+)")}</h4>
            <p className="flex items-center gap-2 text-sm font-bold tabular-nums">
              <span className={view.now.belowMinimum ? "text-muted-foreground" : BAND[bandOf(view.now.rate)].text}>{t("Now {rate}", { rate: view.now.belowMinimum ? t("not met") : pct(view.now.rate) })}</span>
              {touched && (
                <>
                  <span aria-hidden className="font-normal text-muted-foreground">
                    →
                  </span>
                  <span className={view.match.belowMinimum ? "text-muted-foreground" : BAND[bandOf(view.match.rate)].text}>{t("What if {rate}", { rate: view.match.belowMinimum ? t("not met") : pct(view.match.rate) })}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-3 p-4">
            {r.english === "gap" && p.ielts !== null && (
              <p className="text-sm text-(--fd-gap)">
                <b>{t("Also needed for an offer: IELTS {score}", { score: p.ielts })}</b> {t("It doesn’t move the match rate, but the offer depends on it.")}
              </p>
            )}
            {!view.match.belowMinimum && view.match.rate >= STRONG_FROM ? (
              <p className="text-sm text-muted-foreground">
                {touched ? t("This what-if reaches a strong position.") : t("You’re already in a strong position.")}
                {view.cushion !== null && scale && <> {t("It holds down to {result}.", { result: resultText(t, scale, view.cushion) })}</>}
              </p>
            ) : view.ceiling < STRONG_FROM ? (
              <p className="text-sm text-muted-foreground">
                <b className="text-foreground">{t("Out of reach on its own numbers.")}</b> {t("Even with every change at its top, this programme stops at about {rate}: its ceiling follows how few applicants it admits.", { rate: pct(view.ceiling) })}
              </p>
            ) : view.ways.length ? (
              <ul className="grid gap-2 md:grid-cols-2">
                {view.ways.map((w) => (
                  <li key={w.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3">
                    <span className="text-sm font-semibold">{wayText(t, scale, w)}</span>
                    <span className="flex items-center gap-2">
                      <b className="text-lg text-(--fd-match-strong) tabular-nums">{pct(w.rate)}</b>
                      <Button variant="outline" size="sm" onClick={() => setWhat(w.answers)}>
                        {t("Try")}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("No single change gets there; try the controls below.")}</p>
            )}
            <WhatIfControls r={r} scale={scale} answers={answers} onChange={setWhat} />
            {touched && (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setWhat(null)}>
                <RotateCcwIcon data-icon="inline-start" />
                {t("Back to my answers")}
              </Button>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <RequirementQuotes academic={p.academic} englishRule={p.englishRule} url={p.url} />
        {p.profile && <ClassProfileView profile={p.profile} />}
        <PrepareView checks={c} steps={steps} loading={loading} url={p.url} onOpen={() => loadPrepare(p.discipline)} />
      </div>
    </div>
  );
}

function WhatIfControls({ r, scale, answers, onChange }: { r: FinderRow; scale: ResultScale; answers: PlanAnswers; onChange: (a: PlanAnswers) => void }) {
  const t = useT();
  const m = useModel();
  const fit = r.p.fit;
  const current = resultOf(answers);
  const you = studentRank(m.university, answers);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {scale && current !== null && (
        <div className="col-span-2 flex flex-col gap-2 sm:col-span-4">
          <span className="text-xs font-medium text-muted-foreground">
            {t("Result")} <b className="text-sm text-foreground tabular-nums">{you ? yoursText(t, you) : ""}</b>
          </span>
          {scale.kind === "class" ? (
            <Select items={scale.values.map((v) => ({ value: v, label: t(CLASS_LABEL[v as Exclude<Classification, "unsure">]) }))} value={String(current)} onValueChange={(v) => v && onChange(withResult(answers, scale, v as Classification))}>
              <SelectTrigger className="w-48 bg-card" aria-label={t("Result")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {scale.values.map((v) => (
                  <SelectItem key={v} value={v}>
                    {t(CLASS_LABEL[v as Exclude<Classification, "unsure">])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Slider min={scale.min} max={scale.max} step={scale.step} value={[Number(current)]} onValueChange={(v) => onChange(withResult(answers, scale, Array.isArray(v) ? v[0] : v))} thumbLabels={[t("Result")]} />
          )}
        </div>
      )}
      {answers.englishTest === "ielts" && answers.englishScore !== null && <Step label={t("IELTS")} value={answers.englishScore} step={0.5} min={4} max={9} onChange={(v) => onChange({ ...answers, englishScore: v })} />}
      <Step label={t("Years of full-time work")} value={answers.workYears ?? 0} step={1} min={0} max={10} onChange={(v) => onChange({ ...answers, workYears: v, workExperience: v > 0 ? "have" : answers.workExperience })} />
      <Step label={t("Internships in your field")} value={answers.internshipsSame ?? 0} step={1} min={0} max={3} onChange={(v) => onChange({ ...answers, internshipsSame: v })} />
      {fit && fit.greW > 0 && <NumberField label={t("GRE (optional)")} value={answers.gre} min={260} max={340} step={1} onChange={(v) => onChange({ ...answers, gre: v })} />}
      {fit && fit.gmatW > 0 && <NumberField label={t("GMAT (optional)")} value={answers.gmat} min={205} max={805} step={10} onChange={(v) => onChange({ ...answers, gmat: v })} />}
    </div>
  );
}

function EnglishRows({ r, input }: { r: FinderRow; input: MatchInput }) {
  const t = useT();
  const m = useModel();
  const { p } = r;
  const fit = p.fit!;
  const g = m.data.match;
  const rate = matchRate(fit, g, input).rate;
  const noTests = matchRate(fit, g, { ...input, gre: null, gmat: null }).rate;
  const noIelts = matchRate(fit, g, { ...input, ielts: null }).rate;
  const rule = p.englishRule ? (p.englishRule.required === "all" ? t("A score from every applicant") : t("A score unless your degree was taught in English")) : t("Not stated");
  const test = (name: string, st: { status: string } | null, weight: number, mine: number | null, median: number | undefined) => (
    <Row
      k={name}
      v={
        <>
          {st ? t(TEST_STATUS[st.status] ?? st.status) : t("Not stated")}
          {mine !== null && <span className="text-muted-foreground">· {t("you {score}", { score: mine })}</span>}
        </>
      }
      d={[weight > 0 ? t("Counts above GRE 325 (a GMAT is read as a GRE)") : t("Not counted for this programme"), median ? t("reported admits’ median {score}", { score: median }) : null].filter(Boolean).join(" · ")}
    />
  );
  return (
    <>
      <Rows>
        <Row
          k={t("English")}
          v={p.ielts !== null ? t("IELTS {score} minimum", { score: p.ielts }) : t("Not stated")}
          d={[rule, p.cases?.ielts ? t("reported admits’ median IELTS {score}", { score: p.cases.ielts.median }) : null, t("effect on your match rate: {change}", { change: pointsText(t, rate - noIelts) })].filter(Boolean).join(" · ")}
        />
        {test("GRE", p.gre, fit.greW, input.gre, p.cases?.gre?.median)}
        {test("GMAT", p.gmat, fit.gmatW, input.gmat, p.cases?.gmat?.median)}
      </Rows>
      <p className="text-xs text-muted-foreground">{t("Your tests change the match rate by {change}.", { change: pointsText(t, rate - noTests) })}</p>
    </>
  );
}

function ExperienceRows({ r, input }: { r: FinderRow; input: MatchInput }) {
  const t = useT();
  const m = useModel();
  const { p } = r;
  const fit = p.fit!;
  const g = m.data.match;
  const career = careerFromCounts(input.workYears, input.internshipsSame, input.internshipsOther);
  const bonus = EXPERIENCE_WEIGHT[fit.exp] * career;
  const now = matchRate(fit, g, input).rate;
  const without = matchRate(fit, g, { ...input, workYears: 0, internshipsSame: 0, internshipsOther: 0 }).rate;
  const [label, what] = EXP_LABEL[fit.exp];
  const st = p.cases?.status;
  const work = input.workYears ?? 0;
  const interns = (input.internshipsSame ?? 0) + (input.internshipsOther ?? 0);
  return (
    <Rows>
      <Row k={t(label)} d={t(what)} />
      <Row
        k={t("You")}
        v={`${work === 1 ? t("1 year of full-time work") : t("{n} years of full-time work", { n: work })} · ${interns === 1 ? t("1 internship") : t("{n} internships", { n: interns })}`}
        d={[
          t("career score {score} of 1", { score: career.toFixed(2) }),
          t("+{bonus} GPA points", { bonus: bonus.toFixed(3) }),
          t("{change} on the match rate", { change: pointsText(t, now - without) }),
          fit.exp === "mba-exec" ? t("work scale ×{x}", { x: mbaWorkGate(input.workYears) }) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      {st && (
        <Row
          k={t("Reported admits")}
          v={t("{fresh} fresh graduates · {graduated} graduated · {working} working", { fresh: st.fresh, graduated: st.graduated, working: st.working })}
          d={p.cases?.experience ? t("Of {n} with their background listed: {i} with internships, {w} with work", { n: p.cases.experience.sampled, i: p.cases.experience.internship, w: p.cases.experience.work }) : undefined}
        />
      )}
    </Rows>
  );
}
