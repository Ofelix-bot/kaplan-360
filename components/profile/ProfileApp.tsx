"use client";

import { createContext, Suspense, use, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { ArrowRightIcon, ChevronsUpDownIcon, CircleCheckIcon, ImageIcon, MicIcon, PlusIcon, SearchIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { CertificateChips } from "@/components/careers/CertificateChips";
import { DegreePicker } from "@/components/careers/DegreePicker";
import { DirectionPicker } from "@/components/finder/direction-picker";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { useLocalName } from "@/components/results/names";
import { FieldLabel, NONE, NumberField, Pick, Stepper } from "@/components/stand/fields";
import { CLASSES, gradeKind } from "@/components/stand/grade";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReadSource } from "@/components/shared/autofill-input";
import type { KaplanDegree } from "@/lib/careers/types";
import { countryNames } from "@/lib/countries";
import { TESTS } from "@/lib/english-tests";
import { FEES, finderOf, REGIONS } from "@/lib/finder/answers";
import { FlowNext, FlowSteps } from "@/components/shared/FlowSteps";
import { msg } from "@/lib/i18n/translate";
import { ExampleBannerUi } from "@/components/shared/WorkedExampleBanner";
import type { SchoolOption } from "@/lib/plan-options-types";
import { plannedDegree, statusPatch, type Classification, type EnglishTest, type ExperienceEntry, type ExperienceKind, type FinderAnswers } from "@/lib/plan-storage";
import { groupSnapshot, type FillGroup } from "@/lib/profile/autofill";
import { SG_STATUSES } from "@/lib/profile/options";
import { complete, doneCount, part1, part2, type PartProgress } from "@/lib/profile/progress";
import { otherSchoolDegree, type StandDegree } from "@/lib/stand/profile";
import { usePlan } from "@/lib/use-plan";
import { useResultsData } from "@/lib/workspace/data";
import { BackToService } from "./BackToService";
import { AutofillCard } from "./AutofillCard";
import { experiencePatch } from "./profile";
import { ProfileArt } from "./ProfileArt";

// /profile: the student's own answers in two cards, each saved as it changes into the answers every service reads
// (lib/plan-storage.ts; this browser only). Part 1, "About you", is what the Career Compass and the Programme finder
// both read: the degree (Kaplan's 56, or another school's awarding university), graduation, status in Singapore,
// nationality and (for anyone who would need a work pass) the year of birth, then internships and work, and
// certificates. Part 2, "For master's programmes", only the finder reads: the result, the master's directions,
// English and tests, budget and region, research, awards and projects; the finder asks only what is missing here
// (components/finder/questionnaire.tsx). Each card counts its needed and optional answers (lib/profile/progress.ts)
// and its button opens the next step once the needed ones are in. While a worked example is open it shows (and
// edits only) the example's answers, under the same banner as /careers. Labels and controls only, no explanations.
// Above the cards, the autofill card (AutofillCard.tsx) reads a sentence, screenshots or PDFs into the empty answers;
// the groups it filled carry a small image, microphone or sparkle mark until they are edited.

/** What the server slices for the page (app/[lang]/profile/data.ts). */
export type ProfileData = {
  degrees: KaplanDegree[];
  /** programmeId → its elective modules. */
  electives: Record<string, string[]>;
  /** programmeId → the 16 skills offered first on an entry: those the hot roles of its industries ask for most. */
  skillsByDegree: Record<string, string[]>;
  /** The same over every industry, before a degree is picked. */
  topSkills: string[];
  /** Every key skill title of every role, for the search. */
  allSkills: string[];
  /** programmeId → the awarding university's country (the grade's scheme). */
  countries: Record<string, string | null>;
  schools: SchoolOption[];
  disciplines: Record<string, string>;
};

const thisYear = () => new Date().getFullYear();
/** Lower case, accents dropped. */
const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const monthValue = (y: number | null, m: number | null) => (y && m ? `${y}-${String(m).padStart(2, "0")}` : "");
const splitMonth = (v: string) => {
  const [y, m] = v.split("-").map(Number);
  return y && m ? { y, m } : null;
};

const CHIP = cn(
  "min-h-8 h-auto max-w-full rounded-full py-1 border-(--land-line) bg-(--land-card) px-3 text-[13px] font-medium whitespace-normal text-(--text) transition-[background-color,border-color,color] duration-150",
  "hover:border-(--brand-ink) hover:bg-(--land-card) focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)",
  "aria-pressed:border-(--brand-ink) aria-pressed:bg-[color-mix(in_oklab,var(--brand-ink)_10%,var(--land-card))] aria-pressed:text-(--brand-ink)",
);

/** A single or multiple choice as chips. */
function Chips<V extends string>({ label, items, isOn, onToggle }: { label: string; items: { value: V; label: string }[]; isOn: (v: V) => boolean; onToggle: (v: V) => void }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <FieldLabel id={id}>{label}</FieldLabel>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {items.map((i) => (
          <Toggle key={i.value} variant="outline" pressed={isOn(i.value)} onPressedChange={() => onToggle(i.value)} className={CHIP}>
            {i.label}
          </Toggle>
        ))}
      </div>
    </div>
  );
}

