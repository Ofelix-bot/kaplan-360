"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, PencilIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { useLocale, useLocalize, useT } from "@/components/i18n/I18nProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModel } from "@/components/workspace/model";
import { ExampleBannerUi } from "@/components/shared/WorkedExampleBanner";
import { EditProfileLink } from "@/components/profile/EditProfileLink";
import { allRequired, BACKGROUNDS, backgroundCovers, FEES, finderOf, kindOf, KINDS, REGIONS, UK_CLASSES } from "@/lib/finder/answers";
import { plannedDegree } from "@/lib/plan-storage";
import { directionLabel } from "@/lib/finder/directions";
import { transitions } from "@/lib/motion";
import { Pill } from "./parts";
import { ProgrammeCard } from "./programme-card";
import { SituationPopover } from "./situation-popover";
import { CriteriaBar } from "./standing";
import { MAX_COMPARE, useFinderList, type FinderTab } from "./use-finder";

// The programmes for the student (/results): their answers as chips, then the programmes that fit, 20 at a
// time, each with its requirements next to the student's answers. "Compare" boxes fill a bar that opens the
// comparison. Without the four needed answers the page sends the student back to the questions; "Edit answers"
// opens /profile at Part 2, where the finder's answers live.

export const START_HREF = "/results/start";
export const COMPARE_HREF = "/results/compare";
const PAGE = 20;

function Cond({ k, v }: { k: string; v: ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 text-sm whitespace-nowrap">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </span>
  );
}

/** The student's answers as chips, with the way back to the questions; English and work open their own popover. */
export function Conditions({ label }: { label: string }) {
  const t = useT();
  const locale = useLocale();
  const { answers: a, disciplines, programmes } = useModel();
  const f = finderOf(a);
  // The background and level follow from the degree when the finder didn't ask them (the profile had the degree).
  const degree = programmes.find((p) => p.id === plannedDegree(a));
  const background = f.background ?? (degree ? (BACKGROUNDS.find((b) => backgroundCovers(b.id).includes(degree.discipline))?.id ?? degree.discipline) : null);
  const sep = locale === "en" ? ", " : "、";
  const any = t("Any");
  const kind = KINDS.find((k) => k.id === kindOf(a));
  const bg = BACKGROUNDS.find((b) => b.id === background)?.label ?? (background ? disciplines[background] : null);
  const gpa = f.scale === "uk" ? (a.classification ? t(UK_CLASSES.find((c) => c.id === a.classification)!.label) : "—") : f.gpa !== null ? (f.scale === "100" ? `${f.gpa}%` : `${f.gpa.toFixed(2)} / ${f.scale}`) : "—";
  const english = a.englishTest === "none" ? t("not yet") : a.englishTest && a.englishScore !== null ? `${a.englishTest.toUpperCase()} ${a.englishScore}` : t("not filled in");
  // Not filled in counts as none (lib/finder/row-state.ts hardMiss), and the chip says so.
  const work = a.workYears !== null ? (a.workYears === 0 ? t("none yet") : t(a.workYears === 1 ? "1 year" : "{n} years", { n: a.workYears })) : a.workExperience === "none" ? t("none yet") : a.workExperience === "have" ? t("not filled in") : t("not filled in, counted as none");
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:px-5">
      <span className="shrink-0 text-sm font-semibold">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        <Cond k={t("Background")} v={bg ? t(bg) : "—"} />
        <Cond k={t("Degree level")} v={kind ? (locale === "en" ? kind.en : `${t(kind.label)} ${kind.en}`) : "—"} />
        <Cond k="GPA" v={gpa} />
        <Cond k={t("Direction")} v={f.directions.map((d) => t(directionLabel(d))).join(sep) || "—"} />
        <Cond k={t("Fee")} v={f.fee ? t(FEES.find((b) => b.id === f.fee)!.label) : any} />
        <Cond k={t("Area")} v={f.regions.length ? f.regions.map((r) => t(REGIONS.find((x) => x.id === r)?.label ?? "Other")).join(sep) : any} />
        <SituationPopover
          trigger={
            <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-sm whitespace-nowrap hover:bg-muted">
              <span className="text-muted-foreground">{t("English")}</span>
              <span className="font-medium">{english}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{t("Work")}</span>
              <span className="font-medium">{work}</span>
              <PencilIcon aria-hidden className="size-3 text-muted-foreground" />
            </button>
          }
        />
      </div>
      <EditProfileLink part={2} className="font-bold">
        {t("Edit answers")}
      </EditProfileLink>
    </div>
  );
}

