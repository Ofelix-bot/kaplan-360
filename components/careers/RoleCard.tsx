"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { useDay } from "@/components/landing/receipts";
import { ExpandCard } from "@/components/shared/ExpandCard";
import { Fn } from "@/components/shared/receipt";
import { DRAFT } from "@/content/draft";
import { chipById } from "@/lib/careers/chips";
import { roleHref } from "@/lib/careers/links";
import { RULE_IDS } from "@/lib/careers/match";
import type { GapAction, MatchResult, RoleCardData } from "@/lib/careers/types";
import { exampleHref, openExampleNow } from "@/lib/example-link";
import { fromRule, type ReceiptView } from "@/lib/receipts/model";
import { usePlan } from "@/lib/use-plan";
import { RoleScene } from "./art/RoleScene";
import { RoleBadges } from "./Badges";
import { BAND_TEXT, MatchBandText, MatchMeter } from "./MatchMeter";

// A hot-role card (Q10, Q11, Q12, Q26) on the shared ExpandCard (tone "card", unchanged): the badges and the
// match band on the label line, the role's short title, and as the picture the n of m, a big n over its
// meter (moved out of the label on 2026-10-29, so the card says something at rest; the label still says it
// to screen readers, since the picture is aria-hidden); on hover,
// focus or tap (shown from the start where nothing hovers) the key skills the student covers and misses and
// the nearest gap action, then the receipts behind the badges and, only where an employer check ran,
// "N openings · checked {date}". The CTA opens the role page, keeping an open worked example.
// The badges' Fns sit in ExpandCard's `extra` row, above the stretched link, so each stays its own target;
// the band's Fn sits in the label, raised above it the same way. The caller's ReceiptSection lists the same
// ids (roleReceiptViews, and the band rule in HotRoles) so every Fn has its number.

const C = DRAFT.careers;

/** The rule behind High pay, one per industry (its id names the industry, so the source list holds it once). */
export function highPayRuleView(role: RoleCardData): ReceiptView | null {
  return role.highPay && role.highPayRule ? fromRule(`rule:high-pay:${role.industryId}`, role.highPayRule) : null;
}

/** The receipts a card's Fns use, in reading order: MOM needs facts, the wage row, the High pay rule. */
export function roleReceiptViews(role: RoleCardData, receipts: Record<string, ReceiptView>): ReceiptView[] {
  const out: ReceiptView[] = [];
  if (role.momNeeds) for (const id of role.momNeedsFactIds) if (receipts[id]) out.push(receipts[id]);
  if (role.highPay) {
    if (role.wageFactId && receipts[role.wageFactId]) out.push(receipts[role.wageFactId]);
    const rule = highPayRuleView(role);
    if (rule) out.push(rule);
  }
  return out;
}

/** The first action that closes a gap: an elective, then a certificate, then an internship. */
function firstAction(result: MatchResult): GapAction | null {
  return result.actions.elective[0] ?? result.actions.certificate[0] ?? result.actions.internship[0] ?? null;
}

/** Skills named on a card line; the rest are counted ("+4"), and the role page lists them all. */
const SKILLS_SHOWN = 2;

// The card's lines are cut by count, not by line-clamp: a clamped paragraph still lays its hidden lines out
// under the next row (Hallmark 73, text painted under another element).
function SkillLine({ label, skills }: { label: string; skills: string[] }) {
  if (skills.length === 0) return null;
  const more = skills.length - SKILLS_SHOWN;
  return (
    <p className="m-0">
      <span className="font-semibold text-(--text)">{label}</span> <span lang="en">{skills.slice(0, SKILLS_SHOWN).join(", ")}</span>
      {more > 0 && <span className="whitespace-nowrap tabular-nums"> +{more}</span>}
    </p>
  );
}

