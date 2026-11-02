"use client";

import { cn } from "cn";
import { ArrowUpRightIcon, ChevronDownIcon, CircleAlertIcon, CircleCheckIcon, CircleDotIcon, CircleHelpIcon } from "lucide-react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import type { Check } from "@/components/results/compare";
import { Fn, ReceiptSection, SourceList } from "@/components/shared/receipt";
import { FOCUS, NUDGE } from "@/components/shared/receipt/text";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { msg } from "@/lib/i18n/translate";
import { hostOf, type ReceiptView } from "@/lib/receipts/model";
import type { EnglishRule, ResultsProfile } from "@/lib/results-types";
import { Spinner } from "./spinner";

// The parts of a programme's detail around its admission range: each published minimum next to the
// student's answer, the requirement in the university's own words, the programme's class profile,
// and how to prepare.

// As in the results list: met in the skin's "safe" green, below in the danger colour, unknown outlined, information muted.
const STATE_STYLE: Record<Check["state"], string> = {
  meets: "border-border [&>svg]:text-(--rs-safe)",
  below: "border-destructive/50 [&>svg]:text-destructive",
  unknown: "border-dashed border-muted-foreground/50 [&>svg]:text-muted-foreground",
  info: "border-border text-muted-foreground [&>svg]:text-muted-foreground",
};

function StateIcon({ state }: { state: Check["state"] }) {
  const cls = "size-3.5 shrink-0";
  if (state === "meets") return <CircleCheckIcon className={cls} />;
  if (state === "below") return <CircleAlertIcon className={cls} />;
  if (state === "unknown") return <CircleHelpIcon className={cls} />;
  return <CircleDotIcon className={cls} />;
}