/** The flow's two stops: the programmes here, and the plan. */
function StepTabs() {
  const t = useT();
  return (
    <nav aria-label={t("Steps")} className="flex gap-7 border-b border-border">
      <span aria-current="page" className="-mb-px border-b-2 border-primary pb-3 text-[15px] font-bold">
        1 · {t("Programmes")}
      </span>
      <Link href="/plan" className="-mb-px border-b-2 border-transparent pb-3 text-[15px] text-muted-foreground hover:text-foreground">
        2 · {t("Your plan")}
      </Link>
    </nav>
  );
}

export function Legend() {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <Pill state="met">{t("Meets it")}</Pill>
      <Pill state="gap">{t("A gap")}</Pill>
      <Pill state="none">{t("Not required")}</Pill>
      <span className="ml-1">{t("Where you are: the match rate, from the official requirements, past admissions and offer rates. Red under 30%, amber 30–60%, green above 60%.")}</span>
    </div>
  );
}

/** The bar that appears once a programme is ticked to compare. */
function CompareBar() {
  const t = useT();
  const { answers } = useModel();
  const n = Math.min(answers.shortlist.length, MAX_COMPARE);
  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16, transition: transitions.exit }} className="pointer-events-none sticky bottom-4 z-10 flex justify-center">
          <Link href={COMPARE_HREF} className={cn(buttonVariants(), "pointer-events-auto h-12 gap-2 rounded-xl px-6 text-[15px] font-bold shadow-lg")}>
            {t("Compare {n} / {m}", { n, m: MAX_COMPARE })}
            <ArrowRightIcon aria-hidden />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FinderList() {
  const t = useT();
  const router = useRouter();
  const localize = useLocalize();
  const { answers } = useModel();
  const { list, left, counts, criteria, setCriteria, tab, setTab } = useFinderList();
  const leftOut = left["part-time"] + left.work + left.english;
  const reasons = [
    left.work > 0 && t("work experience {n}", { n: left.work }),
    left["part-time"] > 0 && t("part-time only {n}", { n: left["part-time"] }),
    left.english > 0 && t("English score {n}", { n: left.english }),
  ].filter(Boolean);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const ready = allRequired(answers);
  useEffect(() => {
    if (!ready) router.replace(localize(START_HREF));
  }, [ready, router, localize]);
  if (!ready) return null;
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-4 pt-10 pb-16 sm:px-6 sm:pt-12">
      <ExampleBannerUi skin="results" className="border-border bg-muted" />
      <header className="flex flex-col items-start gap-3">
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">QS 2027</span>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight sm:text-[32px]">{t("Programmes for you")}</h1>
        <p className="text-[15px] text-muted-foreground">{t("Every official requirement has your answer next to it.")}</p>
        <EditProfileLink part={2} className="font-semibold">
          {t("Edit answers")}
        </EditProfileLink>
      </header>
      <Conditions label={t("Your criteria")} />
      <StepTabs />
      <Tabs value={tab} onValueChange={(v) => (setTab(v as FinderTab), setShown(PAGE))} className="items-start">
        <TabsList className="h-11! w-full rounded-xl p-1 sm:w-fit">
          <TabsTrigger value="all" className="flex-1 px-4 text-[15px] font-semibold sm:flex-none">
            {t("All programmes")} <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{counts.all.toLocaleString("en-SG")}</span>
          </TabsTrigger>
          <TabsTrigger value="kaplan" className="flex-1 px-4 text-[15px] font-semibold sm:flex-none">
            {t("Kaplan Singapore master’s")} <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{counts.kaplan}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-3">
        <CriteriaBar value={criteria} onChange={(c) => (setCriteria(c), setShown(PAGE))} />
        <div className="flex flex-col gap-1" aria-live="polite">
          <p className="text-[15px] text-muted-foreground">{t("{n} programmes fit your answers", { n: list.length.toLocaleString("en-SG") })}</p>
          {leftOut > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("{n} left out: a requirement you don’t meet yet ({reasons})", { n: leftOut.toLocaleString("en-SG"), reasons: reasons.join(" · ") })}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {list.slice(0, shown).map((r) => (
          <ProgrammeCard key={r.p.id} r={r} criteria={criteria} open={open === r.p.id} onToggle={() => setOpen(open === r.p.id ? null : r.p.id)} />
        ))}
        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-[15px] text-muted-foreground">
            {tab === "kaplan" ? t("No Kaplan Singapore master’s fits all of these.") : t("No programme fits all of these. Try another direction, fee or region.")}{" "}
            <EditProfileLink part={2} className="font-semibold">
              {t("Edit answers")}
            </EditProfileLink>
          </div>
        )}
      </div>
      {shown < list.length && (
        <Button variant="outline" className="h-12 self-center rounded-xl bg-card px-6 text-[15px] font-bold" onClick={() => setShown((s) => s + PAGE)}>
          {t("Show more programmes")}
        </Button>
      )}
      <Legend />
      <CompareBar />
    </div>
  );
}