function OptionalTag() {
  const t = useT();
  return <span className="rounded-full bg-(--land-ground) px-2 py-0.5 text-[11px] font-medium text-(--land-body)">{t("Optional")}</span>;
}

/** The groups an autofill filled, and from what: each keeps its mark while its answers stay as filled. */
type Marks = {
  source: ReadSource;
  snaps: Partial<Record<FillGroup, string>>;
} | null;
const MarksContext = createContext<Marks>(null);

/** The mark a group carries: the autofill's source, while the group's answers are still what it filled. */
function useMark(group: FillGroup | undefined): ReadSource | "typed" | null {
  const marks = use(MarksContext);
  const { answers } = usePlan();
  if (!group || !marks) return null;
  const snap = marks.snaps[group];
  return snap !== undefined && snap === groupSnapshot(answers, group) ? (marks.source ?? "typed") : null;
}

function Group({ title, filled, optional, headingId, mark: group, children }: { title: string; filled: boolean; optional?: boolean; headingId?: string; mark?: FillGroup; children: ReactNode }) {
  const t = useT();
  const auto = useId();
  const id = headingId ?? auto;
  const mark = useMark(group);
  const markLabel = mark === "file" ? t("Read from your files") : mark === "voice" ? t("Read from what you said") : t("Read from your sentence");
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4 border-t border-(--border) pt-6">
      <h3 id={id} className="flex flex-wrap items-center gap-2 text-lg font-semibold text-(--text)">
        {title}
        {optional && <OptionalTag />}
        {mark && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  tabIndex={0}
                  aria-label={markLabel}
                  className="inline-grid size-5 place-items-center rounded text-(--brand-ink) outline-none focus-visible:ring-2 focus-visible:ring-(--focus-ring)"
                />
              }
            >
              {mark === "file" ? <ImageIcon aria-hidden className="size-4" /> : mark === "voice" ? <MicIcon aria-hidden className="size-4" /> : <SparklesIcon aria-hidden className="size-4" />}
            </TooltipTrigger>
            <TooltipContent>{markLabel}</TooltipContent>
          </Tooltip>
        )}
        {filled && (
          <>
            <CircleCheckIcon aria-hidden className="size-4.5 text-(--brand-ink)" />
            <span className="sr-only">{t("Filled")}</span>
          </>
        )}
      </h3>
      {children}
    </section>
  );
}

