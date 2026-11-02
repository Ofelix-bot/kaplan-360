"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "cn";
import { BookmarkPlusIcon, ChevronsUpDownIcon, ExternalLinkIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "@/components/i18n/Link";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { budgetChoices, budgetLabel } from "@/components/results/budget";
import { LAST_QS, qsAll, qsRange } from "@/components/results/facets";
import { useLocalName } from "@/components/results/names";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TESTS } from "@/lib/english-tests";
import { monthYear } from "@/lib/i18n/format";
import { msg } from "@/lib/i18n/translate";
import { transitions } from "@/lib/motion";
import type { EnglishTest, IntakeWindow, PlanLevel } from "@/lib/plan-storage";
import { QS_STEPS } from "@/lib/results-types";
import { useWorkspace } from "@/lib/workspace/store";
import { DescribeYourself } from "./describe-yourself";
import { useModel, type Have, type MarkField, type ResultValue } from "./model";
import { SEGMENT, SELECTED } from "./skin";

// The filters, in three groups: the student's background (their answers, prefilled and written
// back), tests and experience, and where and how much. Every option shows how many programmes it
// would leave, counted with every other filter kept (components/results/facets.ts).

type Score = Exclude<EnglishTest, "none">;

/** Typical scores on each test's scale, from a little under to a little over what master's programmes ask. */
const SCORES: Record<Score, number[]> = {
  ielts: [5.5, 6, 6.5, 7, 7.5, 8],
  toefl: [72, 79, 85, 90, 94, 100, 105, 110],
  pte: [50, 58, 62, 65, 70, 76, 80],
  duolingo: [95, 100, 105, 110, 115, 120, 125, 130],
};
const INTAKES: { value: IntakeWindow; label: string }[] = [
  { value: "any", label: "Starts any time" },
  { value: "jan-mar", label: "Starts January to March" },
  { value: "jul-oct", label: "Starts July to October" },
];
/** QS steps labelled under the slider. */
const TICKS = [0, 3, 5, 7, 10, LAST_QS];
/** A select's value for "not set". */
const NONE = "-";
const n = (v: number) => v.toLocaleString("en-SG");

function Count({ value, className }: { value: number; className?: string }) {
  return <span className={cn("text-[11px] text-muted-foreground tabular-nums", className)}>{n(value)}</span>;
}

function Group({ title, tally, children }: { title: string; tally: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={id} className="font-heading text-sm font-semibold">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">{tally}</span>
      </div>
      {children}
    </section>
  );
}

