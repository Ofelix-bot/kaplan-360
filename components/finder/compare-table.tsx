"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ExternalLinkIcon, InfoIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import Link from "@/components/i18n/Link";
import { useIntlLocale, useLocale, useT } from "@/components/i18n/I18nProvider";
import { useLocalName } from "@/components/results/names";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useModel } from "@/components/workspace/model";
import { money } from "@/components/workspace/programme-detail";
import { ExampleBannerUi } from "@/components/shared/WorkedExampleBanner";
import { LEVEL_NAME, LEVELS, levelOf, RANK_LEVEL, type Level } from "@/lib/admit-range";
import { finderOf } from "@/lib/finder/answers";
import { compassFor } from "@/lib/finder/criteria";
import { englishState, gradeState, hardMisses, matchInput, rowMatch, workState } from "@/lib/finder/row-state";
import { RANK_NAME } from "@/lib/grades";
import { msg } from "@/lib/i18n/translate";
import { usePlanStore } from "@/lib/workspace/plan-store";
import { feeText, intakeText, lengthText } from "./programme-card";
import { Pill } from "./parts";
import { SituationPopover } from "./situation-popover";
import { industryText, RecognitionBadges, subjectText } from "./standing";
import { MAX_COMPARE, type FinderRow } from "./use-finder";

// Up to four programmes side by side (/results/compare), in three groups: whether the student can get in,
// what it costs and how long it takes, and the university and the sources. A gap is tinted orange; the usual
// range of admitted students is marked as an estimate unless the programme publishes it.

const LIST = "/results";

type Cell = { node: ReactNode; key: string; gap?: boolean };
type Line = { label: string; sub?: string; cells: Cell[] };

/** The steps' names short enough for the bar's labels. */
const SHORT: Record<Level, string> = { 40: msg("3rd"), 50: "2:2", 60: "2:1", 65: msg("Hi 2:1"), 70: msg("1st") };

