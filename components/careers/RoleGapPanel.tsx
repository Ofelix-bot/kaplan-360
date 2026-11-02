"use client";

import { useMemo, type ReactNode } from "react";
import { ArrowRightIcon, AwardIcon, BookOpenIcon, BriefcaseIcon, CheckIcon, PlusIcon, SquareCheckIcon } from "lucide-react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Fn } from "@/components/shared/receipt";
import { DRAFT } from "@/content/draft";
import { chipById } from "@/lib/careers/chips";
import { roleHref } from "@/lib/careers/links";
import { MATCH_RULES, RULE_IDS } from "@/lib/careers/match";
import type { CoverSource, MatchResult, RoleCardData } from "@/lib/careers/types";
import { exampleHref, openExampleNow } from "@/lib/example-link";
import type { SkillGap } from "@/lib/plan-storage";
import { fromRule, type ReceiptView } from "@/lib/receipts/model";
import { usePlan } from "@/lib/use-plan";
import { CellSwatch } from "./SkillCells";

// The picked hot role's gap (2026-11-02 board), under the hot roles: "<role>: closing the gap", the role page's
// link, the counts now · after Kaplan courses · outside the courses, one bar of the role's key skills grouped
// have → Kaplan → outside, and three columns. You have: each covered skill and what covers it. Kaplan courses
// can close: only a missing skill an elective of the student's own degree covers (2026-11-02: never another
// degree's modules), each with "Add to plan". Close outside your courses: the rest, linked to the
// role page's master's. The closing button adds every gap to the plan (PlanAnswers.skillGaps, /plan's own rows)
// and opens /plan. Receipts: the count rule on "You have", the gap rule on the counts line; the caller's
// ReceiptSection lists them (gapReceipts).

const C = DRAFT.careers.gapPanel;
const M = DRAFT.careers.match;
const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--focus-ring)";

/** Skill titles compared without case or spacing differences (as lib/careers/match.ts does). */
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Have = { skill: string; level: number; via: CoverSource[] };
type Kaplan = { skill: string; level: number; module: string };
type Outside = { skill: string; level: number };
export type GapColumns = { have: Have[]; kaplan: Kaplan[]; outside: Outside[]; m: number };

/** The role's key skills in the three columns, in key-skill order within each. */
export function gapColumns(role: RoleCardData, result: MatchResult): GapColumns {
  const covered = new Map(result.covered.map((c) => [norm(c.skill), c]));
  const missing = new Map(result.missing.map((g) => [norm(g.skill), g]));
  const out: GapColumns = { have: [], kaplan: [], outside: [], m: 0 };
  for (const s of role.keySkills.filter((s) => s.key).sort((a, b) => a.sortOrder - b.sortOrder)) {
    out.m++;
    const k = norm(s.skill);
    const cover = covered.get(k);
    if (cover) {
      out.have.push({ skill: s.skill, level: s.level, via: cover.via });
      continue;
    }
    const elective = missing.get(k)?.actions.find((a) => a.kind === "elective");
    if (elective && elective.kind === "elective") {
      out.kaplan.push({ skill: s.skill, level: s.level, module: elective.module });
      continue;
    }
    out.outside.push({ skill: s.skill, level: s.level });
  }
  return out;
}

/** The receipts the panel's footnotes use, in reading order, for the caller's ReceiptSection. */
export function gapReceipts(programmeId: string | null, url: string | null, modules: boolean, t: (k: string) => string): ReceiptView[] {
  return [
    fromRule(RULE_IDS.count, t(MATCH_RULES.count)),
    fromRule(RULE_IDS.gap, t(MATCH_RULES.gap)),
    ...(programmeId && modules ? [fromRule(RULE_IDS.reading(programmeId), t(MATCH_RULES.reading), { url })] : []),
  ];
}

const gapId = (roleId: string, skill: string) => `${roleId}-${slug(skill)}`;

/** A column: its swatch, its head with the count in lighter ink ("You have 4"), and its skills. */
function Column({ swatch, title, n, fn, children }: { swatch: "have" | "add" | "none"; title: string; n: number; fn?: ReactNode; children: ReactNode }) {
  const t = useT();
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl bg-(--land-ground) p-3 sm:p-4">
      <h4 className="m-0 flex items-center gap-2 text-[14px] font-semibold text-(--text)">
        <CellSwatch state={swatch} className="h-2.5 w-5 shrink-0" />
        <span>
          {t.rich(title, {}, { n: <span className="font-normal text-(--land-body) tabular-nums">{n}</span> })}
          {fn}
        </span>
      </h4>
      {n === 0 ? <p className="m-0 px-1 text-[13px] text-(--land-body)">{t(C.none)}</p> : <ul className="m-0 flex list-none flex-col gap-2.5 p-0">{children}</ul>}
    </section>
  );
}