/** "✓ meets · ! below · ? check the wording": each published minimum next to the student's answer, never a verdict. */
export function CheckPills({ checks }: { checks: Check[] }) {
  const t = useT();
  if (!checks.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("Your answers against the published minimums")}>
      {checks.map((x) => (
        <li key={x.label}>
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  tabIndex={0}
                  className={cn("inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50", STATE_STYLE[x.state])}
                />
              }
            >
              <StateIcon state={x.state} />
              <span className="sr-only">{t(x.label)}: </span>
              <span className="truncate">{x.label === "English" ? x.need : `${t(x.label)} ${x.need}`}</span>
              {x.you && <span className="opacity-70">· {t("you {value}", { value: x.you })}</span>}
              <span className="sr-only">
                {x.state === "meets" ? t(": meets the published minimum") : x.state === "below" ? t(": below the published minimum") : x.state === "unknown" ? t(": check the official wording") : ""}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">{x.text}</TooltipContent>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

/** A disclosure in the detail panel. */
export function Section({ title, extra, children, defaultOpen, onOpenChange }: { title: string; extra?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  return (
    <Collapsible defaultOpen={defaultOpen} onOpenChange={onOpenChange} className="rounded-xl border border-(--rs-line)">
      <CollapsibleTrigger className="group/section flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="min-w-0 flex-1">
          {title}
          {extra && <span className="font-normal text-muted-foreground"> · {extra}</span>}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/section:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 px-3 pt-1 pb-3 text-sm">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** An official page opened in a new tab, in the receipt UI's style: the arrow is an icon and nudges on hover. */
function SourceLink({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-0.5 rounded-sm text-primary underline-offset-4 hover:underline", FOCUS, NUDGE)}>
      {children}
      <ArrowUpRightIcon aria-hidden className="size-3" />
    </a>
  );
}

const ENGLISH_RECEIPT = "results:english-exemption";

/**
 * The English waiver's sentence as a receipt (the shared receipt UI, decisions Q18 and C6). The build keeps
 * the sentence only when it is found on the page, so it is matched word for word. The page names no
 * publisher in this data, so its host stands in; the read date is not part of it, so the card shows none.
 */
function exemptionView(quote: string, url: string, general: boolean): ReceiptView {
  const host = hostOf(url);
  return {
    id: ENGLISH_RECEIPT,
    kind: "official",
    quote,
    mark: [],
    quoteKind: "sentence",
    publisher: host ?? url,
    title: general ? msg("The university’s general admissions page") : msg("The programme’s English requirement"),
    published: null,
    read: "",
    url,
    host,
    where: null,
    shot: null,
    match: "word-for-word",
  };
}

/** The academic requirement as the page words it, and the English waiver's wording with its receipt. */
/** The requirement in the university's words; where it isn't quoted (not read reliably, 2026-11-01), the official page. */
export function RequirementQuotes({ academic, englishRule, url }: { academic: string | null; englishRule: EnglishRule | null; url: string }) {
  const t = useT();
  const exemption = englishRule?.exemption ?? null;
  const receipts = exemption ? [exemptionView(exemption.quote, exemption.url, !!englishRule?.general)] : [];
  return (
    <Section title={t("Requirement, in their words")}>
      <ReceiptSection receipts={receipts} title={t("Requirement, in their words")}>
        {academic ? (
          <blockquote className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed">{academic}</blockquote>
        ) : (
          <p className="text-sm">
            <SourceLink url={url}>{t("Read the entry requirement on the official page")}</SourceLink>
          </p>
        )}
        {exemption && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">{englishRule?.general ? t("English, on the university’s general admissions page") : t("English")}</p>
            <blockquote className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed">
              {exemption.quote}
              <Fn id={ENGLISH_RECEIPT} />
            </blockquote>
          </div>
        )}
        <SourceList className="mt-1 pt-3" />
      </ReceiptSection>
    </Section>
  );
}

type Spread = { average: number | null; median: number | null; low: number | null; high: number | null };
type Shares = { name: string; pct: number | null }[];
const MAX_NAMES = 8;

/**
 * A programme's own class profile: who was admitted, in the figures the programme publishes. They
 * describe the class and are never set against the student's answers: a profile is not a cut-off.
 */
export function ClassProfileView({ profile: p }: { profile: ResultsProfile }) {
  const t = useT();
  const locale = useIntlLocale();
  const n = (v: number) => v.toLocaleString("en-SG", { maximumFractionDigits: 2 });
  const spread = (s: Spread | null, label?: string | null) =>
    s
      ? [
          s.average !== null ? t("{n} average", { n: n(s.average) }) : null,
          s.median !== null ? t("{n} median", { n: n(s.median) }) : null,
          s.low !== null && s.high !== null ? `${n(s.low)}–${n(s.high)}${label ? ` (${label})` : ""}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;
  const shares = (list: Shares, limit = MAX_NAMES) => {
    const shown = list.slice(0, limit).map((x) => (x.pct !== null ? `${x.name} ${n(x.pct)}%` : x.name));
    return list.length > limit ? `${shown.join(" · ")} · ${t("{n} more", { n: list.length - limit })}` : shown.join(" · ");
  };
  const work = [p.workYears !== null ? t("{n} years on average", { n: n(p.workYears) }) : null, p.withWorkPct !== null ? t("{n}% with work experience", { n: n(p.withWorkPct) }) : null].filter(Boolean).join(" · ");
  const facts: [string, string | null][] = [
    [t("Class size"), p.classSize !== null ? n(p.classSize) : null],
    [t("International"), p.internationalPct !== null ? `${n(p.internationalPct)}%` : null],
    [t("Women"), p.womenPct !== null ? `${n(p.womenPct)}%` : null],
    [t("Nationalities"), p.nationalities !== null ? n(p.nationalities) : null],
    [t("Age"), spread(p.age)],
    [t("Work experience"), work || null],
    [p.gpa?.scale ? t("GPA (out of {n})", { n: n(p.gpa.scale) }) : "GPA", spread(p.gpa, p.gpa?.label)],
    ["GMAT", spread(p.gmat)],
    ["GRE", spread(p.gre)],
    [t("Undergraduate schools"), p.undergradInstitutionsCount !== null ? n(p.undergradInstitutionsCount) : null],
  ];
  const lists = (
    [
      [t("Studied before at"), shares(p.undergradInstitutions)],
      [t("First degree from"), shares(p.undergradRegions)],
      [t("Where they come from"), shares(p.regions)],
      [t("Backgrounds"), shares(p.majors)],
    ] as [string, string][]
  ).filter(([, v]) => v);
  return (
    <Section title={t("Class profile, from the programme")} extra={p.intake}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="text-sm tabular-nums">{v}</dd>
            </div>
          ))}
      </dl>
      {lists.length > 0 && (
        <dl className="flex flex-col gap-2">
          {lists.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-xs text-muted-foreground">
        <SourceLink url={p.url}>{t("Official class profile")}</SourceLink> · {t("checked {date}", { date: new Date(`${p.checked}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })}
      </p>
    </Section>
  );
}

/**
 * "How should I prepare?": where the student's answers sit against this programme's published
 * minimums, then the "Before applying" steps drafted at build time from the programme's own quotes
 * (loaded the first time one is opened), and always the official page to check last.
 */
export function PrepareView({ checks, steps, loading, url, onOpen }: { checks: Check[]; steps: string[] | undefined; loading: boolean; url: string; onOpen: () => void }) {
  const t = useT();
  const gaps = checks.filter((c) => c.state === "below" || c.state === "unknown");
  return (
    <Section title={t("How should I prepare?")} onOpenChange={(open) => open && onOpen()}>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium">{t("Against the published requirements")}</p>
        {gaps.length ? (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-muted-foreground/60">
            {gaps.map((g) => (
              <li key={g.label}>
                <strong>{t(g.label)}:</strong> {g.text}. {g.state === "below" ? t("Below the published minimum.") : t("Check the official wording.")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("No gaps against the minimums we can compare with your answers.")}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium">{t("Before applying")}</p>
        {loading && !steps ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Spinner className="size-3.5" />
            {t("Loading…")}
          </p>
        ) : (
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm marker:text-muted-foreground">
            {(steps ?? []).map((s) => (
              <li key={s}>{s}</li>
            ))}
            <li>
              {t.rich("Check the application deadline, any prerequisites and the full requirements on the <a>official page</a> before you apply.", {
                a: (c) => <SourceLink url={url}>{c}</SourceLink>,
              })}
            </li>
          </ol>
        )}
      </div>
    </Section>
  );
}