/** The five steps of the UK scale, the usual range filled, the student's step outlined. */
function ScaleBar({ usual, you }: { usual: Level; you: Level | null }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      <div className="grid grid-cols-5 gap-1">
        {LEVELS.map((l) => (
          <span key={l} className={cn("h-2 rounded-full", l >= usual ? "bg-primary" : "bg-(--fd-dot-off)", l === you && "ring-2 ring-(--fd-gap) ring-offset-1 ring-offset-card")} />
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1 text-center text-[11px] text-muted-foreground">
        {LEVELS.map((l) => (
          <span key={l} className={cn(l === you && "font-bold text-foreground")}>
            {t(SHORT[l])}
            {l === you && ` · ${t("you")}`}
          </span>
        ))}
      </div>
    </div>
  );
}

function Status({ state, children }: { state: "met" | "gap" | "unknown"; children: ReactNode }) {
  return (
    <p className={cn("flex items-center gap-1 text-sm font-semibold", state === "met" ? "text-(--fd-met)" : state === "gap" ? "text-(--fd-gap)" : "text-muted-foreground")}>
      {state === "met" ? <CheckIcon aria-hidden className="size-3.5" strokeWidth={2.5} /> : state === "gap" ? <span aria-hidden>!</span> : <InfoIcon aria-hidden className="size-3.5" />}
      {children}
    </p>
  );
}

function Source({ url, children }: { url: string; children: ReactNode }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-4">
      {children}
      <ExternalLinkIcon aria-hidden className="size-3" />
    </a>
  );
}

export function FinderCompare() {
  const t = useT();
  const locale = useLocale();
  const intl = useIntlLocale();
  const local = useLocalName();
  const m = useModel();
  const update = usePlanStore((s) => s.update);
  const [onlyDiff, setOnlyDiff] = useState(false);

  // ?ids=a,b,c (a careers role's master's, or one programme from Where you stand) joins the shortlist once and
  // is what this visit compares; otherwise the shortlist's first four. The page renders only in the browser
  // (FinderShell waits for the stored answers), so the address can be read here.
  const [linked, setLinked] = useState(() => {
    const ids = [...new Set((new URLSearchParams(window.location.search).get("ids") ?? "").split(",").map((s) => s.trim()).filter((id) => m.byId.has(id)))];
    return ids.length ? ids.slice(0, MAX_COMPARE) : null;
  });
  useEffect(() => {
    if (!linked) return;
    const shortlist = usePlanStore.getState().answers.shortlist;
    const added = linked.filter((id) => !shortlist.includes(id));
    if (added.length) update({ shortlist: [...added, ...shortlist] });
    window.history.replaceState(null, "", window.location.pathname);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A column taken off the shortlist leaves the linked comparison too.
  const remove = (id: string) => {
    m.removeFromShortlist(id);
    setLinked((l) => (l && l.length > 1 ? l.filter((x) => x !== id) : null));
  };

  const awarderQs = m.university ? (m.data.universities.find((u) => u.name === m.university)?.qsValue ?? null) : null;
  const input = matchInput(m.you, m.youCases?.gpa ?? null, awarderQs, m.answers);
  const rows: FinderRow[] = (linked ?? m.answers.shortlist)
    .map((id) => m.byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .slice(0, MAX_COMPARE)
    .map((r) => ({ ...r, grade: gradeState(r, m.you), english: englishState(r, m.answers), work: workState(r, m.answers), match: rowMatch(r, m.data.match, input) }));
  const youLevel: Level | null = m.you ? (m.you.mark !== null ? levelOf(m.you.mark) : RANK_LEVEL[m.you.rank]) : null;
  const f = finderOf(m.answers);

  /** Steps between the student's result and where admitted students usually start. */
  const stepsShort = (r: FinderRow) => (youLevel === null ? 0 : Math.max(0, LEVELS.indexOf(r.p.range.usual) - LEVELS.indexOf(youLevel)));
  const verdict = (r: FinderRow): Cell => {
    const gaps: string[] = [];
    // A fixed requirement the student doesn't meet (the list leaves these out) comes first, named.
    const miss = hardMisses(r, m.answers);
    if (miss.includes("part-time")) gaps.push(t("Fixed requirement not met: part-time only, not for a Student’s Pass"));
    if (miss.includes("work")) gaps.push(t("Fixed requirement not met: {n} years of full-time work", { n: r.p.work! }));
    if (r.grade === "gap") gaps.push(stepsShort(r) > 1 ? t("Grades {n} steps short", { n: stepsShort(r) }) : t("Grades one step short"));
    if (r.english === "gap") gaps.push(t("Fixed requirement not met: English score short"));
    if (r.work === "gap" && !miss.includes("work")) gaps.push(t("Needs work experience"));
    const unset = [r.grade, r.english, r.work].some((s) => s === "unset" || s === "unknown");
    const node = gaps.length ? (
      <div className="flex flex-wrap gap-1">
        {gaps.map((g) => (
          <Pill key={g} state="gap">
            {g}
          </Pill>
        ))}
      </div>
    ) : unset ? (
      <Pill state="unknown">{t("Some to check")}</Pill>
    ) : (
      <Pill state="met">{t("Meets every requirement")}</Pill>
    );
    return { node, key: gaps.join() || (unset ? "unset" : "met"), gap: gaps.length > 0 };
  };

  const grade = (r: FinderRow): Cell => {
    const { p } = r;
    const official = p.minClass ? t(p.range.floor !== null ? LEVEL_NAME[p.range.floor] : RANK_NAME[p.minClass]) : null;
    const estimate = p.range.basis !== "minimum";
    const usual = t(LEVEL_NAME[p.range.usual]);
    const short = stepsShort(r);
    return {
      gap: r.grade === "gap",
      key: `${official}|${p.range.usual}|${r.grade}`,
      node: (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm text-muted-foreground">
            {t("Official:")} <span className="text-foreground">{official ? t("{grade} or above", { grade: official }) : t("not stated as a class")}</span> <Source url={p.url}>{t("wording")}</Source>
          </p>
          {estimate && (
            <p className="self-start rounded-md border border-dashed border-border px-2 py-1 text-sm text-muted-foreground">
              {p.range.basis === "published" ? t("Admitted · published:") : p.range.basis === "cases" ? t("Admitted · reported cases:") : t("Admitted · estimate:")} <b className="font-semibold text-foreground">{t("{grade} or above", { grade: usual })}</b>
            </p>
          )}
          <ScaleBar usual={p.range.usual} you={youLevel} />
          {r.grade === "met" && <Status state="met">{t("In the usual range")}</Status>}
          {r.grade === "gap" && <Status state="gap">{short > 1 ? t("{n} steps under the usual range", { n: short }) : t("One step under the usual range")}</Status>}
          {r.grade === "unset" && <Status state="unknown">{t("Add your GPA to place it")}</Status>}
        </div>
      ),
    };
  };

  const english = (r: FinderRow): Cell => {
    const c = r.c.find((x) => x.label === "English");
    const need = c?.need ?? (r.p.ielts ? `IELTS ${r.p.ielts}` : t("not stated"));
    return {
      gap: r.english === "gap",
      key: `${need}|${r.english}`,
      node: (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm">{need}</p>
          {r.english === "met" && <Status state="met">{t("Meets it")}</Status>}
          {r.english === "gap" && <Status state="gap">{t("Your score is under it")}</Status>}
          {r.english === "unset" && <Status state="unknown">{t("Add your score to check")}</Status>}
          {r.english === "unknown" && <Status state="unknown">{t("Not stated in a comparable way")}</Status>}
        </div>
      ),
    };
  };

  const work = (r: FinderRow): Cell => {
    const asked = r.p.work ? t(r.p.work === 1 ? "1 year of full-time work" : "{n} years of full-time work", { n: r.p.work }) : t("Not required");
    return {
      gap: r.work === "gap",
      key: `${asked}|${r.work}`,
      node: (
        <div className="flex flex-col gap-1.5">
          <p className={cn("text-sm", !r.p.work && "text-muted-foreground")}>{asked}</p>
          {r.work === "gap" && <Status state="gap">{t("You don’t have this yet")}</Status>}
          {r.work === "met" && <Status state="met">{t("Meets it")}</Status>}
          {r.work === "unset" && <Status state="unknown">{t("Add your work experience to check")}</Status>}
        </div>
      ),
    };
  };

  const plain = (text: string | null, sub?: string | null): Cell => ({
    key: `${text}|${sub}`,
    node: (
      <div className="flex flex-col gap-0.5">
        <p className={cn("text-[15px]", text ? "font-semibold" : "text-muted-foreground")}>{text ?? t("Not stated")}</p>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
    ),
  });

  const anyTest = rows.some((r) => r.p.gre?.status === "required" || r.p.gmat?.status === "required");
  const groups: { title: string; lines: Line[] }[] = [
    {
      title: t("Can you get in"),
      lines: [
        { label: t("Verdict"), cells: rows.map(verdict) },
        { label: t("Degree grades"), sub: m.you ? t("you ≈ {grade}", { grade: t(LEVEL_NAME[youLevel!]) }) : undefined, cells: rows.map(grade) },
        { label: t("English"), cells: rows.map(english) },
        { label: t("Work experience"), cells: rows.map(work) },
        ...(anyTest
          ? [
              {
                label: "GRE / GMAT",
                cells: rows.map((r) => {
                  const need = [r.p.gre?.status === "required" && "GRE", r.p.gmat?.status === "required" && "GMAT"].filter(Boolean).join(" / ");
                  return plain(need ? t("{test} required", { test: need }) : null);
                }),
              },
            ]
          : []),
      ],
    },
    {
      title: t("Cost and time"),
      lines: [
        {
          label: t("Fee (a year)"),
          sub: m.data.fx ? t("At MAS rates, {period}", { period: m.data.fx.period }) : undefined,
          cells: rows.map((r) => plain(r.p.fee ? (r.p.feeBasis === "year" ? money(r.p.fee.amount, r.p.fee.currency) : feeText(t, r.p)) : null, r.p.feeSgd !== null && r.p.fee?.currency !== "SGD" ? `≈ S$${r.p.feeSgd.toLocaleString("en-SG")}` : null)),
        },
        { label: t("Length"), cells: rows.map((r) => plain(lengthText(t, r.p.months))) },
        { label: t("Intake month"), cells: rows.map((r) => plain(r.p.intake ? intakeText(intl, r.p.intake) : (r.p.intakeText?.slice(0, 40) ?? null))) },
      ],
    },
    {
      title: t("University and sources"),
      lines: [
        { label: "QS 2027", cells: rows.map((r) => plain(r.u.qs ? (r.u.qs.startsWith("=") ? t("Joint {n}", { n: r.u.qs.slice(1) }) : t("No. {n}", { n: r.u.qs })) : t("Unranked"))) },
        {
          label: t("Subject strength"),
          sub: t("QS by Subject 2026, else GRAS 2025"),
          cells: rows.map((r) => plain(subjectText(t, r))),
        },
        { label: t("Industry recognition"), sub: t("QS employer reputation"), cells: rows.map((r) => plain(industryText(t, r))) },
        {
          label: t("Singapore recognition"),
          cells: rows.map((r) => ({
            key: `${r.u.name}|${r.p.discipline}|${(r.p.badges ?? []).map((b) => b.kind + b.body).join()}`,
            node: compassFor(r) || r.p.badges?.length ? <RecognitionBadges r={r} /> : <p className="text-[15px] text-muted-foreground">{t("None found")}</p>,
          })),
        },
        {
          label: t("Official site"),
          cells: rows.map((r) => ({
            key: r.p.url,
            node: (
              <div className="flex flex-col gap-0.5 text-sm">
                <Source url={r.p.url}>{t("Programme site")}</Source>
                <span className="text-muted-foreground">{t("Checked on {date}", { date: new Date(`${r.p.checked}T00:00:00`).toLocaleDateString(intl, { day: "numeric", month: "long", year: "numeric" }) })}</span>
              </div>
            ),
          })),
        },
      ],
    },
  ];
  const differs = (l: Line) => rows.length < 2 || new Set(l.cells.map((c) => c.key)).size > 1;

  const gpa = f.scale === "uk" ? null : f.gpa !== null ? `${f.scale === "100" ? `${f.gpa}%` : `GPA ${f.gpa.toFixed(1)} / ${f.scale}`}` : null;
  const english0 = m.answers.englishTest && m.answers.englishTest !== "none" && m.answers.englishScore !== null ? `${m.answers.englishTest.toUpperCase()} ${m.answers.englishScore}` : t("English not filled in");
  const work0 = m.answers.workYears !== null ? (m.answers.workYears === 0 ? t("No full-time work yet") : t(m.answers.workYears === 1 ? "1 year of full-time work" : "{n} years of full-time work", { n: m.answers.workYears })) : t("Work not filled in");
  const chip = "inline-flex h-8 items-center rounded-full bg-muted px-3 text-sm whitespace-nowrap";
  const cols = rows.length + (rows.length < MAX_COMPARE ? 1 : 0);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
      <ExampleBannerUi skin="results" className="border-border bg-muted" />
      <Link href={LIST} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold">
        <ArrowLeftIcon aria-hidden className="size-4" />
        {t("Back to the programmes")}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight sm:text-[32px]">{t("Compare {n} programmes", { n: rows.length })}</h1>
        <p className="max-w-3xl text-[15px] text-muted-foreground">
          {t("In order: can you get in → cost and time → university and sources. Gaps are orange; an “estimate” in a dashed box is ours, from the official wording and the QS rank, not an official requirement.")}
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:px-5">
        <span className="shrink-0 text-sm font-semibold">{t("You")}</span>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <span className={chip}>
            {t("Degree level")} ≈ {youLevel !== null ? t(LEVEL_NAME[youLevel]) : "—"}
            {gpa && <span className="ml-1 text-muted-foreground">（{gpa}）</span>}
          </span>
          <span className={chip}>{english0}</span>
          <span className={chip}>{work0}</span>
          <SituationPopover trigger={<button type="button" className="text-sm font-bold underline underline-offset-4">{t("Edit")}</button>} />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyDiff} onCheckedChange={(c) => setOnlyDiff(!!c)} />
            {t("Only differences")}
          </label>
          <Link href="/plan" className={cn(buttonVariants(), "h-11 gap-2 rounded-xl px-5 text-[15px] font-bold")}>
            {t("Make my plan")}
            <ArrowRightIcon aria-hidden />
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-[15px] text-muted-foreground">
          {t("Tick “Compare” on up to four programmes to see them side by side.")}{" "}
          <Link href={LIST} className="font-semibold text-foreground underline underline-offset-4">
            {t("Back to the programmes")}
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full border-collapse text-left" style={{ tableLayout: "fixed", minWidth: 132 + cols * 230 }}>
            <colgroup>
              <col className="w-[132px] sm:w-[200px] lg:w-[270px]" />
              {Array.from({ length: cols }, (_, i) => (
                <col key={i} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="sticky left-0 z-[1] bg-card px-5 pb-5 align-bottom text-sm font-normal text-muted-foreground">
                  {t("Compared items")}
                </th>
                {rows.map((r) => {
                  const uni = local(r.u.name, r.u.zh);
                  const title = local(r.p.name, r.p.zh);
                  return (
                    <th key={r.p.id} scope="col" className="border-l border-border p-5 align-top font-normal">
                      <div className="flex items-start gap-2">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="text-sm text-muted-foreground">{[uni.name, uni.en].filter(Boolean).join(" · ")}</span>
                          <span className="text-[17px] leading-snug font-bold">{locale === "en" ? title.name : (title.en ?? title.name)}</span>
                          <span className="text-sm text-muted-foreground">{t(r.p.campus?.country ?? r.u.country)}</span>
                        </div>
                        <button type="button" onClick={() => remove(r.p.id)} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                          <XIcon aria-hidden className="size-4" />
                          <span className="sr-only">{t("Remove {name} from the comparison", { name: title.name })}</span>
                        </button>
                      </div>
                    </th>
                  );
                })}
                {rows.length < MAX_COMPARE && (
                  <th scope="col" className="border-l border-border p-5 align-top font-normal">
                    <Link href={LIST} className="flex h-full min-h-[88px] flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-border text-sm font-semibold hover:bg-muted">
                      <PlusIcon aria-hidden className="size-4" />
                      {t("Add a programme")}
                      <span className="text-xs font-normal text-muted-foreground">{t("{n} at most", { n: MAX_COMPARE })}</span>
                    </Link>
                  </th>
                )}
              </tr>
            </thead>
            {groups.map((g) => {
              const lines = onlyDiff ? g.lines.filter(differs) : g.lines;
              if (!lines.length) return null;
              return (
                <tbody key={g.title}>
                  <tr className="border-b border-border bg-muted/70">
                    <th scope="colgroup" colSpan={cols + 1} className="sticky left-0 px-5 py-3 text-sm font-bold">
                      {g.title}
                    </th>
                  </tr>
                  {lines.map((l) => (
                    <tr key={l.label} className="border-b border-border last:border-b-0">
                      <th scope="row" className="sticky left-0 z-[1] bg-card px-5 py-5 align-top font-normal">
                        <span className="block text-[15px] font-bold">{l.label}</span>
                        {l.sub && <span className="block text-sm text-muted-foreground">{l.sub}</span>}
                      </th>
                      {l.cells.map((c, i) => (
                        <td key={rows[i].p.id} className={cn("border-l border-border px-5 py-5 align-top", c.gap && "bg-(--fd-gap-bg)/60")}>
                          {c.node}
                        </td>
                      ))}
                      {rows.length < MAX_COMPARE && <td className="border-l border-border" />}
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <Pill state="met">{t("Meets it")}</Pill>
        <Pill state="gap">{t("A gap")}</Pill>
        <Pill state="unknown">{t("Not stated")}</Pill>
        <span className="rounded-md border border-dashed border-border px-2 py-0.5 text-xs font-semibold text-foreground">{t("Estimate")}</span>
        <span>{t("Our reading of the official wording and the QS rank, not an official requirement. Check the official page before you apply.")}</span>
      </div>
    </div>
  );
}
