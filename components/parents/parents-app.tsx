"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRightIcon, CheckIcon, LockIcon, SparklesIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { useIntlLocale, useLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { PageHead } from "@/components/finder/parts";
import { applied } from "@/components/finder/sentence-fill";
import { useFinderList, type FinderRow } from "@/components/finder/use-finder";
import { requiresTest, studyCountry, WINDOWS } from "@/components/results/facets";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useModel, useModelMaybe, type WorkspaceProps } from "@/components/workspace/model";
import { money } from "@/components/workspace/programme-detail";
import { Spinner } from "@/components/workspace/spinner";
import { closeExampleNow } from "@/lib/example-link";
import { backgroundCovers, finderOf, UK_CLASSES } from "@/lib/finder/answers";
import { directionLabel, directionsSaid } from "@/lib/finder/directions";
import { monthYear } from "@/lib/i18n/format";
import { msg } from "@/lib/i18n/translate";
import { transitions } from "@/lib/motion";
import { MAX_CANDIDATES, MAX_FAMILY_TEXT, PICKS, totalFeeSgd, type Candidate, type FamilyNeeds, type FamilyPlan, type FamilyReading } from "@/lib/parent-plan";
import type { PlanSources } from "@/lib/plan-input";
import type { IntakeWindow, PlanAnswers } from "@/lib/plan-storage";
import { useResultsData } from "@/lib/workspace/data";
import { usePlanStore } from "@/lib/workspace/plan-store";
import { FamilyPlanView, type ParentsFacts } from "./family-plan";
import { Kappy, KappyBubble } from "@/components/kappy/Kappy";
import { KappyMic } from "@/components/kappy/KappyMic";
import type { KappyEngine } from "@/components/kappy/engine";

// /parents: a parent (or the student) describes the child in their own words. Claude reads it into the planner's
// answers and the family's needs (app/api/parents, step "read"); the answers go into this browser's plan, as the
// finder's one-sentence box does, and the finder's own rules pick the candidates here; Claude then picks three of
// them with a reason each (step "plan"), and writes this month's steps and the questions for those three (step
// "brief", shown when it comes back). Only the text and the candidates' facts are sent, and nothing is kept. Unlike
// the one-sentence box, this page reads only this text: a direction, region or fee band the text doesn't give is left
// open, not carried over from an earlier visit.

type Stage = "idle" | "reading" | "ranking" | "writing" | "done" | "empty";
type ChipKey = "budget" | "regions" | "direction" | "months" | "tests" | "qs" | "intake" | "recognition" | "after";

const ERRORS: Record<string, string> = {
  unavailable: msg("The AI reader isn’t available right now. Use the Programme finder instead."),
  busy: msg("Too many tries in a row. Wait a minute and try again."),
  "too-long": msg("Keep it to {n} characters."),
  failed: msg("That didn’t work. Try again."),
};

const EXAMPLE = msg(
  "My daughter is studying a UCD business degree at Kaplan and graduates next June, GPA 3.2, IELTS 6.5. We’d like a one-year master’s in the UK or Hong Kong, RMB 500,000 in total at most. She will work back in China afterwards, so the degree must be recognised by CSCSE. We worry most about her finding a job.",
);

const TEST_NAME: Record<string, string> = { ielts: "IELTS", toefl: "TOEFL", pte: "PTE", duolingo: "Duolingo" };

