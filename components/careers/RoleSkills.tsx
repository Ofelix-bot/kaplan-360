"use client";

import { useMemo } from "react";
import { CheckIcon, CircleDashedIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { MatchBandText, MatchMeter } from "@/components/careers/MatchMeter";
import { Fn, ReceiptSection, SourceList } from "@/components/shared/receipt";
import { DRAFT } from "@/content/draft";
import { chipById, chipRuleId } from "@/lib/careers/chips";
import { MATCH_RULES, matchFor, RULE_IDS } from "@/lib/careers/match";
import type { Cover, CoverSource, RoleFull, StudentContext } from "@/lib/careers/types";
import { useMatchStudent } from "@/lib/careers/use-student";
import { fromRule, type ReceiptView } from "@/lib/receipts/model";

// The role page's key skills (plan §3.2; Q11, Q22, C5): each of the role's m key skills with its Skills
// Framework level as 6 cells, and, where the student covers it, a check with what covers it: a module of
// their degree (linked by Kaplan 360++'s reading, footnoted), a certificate they hold or a skill they
// ticked (footnoted to the chip's mapping). Work and internship counts never cover a skill (C5). Above the
// list: the band with "n of m" (never a probability). Read on the client from the student's answers;
// the static HTML shows the skills without coverage, so hydration matches.

const C = DRAFT.careers;

const readingId = RULE_IDS.reading;

const H2 = "m-0 min-w-0 font-heading text-[clamp(24px,2.6vw,34px)] leading-[1.12] font-bold tracking-[-0.02em] text-balance wrap-break-word text-(--text)";

/** The 1–6 level cells. Decorative: the label says the level. */
function Level({ level }: { level: number }) {
  return (
    <span aria-hidden className="grid grid-cols-6 gap-1">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className={cn("h-2 w-4 rounded-sm sm:w-5", i < level ? "bg-(--brand-ink)" : "bg-(--land-line)")} />
      ))}
    </span>
  );
}

/** One way a skill is covered, with its footnote. */
function Via({ via, programmeId }: { via: CoverSource; programmeId: string | null }) {
  const t = useT();
  if (via.kind === "module") {
    return (
      <span>
        <span lang="en">{t(C.match.viaModule, { module: via.module })}</span>
        {programmeId && <Fn id={readingId(programmeId)} />}
      </span>
    );
  }
  // A skill ticked on an internship or work entry (/profile): the student's own record, no mapping to footnote.
  if (via.kind === "experience") return <span>{t(C.match.viaExperience)}</span>;
  const chip = chipById(via.chipId);
  const label = chip ? t(chip.label) : via.chipId;
  return (
    <span>
      {via.kind === "certificate" ? t(C.match.viaCertificate, { certificate: label }) : t(C.match.viaSkill, { skill: label })}
      {chip && <Fn id={chipRuleId(chip.id)} />}
    </span>
  );
}

export function RoleSkills({ role, ctx, className }: { role: RoleFull; ctx: StudentContext; className?: string }) {
  const t = useT();
  const { student, ready } = useMatchStudent(ctx);
  const keySkills = useMemo(() => {
    const key = role.keySkills.length ? role.keySkills : role.skills.filter((s) => s.key);
    return [...key].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [role.keySkills, role.skills]);

  const result = useMemo(() => {
    if (!ready) return null;
    return matchFor(student, role, ctx);
  }, [ready, student, role, ctx]);

  const covered = useMemo(() => new Map<string, Cover>((result?.covered ?? []).map((c) => [c.skill, c])), [result]);

  // Footnotes in reading order: the first module reading, then each chip's mapping as it appears.
  const views = useMemo(() => {
    const out: ReceiptView[] = [];
    const seen = new Set<string>();
    const add = (id: string, text: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push(fromRule(id, text));
    };
    for (const s of keySkills) {
      for (const via of (covered.get(s.skill)?.via ?? []).slice(0, 2)) {
        if (via.kind === "module" && student.programmeId) add(readingId(student.programmeId), t(MATCH_RULES.reading));
        else if (via.kind !== "module" && via.kind !== "experience") {
          const chip = chipById(via.chipId);
          if (chip) add(chipRuleId(chip.id), chip.basis);
        }
      }
    }
    return out;
  }, [keySkills, covered, student.programmeId, t]);

  if (keySkills.length === 0) return null;

  return (
    <section aria-labelledby="cr-skills-title" className={cn("home-wrap flex flex-col gap-6 border-t border-(--land-line) py-12 sm:py-14", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <h2 id="cr-skills-title" className={H2}>
          {t(C.role.skillsTitle)}
        </h2>
        <div className="flex min-w-0 flex-col items-start gap-1.5 sm:items-end">
          <MatchMeter n={result?.n ?? 0} m={result?.m ?? keySkills.length} band={result?.band ?? null} />
          <p className="m-0 text-[14px] leading-snug font-semibold text-(--text)">
            <MatchBandText result={result} />
          </p>
        </div>
      </div>

      <ReceiptSection receipts={views}>
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
          {keySkills.map((s) => {
            const cover = covered.get(s.skill);
            return (
              <li
                key={s.skill}
                className={cn("flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-(--land-card) p-4 sm:p-5", cover ? "border-(--brand-ink)" : "border-(--land-line)")}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <p lang="en" className="m-0 min-w-0 text-[16px] leading-snug font-semibold text-balance wrap-break-word text-(--text)">
                    {s.skill}
                  </p>
                  {cover ? (
                    <CheckIcon role="img" aria-label={t(C.hot.youHave)} className="size-5 shrink-0 text-(--brand-ink)" />
                  ) : result ? (
                    <CircleDashedIcon role="img" aria-label={t(C.hot.youMiss)} className="size-5 shrink-0 text-(--land-body)" />
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Level level={s.level} />
                  <span className="text-[13px] leading-none text-(--land-body)">{t(C.role.level, { level: s.level })}</span>
                </div>
                {cover && cover.via.length > 0 && (
                  <p className="m-0 flex flex-col gap-1 text-[14px] leading-snug text-(--text)">
                    {cover.via.slice(0, 2).map((via, i) => (
                      <Via key={i} via={via} programmeId={student.programmeId} />
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {views.length > 0 && <SourceList className="mt-6" />}
      </ReceiptSection>
    </section>
  );
}