function Item({ skill, children }: { skill: string; children: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-xl border border-(--land-line) bg-(--land-card) p-3.5">
      <span lang="en" className="text-[15px] leading-snug font-semibold wrap-break-word text-(--text)">
        {skill}
      </span>
      {children}
    </li>
  );
}

/** What covers a skill the student has: the modules on one line, else the certificate, ticked skill or experience. */
function Via({ via }: { via: CoverSource[] }) {
  const t = useT();
  const locale = useIntlLocale();
  const modules = via.flatMap((v) => (v.kind === "module" ? [v.module] : []));
  const line = (icon: ReactNode, text: ReactNode) => (
    <span className="inline-flex min-w-0 items-baseline gap-1.5 text-[13px] leading-5 text-(--text)">
      {icon}
      <span className="min-w-0">{text}</span>
    </span>
  );
  const icon = "size-3.5 shrink-0 translate-y-0.5 text-(--land-body)";
  if (modules.length) return line(<BookOpenIcon aria-hidden className={icon} />, t.rich(C.from, {}, { modules: <span lang="en">{modules.join(locale.startsWith("zh") ? "、" : ", ")}</span> }));
  const v = via[0];
  if (!v) return null;
  if (v.kind === "experience") return line(<BriefcaseIcon aria-hidden className={icon} />, t(M.viaExperience));
  if (v.kind === "module") return null;
  const chip = chipById(v.chipId);
  if (!chip) return null;
  return v.kind === "certificate"
    ? line(<AwardIcon aria-hidden className={icon} />, t(M.viaCertificate, { certificate: t(chip.label) }))
    : line(<SquareCheckIcon aria-hidden className={icon} />, t(M.viaSkill, { skill: t(chip.label) }));
}

