"use client";

import { useId, useState } from "react";
import { ArrowRightIcon, ImageIcon, MicIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AutofillInput, type ReadSource } from "@/components/shared/autofill-input";
import type { WorkspaceProps } from "@/components/workspace/model";
import { BACKGROUNDS, backgroundCovers, defaultScale, FEES, finderOf, KINDS, REGIONS, required, resultFields, UK_CLASSES } from "@/lib/finder/answers";
import { directionLabel, directionsSaid } from "@/lib/finder/directions";
import { transitions } from "@/lib/motion";
import type { FinderAnswers, PlanAnswers } from "@/lib/plan-storage";
import { plannedDegree } from "@/lib/plan-storage";
import { withSentence, type ProfileReading } from "@/lib/profile-reading";
import { usePlanStore } from "@/lib/workspace/plan-store";
import { LIST_HREF } from "./questionnaire";

// "One sentence": the server reads the sentence into the plan's fields (app/api/profile, as on /results), the
// finder adds the directions it names, and the six answers are filled in at once, shown as a summary to check.
// The box itself (typed or spoken, with screenshots and PDFs) is components/shared/autofill-input.tsx; the rows a
// reading filled carry a small image or microphone mark.

/** The fee band a budget falls in. */
const bandOf = (budget: number | null | undefined): FinderAnswers["fee"] => (budget ? (FEES.find((b) => budget <= b.max)?.id ?? null) : null);

/** The plan answers and the finder's own, from a reading (also the parents' page, components/parents). */
export function applied(answers: PlanAnswers, reading: ProfileReading, text: string, props: WorkspaceProps): PlanAnswers {
  const p = reading.patch;
  const next = withSentence(answers, p);
  const degreeId = plannedDegree(next);
  const degree = props.programmes.find((x) => x.id === degreeId);
  const university = (degreeId && props.awarders[degreeId]?.university) || null;
  const field = degree?.discipline ?? reading.field;
  const f = finderOf(answers);
  const background = field ? (BACKGROUNDS.find((b) => backgroundCovers(b.id).includes(field))?.id ?? field) : f.background;
  const kind: FinderAnswers["kind"] = next.level === "diploma" ? "diploma" : next.level === "degree" ? "bachelor" : f.kind;
  // The result as said: a GPA (on the university's own scale when it has one, else read as out of 4), an average, or a class.
  let scale = f.scale ?? defaultScale(university);
  let gpa = f.gpa;
  let result: Partial<PlanAnswers> = {};
  if (p.degreeGpa != null) {
    scale = scale === "uk" || scale === "100" ? "4.0" : scale;
    gpa = p.degreeGpa;
    result = resultFields(university, scale, gpa, null);
  } else if (p.averageMark != null) {
    scale = "100";
    gpa = p.averageMark;
    result = resultFields(university, scale, gpa, null);
  } else if (p.classification) {
    scale = "uk";
    gpa = null;
    result = resultFields(university, scale, null, p.classification);
  }
  const said = directionsSaid(text);
  const regions = p.countries?.length ? REGIONS.filter((r) => p.countries!.some((c) => r.has(c))).map((r) => r.id) : f.regions;
  return {
    ...next,
    ...result,
    finder: { ...f, background, kind, scale, gpa, directions: reading.directions?.length ? reading.directions : said.length ? said : f.directions, fee: p.budget ? bandOf(p.budget) : f.fee, regions },
  };
}

/** The summary's six answers in raw form, to tell which rows a reading changed. */
function summaryOf(answers: PlanAnswers): Record<string, string | null> {
  const f = finderOf(answers);
  const gpa = f.scale === "uk" ? (answers.classification && answers.classification !== "unsure" ? answers.classification : null) : f.gpa !== null ? `${f.scale}:${f.gpa}` : null;
  return {
    background: f.background,
    kind: f.kind,
    gpa,
    directions: f.directions.length ? f.directions.join() : null,
    fee: f.fee,
    regions: f.regions.length ? f.regions.join() : null,
  };
}

