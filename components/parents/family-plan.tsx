"use client";

import { useId, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, BadgeCheckIcon, BriefcaseIcon, CalendarIcon, CheckIcon, CircleSlashIcon, CopyIcon, ExternalLinkIcon, GraduationCapIcon, InfoIcon, MessageCircleIcon, PrinterIcon, SparklesIcon, WalletIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { useIntlLocale, useLocale, useLocalize, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { lengthText, ProgrammeCard } from "@/components/finder/programme-card";
import type { FinderRow } from "@/components/finder/use-finder";
import { useLocalName } from "@/components/results/names";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useModel, type Model } from "@/components/workspace/model";
import { money } from "@/components/workspace/programme-detail";
import { Spinner } from "@/components/workspace/spinner";
import { localToday } from "@/lib/benefit-state";
import { monthYear } from "@/lib/i18n/format";
import { FX_DATE, sgdToCny, totalFeeSgd, type FamilyNeeds, type FamilyPlan } from "@/lib/parent-plan";
import { planInput, type PlanSources } from "@/lib/plan-input";
import { itemWhen } from "@/lib/plan-road";
import { buildPlan, LANES as PLAN_LANES, monthOf, type PlanItem } from "@/lib/plan-timeline";

// The parents' plan (components/parents/parents-app.tsx), in the order parents weigh it: cost, the programmes,
// what graduates earn, recognition in China, the months ahead, and what to talk over with the child. Claude wrote
// only the summary, a reason per programme, this month's steps and the questions (lib/parent-ai.ts); every figure
// on the page comes from the site's own data: fees at MAS rates, SWDA's employment survey, CSCSE's list, and the
// dates /plan works out for the same three programmes (lib/plan-timeline.ts buildPlan).

/** The official facts the page gets from the server (app/[lang]/parents/page.tsx). */
export type ParentsFacts = {
  cscse: { url: string; published: string; rows: { university: string | null; institution: string; from: string }[] };
  outcomes: {
    pei: { cohort: string; ftp: number; salary: number };
    au: { cohort: string; ftp: number; salary: number };
    source: { name: string; url: string; published: string | null };
  };
};

const noSubscribe = () => () => {};
const LANES = new Set(["study", "tests", "applications", "scholarships"]);
const LANE_LABEL = Object.fromEntries(PLAN_LANES.map((l) => [l.id, l.label])) as Record<PlanItem["lane"], string>;
const BASIS = { official: "Official", typical: "Estimated", yours: "Yours" } as const;

/** RMB, rounded to the thousand, in the page's language (RMB 311,000 in English, ¥311,000 in Chinese). */
function useCny() {
  const t = useT();
  return (sgd: number) => t("RMB {amount}", { amount: (Math.round(sgdToCny(sgd) / 1000) * 1000).toLocaleString("en-SG") });
}

function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" aria-label={label} className="grid size-6 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40" />
        }
      >
        <InfoIcon aria-hidden className="size-4" />
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{children}</TooltipContent>
    </Tooltip>
  );
}

function Section({ icon: Icon, title, info, children }: { icon: LucideIcon; title: string; info?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-muted">
          <Icon aria-hidden className="size-4" />
        </span>
        <h3 id={id} className="text-[17px] font-bold">
          {title}
        </h3>
        {info && <InfoTip label={title}>{info}</InfoTip>}
      </div>
      {children}
    </section>
  );
}