export function RoleGapPanel({ role, result, className }: { role: RoleCardData; result: MatchResult | null; className?: string }) {
  const t = useT();
  const { answers, update, example } = usePlan();
  const cols = useMemo(() => (result ? gapColumns(role, result) : null), [role, result]);
  const details = example ? exampleHref(roleHref(role.id), example) : roleHref(role.id);
  const masters = example ? exampleHref(`${roleHref(role.id)}#cr-masters-title`, example) : `${roleHref(role.id)}#cr-masters-title`;
  const planHref = example ? exampleHref("/plan", example) : "/plan";
  const keep = example ? () => openExampleNow(example) : undefined;

  const saved = new Set(answers.skillGaps.map((g) => g.id));
  const gapsOf = (c: GapColumns): SkillGap[] => [
    ...c.kaplan.map((k) => ({ id: gapId(role.id, k.skill), roleId: role.id, role: role.short, skill: k.skill, level: k.level, via: "kaplan" as const, module: k.module, own: true })),
    ...c.outside.map((o) => ({ id: gapId(role.id, o.skill), roleId: role.id, role: role.short, skill: o.skill, level: o.level, via: "outside" as const, module: null, own: false })),
  ];
  const toggle = (g: SkillGap) =>
    update({ skillGaps: saved.has(g.id) ? answers.skillGaps.filter((x) => x.id !== g.id) : [...answers.skillGaps, g] });
  const addAll = (list: SkillGap[]) => {
    update({ skillGaps: [...answers.skillGaps.filter((x) => !list.some((g) => g.id === x.id)), ...list] });
    keep?.();
  };

  const head = (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-2">
        <h3 className="m-0 font-heading text-[clamp(22px,2.4vw,30px)] [font-stretch:var(--display-stretch)] leading-[1.15] font-bold tracking-[-0.01em] text-balance wrap-break-word text-(--text)">
          {t.rich(C.title, {}, { role: <span lang="en">{role.short}</span> })}
        </h3>
        {cols && (
          <p className="m-0 text-[14px] leading-snug text-(--land-body) tabular-nums">
            {t(cols.outside.length ? C.line : C.lineNoOutside, { n: cols.have.length, m: cols.m, k: cols.have.length + cols.kaplan.length, x: cols.outside.length })}
            <Fn id={RULE_IDS.gap} />
          </p>
        )}
      </div>
      <Link
        href={details}
        onClick={keep}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-solid border-(--land-line) bg-(--land-card) px-4 text-[14px] font-semibold text-(--text) no-underline",
          "transition-[border-color] duration-200 hover:border-(--land-body) motion-reduce:transition-none",
          FOCUS,
        )}
      >
        {t(C.details)}
        <ArrowRightIcon aria-hidden className="size-4" />
      </Link>
    </div>
  );

  if (!result || !cols) {
    return (
      <div className={cn("flex flex-col gap-4 rounded-2xl border border-(--land-line) bg-(--land-card) p-5 sm:p-8", className)}>
        {head}
        <p className="m-0 text-[15px] text-(--land-body)">{t(DRAFT.careers.entry.empty)}</p>
      </div>
    );
  }

  const gaps = gapsOf(cols);
  const bar = [...cols.have.map(() => "have" as const), ...cols.kaplan.map(() => "add" as const), ...cols.outside.map(() => "none" as const)];
  return (
    <div className={cn("flex flex-col gap-6 rounded-2xl border border-(--land-line) bg-(--land-card) p-5 sm:p-8", className)}>
      {head}

      <p role="img" aria-label={t(C.bar, { n: cols.have.length, k: cols.kaplan.length, x: cols.outside.length, m: cols.m })} className={cn("m-0 flex w-full items-center", bar.length > 20 ? "gap-0.5" : "gap-1.5")}>
        {bar.map((s, i) => (
          <CellSwatch key={i} state={s} className="h-2.5 min-w-0 flex-1" />
        ))}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Column swatch="have" title={C.have} n={cols.have.length} fn={<Fn id={RULE_IDS.count} />}>
          {cols.have.map((h) => (
            <Item key={h.skill} skill={h.skill}>
              <span className="text-[13px] text-(--land-body) tabular-nums">{t(C.level, { level: h.level })}</span>
              <Via via={h.via} />
            </Item>
          ))}
        </Column>

        <Column swatch="add" title={C.kaplan} n={cols.kaplan.length}>
          {cols.kaplan.map((k) => {
            const g = gaps.find((x) => x.skill === k.skill)!;
            const on = saved.has(g.id);
            return (
              <Item key={k.skill} skill={k.skill}>
                <span className="text-[13px] text-(--land-body) tabular-nums">{t(C.level, { level: k.level })}</span>
                <span className="inline-flex min-w-0 items-baseline gap-1.5 text-[13px] leading-5 text-(--text)">
                  <BookOpenIcon aria-hidden className="size-3.5 shrink-0 translate-y-0.5 text-(--land-body)" />
                  <span className="flex min-w-0 flex-col">
                    <span lang="en" className="wrap-break-word">
                      {k.module}
                    </span>
                    <span className="text-[12px] text-(--land-body)">{t(C.ownElective)}</span>
                  </span>
                </span>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(g)}
                  className={cn(
                    "mt-1.5 inline-flex min-h-9 w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-solid px-3 text-[13px] font-semibold",
                    "transition-[background-color,border-color] duration-200 motion-reduce:transition-none",
                    on ? "border-(--brand-ink) bg-[color-mix(in_oklab,var(--brand-ink)_8%,transparent)] text-(--brand-ink)" : "border-(--land-line) bg-(--land-card) text-(--text) hover:border-(--land-body)",
                    FOCUS,
                  )}
                >
                  {on ? <CheckIcon aria-hidden className="size-3.5" /> : <PlusIcon aria-hidden className="size-3.5" />}
                  {t(on ? C.added : C.add)}
                </button>
              </Item>
            );
          })}
        </Column>

        <Column swatch="none" title={C.outside} n={cols.outside.length}>
          {cols.outside.map((o) => (
            <Item key={o.skill} skill={o.skill}>
              <span className="text-[13px] text-(--land-body) tabular-nums">{t(C.levelNone, { level: o.level })}</span>
              <Link
                href={masters}
                onClick={keep}
                className={cn("mt-1.5 inline-flex w-fit items-center gap-1 rounded-sm text-[13px] font-semibold text-(--brand-ink) no-underline underline-offset-4 hover:underline", FOCUS)}
              >
                {t(C.find)}
                <ArrowRightIcon aria-hidden className="size-3.5" />
              </Link>
            </Item>
          ))}
        </Column>
      </div>

      {gaps.length > 0 ? (
        <div className="flex justify-end">
          <Link
            href={planHref}
            onClick={() => addAll(gaps)}
            className={cn(
              "inline-flex min-h-12 items-center gap-2.5 rounded-lg bg-(--accent) px-5 text-[15px] font-bold text-(--accent-text) no-underline",
              "transition-[background-color] duration-200 hover:bg-[color-mix(in_oklab,var(--accent)_88%,var(--accent-text))] motion-reduce:transition-none",
              FOCUS,
            )}
          >
            {gaps.length === 1 ? t(C.addAllOne) : t(C.addAll, { n: gaps.length })}
            <ArrowRightIcon aria-hidden className="size-4" />
          </Link>
        </div>
      ) : (
        <p className="m-0 inline-flex items-center gap-1.5 text-[15px] font-semibold text-(--brand-ink)">
          <CheckIcon aria-hidden className="size-4" />
          {t(C.done)}
        </p>
      )}
    </div>
  );
}