/** One call to app/api/parents. A call that failed or ran out of time is made once more: a new call gets the host's full time again. */
async function post<T>(body: object, tries = 2): Promise<T> {
  let error = "failed";
  try {
    const r = await fetch("/api/parents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await r.json().catch(() => ({}))) as T & { error?: string };
    if (r.ok && !json.error) return json;
    error = json.error ?? "failed";
  } catch {}
  if (error === "failed" && tries > 1) return post<T>(body, tries - 1);
  throw new Error(error);
}

/**
 * A Kaplan degree for the match when the text names the awarding university but not the programme ("UCD 商科"): that
 * university's degree in the field read, else its first. The match needs only the university and its grading; the
 * chip says no more than the text did (the university and the field).
 */
function inferredDegree({ reading, awarder }: FamilyReading, props: WorkspaceProps) {
  const p = reading.patch;
  if (p.programmeId || p.school || !awarder || p.level === "diploma") return null;
  const theirs = props.programmes.filter((x) => x.university === awarder && x.level === "degree");
  return theirs.find((x) => x.discipline === reading.field) ?? theirs[0] ?? null;
}

/** The answers from a reading: as the one-sentence box applies them, with what the text leaves open left open. */
function familyAnswers(answers: PlanAnswers, family: FamilyReading, text: string, props: WorkspaceProps): PlanAnswers {
  const { needs } = family;
  const degree = inferredDegree(family, props);
  const reading = degree ? { ...family.reading, patch: { ...family.reading.patch, level: "degree" as const, programmeId: degree.id } } : family.reading;
  const next = applied(answers, reading, text, props);
  const f = finderOf(next);
  const said = needs.directions.length ? needs.directions : directionsSaid(text);
  return { ...next, finder: { ...f, directions: said, fee: reading.patch.budget ? f.fee : null, regions: reading.patch.countries?.length ? f.regions : [] } };
}

/**
 * The finder's list held to the family's own conditions, best match first. With no direction named, the child's own
 * field (`fields`, from the subject background) and programmes open to any bachelor's.
 */
function candidatesFrom(list: FinderRow[], needs: FamilyNeeds, intake: IntakeWindow | null, fields: string[]): FinderRow[] {
  const window = intake && intake !== "any" ? WINDOWS[intake] : 0;
  const over = (r: FinderRow) => {
    if (!needs.budgetSgd) return false;
    const fee = needs.budgetScope === "tuition-year" ? r.p.feeSgd : totalFeeSgd(r.p);
    return fee !== null && fee > needs.budgetSgd;
  };
  const qs = (r: FinderRow) => r.u.qsValue ?? 9999;
  return list
    .filter((r) => !fields.length || r.p.any || fields.includes(r.p.discipline))
    .filter((r) => !needs.maxMonths || !r.p.months || r.p.months <= needs.maxMonths)
    .filter((r) => !needs.noTests || !requiresTest(r.p))
    .filter((r) => !needs.qsMax || (r.u.qsValue !== null && r.u.qsValue <= needs.qsMax))
    .filter((r) => !window || !r.p.intake || (r.p.intake & window) !== 0)
    .filter((r) => !over(r))
    .sort((a, b) => (b.match?.rate ?? -1) - (a.match?.rate ?? -1) || qs(a) - qs(b) || a.p.name.localeCompare(b.p.name));
}

/**
 * The candidates the writer chooses from: the finder's best matches first, then the best-ranked (QS) of the rest where
 * the child's match is strong, so a family that weighs ranking has those to choose from as well.
 */
function poolOf(rows: FinderRow[]): FinderRow[] {
  const top = rows.slice(0, 12);
  const qs = (r: FinderRow) => r.u.qsValue ?? 9999;
  const ranked = rows
    .slice(12)
    .filter((r) => r.match?.band === "strong")
    .sort((a, b) => qs(a) - qs(b))
    .slice(0, MAX_CANDIDATES - top.length);
  return [...top, ...ranked];
}

const toCandidate = (r: FinderRow): Candidate => ({
  id: r.p.id,
  programme: r.p.name,
  university: r.u.name,
  country: studyCountry(r),
  qs: r.u.qs,
  months: r.p.months,
  feeYearSgd: r.p.feeSgd,
  feeTotalSgd: totalFeeSgd(r.p),
  intake: Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => r.p.intake & (1 << (m - 1))),
  ielts: r.p.ielts,
  testsRequired: requiresTest(r.p),
  match: r.match ? Math.round(r.match.rate * 100) : null,
});

