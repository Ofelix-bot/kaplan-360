"use client";

import { useMemo } from "react";
import { AwardIcon, BookOpenIcon, BriefcaseIcon, CheckIcon, CircleDashedIcon, SquareCheckIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Fn } from "@/components/shared/receipt/Fn";
import { ReceiptSection } from "@/components/shared/receipt/ReceiptSection";
import { SourceList } from "@/components/shared/receipt/SourceList";
import { DRAFT } from "@/content/draft";
import { chipById, chipRuleId } from "@/lib/careers/chips";
import { matchFor, MATCH_RULES, RULE_IDS } from "@/lib/careers/match";
import type { Cover, CoverSource, MatchResult, RoleCardData, StudentContext } from "@/lib/careers/types";
import { useMatchStudent } from "@/lib/careers/use-student";
import { fromRule, type ReceiptView } from "@/lib/receipts/model";
import { coverableSet, keySkillCells } from "@/lib/careers/cells";
import { MatchBandText } from "./MatchMeter";
import { SkillCells } from "./SkillCells";

// The gap picture (plan §3.2, Q11, Q22, C5): every key skill the role asks for, beside what the student has
// for it (a core module, a certificate or a ticked skill) or "Missing"; then the count now and after the
// listed electives and certificates (n → n′ of m, Kaplan 360++'s count). Module links are Kaplan 360++'s
// reading, chip links Kaplan 360++'s mapping; each carries its receipt. No heading of its own: the role page
// and the industry page put it under theirs. Rows are a list, never a table. Ends with the section's sources.

const C = DRAFT.careers;
const PILL = "rounded-full border px-2.5 py-1 text-[13px] leading-5";

/** The receipts this picture's footnotes use, in reading order. */
function receiptsFor(result: MatchResult | null, programmeId: string | null, url: string | null, t: (k: string) => string): ReceiptView[] {
  const out: ReceiptView[] = [fromRule(RULE_IDS.band, t(MATCH_RULES.band))];
  if (!result) return out;
  if (result.fit === "adjacent") out.push(fromRule(RULE_IDS.adjacent, t(MATCH_RULES.adjacent)));
  if (result.fieldOnly) out.push(fromRule(RULE_IDS.fieldOnly, t(MATCH_RULES.fieldOnly)));
  if (programmeId && result.covered.some((c) => c.via.some((v) => v.kind === "module"))) out.push(fromRule(RULE_IDS.reading(programmeId), t(MATCH_RULES.reading), { url }));
  for (const c of result.covered)
    for (const v of c.via) {
      if (v.kind === "module" || v.kind === "experience") continue;
      const chip = chipById(v.chipId);
      if (chip) out.push(fromRule(chipRuleId(chip.id), t(chip.basis)));
    }
  if (result.missing.length) out.push(fromRule(RULE_IDS.count, t(MATCH_RULES.count)));
  return out;
}

function Via({ via, programmeId }: { via: CoverSource; programmeId: string | null }) {
  const t = useT();
  if (via.kind === "module")
    return (
      <span className="inline-flex min-w-0 items-baseline gap-1.5">
        <BookOpenIcon aria-hidden className="size-3.5 shrink-0 translate-y-0.5 text-(--brand-ink)" />
        <span className="min-w-0">
          {t.rich(C.match.viaModule, {}, { module: <span lang="en">{via.module}</span> })}
          {programmeId && <Fn id={RULE_IDS.reading(programmeId)} />}
        </span>
      </span>
    );
  // A skill the student ticked on an internship or work entry (/profile): their own record, no mapping to footnote.
  if (via.kind === "experience")
    return (
      <span className="inline-flex min-w-0 items-baseline gap-1.5">
        <BriefcaseIcon aria-hidden className="size-3.5 shrink-0 translate-y-0.5 text-(--brand-ink)" />
        <span className="min-w-0">{t(C.match.viaExperience)}</span>
      </span>
    );
  const chip = chipById(via.chipId);
  if (!chip) return null;
  const Icon = via.kind === "certificate" ? AwardIcon : SquareCheckIcon;
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5">
      <Icon aria-hidden className="size-3.5 shrink-0 translate-y-0.5 text-(--brand-ink)" />
      <span className="min-w-0">
        {via.kind === "certificate" ? t(C.match.viaCertificate, { certificate: t(chip.label) }) : t(C.match.viaSkill, { skill: t(chip.label) })}
        <Fn id={chipRuleId(chip.id)} />
      </span>
    </span>
  );
}