/** One of the two cards: its heading and progress, its groups, and the way on. */
function Part({
  id,
  eyebrow,
  title,
  lede,
  progress,
  children,
  note,
  next,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  progress: PartProgress;
  children: ReactNode;
  note: string;
  next: ReactNode;
}) {
  const t = useT();
  const headingId = useId();
  const { needed, optional } = progress;
  return (
    <section id={id} aria-labelledby={headingId} className="flex min-w-0 scroll-mt-[calc(var(--header-h)+16px)] flex-col gap-6 rounded-[20px] border border-(--border) bg-(--land-card) p-5 sm:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="m-0 text-xs font-semibold tracking-[0.06em] text-[#a8590a] uppercase dark:text-(--accent-ink)">{eyebrow}</p>
          <h2 id={headingId} className="m-0 font-heading text-[26px] leading-tight font-bold text-(--text)">
            {title}
          </h2>
          <p className="m-0 max-w-[52ch] text-sm text-(--land-body)">{lede}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <p className="m-0 text-[13px] text-(--land-body)" aria-live="polite">
            <b className="font-semibold text-(--text)">{t("Needed {n}/{m}", { n: doneCount(needed), m: needed.length })}</b>
            {" · "}
            {t("Optional {n}/{m}", {
              n: doneCount(optional),
              m: optional.length,
            })}
          </p>
          <div aria-hidden className="flex gap-1">
            {needed.map((i) => (
              <span key={i.id} className={cn("h-1.5 w-6 rounded-full transition-colors duration-200", i.done ? "bg-(--brand-ink)" : "bg-(--land-line)")} />
            ))}
          </div>
        </div>
      </header>
      {children}
      <footer className="flex flex-col gap-3 border-t border-(--border) pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-sm text-(--land-body)">{note}</p>
        {next}
      </footer>
    </section>
  );
}

/** The way on: the step's button once the needed answers are in, else the same button off, with what to do. */
function NextStep({ href, label, ready }: { href: string; label: string; ready: boolean }) {
  const t = useT();
  if (ready) return <FlowNext href={href} label={label} className="self-end sm:self-auto" />;
  return (
    <div className="flex flex-col items-end gap-1.5 sm:flex-row-reverse sm:items-center sm:gap-3">
      <Button size="lg" disabled className="h-11 gap-2 rounded-full px-5 text-[15px] font-semibold">
        {t(label)}
        <ArrowRightIcon aria-hidden data-icon="inline-end" className="size-4" />
      </Button>
      <span className="text-xs text-(--land-body)">{t("Fill in the needed items above to continue.")}</span>
    </div>
  );
}

/** Another private school's awarding university: searchable by English or Chinese name, with its country. */
function AwarderPicker({ className }: { className?: string }) {
  const t = useT();
  const local = useLocalName();
  const { answers, update } = usePlan();
  const data = useResultsData((s) => s.data);
  const [query, setQuery] = useState("");
  const id = useId();
  useEffect(() => useResultsData.getState().load(), []);
  const all = useMemo(() => (data?.universities ?? []).filter((u, i, list) => list.findIndex((x) => x.name === u.name) === i).sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const q = query.trim().toLowerCase();
  const list = all.filter((u) => !q || [u.name, u.zh?.hans, u.zh?.hant].some((x) => x?.toLowerCase().includes(q))).slice(0, 80);
  const chosen = all.find((u) => u.name === answers.schoolAwarder);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <FieldLabel id={id}>{t("Awarding university")}</FieldLabel>
      <Popover>
        <PopoverTrigger render={<Button variant="outline" aria-labelledby={id} className="w-full min-w-0 justify-between bg-(--land-card) font-normal" />}>
          <span className="truncate">{chosen ? local(chosen.name, chosen.zh).name : (answers.schoolAwarder ?? t("Choose…"))}</span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--anchor-width) min-w-72 gap-2 p-2">
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
                  <button
                    type="button"
                    aria-pressed={u.name === answers.schoolAwarder}
                    className="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-muted aria-pressed:bg-muted aria-pressed:font-semibold"
                    onClick={() =>
                      update({
                        schoolAwarder: u.name,
                        schoolAwarderCountry: u.country || null,
                      })
                    }
                  >
                    <span className="min-w-0 flex-1 truncate">{local(u.name, u.zh).name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{t(u.country)}</span>
                  </button>
                </li>
              ))}
              {data && list.length === 0 && <li className="px-1.5 py-2 text-sm text-muted-foreground">{t("No university by that name here.")}</li>}
            </ul>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** The degree as the grade's scheme reads it: Kaplan's, or another school's awarding university. */
function useDegree(data: ProfileData): {
  kaplan: KaplanDegree | null;
  degree: StandDegree | null;
} {
  const { answers: a } = usePlan();
  const other = !!a.school && a.school !== "kaplan";
  const id = plannedDegree(a);
  const kaplan = other ? null : (data.degrees.find((d) => d.id === id) ?? null);
  const degree: StandDegree | null = other
    ? otherSchoolDegree(a)
    : kaplan
      ? {
          name: kaplan.name,
          university: kaplan.university,
          country: data.countries[kaplan.id] ?? null,
          discipline: kaplan.discipline,
        }
      : null;
  return { kaplan, degree };
}