/** /plan's road for the three programmes (the student's own answers, those three as the shortlist), worked out in the browser. */
function usePicksPlan(ids: string[], sources: PlanSources) {
  const m = useModel();
  const t = useT();
  const locale = useIntlLocale();
  const local = useLocalName();
  const names = useSiteNames();
  const today = useSyncExternalStore(noSubscribe, localToday, () => null);
  const key = ids.join(",");
  return useMemo(() => {
    if (!today) return null;
    const plan = buildPlan({
      ...planInput({ today, answers: { ...m.answers, shortlist: ids }, data: m.data, sources }),
      t,
      locale,
      name: local,
      school: (en) => names.school(en).name,
      degreeName: (en) => names.degree(en).name,
    });
    return { plan, today };
    // `ids` enters through key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, today, m.answers, m.data, sources, t, locale, local, names]);
}

function Cost({ rows, needs }: { rows: FinderRow[]; needs: FamilyNeeds }) {
  const t = useT();
  const cny = useCny();
  const local = useLocalName();
  const budget = needs.budgetSgd;
  const totals = rows.map((r) => totalFeeSgd(r.p));
  const scale = Math.max(budget ?? 0, ...totals.map((x) => x ?? 0)) * 1.08 || 1;
  const scope = needs.budgetScope === "all-total" ? t("everything, for the whole master’s") : needs.budgetScope === "tuition-total" ? t("tuition, for the whole master’s") : t("tuition a year");
  const yearly = needs.budgetScope === "tuition-year";
  const from = needs.budgetFrom;
  const written = from ? (from.currency === "CNY" ? t("RMB {amount}", { amount: from.amount.toLocaleString("en-SG") }) : money(from.amount, from.currency)) : budget ? money(budget, "SGD") : null;
  return (
    <Section icon={WalletIcon} title={t("Cost")} info={t("Tuition for the whole master’s: the yearly fee times its years, in RMB at the MAS rate of {date}. Living costs aren’t included.", { date: FX_DATE })}>
      {budget && (
        <p className="text-[15px]">
          <span className="text-muted-foreground">{t("Your budget")} </span>
          <span className="font-semibold">{written}</span>
          <span className="text-muted-foreground"> · {scope}</span>
        </p>
      )}
      <ul className="flex flex-col gap-4">
        {rows.map((r, i) => {
          const total = totals[i];
          const value = yearly ? r.p.feeSgd : total;
          const over = budget !== null && value !== null && value > budget;
          const name = local(r.p.name, r.p.zh).name;
          return (
            <li key={r.p.id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="min-w-0 truncate text-[15px] font-semibold">{name}</span>
                <span className="text-[15px] font-bold tabular-nums">
                  {total !== null ? cny(total) : t("Fee not stated")}
                  {total !== null && <span className="ml-2 text-sm font-normal text-muted-foreground">{money(total, "SGD")}</span>}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-muted" aria-hidden>
                {value !== null && <div className={cn("h-full rounded-full", over ? "bg-(--fd-gap)" : "bg-(--fd-met)")} style={{ width: `${Math.min(100, (value / scale) * 100)}%` }} />}
                {budget && <div className="absolute -top-1 h-4.5 w-0.5 rounded bg-foreground" style={{ left: `${(budget / scale) * 100}%` }} />}
              </div>
              <span className="text-sm text-muted-foreground">
                {[lengthText(t, r.p.months), r.p.feeSgd !== null && t("{amount} a year", { amount: money(r.p.feeSgd, "SGD") }), over && t("Over your budget")].filter(Boolean).join(" · ")}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function Programmes({ rows, reasons }: { rows: FinderRow[]; reasons: Map<string, string | null> }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Section icon={GraduationCapIcon} title={t("Programmes")}>
      <ol className="flex flex-col gap-5">
        {rows.map((r, i) => {
          const reason = reasons.get(r.p.id);
          return (
            <li key={r.p.id} className="flex flex-col gap-2">
              <p className="flex items-start gap-2 text-[15px]">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background">{i + 1}</span>
                {reason ? (
                  <span>
                    <SparklesIcon aria-hidden className="mr-1 inline size-3.5 text-(--fd-met)" />
                    <span className="sr-only">{t("Written by AI")}: </span>
                    {reason}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t("Next in the finder’s order")}</span>
                )}
              </p>
              <ProgrammeCard r={r} open={open === r.p.id} onToggle={() => setOpen(open === r.p.id ? null : r.p.id)} />
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function Outcomes({ facts }: { facts: ParentsFacts["outcomes"] }) {
  const t = useT();
  const cny = useCny();
  const stat = (label: string, x: { ftp: number; salary: number }) => (
    <div className="flex flex-col gap-1 rounded-xl bg-muted p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-[28px] leading-tight font-bold tabular-nums">{x.ftp}%</span>
      <span className="text-sm">{t("in full-time permanent jobs six months after graduating")}</span>
      <span className="text-sm text-muted-foreground">{t("Median pay {amount} a month ({cny})", { amount: money(x.salary, "SGD"), cny: cny(x.salary) })}</span>
    </div>
  );
  return (
    <Section icon={BriefcaseIcon} title={t("After graduating")} info={t("Singapore’s official survey of fresh graduates. There are no official figures for jobs in mainland China in our sources.")}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stat(t("Singapore private-school degrees, {cohort}", { cohort: facts.pei.cohort }), facts.pei)}
        {stat(t("Singapore’s public universities, {cohort}", { cohort: facts.au.cohort }), facts.au)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={facts.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline">
          {facts.source.name}
          <ExternalLinkIcon aria-hidden className="size-3.5" />
        </a>
        <Link href="/careers" className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-1.5 rounded-xl px-4 text-sm font-semibold")}>
          {t("Jobs the degree leads to")}
          <ArrowRightIcon aria-hidden />
        </Link>
      </div>
    </Section>
  );
}

const plainName = (s: string) =>
  s
    .toLowerCase()
    .split(",")[0]
    .replace(/[^a-z ]/g, "")
    .trim();

/** The child's degree in CSCSE's list: the school and the university awarding it, as the answers give them. */
function recognitionOf(m: Model, cscse: ParentsFacts["cscse"]): { school: string; university: string; from: string | null } | null {
  const other = m.answers.school ? m.schools.find((s) => s.id === m.answers.school) : null;
  const school = other ? other.name : "Kaplan Higher Education Academy";
  const university = other ? m.answers.schoolAwarder : m.university;
  if (!university) return null;
  const u = plainName(university);
  const s = plainName(school).split(" ")[0];
  const row = cscse.rows.find((r) => r.university && plainName(r.institution).startsWith(s) && (plainName(r.university).includes(u) || u.includes(plainName(r.university))));
  return { school: other ? other.name : "Kaplan", university, from: row?.from ?? null };
}

function Recognition({ cscse }: { cscse: ParentsFacts["cscse"] }) {
  const t = useT();
  const locale = useIntlLocale();
  const m = useModel();
  const names = useSiteNames();
  const r = recognitionOf(m, cscse);
  const from = r?.from ? monthYear(locale, monthOf(`${r.from}-01`), "long") : null;
  return (
    <Section icon={BadgeCheckIcon} title={t("Recognition in China")} info={t("CSCSE’s list covers the degree your child studies in Singapore. Recognition of the master’s itself isn’t in our data.")}>
      {r ? (
        <p className="flex items-start gap-2 text-[15px]">
          {r.from ? <CheckIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-(--fd-met)" /> : <CircleSlashIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-(--fd-gap)" />}
          <span>
            {r.from
              ? t("{school} × {university}: in CSCSE’s list, for certificates issued from {month}.", { school: r.school, university: names.school(r.university).name, month: from! })
              : t("{school} × {university}: not in CSCSE’s list.", { school: r.school, university: names.school(r.university).name })}
          </span>
        </p>
      ) : (
        <p className="text-[15px] text-muted-foreground">{t("Name your child’s degree in the text to check it.")}</p>
      )}
      <a href={cscse.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground underline-offset-4 hover:underline">
        {t("CSCSE, Singapore private institutions’ recognition list, {date}", { date: cscse.published })}
        <ExternalLinkIcon aria-hidden className="size-3.5" />
      </a>
    </Section>
  );
}

/** What is due soonest on /plan's road for the three: each item's date line as the road words it, and its lane. */
function Months({ items, today, onPlan }: { items: PlanItem[]; today: string; onPlan: () => void }) {
  const t = useT();
  const locale = useIntlLocale();
  const due = (i: PlanItem) => i.due ?? i.to ?? i.from;
  // A master's plan: the undergraduate awards some universities list sit on their pages but not in it.
  const shown = items
    .filter((i) => LANES.has(i.lane) && due(i) >= today && !/undergraduate/i.test(i.title))
    .sort((a, b) => due(a).localeCompare(due(b)))
    .slice(0, 6);
  return (
    <Section icon={CalendarIcon} title={t("The months ahead")}>
      {shown.length ? (
        <ol className="flex flex-col divide-y divide-border">
          {shown.map((i) => (
            <li key={i.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0">
              <span className="text-sm font-semibold tabular-nums">{itemWhen(i, today, { t, locale })}</span>
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[15px]">
                <span className="rounded bg-muted px-1.5 text-xs font-medium text-muted-foreground">{t(LANE_LABEL[i.lane])}</span>
                <span className={cn(i.key && "font-semibold")}>{i.short}</span>
                <span className="text-xs text-muted-foreground">{t(BASIS[i.basis])}</span>
                {i.url && (
                  <a href={i.url} target="_blank" rel="noreferrer" aria-label={t("Official page")} className="text-muted-foreground hover:text-foreground">
                    <ExternalLinkIcon aria-hidden className="inline size-3.5" />
                  </a>
                )}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[15px] text-muted-foreground">{t("No dates yet for these programmes.")}</p>
      )}
      <Button variant="outline" onClick={onPlan} className="h-10 gap-1.5 self-start rounded-xl px-4 text-sm font-semibold">
        {t("The full timeline in the plan")}
        <ArrowRightIcon aria-hidden />
      </Button>
    </Section>
  );
}

/** This month's steps and the questions: the second call, `briefing` until it answers (the section goes if it fails). */
function Talk({ plan, writer, briefing }: { plan: FamilyPlan; writer: FamilyNeeds["writer"]; briefing: boolean }) {
  const t = useT();
  if (!plan.todo.length && !plan.talk.length && !briefing) return null;
  return (
    <Section icon={MessageCircleIcon} title={writer === "parent" ? t("To talk over with your child") : t("What to do next")}>
      {briefing && (
        <p role="status" className="flex items-center gap-2 text-[15px] text-muted-foreground">
          <Spinner className="size-4" />
          {t("Writing this month’s steps")}
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {plan.todo.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-muted-foreground">{t("This month")}</h4>
            <ul className="flex flex-col gap-2">
              {plan.todo.map((x) => (
                <li key={x.text} className="flex items-start gap-2 text-[15px]">
                  {writer === "parent" && (
                    <Badge variant="outline" className="mt-0.5 shrink-0">
                      {x.who === "child" ? t("Child") : t("Parent")}
                    </Badge>
                  )}
                  <span>{x.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {plan.talk.length > 0 && writer === "parent" && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-muted-foreground">{t("Questions for your child")}</h4>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px]">
              {plan.talk.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}

/** The plan as plain text, to paste into a chat with the child. */
function planText(x: { title: string; plan: FamilyPlan; rows: FinderRow[]; reasons: Map<string, string | null>; line: (r: FinderRow) => string; sep: string; todo: string; talk: string }) {
  const lines = [x.title, x.plan.summary.join(x.sep), ""];
  x.rows.forEach((r, i) => {
    lines.push(`${i + 1}. ${x.line(r)}`);
    const reason = x.reasons.get(r.p.id);
    if (reason) lines.push(`   ${reason}`);
    lines.push(`   ${r.p.url}`);
  });
  if (x.plan.todo.length) lines.push("", x.todo, ...x.plan.todo.map((d) => `- ${d.text}`));
  if (x.plan.talk.length) lines.push("", x.talk, ...x.plan.talk.map((q) => `- ${q}`));
  return lines.join("\n").trim();
}

export function FamilyPlanView({
  plan,
  rows,
  needs,
  ai,
  briefing,
  kept,
  facts,
  sources,
  onRetry,
}: {
  plan: FamilyPlan;
  rows: FinderRow[];
  needs: FamilyNeeds;
  ai: boolean;
  briefing: boolean;
  kept: number;
  facts: ParentsFacts;
  sources: PlanSources;
  onRetry: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const localize = useLocalize();
  const router = useRouter();
  const m = useModel();
  const local = useLocalName();
  const cny = useCny();
  const [copied, setCopied] = useState(false);
  const picks = plan.picks.flatMap((p) => rows.filter((r) => r.p.id === p.id));
  const reasons = new Map(plan.picks.map((p) => [p.id, p.reason]));
  const road = usePicksPlan(
    picks.map((r) => r.p.id),
    sources,
  );
  const title = needs.writer === "parent" ? t("A plan for your child") : t("Your plan");
  const sep = locale === "en" ? " " : "";

  // The three join the student's shortlist (the plan's timeline reads it), first in it, then /plan opens.
  const toPlan = () => {
    picks
      .slice()
      .reverse()
      .forEach((r) => m.addToShortlist(r.p.id, 0));
    router.push(localize("/plan"));
  };
  const copy = async () => {
    const line = (r: FinderRow) => {
      const total = totalFeeSgd(r.p);
      return [local(r.p.name, r.p.zh).name, local(r.u.name, r.u.zh).name, r.u.qs && `QS #${r.u.qs.replace(/^=/, "")}`, lengthText(t, r.p.months), total !== null && cny(total)].filter(Boolean).join(" · ");
    };
    try {
      await navigator.clipboard.writeText(planText({ title, plan, rows: picks, reasons, line, sep, todo: t("This month"), talk: t("Questions for your child") }));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[24px] leading-tight font-bold tracking-tight">{title}</h2>
          {ai && (
            <Badge variant="secondary" className="gap-1">
              <SparklesIcon aria-hidden className="size-3" />
              {t("Written by AI from your words")}
            </Badge>
          )}
        </div>
        {ai && plan.summary.length > 0 && <p className="text-[17px] leading-relaxed">{plan.summary.join(sep)}</p>}
        {!ai && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-(--fd-gap-bg) px-4 py-3 text-[15px]">
            <span>{t("The AI didn’t answer in time: these are the finder’s top three, without written reasons.")}</span>
            <Button variant="outline" onClick={onRetry} className="h-9 rounded-lg px-3 text-sm font-semibold">
              {t("Try again")}
            </Button>
          </div>
        )}
      </header>

      <Cost rows={picks} needs={needs} />
      <Programmes rows={picks} reasons={reasons} />
      <Outcomes facts={facts.outcomes} />
      <Recognition cscse={facts.cscse} />
      {road && <Months items={road.plan.items} today={road.today} onPlan={toPlan} />}
      <Talk plan={plan} writer={needs.writer} briefing={briefing} />

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()} className="h-12 gap-2 rounded-xl px-4 text-[15px] font-semibold">
          <PrinterIcon aria-hidden />
          {t("Print")}
        </Button>
        <Button variant="outline" onClick={() => void copy()} className="h-12 gap-2 rounded-xl px-4 text-[15px] font-semibold">
          {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
          {copied ? t("Copied") : t("Copy as text")}
        </Button>
        <Link href="/results" className={cn(buttonVariants({ variant: "outline" }), "h-12 gap-2 rounded-xl px-4 text-[15px] font-semibold")}>
          {t("All {n} in the finder", { n: kept })}
        </Link>
        <Button onClick={toPlan} className="h-12 gap-2 rounded-xl px-5 text-[15px] font-bold sm:ml-auto">
          {t("Add the three to the plan")}
          <ArrowRightIcon aria-hidden />
        </Button>
      </div>
    </div>
  );
}
