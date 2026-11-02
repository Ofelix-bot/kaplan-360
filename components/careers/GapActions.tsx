"use client";

import { useMemo, type ReactNode } from "react";
import { AwardIcon, BookOpenIcon, BriefcaseIcon, CheckIcon, ExternalLinkIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { useIntlLocale, useT } from "@/components/i18n/I18nProvider";
import { Fn } from "@/components/shared/receipt/Fn";
import { ReceiptSection } from "@/components/shared/receipt/ReceiptSection";
import { SourceList } from "@/components/shared/receipt/SourceList";
import { DRAFT } from "@/content/draft";
import { chipById, chipRuleId } from "@/lib/careers/chips";
import { matchFor, MATCH_RULES, RULE_IDS, SF_DATASET_URL } from "@/lib/careers/match";
import type { GapAction, GapActionKind, RoleCardData, StudentContext } from "@/lib/careers/types";
import { useMatchStudent } from "@/lib/careers/use-student";
import { RECEIPTS } from "@/lib/home/receipts";
import { fromRegistry, fromRule, type ReceiptView } from "@/lib/receipts/model";

// What closes the gap (Q27; plan §3.2): up to three columns of cards, one per kind, each with its receipts.
// (1) An elective of the student's own degree linked to a missing key skill (Kaplan 360++'s reading), linked
//     to the Kaplan programme page. (2) A certificate we hold receipts for that covers one, with this degree's
//     exemptions. (3) An internship in the role's Skills Framework track, named from the track and the skill
//     TITLES only (the Skills Framework's terms bar reusing its descriptions); a Student's Pass holder also sees
//     MOM's work-pass sentence. "course" (SkillsFuture) never renders: MySkillsFuture's robots.txt and terms
//     refuse it. Cards sit straight on the page: one card level, no card inside a card. Ends with its sources.

const C = DRAFT.careers;
const SHOWN = 3;
const KINDS: Exclude<GapActionKind, "course">[] = ["elective", "certificate", "internship"];
const TITLE: Record<(typeof KINDS)[number], string> = { elective: C.actions.electiveTitle, certificate: C.actions.certificateTitle, internship: C.actions.internshipTitle };
const ICON: Record<(typeof KINDS)[number], LucideIcon> = { elective: BookOpenIcon, certificate: AwardIcon, internship: BriefcaseIcon };
const COLS = ["", "md:grid-cols-1", "md:grid-cols-2", "md:grid-cols-3"];
const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)";

/** Registry receipts as views, skipping an id the registry lacks. */
const registry = (ids: readonly string[]): ReceiptView[] => ids.flatMap((id) => (RECEIPTS[id] ? [fromRegistry(RECEIPTS[id])] : []));

function receiptsFor(actions: Record<GapActionKind, GapAction[]>, programmeId: string | null, url: string | null, t: (k: string) => string): ReceiptView[] {
  const out: ReceiptView[] = [];
  if (programmeId && actions.elective.length) out.push(fromRule(RULE_IDS.reading(programmeId), t(MATCH_RULES.reading), { url }));
  for (const a of actions.certificate.slice(0, SHOWN)) {
    if (a.kind !== "certificate") continue;
    out.push(...registry(a.receipts));
    const chip = chipById(a.chipId);
    if (chip) out.push(fromRule(chipRuleId(chip.id), t(chip.basis)));
  }
  for (const a of actions.internship) {
    if (a.kind !== "internship") continue;
    out.push(fromRule(RULE_IDS.internship, t(MATCH_RULES.internship), { url: SF_DATASET_URL }));
    out.push(...registry(a.receipts));
  }
  return out;
}

function Card({ icon: Icon, title, children, fns }: { icon: LucideIcon; title: ReactNode; children: ReactNode; fns: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-2xl border border-(--land-line) bg-(--land-card) p-4 text-(--text)">
      <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--brand-ink)_10%,transparent)] text-(--brand-ink)">
        <Icon className="size-4" />
      </span>
      <p className="text-[15px] leading-snug font-semibold [overflow-wrap:break-word]">
        {title}
        {fns}
      </p>
      <div className="flex flex-col gap-1.5 text-[13px] leading-5 text-(--land-body)">{children}</div>
    </li>
  );
}