export function RoleCard({ role, result, receipts }: { role: RoleCardData; result: MatchResult | null; receipts: Record<string, ReceiptView> }) {
  const t = useT();
  const day = useDay();
  const { example } = usePlan();

  const action = result ? firstAction(result) : null;
  const actionText = (a: GapAction): string | null => {
    if (a.kind === "elective") return t(C.actions.elective, { module: a.module });
    if (a.kind === "certificate") {
      const chip = chipById(a.chipId);
      return chip ? t(C.actions.certificate, { certificate: t(chip.label) }) : null;
    }
    if (a.kind === "internship") return t(C.actions.internship, { track: a.track });
    return null;
  };
  const next = action ? actionText(action) : null;

  const description: ReactNode = result ? (
    <div className="flex flex-col gap-2">
      {!result.fieldOnly && (
        <>
          <SkillLine label={t(C.hot.youHave)} skills={result.covered.map((c) => c.skill)} />
          <SkillLine label={t(C.hot.youMiss)} skills={result.missing.map((g) => g.skill)} />
        </>
      )}
      {next && (
        <p className="m-0">
          <span className="font-semibold text-(--text)">{t(C.hot.nextStep)}</span> {next}
        </p>
      )}
      {result.missing.length === 0 && <p className="m-0">{t(C.gap.done)}</p>}
    </div>
  ) : (
    // No match yet: the label already says to pick a degree; the role's key skills stand in.
    <SkillLine label={t(C.role.skillsTitle)} skills={role.keySkills.map((s) => s.skill)} />
  );

  const momIds = role.momNeeds ? role.momNeedsFactIds.filter((id) => receipts[id]) : [];
  const wageId = role.highPay && role.wageFactId && receipts[role.wageFactId] ? role.wageFactId : null;
  const rule = highPayRuleView(role);
  const extra =
    momIds.length > 0 || wageId || rule || role.openings ? (
      <>
        {momIds.length > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[13px] font-semibold">
            {t(role.momNeedsSol ? C.badges.momNeedsSol : C.badges.momNeeds)}
            {momIds.map((id) => (
              <Fn key={id} id={id} />
            ))}
          </span>
        )}
        {(wageId || rule) && (
          <span className="inline-flex items-center gap-0.5 text-[13px] font-semibold">
            {t(C.badges.highPay)}
            {wageId && <Fn id={wageId} />}
            {rule && <Fn id={rule.id} />}
          </span>
        )}
        {role.openings && (
          <span className="basis-full text-[13px] text-(--land-body)">
            {t(role.openings.total === 1 ? C.hot.openingsOne : C.hot.openings, { n: role.openings.total, date: day(role.openings.checkedOn) })}
          </span>
        )}
      </>
    ) : undefined;

  const m = result?.m ?? role.keySkills.length;
  const href = example ? exampleHref(roleHref(role.id), example) : roleHref(role.id);

  return (
    <ExpandCard
      tone="card"
      // The picture (scene, n of m, meter) takes its own height everywhere, not ExpandCard's 220px box (touch,
      // reduced motion: in the flow, no gap above it) or its 56% (hover: from the card's foot, too short for the
      // scene); the card is tall enough that the scene starts under the title (shorter with no n to show).
      className={cn("[&>div[aria-hidden]]:h-auto", result ? "min-h-[480px]" : "min-h-[430px]")}
      label={
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <RoleBadges momNeeds={role.momNeeds} sol={role.momNeedsSol} highPay={role.highPay} />
          {result ? (
            <span>
              <span className={BAND_TEXT[result.band]}>{t(C.match[result.band])}</span>
              <span className="sr-only">, {t(C.match.nOfM, { n: result.n, m: result.m })}</span>
              {/* As on the role page: the band rule (the field-only rule for a degree without modules), above the stretched link. */}
              <Fn id={result.fieldOnly ? RULE_IDS.fieldOnly : RULE_IDS.band} className="relative z-10" />
            </span>
          ) : (
            <span>
              <MatchBandText result={null} />
            </span>
          )}
        </span>
      }
      title={
        <span lang="en" title={role.title !== role.short ? role.title : undefined}>
          {role.short}
        </span>
      }
      visual={
        <div className="flex flex-col justify-end gap-3 px-7 pb-8 [@media(hover:hover)]:motion-safe:pb-24">
          <RoleScene roleId={role.id} className="mb-3" />
          {result && (
            <p className="m-0 text-[15px] leading-tight text-(--land-body)">
              {t.rich(C.match.nOfM, {}, { n: <span className={cn("font-heading text-[56px] leading-none font-bold tabular-nums", BAND_TEXT[result.band])}>{result.n}</span>, m: result.m })}
            </p>
          )}
          <MatchMeter n={result?.n ?? 0} m={m} band={result?.band ?? null} className="max-w-none gap-1.5 [&>span]:h-3.5" />
        </div>
      }
      description={description}
      cta={{ href, label: t(C.hot.open), onClick: example ? () => openExampleNow(example) : undefined }}
      extra={extra}
    />
  );
}
