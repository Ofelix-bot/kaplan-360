"use client";

import type { CSSProperties } from "react";
import { ExternalLinkIcon, MousePointerClickIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { campusLabel, isAsia, studyCountry, type Row } from "@/components/results/facets";
import { useLocalName } from "@/components/results/names";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { useResultsData } from "@/lib/workspace/data";
import { transitions } from "@/lib/motion";
import { AdmitRangeView } from "./admit-range";
import { AdmittedCasesView } from "./admitted-cases";
import { useModel } from "./model";
import { MonthDots } from "./month-dots";
import { CheckPills, ClassProfileView, PrepareView, RequirementQuotes } from "./programme-parts";
import { ShortlistToggle } from "./shortlist-toggle";

// One programme in full: its facts, its admission range with the student's result on it, each
// other published minimum next to the student's answer, the requirement in the university's words,
// its class profile, how to prepare, and the official page.

const SYMBOL: Record<string, string> = { GBP: "£", EUR: "€", AUD: "A$", SGD: "S$", NZD: "NZ$", HKD: "HK$", USD: "US$", CAD: "C$", MOP: "MOP$", CNY: "RMB " };
export const money = (n: number, c: string | null) => `${(c && SYMBOL[c]) ?? (c ? `${c} ` : "")}${Math.round(n).toLocaleString("en-SG")}`;
// Length bars stand against two years.
const LENGTH_SCALE = 24;

/** A thin bar for a value against a scale, drawn from the left. */
function Meter({ value }: { value: number }) {
  return (
    <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <motion.span
        className="block h-full rounded-full bg-primary/60"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: Math.min(1, value) }}
        transition={transitions.enter}
        style={{ originX: 0 } as CSSProperties}
      />
    </span>
  );
}

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 flex min-w-0 flex-col gap-0.5" : "flex min-w-0 flex-col gap-0.5"}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function DetailEmpty() {
  const t = useT();
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MousePointerClickIcon />
        </EmptyMedia>
        <EmptyTitle>{t("Pick a programme")}</EmptyTitle>
        <EmptyDescription>{t("Its requirements, next to your answers, and who was admitted show here.")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function Detail({ row: { p, u, c } }: { row: Row }) {
  const t = useT();
  const locale = useIntlLocale();
  const local = useLocalName();
  const m = useModel();
  const steps = useResultsData((s) => s.prepare[p.discipline]?.[p.id]);
  const loading = useResultsData((s) => s.loadingFields.includes(p.discipline));
  const loadPrepare = useResultsData((s) => s.loadPrepare);
  const title = local(p.name, p.zh);
  const uni = local(u.name, u.zh);
  const campus = campusLabel(p, t);
  // The degree result is on the admission range above the other minimums.
  const pills = c.filter((x) => x.label !== "Degree");

  return (
    <motion.article
      key={p.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: transitions.exit }}
      transition={transitions.enter}
      className="flex flex-col gap-5 p-4"
    >
      <header className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {uni.name} · {t(u.country)}
          {u.qs && ` · QS ${u.qs}`}
        </p>
        <div>
          <h2 className="font-heading text-lg leading-snug font-semibold text-balance">{title.name}</h2>
          {title.en && (
            <p className="text-xs text-muted-foreground">
              {title.en}
              {title.translated && <span> · {t("translated name")}</span>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {u.partner && <Badge>{t("Kaplan partner")}</Badge>}
          {campus && <Badge variant={p.kaplan ? "default" : "secondary"} className={p.kaplan ? "bg-amber text-amber-text" : undefined}>{campus}</Badge>}
          {!p.kaplan && isAsia(studyCountry({ p, u })) && <Badge variant="secondary">{t("Asia")}</Badge>}
          {p.any && <Badge variant="outline">{t("Open to any subject")}</Badge>}
          {p.mode === "part-time" && (
            <Badge variant="outline" className="border-destructive/50 text-destructive" title={t("Part-time only: not for a Student’s Pass")}>
              {t("Part-time only")}
            </Badge>
          )}
          {p.language && !/^english$/i.test(p.language.trim()) && <Badge variant="outline">{t("Taught in {language}", { language: t(p.language) })}</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          <ShortlistToggle id={p.id} name={title.name} labelled />
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
            {t("Official page")}
            <span className="sr-only">: {p.name}</span>
            <ExternalLinkIcon className="size-3.5" />
          </a>
          <span className="text-xs text-muted-foreground">{t("checked {date}", { date: new Date(`${p.checked}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })}</span>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label={t("Fee")}>
          {p.fee ? (
            <>
              <span className="font-medium tabular-nums">{money(p.fee.amount, p.fee.currency)}</span>
              {p.fee.basis && <span className="text-muted-foreground"> {p.fee.basis}</span>}
              {p.feeSgd !== null && <Meter value={p.feeSgd / m.feeScale} />}
              {p.feeSgd !== null && p.fee.currency !== "SGD" && (
                <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                  {t(p.feeBasis === "one-year" ? "≈ S${n} a year (one-year course)" : "≈ S${n} a year", { n: p.feeSgd.toLocaleString("en-SG") })}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{t("Not stated")}</span>
          )}
        </Fact>
        <Fact label={t("Length")}>
          {p.months ? (
            <>
              <span className="font-medium tabular-nums">{p.months}</span> <span className="text-muted-foreground">{t("months")}</span>
              <Meter value={p.months / LENGTH_SCALE} />
            </>
          ) : (
            <span className="text-muted-foreground">{t("Not stated")}</span>
          )}
        </Fact>
        <Fact label={t("Starts")} wide>
          {p.intake ? <MonthDots mask={p.intake} /> : p.intakeText ? p.intakeText.slice(0, 40) : <span className="text-muted-foreground">{t("Not stated")}</span>}
        </Fact>
      </dl>

      <Separator />

      <AdmitRangeView range={p.range} minBasis={p.minBasis} university={{ name: uni.name, good: u.good }} you={m.you} tier={m.youCases?.tier ?? null} cases={p.cases}>
        {p.cases && <AdmittedCasesView cases={p.cases} p={p} you={m.youCases} source={m.data.cases} />}
      </AdmitRangeView>

      {pills.length > 0 && (
        <section aria-labelledby="checks-heading" className="flex flex-col gap-2">
          <h3 id="checks-heading" className="font-heading text-sm font-semibold">
            {t("Other requirements")}
          </h3>
          <CheckPills checks={pills} />
        </section>
      )}

      <div className="flex flex-col gap-2">
        <RequirementQuotes academic={p.academic} englishRule={p.englishRule} url={p.url} />
        {p.profile && <ClassProfileView profile={p.profile} />}
        <PrepareView checks={c} steps={steps} loading={loading} url={p.url} onOpen={() => loadPrepare(p.discipline)} />
      </div>
    </motion.article>
  );
}

export function ProgrammeDetail({ id }: { id: string | null }) {
  const { byId } = useModel();
  const row = id ? byId.get(id) : undefined;
  if (!row) return <DetailEmpty />;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Detail key={row.p.id} row={row} />
    </AnimatePresence>
  );
}