function DegreeGroup({ data, filled }: { data: ProfileData; filled: boolean }) {
  const t = useT();
  const names = useSiteNames();
  const { answers: a, update } = usePlan();
  const electivesId = useId();
  const monthId = useId();
  const school = a.school && a.school !== "kaplan" ? a.school : "kaplan";
  const other = school !== "kaplan";
  const { kaplan } = useDegree(data);
  const electives = kaplan ? (data.electives[kaplan.id] ?? []) : [];
  const taken = new Set(a.electives);
  const schoolItems = [
    { value: "kaplan", label: t("Kaplan") },
    ...data.schools.map((s) => ({
      value: s.id,
      label: names.school(s.name).name,
    })),
  ];
  const fieldItems = [
    { value: NONE, label: t("Choose…") },
    ...Object.entries(data.disciplines).map(([v, name]) => ({
      value: v,
      label: t(name),
    })),
  ];

  return (
    <Group title={t("Degree")} filled={filled} mark="degree">
      <div className="grid grid-cols-6 gap-x-3 gap-y-3">
        <Pick className="col-span-6 sm:col-span-2" label={t("School")} value={school} items={schoolItems} onChange={(v) => update(v === "kaplan" ? { school: null } : { school: v })} />
        {other ? (
          <>
            <AwarderPicker className="col-span-6 sm:col-span-4" />
            <Pick
              className="col-span-6 sm:col-span-4"
              label={t("Degree field")}
              value={a.schoolDiscipline ?? NONE}
              items={fieldItems}
              onChange={(v) => update({ schoolDiscipline: v === NONE ? null : v })}
            />
            <Pick
              className="col-span-6 sm:col-span-2"
              label={t("Honours degree")}
              value={a.schoolHonours === true ? "yes" : a.schoolHonours === false ? "no" : NONE}
              items={[
                { value: NONE, label: t("Choose…") },
                { value: "yes", label: t("Honours") },
                { value: "no", label: t("Not honours") },
              ]}
              onChange={(v) => update({ schoolHonours: v === NONE ? null : v === "yes" })}
            />
          </>
        ) : (
          <div className="col-span-6 flex min-w-0 flex-col gap-1 sm:col-span-4">
            <FieldLabel>{a.level === "diploma" ? t("Degree you plan next") : t("Degree")}</FieldLabel>
            <DegreePicker degrees={data.degrees} />
          </div>
        )}
      </div>

      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Chips
          label={t("Graduation")}
          items={[
            { value: "yes", label: t("Graduated") },
            { value: "no", label: t("Still studying") },
          ]}
          isOn={(v) => a.graduated === (v === "yes")}
          onToggle={(v) =>
            update({
              graduated: a.graduated === (v === "yes") ? null : v === "yes",
            })
          }
        />
        <div className="flex min-w-0 flex-col gap-1">
          <FieldLabel htmlFor={monthId}>{a.graduated ? t("Graduated in") : t("Expected graduation")}</FieldLabel>
          <Input
            id={monthId}
            type="month"
            value={monthValue(a.graduationYear, a.graduationMonth)}
            className="bg-(--land-card) px-1.5 tabular-nums"
            onChange={(e) => {
              const v = splitMonth(e.target.value);
              update({
                graduationYear: v?.y ?? null,
                graduationMonth: v?.m ?? null,
              });
            }}
          />
        </div>
      </div>

      {electives.length > 0 && (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend id={electivesId} className="mb-2 flex items-center gap-2 text-xs leading-4 font-medium text-(--land-body)">
            {t("Electives taken")}
            <OptionalTag />
          </legend>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {electives.map((m) => (
              <li key={m}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-md py-1.5 text-sm text-(--text)">
                  <Checkbox
                    className="mt-0.5"
                    checked={taken.has(m)}
                    onCheckedChange={(on) =>
                      update({
                        electives: on ? [...a.electives.filter((x) => x !== m), m] : a.electives.filter((x) => x !== m),
                      })
                    }
                  />
                  <span lang="en" className="min-w-0 text-pretty">
                    {m}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </Group>
  );
}

function StatusGroup({ filled }: { filled: boolean }) {
  const t = useT();
  const locale = useLocale();
  const { answers: a, update } = usePlan();
  const countries = useMemo(() => countryNames(locale), [locale]);
  const citizen = a.sgStatus === "citizen";
  const pass = a.sgStatus === "student-pass" || a.sgStatus === "other-pass";
  return (
    <Group title={t("Nationality and status")} filled={filled} mark="status">
      <Chips label={t("Status in Singapore")} items={SG_STATUSES.map((s) => ({ value: s.value, label: t(s.label) }))} isOn={(v) => a.sgStatus === v} onToggle={(v) => update(statusPatch(v, a))} />
      <div className="grid grid-cols-6 gap-x-3 gap-y-3">
        <Pick
          className="col-span-6 sm:col-span-3"
          label={t("Nationality")}
          value={a.nationality ?? NONE}
          disabled={citizen}
          items={[{ value: NONE, label: t("Choose…") }, ...countries.map((c) => ({ value: c.code, label: c.name }))]}
          onChange={(v) => update({ nationality: v === NONE ? null : v })}
        />
        {pass && (
          <div className="col-span-6 flex flex-col gap-1.5 sm:col-span-3 sm:border-l-2 sm:border-[color-mix(in_oklab,var(--accent-ink)_45%,transparent)] sm:pl-3">
            <NumberField label={t("Year of birth")} value={a.birthYear} min={1950} max={thisYear() - 14} step={1} placeholder={t("e.g. {n}", { n: 2003 })} onChange={(v) => update({ birthYear: v })} />
            <p className="m-0 text-xs text-(--land-body)">{t("Asked only when a work pass would be needed. The Employment Pass salary floor rises with age.")}</p>
          </div>
        )}
      </div>
    </Group>
  );
}

/** One entry's skills: the 16 offered for the degree, the ones ticked from the search, and the search itself. */
function SkillPicker({ entry, offered, all, onChange }: { entry: ExperienceEntry; offered: string[]; all: string[]; onChange: (skills: string[]) => void }) {
  const t = useT();
  const labelId = useId();
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  const ticked = new Set(entry.skills);
  // A skill ticked from the search stays in the search's list while the query stays, so focus stays on it.
  const found = q ? all.filter((s) => !offered.includes(s) && fold(s).includes(q)).slice(0, 12) : [];
  const shown = [...offered, ...entry.skills.filter((s) => !offered.includes(s) && !found.includes(s))];
  const set = (s: string, on: boolean) => onChange(on ? [...entry.skills.filter((x) => x !== s), s] : entry.skills.filter((x) => x !== s));
  const chip = (s: string) => (
    <Toggle key={s} pressed={ticked.has(s)} onPressedChange={(p) => set(s, p)} variant="outline" className={cn(CHIP, "text-left")}>
      {ticked.has(s) ? <CircleCheckIcon aria-hidden /> : <PlusIcon aria-hidden className="text-(--land-body)" />}
      <span lang="en">{s}</span>
    </Toggle>
  );
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <FieldLabel id={labelId}>{t("Skills used")}</FieldLabel>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {shown.map(chip)}
      </div>
      <InputGroup className="max-w-sm bg-(--land-card)">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput type="search" placeholder={t("Search skills")} aria-label={t("Search skills")} value={query} onChange={(e) => setQuery(e.target.value)} />
      </InputGroup>
      {q && (
        <div role="group" aria-label={t("Skills found")} className="flex flex-wrap gap-2">
          {found.length ? found.map(chip) : <p className="text-sm text-(--land-body)">{t("No skill by that name.")}</p>}
        </div>
      )}
    </div>
  );
}

const KINDS: { value: ExperienceKind; label: string }[] = [
  { value: "internship-field", label: "Internship in your field" },
  { value: "internship-other", label: "Internship in another field" },
  { value: "work", label: "Full-time work" },
];

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function ExperienceGroup({ data, filled }: { data: ProfileData; filled: boolean }) {
  const t = useT();
  const { answers: a, update } = usePlan();
  const id = plannedDegree(a);
  const offered = (id && data.skillsByDegree[id]) || data.topSkills;
  const entries = a.experience;
  const save = (next: ExperienceEntry[]) => update(experiencePatch(a, next));
  const edit = (entryId: string, patch: Partial<ExperienceEntry>) => save(entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)));
  const add = (kind: ExperienceKind) => save([...entries, { id: newId(), kind, months: null, skills: [] }]);
  const kindItems = KINDS.map((k) => ({ value: k.value, label: t(k.label) }));

  return (
    <Group title={t("Internships and work")} filled={filled} optional>
      {entries.length > 0 && (
        <ol className="flex flex-col gap-3">
          {entries.map((e, i) => {
            const name = t("{kind}, entry {n}", {
              kind: t(KINDS.find((k) => k.value === e.kind)!.label),
              n: i + 1,
            });
            return (
              <li key={e.id}>
                <fieldset className="flex min-w-0 flex-col gap-3 rounded-xl border border-(--land-line) bg-(--land-card) p-3 sm:p-4">
                  <legend className="sr-only">{name}</legend>
                  <div className="flex items-end gap-2">
                    <Pick className="min-w-0 flex-1" label={t("Type")} value={e.kind} items={kindItems} onChange={(v) => edit(e.id, { kind: v as ExperienceKind })} />
                    <NumberField className="w-28 shrink-0" label={t("Months")} value={e.months} min={1} max={480} step={1} onChange={(v) => edit(e.id, { months: v })} />
                    <Button variant="ghost" size="icon" className="shrink-0" aria-label={t("Remove {entry}", { entry: name })} onClick={() => save(entries.filter((x) => x.id !== e.id))}>
                      <Trash2Icon aria-hidden />
                    </Button>
                  </div>
                  <SkillPicker entry={e} offered={offered} all={data.allSkills} onChange={(skills) => edit(e.id, { skills })} />
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="bg-(--land-card)" onClick={() => add("internship-field")}>
          <PlusIcon aria-hidden data-icon="inline-start" />
          {t("Add internship")}
        </Button>
        <Button variant="outline" className="bg-(--land-card)" onClick={() => add("work")}>
          <PlusIcon aria-hidden data-icon="inline-start" />
          {t("Add full-time work")}
        </Button>
      </div>
    </Group>
  );
}

function CertificatesGroup({ filled }: { filled: boolean }) {
  const t = useT();
  const id = useId();
  return (
    <Group title={t("Certificates")} filled={filled} headingId={id} optional>
      <CertificateChips labelledBy={id} />
    </Group>
  );
}

/**
 * The result in the awarding university's scheme (a GPA on its scale, an Australian WAM, or a UK class with an
 * optional average mark), also written as the Programme finder's GPA and scale so the finder reads the same answer.
 * A class given in the finder for a degree graded otherwise (a diploma student who isn't sure yet) shows as a class.
 */
function GradesGroup({ data, filled }: { data: ProfileData; filled: boolean }) {
  const t = useT();
  const { answers: a, update } = usePlan();
  const { degree } = useDegree(data);
  const grade = gradeKind(degree);
  const f = finderOf(a);
  const kind = f.scale === "uk" && a.classification !== null ? "class" : grade?.kind;
  const finder = (patch: Partial<FinderAnswers>): { finder: FinderAnswers } => ({ finder: { ...f, ...patch } });
  const hint = t("Not graduated yet? Use your average so far.");
  return (
    <Group title={t("Grades")} filled={filled} mark="grades">
      {!kind && <p className="m-0 text-sm text-(--land-body)">{t("Choose your degree in Part 1 first.")}</p>}
      <div className="grid grid-cols-6 gap-x-3 gap-y-3">
        {kind === "class" && (
          <>
            <Pick
              className="col-span-6 sm:col-span-3"
              label={t("Class")}
              value={a.classification ?? NONE}
              items={[
                { value: NONE, label: t("Choose…") },
                ...CLASSES.map((c) => ({
                  value: c.value as string,
                  label: t(c.label),
                })),
                { value: "unsure", label: t("Not sure yet") },
              ]}
              onChange={(v) =>
                update({
                  classification: v === NONE ? null : (v as Classification),
                  ...finder({ scale: "uk", gpa: null }),
                })
              }
            />
            <NumberField
              className="col-span-6 sm:col-span-3"
              label={t("Average mark")}
              value={a.averageMark}
              min={0}
              max={100}
              step={1}
              suffix="%"
              placeholder={t("optional")}
              onChange={(v) => update({ averageMark: v })}
            />
          </>
        )}
        {kind === "wam" && (
          <NumberField
            className="col-span-6 sm:col-span-3"
            label={t("WAM")}
            value={a.averageMark}
            min={0}
            max={100}
            step={1}
            suffix="%"
            placeholder={t("e.g. {n}", { n: 68 })}
            onChange={(v) =>
              update({
                averageMark: v,
                classification: null,
                ...finder({ scale: "100", gpa: v }),
              })
            }
          />
        )}
        {kind === "gpa" && grade?.kind === "gpa" && (
          <NumberField
            className="col-span-6 sm:col-span-3"
            label="GPA"
            value={a.degreeGpa}
            min={0}
            max={grade.scale}
            step={0.01}
            suffix={`/ ${grade.scale}`}
            placeholder={t("e.g. {n}", { n: 3.3 })}
            onChange={(v) =>
              update({
                degreeGpa: v,
                ...finder({ scale: grade.scale.toFixed(1), gpa: v }),
              })
            }
          />
        )}
      </div>
      {kind && <p className="-mt-2 mb-0 text-xs text-(--land-body)">{hint}</p>}
    </Group>
  );
}

function DirectionsGroup({ filled }: { filled: boolean }) {
  const t = useT();
  const { answers: a, update } = usePlan();
  const f = finderOf(a);
  return (
    <Group title={t("Master’s direction")} filled={filled} mark="directions">
      <div className="flex min-w-0 flex-col gap-1">
        <FieldLabel>{t("Up to 3")}</FieldLabel>
        <DirectionPicker value={f.directions} onChange={(directions) => update({ finder: { ...f, directions } })} />
      </div>
    </Group>
  );
}

function EnglishGroup({ filled }: { filled: boolean }) {
  const t = useT();
  const { answers: a, update } = usePlan();
  const dateId = useId();
  const test: Exclude<EnglishTest, "none"> | null = a.englishTest && a.englishTest !== "none" ? a.englishTest : null;
  const scale = TESTS.find((x) => x.value === test);
  const testItems = [{ value: NONE, label: t("Choose…") }, ...TESTS.map((x) => ({ value: x.value as string, label: t(x.short) }))];
  // A GRE or GMAT score means "I have one" on /results; clearing both leaves that answer open again.
  const scores = (p: { gre?: number | null; gmat?: number | null }) => {
    const gre = p.gre !== undefined ? p.gre : a.gre;
    const gmat = p.gmat !== undefined ? p.gmat : a.gmat;
    return {
      ...p,
      greGmat: gre !== null || gmat !== null ? ("have" as const) : a.greGmat === "have" ? null : a.greGmat,
    };
  };
  return (
    <Group title={t("English and tests")} filled={filled} mark="english">
      <div className="grid grid-cols-6 gap-x-3 gap-y-3">
        <Pick
          className="col-span-6 sm:col-span-2"
          label={t("English test")}
          value={a.englishTest ?? NONE}
          items={testItems}
          onChange={(v) => {
            const next = v === NONE ? null : (v as EnglishTest);
            update({
              englishTest: next,
              englishScore: next === a.englishTest ? a.englishScore : null,
            });
          }}
        />
        {test && (
          <>
            <NumberField
              className="col-span-3 sm:col-span-2"
              label={t("Score")}
              value={a.englishScore}
              min={scale?.min ?? 0}
              max={scale?.max ?? 9}
              step={scale?.step ?? 0.5}
              placeholder={scale?.start ? String(scale.start) : "–"}
              onChange={(v) => update({ englishScore: v })}
            />
            <div className="col-span-3 flex min-w-0 flex-col gap-1 sm:col-span-2">
              <FieldLabel htmlFor={dateId}>{t("Taken")}</FieldLabel>
              <Input
                id={dateId}
                type="month"
                max={`${thisYear()}-12`}
                value={monthValue(a.englishTestYear, a.englishTestMonth)}
                className="bg-(--land-card) px-1.5 tabular-nums"
                onChange={(e) => {
                  const v = splitMonth(e.target.value);
                  update({
                    englishTestYear: v?.y ?? null,
                    englishTestMonth: v?.m ?? null,
                  });
                }}
              />
            </div>
          </>
        )}
        <NumberField className="col-span-3" label={t("GRE")} value={a.gre} min={260} max={340} step={1} placeholder={t("optional")} onChange={(v) => update(scores({ gre: v }))} />
        <NumberField className="col-span-3" label={t("GMAT")} value={a.gmat} min={205} max={805} step={1} placeholder={t("optional")} onChange={(v) => update(scores({ gmat: v }))} />
      </div>
    </Group>
  );
}

function BudgetGroup({ filled }: { filled: boolean }) {
  const t = useT();
  const { answers: a, update } = usePlan();
  const f = finderOf(a);
  const regions = [...REGIONS, { id: "other", label: msg("Other") }];
  return (
    <Group title={t("Budget and region")} filled={filled} optional mark="budget">
      <Chips
        label={t("Tuition per year (S$)")}
        items={FEES.map((b) => ({ value: b.id, label: t(b.label) }))}
        isOn={(v) => f.fee === v}
        onToggle={(v) => update({ finder: { ...f, fee: f.fee === v ? null : v } })}
      />
      <Chips
        label={t("Region")}
        items={regions.map((r) => ({ value: r.id, label: t(r.label) }))}
        isOn={(v) => f.regions.includes(v)}
        onToggle={(v) =>
          update({
            finder: {
              ...f,
              regions: f.regions.includes(v) ? f.regions.filter((x) => x !== v) : [...f.regions, v],
            },
          })
        }
      />
    </Group>
  );
}

function ResearchGroup({ filled }: { filled: boolean }) {
  const t = useT();
  const { answers: a, update } = usePlan();
  return (
    <Group title={t("Research, awards and projects")} filled={filled} optional>
      <div className="grid grid-cols-3 gap-x-3 gap-y-3 sm:max-w-md">
        <Stepper label={t("Research")} value={a.research} max={9} onChange={(v) => update({ research: v })} />
        <Stepper label={t("Competition awards")} value={a.competitions} max={9} onChange={(v) => update({ competitions: v })} />
        <Stepper label={t("Projects")} value={a.projects} max={9} onChange={(v) => update({ projects: v })} />
      </div>
    </Group>
  );
}

const done = (p: PartProgress, id: string) => [...p.needed, ...p.optional].some((i) => i.id === id && i.done);
const allDone = (p: PartProgress, ids: string[]) => ids.every((id) => !p.needed.some((i) => i.id === id) || done(p, id));

function Form({ data, autofill: withAutofill }: { data: ProfileData; autofill: boolean }) {
  const t = useT();
  const { answers } = usePlan();
  const [marks, setMarks] = useState<Marks>(null);
  const { kaplan } = useDegree(data);
  const one = part1(answers, !!kaplan && (data.electives[kaplan.id]?.length ?? 0) > 0);
  const two = part2(answers);
  // Opened at a part (#part-1, #part-2, from a service page's "Fill them in"): it is there once the form is.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#part-1" || hash === "#part-2") document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
  }, []);
  return (
    <MarksContext value={marks}>
      <div className="flex flex-col gap-8">
        {withAutofill && (
          <AutofillCard
            degrees={data.degrees}
            onFilled={(source, groups, next) =>
              setMarks({
                source,
                snaps: Object.fromEntries(groups.map((g) => [g, groupSnapshot(next, g)])),
              })
            }
          />
        )}
        <Part
          id="part-1"
          eyebrow={t("Part 1 · Careers and programmes")}
          title={t("About you")}
          lede={t("Career Compass needs only this part. The Programme finder uses it as well.")}
          progress={one}
          note={t("Exploring careers only? This part is enough.")}
          next={<NextStep href="/careers" label={msg("Next: Career Compass")} ready={complete(one)} />}
        >
          <DegreeGroup data={data} filled={allDone(one, ["degree", "graduation"])} />
          <StatusGroup filled={allDone(one, ["status", "nationality", "birthYear"])} />
          <ExperienceGroup data={data} filled={done(one, "experience")} />
          <CertificatesGroup filled={done(one, "certificates")} />
        </Part>
        <Part
          id="part-2"
          eyebrow={t("Part 2 · Programmes only")}
          title={t("For master’s programmes")}
          lede={t("Only the Programme finder uses this part. Skip it if you are exploring careers only.")}
          progress={two}
          note={t("The Programme finder reads these answers, so nothing is asked twice.")}
          next={<NextStep href="/results" label={msg("Next: see programmes")} ready={complete(one) && complete(two)} />}
        >
          <GradesGroup data={data} filled={done(two, "grade")} />
          <DirectionsGroup filled={done(two, "directions")} />
          <EnglishGroup filled={done(two, "english")} />
          <BudgetGroup filled={done(two, "fee") || done(two, "regions")} />
          <ResearchGroup filled={done(two, "research")} />
        </Part>
      </div>
    </MarksContext>
  );
}

/** `autofill`: the reader behind the autofill card is available (app/api/profile has its key). */
export function ProfileApp({ data, autofill = false }: { data: ProfileData; autofill?: boolean }) {
  const t = useT();
  const { ready } = usePlan();

  return (
    <div className="ui min-h-svh bg-(--land-ground) pt-(--header-h) text-foreground">
      <FlowSteps current="profile" />
      <div className="home-wrap pt-8 pb-20 sm:pt-11 sm:pb-28">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <header className="grid items-center gap-x-8 gap-y-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-2">
              <Suspense fallback={null}>
                <BackToService />
              </Suspense>
              <ExampleBannerUi skin="land" />
              <h1 className="m-0 font-heading text-[clamp(32px,4.4vw,54px)] leading-[1.06] font-bold tracking-[-0.02em] text-balance text-(--text)">{t("Your profile")}</h1>
            </div>
            <ProfileArt className="block h-auto w-full max-w-[420px] justify-self-center md:justify-self-end" />
          </header>
          {ready ? (
            <Form data={data} autofill={autofill} />
          ) : (
            <div aria-busy="true" className="flex flex-col gap-8">
              <span aria-hidden className="h-96 rounded-[20px] bg-(--land-line)/40" />
              <span aria-hidden className="h-72 rounded-[20px] bg-(--land-line)/40" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