function Row({ skill, level, cover, programmeId }: { skill: string; level: number; cover: Cover | null; programmeId: string | null }) {
  const t = useT();
  return (
    <li className="grid grid-cols-1 items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)]">
      <span
        className={cn(
          PILL,
          "inline-flex w-fit max-w-full items-center gap-1.5 bg-(--land-card)",
          cover ? "border-(--brand-ink) text-(--text)" : "border-dashed border-(--land-line) text-(--land-body)",
        )}
      >
        {cover ? <CheckIcon aria-hidden className="size-3.5 shrink-0 text-(--brand-ink)" /> : <CircleDashedIcon aria-hidden className="size-3.5 shrink-0" />}
        <span lang="en" className="min-w-0 truncate">
          {skill}
        </span>
        <span className="shrink-0 text-xs text-(--land-body)">
          <span className="sr-only">, </span>
          {t(C.role.level, { level })}
        </span>
      </span>
      <span aria-hidden className={cn("hidden h-px sm:block", cover ? "bg-(--brand-ink)" : "border-t border-dashed border-(--land-line)")} />
      <span className="flex min-w-0 flex-col gap-0.5 pl-1 text-[13px] leading-5 text-(--text) sm:pl-0">
        {cover ? cover.via.slice(0, 2).map((v, i) => <Via key={i} via={v} programmeId={programmeId} />) : <span className="text-(--land-body)">{t(C.hot.youMiss)}</span>}
      </span>
    </li>
  );
}

/** m cells: now (solid) and what the listed actions add (light), with the two counts as words. */
function Progress({ n, nAfter, m }: { n: number; nAfter: number; m: number }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <span aria-hidden className="flex w-full max-w-md items-center gap-1">
        {Array.from({ length: m }, (_, i) => (
          <span key={i} className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-(--land-line)">
            <span
              style={{ transitionDelay: `${i * 40}ms` }}
              className={cn(
                "absolute inset-0 origin-left rounded-full motion-safe:transition-transform motion-safe:duration-(--motion-ui-dur) motion-safe:ease-(--motion-ui)",
                i < n ? "bg-(--brand-ink)" : "bg-(--accent)",
                i < nAfter ? "scale-x-100" : "scale-x-0",
              )}
            />
          </span>
        ))}
      </span>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-(--land-body)">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-(--brand-ink)" />
          {t(C.gap.now, { n, m })}
          <Fn id={RULE_IDS.count} />
        </span>
        {nAfter > n && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full bg-(--accent)" />
            {t(C.gap.after, { n: nAfter, m })}
          </span>
        )}
      </p>
    </div>
  );
}

export function MatchGap({ role, ctx, className }: { role: RoleCardData; ctx: StudentContext; className?: string }) {
  const t = useT();
  const { student } = useMatchStudent(ctx);
  const result = useMemo(() => matchFor(student, role, ctx), [student, role, ctx]);
  const url = ctx.degrees.find((d) => d.id === student.programmeId)?.url ?? null;
  const receipts = useMemo(() => receiptsFor(result, student.programmeId, url, t), [result, student.programmeId, url, t]);
  const keys = role.keySkills.filter((s) => s.key).sort((a, b) => a.sortOrder - b.sortOrder);
  const coverOf = new Map(result?.covered.map((c) => [c.skill, c]) ?? []);
  const coverable = useMemo(() => coverableSet(ctx.coverableSkills), [ctx.coverableSkills]);
  const cells = useMemo(() => keySkillCells(role.keySkills, result, coverable), [role.keySkills, result, coverable]);

  return (
    <ReceiptSection receipts={receipts}>
      <div className={cn("flex min-w-0 flex-col gap-5", className)}>
        <div className="flex flex-col gap-2">
          <SkillCells cells={cells} label={t(C.role.skillsTitle)} />
          <p className="text-sm">
            <MatchBandText result={result} />
            <Fn id={RULE_IDS.band} />
            {result?.fieldOnly && <Fn id={RULE_IDS.fieldOnly} />}
          </p>
          {result?.fit === "adjacent" && (
            <p className="text-[13px] text-(--land-body)">
              {t(C.match.adjacent)}
              <Fn id={RULE_IDS.adjacent} />
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p aria-hidden className="hidden grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)] gap-x-3 text-xs font-medium text-(--land-body) sm:grid">
            <span>{t(C.gap.asks)}</span>
            <span />
            <span>{t(C.gap.have)}</span>
          </p>
          <ul aria-label={t(C.gap.asks)} className="flex flex-col gap-2">
            {keys.map((k) => (
              <Row key={k.skill} skill={k.skill} level={k.level} cover={coverOf.get(k.skill) ?? null} programmeId={student.programmeId} />
            ))}
          </ul>
        </div>

        {result &&
          (result.missing.length ? (
            <Progress n={result.n} nAfter={result.nAfter} m={result.m} />
          ) : (
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-(--brand-ink)">
              <CheckIcon aria-hidden className="size-4" />
              {t(C.gap.done)}
            </p>
          ))}
      </div>
      <SourceList />
    </ReceiptSection>
  );
}