export function SentenceFill({ props, onCheck }: { props: WorkspaceProps; onCheck: () => void }) {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const answers = usePlanStore((s) => s.answers);
  const update = usePlanStore((s) => s.update);
  const [filled, setFilled] = useState(false);
  const [source, setSource] = useState<ReadSource>(null);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const sep = locale === "en" ? ", " : "、";

  const onRead = (reading: ProfileReading, text: string, from: ReadSource) => {
    const before = summaryOf(usePlanStore.getState().answers);
    const next = applied(usePlanStore.getState().answers, reading, text, props);
    update(next);
    const after = summaryOf(next);
    setMarked(new Set(Object.keys(after).filter((k) => after[k] !== null && after[k] !== before[k])));
    setSource(from);
    setFilled(true);
  };

  const f = finderOf(answers);
  const background = f.background ? (BACKGROUNDS.find((b) => b.id === f.background)?.label ?? props.disciplines[f.background] ?? null) : null;
  const kind = f.kind ? KINDS.find((k) => k.id === f.kind)! : null;
  const gpa =
    f.scale === "uk"
      ? answers.classification && answers.classification !== "unsure"
        ? t(UK_CLASSES.find((c) => c.id === answers.classification)!.label)
        : null
      : f.gpa !== null
        ? f.scale === "100"
          ? `${f.gpa}%`
          : f.gpa.toFixed(2)
        : null;
  const fee = f.fee ? t(FEES.find((b) => b.id === f.fee)!.label) : null;
  const regions = f.regions.length ? f.regions.map((r) => t(REGIONS.find((x) => x.id === r)?.label ?? "Other")).join(sep) : null;
  const rows: { id: string; k: string; v: string | null; note?: string }[] = [
    { id: "background", k: t("Subject background"), v: background && t(background) },
    { id: "kind", k: t("Degree level"), v: kind && (locale === "en" ? kind.en : `${t(kind.label)} ${kind.en}`) },
    { id: "gpa", k: "GPA", v: gpa, note: f.scale && f.scale !== "uk" && f.scale !== "100" && gpa ? t("(read as out of {scale})", { scale: f.scale }) : undefined },
    { id: "directions", k: t("Master’s direction"), v: f.directions.length ? f.directions.map((d) => t(directionLabel(d))).join(sep) : null },
    { id: "fee", k: t("Tuition you want"), v: fee },
    { id: "regions", k: t("Region"), v: regions },
  ];
  const markLabel = source === "file" ? t("Read from your files") : t("Read from what you said");
  const n = rows.filter((r) => r.v).length;
  // The needed answers the sentence didn't give (most often the Kaplan degree itself): filled in on Quick choice.
  const need = required(answers);
  const missing = [!need.degree && t("Your Kaplan degree"), !need.gpa && "GPA", !need.directions && t("Master’s direction"), !need.english && t("English test")].filter((x): x is string => !!x);

  return (
    <div className="flex flex-col gap-6">
      <AutofillInput
        title={t("Describe your situation in one sentence")}
        hint={t("Say your subject, degree, grades and the direction you want; add a budget or a region if you have one.")}
        placeholder={t("I study a UCD finance top-up at Kaplan, GPA 3.4, and want a master’s in finance or sustainability.")}
        button={t("Fill it in for me")}
        onRead={onRead}
      />

      <AnimatePresence initial={false}>
        {filled && (
          <motion.section
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: transitions.exit }}
            aria-labelledby={`${id}-done`}
            className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex flex-col gap-1">
              <h2 id={`${id}-done`} className="text-[17px] font-bold">
                {t("We filled in {n}", { n })}
              </h2>
              <p className="text-sm text-muted-foreground">{t("Check them; change anything that’s wrong.")}</p>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
              {rows.map((r, i) => (
                <div key={r.id} className="flex flex-col gap-1">
                  <dt className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    {i + 1} · {r.k}
                    {source && marked.has(r.id) && (
                      <Tooltip>
                        <TooltipTrigger
                          render={<span tabIndex={0} aria-label={markLabel} className="inline-grid size-4 place-items-center rounded text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />}
                        >
                          {source === "file" ? <ImageIcon aria-hidden className="size-3.5" /> : <MicIcon aria-hidden className="size-3.5" />}
                        </TooltipTrigger>
                        <TooltipContent>{markLabel}</TooltipContent>
                      </Tooltip>
                    )}
                  </dt>
                  <dd className={cn("text-[15px]", !r.v && "text-muted-foreground")}>
                    {r.v ?? t("Not mentioned: any")}
                    {r.note && <span className="ml-1 text-xs text-muted-foreground">{r.note}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            {missing.length > 0 && <p className="text-sm font-semibold text-(--fd-gap)">{t("Still needed: {list}", { list: missing.join(sep) })}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant={missing.length ? "default" : "outline"} className="h-12 rounded-xl px-5 text-[15px] font-bold" onClick={onCheck}>
                {t("Check / change")}
              </Button>
              {!missing.length && (
                <Link href={LIST_HREF} className={cn(buttonVariants(), "h-12 gap-2 rounded-xl px-5 text-[15px] font-bold")}>
                  {t("Next: see programmes")}
                  <ArrowRightIcon aria-hidden />
                </Link>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