/** Mounted once the answers are in: the finder's list for them, held to the family's conditions. */
function Rank({ needs, onRanked }: { needs: FamilyNeeds; onRanked: (rows: FinderRow[], total: number) => void }) {
  const { list } = useFinderList("all");
  const m = useModel();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const f = finderOf(m.answers);
    const fields = !f.directions.length && f.background ? backgroundCovers(f.background) : [];
    onRanked(candidatesFrom(list, needs, m.answers.intake, fields), m.data.programmes.length);
  });
  return null;
}

/** What the AI read, as chips; the family's own conditions can be taken off. */
function useChips(family: FamilyReading, props: WorkspaceProps): { key: ChipKey | null; value?: string; label: string }[] {
  const t = useT();
  const intl = useIntlLocale();
  const names = useSiteNames();
  const { reading, needs } = family;
  const p = reading.patch;
  const sep = intl.startsWith("en") ? ", " : "、";
  const degree = props.programmes.find((x) => x.id === p.programmeId);
  const out: { key: ChipKey | null; value?: string; label: string }[] = [];
  if (degree) out.push({ key: null, label: names.degree(degree.name).name });
  else if (family.awarder) out.push({ key: null, label: [names.school(family.awarder).name, reading.field && props.disciplines[reading.field] && t(props.disciplines[reading.field])].filter(Boolean).join(" · ") });
  else if (reading.field && props.disciplines[reading.field]) out.push({ key: null, label: t(props.disciplines[reading.field]) });
  if (p.graduationYear) out.push({ key: null, label: t("Graduates {when}", { when: monthYear(intl, p.graduationYear * 12 + (p.graduationMonth ?? 1) - 1, "long") }) });
  if (p.degreeGpa != null) out.push({ key: null, label: `GPA ${p.degreeGpa}` });
  else if (p.averageMark != null) out.push({ key: null, label: t("Average {n}%", { n: p.averageMark }) });
  else if (p.classification) out.push({ key: null, label: t(UK_CLASSES.find((c) => c.id === p.classification)?.label ?? p.classification) });
  if (p.englishTest && p.englishScore != null) out.push({ key: null, label: `${TEST_NAME[p.englishTest]} ${p.englishScore}` });
  if (needs.budgetSgd) {
    const from = needs.budgetFrom;
    const amount = from ? (from.currency === "CNY" ? t("RMB {amount}", { amount: from.amount.toLocaleString("en-SG") }) : money(from.amount, from.currency)) : money(needs.budgetSgd, "SGD");
    out.push({ key: "budget", label: needs.budgetScope === "tuition-year" ? t("{amount} a year", { amount }) : t("{amount} in total", { amount }) });
  }
  if (p.countries?.length) out.push({ key: "regions", label: p.countries.map((c) => t(c)).join(sep) });
  for (const d of needs.directions) out.push({ key: "direction", value: d, label: t(directionLabel(d)) });
  if (needs.maxMonths) out.push({ key: "months", label: t("{n} months at most", { n: needs.maxMonths }) });
  if (p.intake) out.push({ key: "intake", label: p.intake === "jan-mar" ? t("Starts January to March") : t("Starts July to October") });
  if (needs.noTests) out.push({ key: "tests", label: t("No GRE or GMAT") });
  if (needs.qsMax) out.push({ key: "qs", label: t("QS top {n}", { n: needs.qsMax }) });
  if (needs.recognition) out.push({ key: "recognition", label: t("Recognised in China (CSCSE)") });
  if (needs.after) out.push({ key: "after", label: needs.after === "home" ? t("Works back home after") : t("Stays abroad after") });
  if (needs.career) out.push({ key: null, label: needs.career });
  return out;
}