export function GapActions({ role, ctx, className }: { role: RoleCardData; ctx: StudentContext; className?: string }) {
  const t = useT();
  const locale = useIntlLocale();
  const { student } = useMatchStudent(ctx);
  const result = useMemo(() => matchFor(student, role, ctx), [student, role, ctx]);
  const url = ctx.degrees.find((d) => d.id === student.programmeId)?.url ?? null;
  const actions = result?.actions;
  const receipts = useMemo(() => (actions ? receiptsFor(actions, student.programmeId, url, t) : []), [actions, student.programmeId, url, t]);
  const list = (items: string[]) => new Intl.ListFormat(locale, { type: "conjunction" }).format(items);

  if (!result) return <p className={cn("text-sm text-(--land-body)", className)}>{t(C.entry.empty)}</p>;
  if (!result.missing.length)
    return (
      <p className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-(--brand-ink)", className)}>
        <CheckIcon aria-hidden className="size-4" />
        {t(C.gap.done)}
      </p>
    );

  const kinds = KINDS.filter((k) => result.actions[k].length);
  return (
    <ReceiptSection receipts={receipts}>
      <div className={cn("grid grid-cols-1 gap-6", COLS[kinds.length], className)}>
        {kinds.map((kind) => {
          const headingId = `gap-${role.id}-${kind}`;
          return (
            <section key={kind} aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
              <h3 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-(--text)">
                {t(TITLE[kind])}
              </h3>
              <ul className="flex flex-col gap-3">
                {result.actions[kind].slice(0, SHOWN).map((a) => {
                  if (a.kind === "elective")
                    return (
                      <Card key={a.module} icon={ICON.elective} title={t.rich(C.actions.elective, {}, { module: <span lang="en">{a.module}</span> })} fns={student.programmeId && <Fn id={RULE_IDS.reading(student.programmeId)} />}>
                        <p>{t.rich(C.actions.electiveCovers, {}, { skills: <span lang="en">{list(a.skills)}</span> })}</p>
                        {a.url && (
                          <a href={a.url} target="_blank" rel="noreferrer" className={cn("inline-flex w-fit items-center gap-1 font-medium text-(--brand-ink) underline-offset-4 hover:underline", FOCUS, "rounded-sm")}>
                            {t(C.actions.seeCourse)}
                            <ExternalLinkIcon aria-hidden className="size-3.5" />
                          </a>
                        )}
                      </Card>
                    );
                  if (a.kind === "certificate") {
                    const chip = chipById(a.chipId);
                    if (!chip) return null;
                    return (
                      <Card
                        key={a.chipId}
                        icon={ICON.certificate}
                        title={t(C.actions.certificate, { certificate: t(chip.label) })}
                        fns={
                          <>
                            {a.receipts.map((id) => (
                              <Fn key={id} id={id} />
                            ))}
                            <Fn id={chipRuleId(chip.id)} />
                          </>
                        }
                      >
                        <p>{t.rich(C.actions.electiveCovers, {}, { skills: <span lang="en">{list(a.skills)}</span> })}</p>
                        {a.exemptions.length > 0 && <p className="font-medium text-(--text)">{t(C.actions.exemptions, { n: a.exemptions.length, list: list(a.exemptions) })}</p>}
                      </Card>
                    );
                  }
                  if (a.kind === "internship")
                    return (
                      <Card
                        key="internship"
                        icon={ICON.internship}
                        title={t.rich(C.actions.internship, {}, { track: <span lang="en">{a.track}</span> })}
                        fns={<Fn id={RULE_IDS.internship} />}
                      >
                        <p>{t.rich(C.actions.internshipAsk, {}, { skills: <span lang="en">{list(a.skills)}</span> })}</p>
                        {a.internships > 0 && <p>{a.internships === 1 ? t(C.actions.internshipHaveOne) : t(C.actions.internshipHave, { n: a.internships })}</p>}
                        {a.local && <p>{t(C.actions.noPass)}</p>}
                        {a.studentPass && (
                          <p>
                            {t(C.actions.pass)}
                            {a.receipts.map((id) => (
                              <Fn key={id} id={id} />
                            ))}
                          </p>
                        )}
                      </Card>
                    );
                  return null;
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <SourceList />
    </ReceiptSection>
  );
}