function Label({ htmlFor, id, children, hint, need }: { htmlFor?: string; id?: string; children: ReactNode; hint?: string; need?: boolean }) {
  const t = useT();
  const Tag = htmlFor ? "label" : "span";
  return (
    <Tag htmlFor={htmlFor} id={id} className="flex flex-wrap items-baseline gap-x-1.5 text-xs font-medium">
      {children}
      {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      {need && <Badge className="h-4 bg-amber px-1.5 text-[10px] text-amber-text">{t("Needed")}</Badge>}
    </Tag>
  );
}

/** A choice of a few options, each with its count. */
/** What the student is studying now: it decides whether the degree below is the one they're on or the one they plan next. */
function LevelSwitch({ level, onPick }: { level: PlanLevel | null; onPick: (level: PlanLevel) => void }) {
  const t = useT();
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={id}>{t("Studying now")}</Label>
      <ToggleGroup
        aria-labelledby={id}
        variant="outline"
        size="sm"
        spacing={1}
        className="w-full"
        value={level ? [level] : []}
        onValueChange={(v) => {
          if (v[0] === "diploma" || v[0] === "degree") onPick(v[0]);
        }}
      >
        <ToggleGroupItem value="diploma" className={cn("h-auto min-h-7 flex-1 px-2 py-1", SELECTED)}>
          {t("Diploma")}
        </ToggleGroupItem>
        <ToggleGroupItem value="degree" className={cn("h-auto min-h-7 flex-1 px-2 py-1", SELECTED)}>
          {t("Degree")}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

function Choice<V extends string | number | null>({ label, hint, need, options, value, onPick, note }: { label: string; hint?: string; need?: boolean; options: { value: V; label: string; n: number }[]; value: V | null; onPick: (v: V) => void; note?: string }) {
  const id = useId();
  const key = (v: V | null) => (v === null ? NONE : String(v));
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={id} hint={hint} need={need}>
        {label}
      </Label>
      <ToggleGroup
        aria-labelledby={id}
        variant="outline"
        size="sm"
        spacing={1}
        className="w-full flex-wrap"
        value={value === null && !options.some((o) => o.value === null) ? [] : [key(value)]}
        onValueChange={(v) => {
          const picked = options.find((o) => key(o.value) === v[0]);
          if (picked) onPick(picked.value);
        }}
      >
        {options.map((o) => (
          <ToggleGroupItem key={key(o.value)} value={key(o.value)} className={cn("h-auto min-h-7 gap-1 px-2 py-1", SELECTED)}>
            <span>{o.label}</span>
            <Count value={o.n} className="text-current opacity-70" />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * The average mark (or GPA) behind a class, optional: it tells a high 2:1 (65% or more) from a 2:1,
 * which many programmes' usual range turns on. Kept as typed until it is a valid value.
 */
function MarkInput({ mark, onMark }: { mark: NonNullable<MarkField>; onMark: (v: number | null) => void }) {
  const t = useT();
  const id = useId();
  const uk = mark.kind === "uk";
  const [draft, setDraft] = useState<string | null>(null);
  const [lo, hi] = uk ? [40, 100] : [0, mark.scale ?? 4.2];
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} hint={t("optional")}>
        {uk ? t("Average mark") : t("GPA out of {n}", { n: mark.scale ?? 4.2 })}
      </Label>
      <InputGroup className="w-40">
        <InputGroupInput
          id={id}
          type="number"
          inputMode="decimal"
          min={lo}
          max={hi}
          step={uk ? 1 : 0.01}
          placeholder={uk ? t("e.g. {n}", { n: 66 }) : t("e.g. {n}", { n: 3.4 })}
          value={draft ?? mark.value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const v = raw === "" ? null : Number(raw);
            if (v === null || (Number.isFinite(v) && v >= lo && v <= hi)) onMark(v);
          }}
          onBlur={() => setDraft(null)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{uk ? "%" : `/ ${mark.scale ?? 4.2}`}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      {/* The GPA's class under the university's own published bands, with that page (only where one is). */}
      {!uk && mark.value !== null && mark.cls && (
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-snug text-muted-foreground">
          <span className="tabular-nums">{t("GPA {gpa} / {scale} · {cls}", { gpa: mark.value, scale: mark.cls.scale, cls: t(GPA_CLASS[mark.cls.key]) })}</span>
          <a href={mark.cls.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {t("Award classification")}
            <ExternalLinkIcon aria-hidden className="size-3" />
          </a>
        </p>
      )}
    </div>
  );
}

/** The class names a published GPA band gives (lib/grades gpaClass). */
const GPA_CLASS = {
  first: msg("First Class Honours"),
  "2:1": msg("Second Class Honours, Grade 1 (2:1)"),
  "2:2": msg("Second Class Honours, Grade 2 (2:2)"),
  pass: msg("Pass"),
} as const;

/** The QS range: how many programmes each step holds, and two handles. */
function QsRange() {
  const t = useT();
  const { results, on } = useModel();
  const qsMin = useWorkspace((s) => s.qsMin);
  const qsMax = useWorkspace((s) => s.qsMax);
  const unranked = useWorkspace((s) => s.unranked);
  const counts = results.counts;
  const max = Math.max(1, ...counts.qs);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label id={id} hint={qsAll({ qsMin, qsMax }) ? t("Any rank") : qsRange({ qsMin, qsMax })}>
        {t("QS World University Ranking 2027")}
      </Label>
      <div className="flex h-10 items-end gap-px px-1.5" aria-hidden>
        {counts.qs.map((c, i) => (
          <motion.span
            key={i}
            className={cn("flex-1 rounded-t-[2px]", i >= qsMin && (qsMax === LAST_QS || i < qsMax) ? "bg-primary/70" : "bg-muted")}
            initial={false}
            animate={{ scaleY: Math.max(0.04, c / max) }}
            transition={transitions.move}
            style={{ height: "100%", originY: 1 }}
            title={`QS ${QS_STEPS[i]}–${i + 1 === LAST_QS ? `${QS_STEPS[LAST_QS]}+` : QS_STEPS[i + 1]}: ${n(c)}`}
          />
        ))}
      </div>
      <Slider
        aria-labelledby={id}
        min={0}
        max={LAST_QS}
        step={1}
        minStepsBetweenValues={1}
        value={[qsMin, qsMax]}
        onValueChange={(v) => {
          const [a, b] = v as number[];
          on.qs(a, b);
        }}
        thumbLabels={[t("Highest QS rank"), t("Lowest QS rank")]}
        getAriaValueText={(_, v) => (v === LAST_QS ? t("QS {n} and below", { n: QS_STEPS[LAST_QS] }) : `QS ${QS_STEPS[v]}`)}
      />
      <div className="relative h-4 text-[10px] text-muted-foreground tabular-nums" aria-hidden>
        {TICKS.map((i) => (
          <span key={i} className={cn("absolute", i === 0 ? "" : i === LAST_QS ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${(i / LAST_QS) * 100}%` }}>
            {QS_STEPS[i]}
            {i === LAST_QS ? "+" : ""}
          </span>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={unranked} onCheckedChange={(c) => on.unranked(!!c)} />
        <span className="flex-1">{t("Include unranked universities")}</span>
        <Count value={counts.unranked} />
      </label>
    </div>
  );
}

/** "Any of these" universities: searchable by English or Chinese name, each with its count. */
function UniversityPicker() {
  const t = useT();
  const local = useLocalName();
  const { results, on } = useModel();
  const chosen = useWorkspace((s) => s.universities);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const all = results.counts.universities;
  const list = all.filter((u) => !q || [u.name, u.zh?.hans, u.zh?.hant].some((x) => x?.toLowerCase().includes(q)));
  const localUni = (name: string) => local(name, all.find((u) => u.name === name)?.zh ?? null).name;
  return (
    <div className="flex flex-col gap-1.5">
      <Label hint={t("any of these")}>{t("Universities")}</Label>
      <Popover>
        <PopoverTrigger render={<Button variant="outline" className="w-full justify-between font-normal" />}>
          <span className="truncate">
            {chosen.length ? t("{n} chosen: {names}", { n: chosen.length, names: chosen.slice(0, 2).map(localUni).join(", ") + (chosen.length > 2 ? "…" : "") }) : t("Any university")}
          </span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) min-w-72 gap-2 rounded-xl p-2">
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput type="search" placeholder={t("Search universities")} aria-label={t("Search universities")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </InputGroup>
          <ScrollArea className="h-64">
            <ul className="flex flex-col pr-2">
              {list.map((u) => (
                <li key={u.name}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted">
                    <Checkbox checked={chosen.includes(u.name)} onCheckedChange={() => on.university(u.name)} />
                    <span className="min-w-0 flex-1 truncate">
                      {local(u.name, u.zh).name}
                      {u.qs && <span className="text-muted-foreground"> · QS {u.qs}</span>}
                    </span>
                    <Count value={u.n} />
                  </label>
                </li>
              ))}
              {list.length === 0 && <li className="px-1.5 py-2 text-sm text-muted-foreground">{t("No university by that name here.")}</li>}
            </ul>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function QuickFilter() {
  const t = useT();
  const locale = useIntlLocale();
  const names = useSiteNames();
  const m = useModel();
  const { answers, results, degrees, disciplines, mine, on } = m;
  const counts = results.counts;
  const universities = useWorkspace((s) => s.universities);
  const qsMin = useWorkspace((s) => s.qsMin);
  const qsMax = useWorkspace((s) => s.qsMax);
  const unranked = useWorkspace((s) => s.unranked);
  const ids = { degree: useId(), field: useId(), english: useId(), budget: useId(), intake: useId() };

  const byUniversity = degrees.reduce((acc, d) => acc.set(d.university ?? "", [...(acc.get(d.university ?? "") ?? []), d]), new Map<string, typeof degrees>());
  const degreeLabel = (d: (typeof degrees)[number]) => (d.university ? `${names.degree(d.name).name} · ${names.school(d.university).name}` : names.degree(d.name).name);
  const degreeItems = [{ value: null as string | null, label: t("Choose your Kaplan degree…") }, ...degrees.map((d) => ({ value: d.id as string | null, label: degreeLabel(d) })), ...(m.degreeId === "not-listed" ? [{ value: "not-listed", label: t("My programme isn’t listed") }] : [])];
  const test: Score | null = answers.englishTest && answers.englishTest !== "none" ? answers.englishTest : null;
  const scores = test ? [...new Set([...SCORES[test], ...(answers.englishScore !== null ? [answers.englishScore] : [])])].sort((a, b) => a - b) : [];
  const scope = [answers.countries.length > 0, !qsAll({ qsMin, qsMax }) || !unranked, universities.length > 0, answers.budget !== null, !!answers.intake && answers.intake !== "any"].filter(Boolean).length;
  const optional = [answers.englishTest !== null, m.tests !== null, answers.workExperience !== null].filter(Boolean).length;
  const needed = [!!m.degreeId, m.result !== null];
  const fieldItems = [
    { value: NONE, label: t("Every field ({n})", { n: n(counts.field.all) }) },
    ...(mine && counts.field.mine !== null ? [{ value: "mine", label: t("{field}, or open to any subject ({n})", { field: t(disciplines[mine.discipline] ?? mine.discipline), n: n(counts.field.mine) }) }] : []),
    { value: "any", label: t("Open to any subject ({n})", { n: n(counts.field.any) }) },
    ...Object.entries(disciplines).map(([d, name]) => ({ value: d, label: `${t(name)} (${n(counts.field.byField[d] ?? 0)})` })),
  ];
  const testItems = [{ value: NONE, label: t("Not set ({n})", { n: n(counts.englishAll) }) }, ...TESTS.map((x) => ({ value: x.value as string, label: x.value === "none" ? t("Not taken yet ({n} open)", { n: n(counts.englishNone) }) : t(x.label) }))];
  const scoreItems = [{ value: NONE, label: t("No score yet ({n} open)", { n: n(counts.englishNone) }) }, ...scores.map((s) => ({ value: String(s), label: t("{score} ({n} open)", { score: s, n: n(test ? counts.english(test, s) : 0) }) }))];
  const budgets = budgetChoices(answers.budget);
  const budgetItems = budgets.map((b) => ({ value: b.value === null ? NONE : String(b.value), label: `${budgetLabel(t, b)} (${n(counts.budget(b.value ?? null))})` }));
  const intakeItems = INTAKES.map((o) => ({ value: o.value as string, label: `${t(o.label)} (${n(counts.intake(o.value))})` }));
  const startHint = m.earliest ? t("Start from {date}", { date: monthYear(locale, m.earliest.getFullYear() * 12 + m.earliest.getMonth()) }) : null;

  return (
    <div className="flex flex-col gap-7">
      <Group title={t("Your background")} tally={t.rich("<b>{n}</b> of {m} needed", { b: (c) => <b className="text-foreground tabular-nums">{c}</b> }, { n: needed.filter(Boolean).length, m: needed.length })}>
        <LevelSwitch level={answers.level} onPick={on.level} />
        <div className="flex flex-col gap-1.5">
          <Label id={ids.degree} need={!m.degreeId}>
            {answers.level === "diploma" ? t("Degree you plan next") : t("Kaplan degree")}
          </Label>
          <Select items={degreeItems} value={m.degreeId} onValueChange={(v) => on.degree((v as string | null) || null)}>
            <SelectTrigger className="w-full" aria-labelledby={ids.degree}>
              <SelectValue placeholder={t("Choose your Kaplan degree…")} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-80">
              {[...byUniversity].map(([university, list]) => (
                <SelectGroup key={university}>
                  <SelectLabel>{university ? names.school(university).name : t("Kaplan")}</SelectLabel>
                  {list.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {names.degree(d.name).name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
              {m.degreeId === "not-listed" && <SelectItem value="not-listed">{t("My programme isn’t listed")}</SelectItem>}
            </SelectContent>
          </Select>
          {answers.level === "diploma" ? (
            <p className="text-xs text-muted-foreground">
              {t.rich("Not sure which? <a>Plan my path</a>", { a: (c) => <Link href="/pathway" className="text-primary underline-offset-4 hover:underline">{c}</Link> })}
            </p>
          ) : (
            startHint && <p className="text-xs text-muted-foreground">{startHint}</p>
          )}
        </div>
        <Choice<ResultValue> label={t("Expected result")} need={m.result === null} options={counts.result} value={m.result} onPick={on.result} />
        {m.mark && <MarkInput mark={m.mark} onMark={on.mark} />}
        {m.stand !== null && (
          <Choice
            label={t("Show programmes where my result…")}
            options={[
              { value: "all", label: t("meets the minimum"), n: counts.stand.all },
              { value: "usual", label: t("is in the admitted range"), n: counts.stand.usual },
            ]}
            value={m.stand}
            onPick={on.stand}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <Label id={ids.field}>{t("Master’s field")}</Label>
          <Select items={fieldItems} value={m.field || NONE} onValueChange={(v) => on.field(!v || v === NONE ? "" : (v as string))}>
            <SelectTrigger className="w-full" aria-labelledby={ids.field}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-80">
              {fieldItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Group>

      <Group title={t("Tests and experience")} tally={t.rich("optional · <b>{n}</b> of {m} set", { b: (c) => <b className="text-foreground tabular-nums">{c}</b> }, { n: optional, m: 3 })}>
        <div className="flex flex-col gap-1.5">
          <Label id={ids.english} hint={t("best score, or expected")}>
            {t("English test")}
          </Label>
          <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby={ids.english}>
            <Select items={testItems} value={answers.englishTest ?? NONE} onValueChange={(v) => on.english(!v || v === NONE ? null : (v as EnglishTest), null)}>
              <SelectTrigger className="w-full" aria-label={t("Test")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {testItems.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {test && (
              <Select items={scoreItems} value={answers.englishScore === null ? NONE : String(answers.englishScore)} onValueChange={(v) => on.english(test, !v || v === NONE ? null : Number(v))}>
                <SelectTrigger className="w-full" aria-label={t("Score")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {scoreItems.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <Choice<Have>
          label={t("GRE or GMAT")}
          hint={t("some programmes require one")}
          options={[
            { value: null, label: t("Any"), n: counts.tests.any },
            { value: "have", label: t("I have one"), n: counts.tests.any },
            { value: "none", label: t("None"), n: counts.tests.none },
          ]}
          value={m.tests}
          onPick={on.tests}
        />
        <Choice<Have>
          label={t("Work experience")}
          hint={t("full time")}
          options={[
            { value: null, label: t("Any"), n: counts.work.any },
            { value: "have", label: t("Yes"), n: counts.work.any },
            { value: "none", label: t("None yet"), n: counts.work.none },
          ]}
          value={answers.workExperience}
          onPick={on.work}
        />
      </Group>

      <Group title={t("Where and how much")} tally={t.rich("sets the scope · <b>{n}</b> of {m}", { b: (c) => <b className="text-foreground tabular-nums">{c}</b> }, { n: scope, m: 5 })}>
        <div className="flex flex-col gap-1.5">
          <Label hint={t("where you’d study")}>{t("Where")}</Label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Where")}>
            {counts.countries.map(([c, count]) => {
              const pressed = answers.countries.includes(c);
              return (
                <Toggle key={c} variant="outline" size="sm" pressed={pressed} disabled={!count && !pressed} onPressedChange={() => on.country(c)} className={cn("h-7 gap-1 rounded-full px-2.5", SELECTED)}>
                  {t(c)} <Count value={count} className="text-current opacity-70" />
                </Toggle>
              );
            })}
          </div>
        </div>
        <QsRange />
        <UniversityPicker />
        <div className="flex flex-col gap-1.5">
          <Label id={ids.budget} hint={t("S$, MAS rates")}>
            {t("Tuition a year")}
          </Label>
          <Select items={budgetItems} value={answers.budget === null ? NONE : String(answers.budget)} onValueChange={(v) => on.budget(!v || v === NONE ? null : Number(v))}>
            <SelectTrigger className="w-full" aria-labelledby={ids.budget}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {budgetItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label id={ids.intake}>{t("Start")}</Label>
          <Select items={intakeItems} value={answers.intake ?? "any"} onValueChange={(v) => on.intake(((v as string) || "any") as IntakeWindow)}>
            <SelectTrigger className="w-full" aria-labelledby={ids.intake}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {intakeItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Group>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <span className="text-xs text-muted-foreground">{t.rich("Needed <b>{n}</b> of {m}", { b: (c) => <b className="text-foreground tabular-nums">{c}</b> }, { n: needed.filter(Boolean).length, m: needed.length })}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={on.clear}>
            <RotateCcwIcon />
            {t("Clear filters")}
          </Button>
          <Button size="sm" onClick={on.save} disabled={m.save.isSaved || m.save.full || m.save.empty}>
            <BookmarkPlusIcon />
            {m.save.isSaved ? t("This search is saved") : m.save.full ? t("5 saved: delete one first") : t("Save this search")}
          </Button>
        </span>
      </div>
    </div>
  );
}

/** The left panel: the filters, or (where the server can read a sentence) one sentence that sets them. */
export function FilterPanel() {
  const t = useT();
  const { sentence } = useModel();
  const tab = useWorkspace((s) => s.tab);
  const setTab = useWorkspace((s) => s.setTab);
  if (!sentence) {
    return (
      <div id="results-filters" tabIndex={-1} className="p-4 outline-none">
        <QuickFilter />
      </div>
    );
  }
  return (
    <Tabs id="results-filters" tabIndex={-1} value={tab} onValueChange={(v) => setTab(v === "ask" ? "ask" : "quick")} className="gap-4 p-4 outline-none">
      <TabsList className="w-full" aria-label={t("Ways to search")}>
        <TabsTrigger value="quick" className={SEGMENT}>{t("Quick filter")}</TabsTrigger>
        <TabsTrigger value="ask" className={SEGMENT}>{t("Describe yourself")}</TabsTrigger>
      </TabsList>
      <TabsContent value="quick">
        <QuickFilter />
      </TabsContent>
      <TabsContent value="ask">
        <DescribeYourself onDone={() => setTab("quick")} />
      </TabsContent>
    </Tabs>
  );
}