function ReadCard({ family, props, onRemove }: { family: FamilyReading; props: WorkspaceProps; onRemove: (key: ChipKey, value?: string) => void }) {
  const t = useT();
  const id = useId();
  const chips = useChips(family, props);
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 id={id} className="flex items-center gap-2 text-[17px] font-bold">
        <SparklesIcon aria-hidden className="size-4 text-(--fd-met)" />
        {t("What the AI read")}
      </h2>
      {chips.length ? (
        <ul className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={`${c.key}-${c.value ?? c.label}`} className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-muted pr-1 pl-3.5 text-sm font-medium">
              {c.label}
              {c.key ? (
                <button type="button" onClick={() => onRemove(c.key!, c.value)} aria-label={t("Take off: {item}", { item: c.label })} className="grid size-7 place-items-center rounded-full text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 print:hidden">
                  <XIcon aria-hidden className="size-3.5" />
                </button>
              ) : (
                <span className="w-2.5" />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-muted-foreground">{t("Nothing the planner uses: say more about the studies, the budget or where.")}</p>
      )}
    </section>
  );
}

function Steps({ stage, counts, model }: { stage: Stage; counts: { total: number; kept: number } | null; model: boolean }) {
  const t = useT();
  const state = (i: number): "done" | "active" | "todo" => {
    const at = stage === "reading" ? 0 : stage === "ranking" ? 1 : stage === "writing" ? 2 : 3;
    return i < at ? "done" : i === at ? "active" : "todo";
  };
  const steps = [
    t("Read your words"),
    counts ? t("{total} programmes, {kept} that fit", { total: counts.total.toLocaleString("en-SG"), kept: counts.kept.toLocaleString("en-SG") }) : model ? t("Pick the programmes that fit") : t("Loading programmes"),
    t("Choose three and write the plan"),
  ];
  return (
    <ol aria-label={t("Steps")} className="grid grid-cols-1 gap-2 sm:grid-cols-3 print:hidden">
      {steps.map((label, i) => {
        const s = stage === "empty" && i === 2 ? "todo" : state(i);
        return (
          <li key={i} aria-current={s === "active" ? "step" : undefined} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", s === "active" ? "border-(--fd-met) bg-(--fd-met-bg)" : "border-border bg-card", s === "todo" && "text-muted-foreground")}>
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", s === "done" ? "bg-(--fd-met) text-white" : "bg-muted")}>
              {s === "done" ? <CheckIcon aria-hidden className="size-3.5" strokeWidth={3} /> : s === "active" ? <Spinner className="size-3.5" /> : i + 1}
            </span>
            <span className={cn(s === "active" && "font-semibold")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Kappy greets the parent, lists what parents usually ask (the page invites questions, it never asks about the child),
 * and listens: its microphone (KappyMic.tsx) puts what is said into the question box.
 */
function ParentsGuide({ value, onText, disabled }: { value: string; onText: (text: string) => void; disabled: boolean }) {
  const t = useT();
  const kappy = useRef<KappyEngine | null>(null);
  return (
    <div className="flex items-end gap-3 [--kappy-scale:1] sm:[--kappy-scale:2] print:hidden">
      <Kappy ref={kappy} label={t("Kappy, your guide on this page")} />
      <KappyBubble tail="left" className="mb-4 text-[15px] leading-relaxed sm:mb-8">
        <p className="font-semibold">{t("Hello, I’m Kappy. No forms here: just tell me about your child, the way you would tell a friend.")}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>{t("What your child studies now, and roughly how their grades look")}</li>
          <li>{t("The budget your family has in mind, and where you would like them to study")}</li>
          <li>{t("What worries you most, for example finding a job afterwards")}</li>
        </ol>
        <p className="mt-2 text-muted-foreground">{t("Not sure what to write? Press “Try an example” first and see how it works.")}</p>
        {!disabled && <KappyMic kappys={() => [kappy.current]} value={value} onText={onText} maxLength={MAX_FAMILY_TEXT} className="mt-2" />}
      </KappyBubble>
    </div>
  );
}

export function ParentsApp({ props, sources, facts }: { props: WorkspaceProps; sources: PlanSources; facts: ParentsFacts }) {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const model = useModelMaybe();
  const dataStatus = useResultsData((s) => s.status);
  const update = usePlanStore((s) => s.update);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [family, setFamily] = useState<FamilyReading | null>(null);
  const [run, setRun] = useState(0);
  const [counts, setCounts] = useState<{ total: number; kept: number } | null>(null);
  const [result, setResult] = useState<{ plan: FamilyPlan; rows: FinderRow[]; ai: boolean } | null>(null);
  const [briefing, setBriefing] = useState(false);
  // The text the plan is written from: the box can change after it was read.
  const said = useRef("");
  const busy = stage === "reading" || stage === "ranking" || stage === "writing";

  const read = async () => {
    const words = text.trim();
    if (!words || busy) return;
    // The reading becomes the visitor's own answers, as "Start planning" does.
    closeExampleNow();
    setStage("reading");
    setError("");
    setResult(null);
    setCounts(null);
    try {
      const body = await post<FamilyReading>({ step: "read", text: words });
      update(familyAnswers(usePlanStore.getState().answers, body, words, props));
      said.current = words;
      setFamily(body);
      setRun((n) => n + 1);
      setStage("ranking");
    } catch (e) {
      setError(t(ERRORS[(e as Error).message] ?? ERRORS.failed, { n: MAX_FAMILY_TEXT }));
      setStage("idle");
    }
  };

  const write = async (needs: FamilyNeeds, rows: FinderRow[], total: number) => {
    setCounts({ total, kept: rows.length });
    const top = poolOf(rows);
    if (!top.length) {
      setStage("empty");
      return;
    }
    setStage("writing");
    let plan: FamilyPlan;
    try {
      ({ plan } = await post<{ plan: FamilyPlan }>({ step: "plan", text: said.current, needs, candidates: top.map(toCandidate), locale }));
      setResult({ plan, rows: top, ai: true });
    } catch {
      // The finder's own top three, without the written lines.
      setResult({ plan: { summary: [], picks: top.slice(0, PICKS).map((r) => ({ id: r.p.id, reason: null })), todo: [], talk: [] }, rows: top, ai: false });
      setStage("done");
      return;
    }
    setStage("done");
    // This month's steps and the questions, for the three picked: a second call, shown when it comes back.
    setBriefing(true);
    try {
      const picks = plan.picks.flatMap((p) => top.filter((r) => r.p.id === p.id)).map(toCandidate);
      const { brief } = await post<{ brief: Pick<FamilyPlan, "todo" | "talk"> }>({ step: "brief", text: said.current, needs, picks, locale });
      setResult((r) => (r && r.plan === plan ? { ...r, plan: { ...plan, ...brief } } : r));
    } catch {
      // Without the steps, the plan stands as it is.
    } finally {
      setBriefing(false);
    }
  };

  const again = () => {
    setResult(null);
    setCounts(null);
    setRun((n) => n + 1);
    setStage("ranking");
  };

  const remove = (key: ChipKey, value?: string) => {
    if (!family || busy) return;
    const needs = { ...family.needs };
    const patch = { ...family.reading.patch };
    const answers = usePlanStore.getState().answers;
    const f = finderOf(answers);
    let change: Partial<PlanAnswers> | null = null;
    if (key === "budget") {
      Object.assign(needs, { budgetSgd: null, budgetScope: null, budgetFrom: null });
      delete patch.budget;
      change = { budget: null, finder: { ...f, fee: null } };
    } else if (key === "regions") {
      delete patch.countries;
      change = { countries: [], finder: { ...f, regions: [] } };
    } else if (key === "direction") {
      needs.directions = needs.directions.filter((d) => d !== value);
      change = { finder: { ...f, directions: f.directions.filter((d) => d !== value) } };
    } else if (key === "intake") {
      delete patch.intake;
      change = { intake: null };
    } else if (key === "months") needs.maxMonths = null;
    else if (key === "tests") needs.noTests = false;
    else if (key === "qs") needs.qsMax = null;
    else if (key === "recognition") needs.recognition = false;
    else if (key === "after") needs.after = null;
    if (change) update(change);
    setFamily({ ...family, reading: { ...family.reading, patch }, needs });
    again();
  };

  if (!props.sentence)
    return (
      <div className="mx-auto flex w-full max-w-[792px] flex-col gap-6 px-4 pt-10 pb-16 sm:pt-12">
        <PageHead eyebrow={t("For parents")} title={t("Tell us about your child")} />
        <p className="text-[15px] text-muted-foreground">{t(ERRORS.unavailable)}</p>
        <Link href="/results/start" className={cn(buttonVariants(), "h-12 gap-2 self-start rounded-xl px-5 text-[15px] font-bold")}>
          {t("Programme finder")}
          <ArrowRightIcon aria-hidden />
        </Link>
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-[792px] flex-col gap-6 px-4 pt-10 pb-16 sm:pt-12">
      <div className="print:hidden">
        <PageHead eyebrow={t("For parents")} title={t("Tell us about your child")} lede={t("In your own words, in any language. Three programmes that fit, what they cost, what graduates earn, recognition in China and the months ahead.")} />
      </div>

      <ParentsGuide value={text} onText={setText} disabled={busy} />

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={id} className="text-[17px] font-bold">
            {t("Your child, in your own words")}
          </label>
          <Button variant="ghost" onClick={() => setText(t(EXAMPLE))} disabled={busy} className="h-9 rounded-lg px-3 text-sm font-semibold">
            {t("Try an example")}
          </Button>
        </div>
        <Textarea
          id={id}
          rows={5}
          maxLength={MAX_FAMILY_TEXT}
          value={text}
          aria-describedby={`${id}-privacy`}
          placeholder={t("What your child studies and their grades, your budget, where and for how long, and what worries you.")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void read();
            }
          }}
          className="min-h-36 rounded-xl bg-card px-4 py-3 text-[15px] md:text-[15px]"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id={`${id}-privacy`} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <LockIcon aria-hidden className="size-3.5" />
            {t("Only this text is sent, and it isn’t kept. Leave out names and ID numbers.")}
          </p>
          <Button onClick={() => void read()} disabled={!text.trim() || busy} aria-busy={busy} className="h-12 gap-2 rounded-xl px-5 text-[15px] font-bold">
            {busy && <Spinner className="size-4" />}
            {t("Write the plan")}
            {!busy && <ArrowRightIcon aria-hidden />}
          </Button>
        </div>
        <div role="status" aria-live="polite">
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>

      {stage !== "idle" && <Steps stage={stage} counts={counts} model={!!model} />}
      {stage === "ranking" && dataStatus === "error" && <p className="text-sm text-destructive">{t("The programme list didn’t load. Check your connection and reload the page.")}</p>}
      {stage === "ranking" && model && family && (
        <Rank
          key={run}
          needs={family.needs}
          onRanked={(rows, total) => {
            void write(family.needs, rows, total);
          }}
        />
      )}

      <AnimatePresence initial={false}>
        {family && stage !== "reading" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: transitions.exit }}>
            <ReadCard family={family} props={props} onRemove={remove} />
          </motion.div>
        )}
      </AnimatePresence>

      {stage === "empty" && <p className="rounded-2xl border border-(--fd-gap)/40 bg-(--fd-gap-bg) p-5 text-[15px]">{t("No programme meets every condition. Take one off above and the plan is written again.")}</p>}

      {stage === "done" && result && family && model && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <FamilyPlanView plan={result.plan} rows={result.rows} needs={family.needs} ai={result.ai} briefing={briefing} kept={counts?.kept ?? result.rows.length} facts={facts} sources={sources} onRetry={again} />
        </motion.div>
      )}
    </div>
  );
}
