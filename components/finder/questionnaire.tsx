"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { useLocale, useLocalize, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkspaceProps } from "@/components/workspace/model";
import { ExampleBannerUi } from "@/components/shared/WorkedExampleBanner";
import { ProfileGap } from "@/components/profile/ProfileGap";
import { TESTS } from "@/lib/english-tests";
import { BACKGROUNDS, backgroundCovers, defaultScale, finderOf, kindOf, KINDS, required, resultFields, SCALES, scaleMax, UK_CLASSES } from "@/lib/finder/answers";
import { finderMissing } from "@/lib/profile/progress";
import { transitions } from "@/lib/motion";
import { plannedDegree, type Classification, type FinderAnswers, type PlanAnswers } from "@/lib/plan-storage";
import { usePlanStore } from "@/lib/workspace/plan-store";
import { DirectionPicker } from "./direction-picker";
import { Chip, PageHead, Step } from "./parts";
import { SentenceFill } from "./sentence-fill";

// The finder's questions (/results/start): only what /profile doesn't say yet of the four answers the list needs
// (the degree, a result, the directions, English; lib/finder/answers.ts required), on a numbered rail with a bar
// that counts them and opens the programmes. Answers go to the same profile. With all four on the profile it goes
// straight to the programmes. The other tab fills the same answers from one sentence.

export const LIST_HREF = "/results";
const TAB = "h-full rounded-lg text-[15px] data-active:bg-card data-active:font-bold data-active:shadow-sm dark:data-active:border-transparent dark:data-active:bg-card";

/** The answers' writer for the finder: its own fields, and any plan answers that go with them. */
export function useFinderUpdate() {
  const answers = usePlanStore((s) => s.answers);
  const update = usePlanStore((s) => s.update);
  return (patch: Partial<FinderAnswers>, more: Partial<PlanAnswers> = {}) => update({ ...more, finder: { ...finderOf(answers), ...patch } });
}

function DegreeStep({ n, props, done, last }: { n: number; props: WorkspaceProps; done: boolean; last?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const names = useSiteNames();
  const id = useId();
  const answers = usePlanStore((s) => s.answers);
  const set = useFinderUpdate();
  const f = finderOf(answers);
  const degrees = props.programmes.filter((p) => p.level === "degree");
  const degreeId = plannedDegree(answers);
  const mine = degrees.find((d) => d.id === degreeId);
  const kind = kindOf(answers);
  const covers = f.background ? backgroundCovers(f.background) : null;
  const near = covers ? degrees.filter((d) => covers.includes(d.discipline)) : degrees;
  const list = near.length ? near : degrees;
  if (mine && !list.includes(mine)) list.unshift(mine);
  const byUniversity = list.reduce((acc, d) => acc.set(d.university ?? "", [...(acc.get(d.university ?? "") ?? []), d]), new Map<string, typeof degrees>());
  const items = list.map((d) => ({ value: d.id, label: names.degree(d.name).name }));

  const pickKind = (k: NonNullable<FinderAnswers["kind"]>) => {
    const level = k === "diploma" ? "diploma" : "degree";
    // The degree stays chosen: the one studied now, or the one planned next.
    const keep = degreeId === "not-listed" ? null : degreeId;
    set({ kind: k }, level === answers.level ? {} : level === "degree" ? { level, programmeId: keep, pathwayDegreeId: null } : { level, programmeId: null, pathwayDegreeId: keep });
  };
  const pickDegree = (value: string | null) => {
    const d = degrees.find((x) => x.id === value);
    const university = d ? (props.awarders[d.id]?.university ?? null) : null;
    const background = d ? (BACKGROUNDS.find((b) => backgroundCovers(b.id).includes(d.discipline))?.id ?? d.discipline) : f.background;
    const k = f.kind === "diploma" ? "diploma" : "bachelor";
    // A new university's own scale, unless the student has typed a GPA already.
    const scale = f.gpa === null && answers.classification === null ? defaultScale(university) : f.scale;
    set({ background, kind: k, scale }, k === "diploma" ? { level: "diploma", pathwayDegreeId: value } : { level: "degree", programmeId: value });
  };

  return (
    <Step n={n} title={t("Your degree")} hint={t("Still studying or on a top-up? Choose the degree you will graduate with")} done={done} last={last}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("Degree level")}>
        {KINDS.map((k) => (
          <Chip key={k.id} pressed={kind === k.id} onPressedChange={() => pickKind(k.id)}>
            {locale === "en" ? k.en : `${t(k.label)} ${k.en}`}
          </Chip>
        ))}
      </div>
      {kind && (
        <div className="flex max-w-xl flex-col gap-1.5">
          <label id={id} className="text-sm text-muted-foreground">
            {kind === "diploma" ? t("The Kaplan degree you plan next") : t("Your Kaplan degree")}
          </label>
          <Select items={items} value={degreeId === "not-listed" ? null : degreeId} onValueChange={(v) => pickDegree((v as string | null) || null)}>
            <SelectTrigger className="w-full bg-card px-4 text-[15px] data-[size=default]:h-12" aria-labelledby={id}>
              <SelectValue placeholder={t("Choose your Kaplan degree…")} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-80">
              {[...byUniversity].map(([university, ds]) => (
                <SelectGroup key={university}>
                  <SelectLabel>{university ? names.school(university).name : t("Kaplan")}</SelectLabel>
                  {ds.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {names.degree(d.name).name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </Step>
  );
}

function GpaStep({ n, props, done, last }: { n: number; props: WorkspaceProps; done: boolean; last?: boolean }) {
  const t = useT();
  const ids = { gpa: useId(), scale: useId() };
  const answers = usePlanStore((s) => s.answers);
  const set = useFinderUpdate();
  const f = finderOf(answers);
  const degreeId = plannedDegree(answers);
  const university = (degreeId && props.awarders[degreeId]?.university) || null;
  const scale = f.scale ?? defaultScale(university);
  const [draft, setDraft] = useState<string | null>(null);
  const max = scaleMax(scale);
  const write = (s: string, value: number | null, cls: Classification | null) => set({ scale: s, gpa: s === "uk" ? null : value }, resultFields(university, s, value, cls));
  const scaleItems = SCALES.map((s) => ({ value: s.id, label: s.id === "100" || s.id === "uk" ? t(s.label) : s.label }));
  return (
    <Step n={n} title="GPA" hint={t("Not graduated yet? Use your average so far")} done={done} last={last}>
      <div className="flex flex-wrap items-end gap-3">
        {scale !== "uk" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.gpa} className="text-sm text-muted-foreground">
              {t("Your GPA")}
            </label>
            <Input
              id={ids.gpa}
              type="number"
              inputMode="decimal"
              min={0}
              max={max}
              step={scale === "100" ? 1 : 0.01}
              placeholder={scale === "100" ? "70" : "3.40"}
              value={draft ?? (f.gpa === null ? "" : scale === "100" ? String(f.gpa) : f.gpa.toFixed(2))}
              onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                const v = raw === "" ? null : Number(raw);
                if (v === null || (Number.isFinite(v) && v >= 0 && v <= max)) write(scale, v, null);
              }}
              onBlur={() => setDraft(null)}
              className="h-12 w-36 bg-card px-4 text-[17px] tabular-nums md:text-[17px]"
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label id={ids.scale} className="text-sm text-muted-foreground">
            {t("Out of")}
          </label>
          <Select
            items={scaleItems}
            value={scale}
            onValueChange={(v) => {
              const s = String(v);
              setDraft(null);
              // A value that doesn't fit the new scale is cleared, not reread.
              const keep = f.gpa !== null && s !== "uk" && f.gpa <= scaleMax(s) ? f.gpa : null;
              write(s, keep, s === "uk" ? answers.classification : null);
            }}
          >
            <SelectTrigger className="w-36 bg-card px-4 text-[17px] data-[size=default]:h-12" aria-labelledby={ids.scale}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {scaleItems.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {scale === "uk" && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Expected result")}>
          {UK_CLASSES.map((c) => (
            <Chip key={c.id} pressed={answers.classification === c.id} onPressedChange={() => write("uk", null, c.id)}>
              {t(c.label)}
            </Chip>
          ))}
        </div>
      )}
    </Step>
  );
}

/** One English test with its score and the month it was taken, or "not yet" (the same answers /profile asks). */
function EnglishStep({ n, done, last }: { n: number; done: boolean; last?: boolean }) {
  const t = useT();
  const ids = { score: useId(), taken: useId() };
  const answers = usePlanStore((s) => s.answers);
  const update = usePlanStore((s) => s.update);
  const test = answers.englishTest && answers.englishTest !== "none" ? TESTS.find((x) => x.value === answers.englishTest) : null;
  const month = answers.englishTestYear && answers.englishTestMonth ? `${answers.englishTestYear}-${String(answers.englishTestMonth).padStart(2, "0")}` : "";
  return (
    <Step n={n} title={t("English test")} hint={t("Choose “Not yet” if you haven’t taken one")} done={done} last={last}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("English test")}>
        {TESTS.map((x) => (
          <Chip key={x.value} pressed={answers.englishTest === x.value} onPressedChange={() => update({ englishTest: x.value, englishScore: x.value === answers.englishTest ? answers.englishScore : null })}>
            {t(x.short)}
          </Chip>
        ))}
      </div>
      {test && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.score} className="text-sm text-muted-foreground">
              {t("Score")}
            </label>
            <Input
              id={ids.score}
              type="number"
              inputMode="decimal"
              min={test.min}
              max={test.max}
              step={test.step}
              placeholder={String(test.start)}
              value={answers.englishScore ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                if (v === null || (Number.isFinite(v) && v >= (test.min ?? 0) && v <= (test.max ?? 999))) update({ englishScore: v });
              }}
              className="h-12 w-36 bg-card px-4 text-[17px] tabular-nums md:text-[17px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.taken} className="text-sm text-muted-foreground">
              {t("Taken")}
            </label>
            <Input
              id={ids.taken}
              type="month"
              max={`${new Date().getFullYear()}-12`}
              value={month}
              onChange={(e) => {
                const [y, mo] = e.target.value.split("-").map(Number);
                update(y && mo ? { englishTestYear: y, englishTestMonth: mo } : { englishTestYear: null, englishTestMonth: null });
              }}
              className="h-12 w-44 bg-card px-4 text-[17px] tabular-nums md:text-[17px]"
            />
          </div>
        </div>
      )}
    </Step>
  );
}

/** The bar under the steps: the needed answers counted, and the way on. */
export function NextBar({ needed, total }: { needed: number; total: number }) {
  const t = useT();
  const ready = needed === total;
  return (
    <div className="sticky bottom-3 z-10 mt-10 rounded-2xl border border-border bg-card/95 p-4 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.18)] backdrop-blur sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <p className="text-sm" aria-live="polite">
            <b className="font-bold">{t("Needed {n} / {m} done", { n: needed, m: total })}</b>
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <motion.div className="h-full rounded-full bg-primary" initial={false} animate={{ width: `${total ? (needed / total) * 100 : 100}%` }} transition={transitions.move} />
          </div>
        </div>
        {ready ? (
          <Link href={LIST_HREF} className={cn(buttonVariants(), "h-12 gap-2 rounded-xl px-6 text-[15px] font-bold")}>
            {t("Next: see programmes")}
            <ArrowRightIcon aria-hidden />
          </Link>
        ) : (
          <span aria-disabled className={cn(buttonVariants(), "h-12 gap-2 rounded-xl px-6 text-[15px] font-bold opacity-40")}>
            {t("Next: see programmes")}
            <ArrowRightIcon aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}

export function FinderStart({ props }: { props: WorkspaceProps }) {
  const t = useT();
  const router = useRouter();
  const localize = useLocalize();
  const answers = usePlanStore((s) => s.answers);
  const set = useFinderUpdate();
  const [tab, setTab] = useState<"quick" | "ask">("quick");
  const f = finderOf(answers);
  const r = required(answers);
  // The questions the profile didn't answer, as they stood on arrival: a step stays while it is being answered.
  const [asked] = useState(() => finderMissing(answers));
  const needed = asked.filter((k) => r[k]).length;
  // Everything answered on the profile already: straight to the programmes.
  useEffect(() => {
    if (!asked.length) router.replace(localize(LIST_HREF));
  }, [asked, router, localize]);
  if (!asked.length) return null;

  const steps = asked.map((k, i) => {
    const n = i + 1;
    const last = i === asked.length - 1;
    if (k === "degree") return <DegreeStep key={k} n={n} props={props} done={r.degree} last={last} />;
    if (k === "gpa") return <GpaStep key={k} n={n} props={props} done={r.gpa} last={last} />;
    if (k === "english") return <EnglishStep key={k} n={n} done={r.english} last={last} />;
    return (
      <Step key={k} n={n} title={t("Master’s direction")} hint={t("Open to choose, up to 3")} done={r.directions} last={last}>
        <DirectionPicker value={f.directions} onChange={(directions) => set({ directions })} />
      </Step>
    );
  });
  const quick = (
    <div className="flex flex-col">
      {steps}
      <NextBar needed={needed} total={asked.length} />
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[792px] flex-col gap-7 px-4 pt-10 pb-16 sm:px-4 sm:pt-12">
      <ExampleBannerUi skin="results" className="border-border bg-muted" />
      <ProfileGap part={2} />
      <PageHead
        eyebrow={t("Programme finder")}
        title={t("Find master’s programmes that fit you")}
        lede={tab === "quick" ? t("Your profile doesn’t say these yet. Answer them here; they are saved to your profile.") : t("Rather not go step by step? Say it in one sentence and we’ll fill in the form.")}
      />
      {props.sentence && (
        <Link href="/parents" className="-mt-3 inline-flex items-center gap-1.5 self-start text-[15px] font-semibold text-(--fd-met) underline-offset-4 hover:underline">
          {t("A parent? Tell us about your child")}
          <ArrowRightIcon aria-hidden className="size-4" />
        </Link>
      )}
      {props.sentence ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v === "ask" ? "ask" : "quick")} className="gap-7">
          <TabsList className="h-[52px]! w-full rounded-xl p-1" aria-label={t("Ways to answer")}>
            <TabsTrigger value="quick" className={TAB}>
              {t("Quick choice")}
            </TabsTrigger>
            <TabsTrigger value="ask" className={TAB}>
              {t("One sentence")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="quick">{quick}</TabsContent>
          <TabsContent value="ask">
            <SentenceFill props={props} onCheck={() => setTab("quick")} />
          </TabsContent>
        </Tabs>
      ) : (
        quick
      )}
    </div>
  );
}
