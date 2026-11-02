"use client";

import { useMemo } from "react";
import { useT } from "@/components/i18n/I18nProvider";
import { DegreePicker } from "@/components/careers/DegreePicker";
import { ExampleGate } from "@/components/careers/ExampleGate";
import { ProfileGap } from "@/components/profile/ProfileGap";
import { FlowSteps } from "@/components/shared/FlowSteps";
import { ReceiptSection, SourceList } from "@/components/shared/receipt";
import { DRAFT } from "@/content/draft";
import { coverableSet, uncoveredShare } from "@/lib/careers/cells";
import { bestMatch, MATCH_RULES, rolesFromIndex, RULE_IDS } from "@/lib/careers/match";
import type { Industry, RoleKeyIndex, StudentContext } from "@/lib/careers/types";
import { useMatchStudent } from "@/lib/careers/use-student";
import { msg } from "@/lib/i18n/translate";
import { fromRule } from "@/lib/receipts/model";
import { bestRuleId, DegreeIndustryMap, HOT_COUNT_RULE, linkRuleId, namedBest, type IndustryMatch } from "./DegreeIndustryMap";
import { GapShare } from "./GapShare";
import { GRID_RULES, IndustryGrid } from "./IndustryGrid";

// /careers, the Career Compass entry (plan §3.1, §3.4; build-spec §6 K5): the guided flow's step bar
// (FlowSteps, at Compass), the worked-example banner (Arjun by default, only
// for visitors with no degree of their own: C1, run by ExampleGate), the one H1, the degree
// picker (the visitor's own input: it closes the example and writes their answers), the "You" strip, then
// two sections, each led by its visual and closed by its numbered sources:
//   1. the student's degree → its 1–3 industries (DegreeIndustryMap), each line footnoted to its basis;
//   2. all 16 industries (IndustryGrid), the student's first.
// Everything the student sees is read on the client from their answers (lib/careers/use-student), so the
// static HTML shows the empty state (no degree) and hydrates without a mismatch.

const C = DRAFT.careers;

// Rule sentences behind our own counts: the footnotes' receipt text.
const RULE_TEXT = {
  hot: msg(
    "Kaplan 360++'s count: a hot role is one MOM needs (a top vacancy of the industry in Job Vacancies 2025, or on the COMPASS Shortage Occupation List) or one whose Occupational Wages 2025 median is in the industry's top 25%.",
  ),
  entry: msg(
    "Kaplan 360++'s rule: a Skills Framework role suits a fresh graduate when the mean level of its technical skills is 2.0 to 3.6 and its title has no senior or operative marker.",
  ),
};

const H2 = "m-0 min-w-0 font-heading text-[clamp(26px,3vw,40px)] leading-[1.1] font-bold tracking-[-0.02em] text-balance wrap-break-word text-(--text)";

export function CareersEntry({ ctx, industries, roleKeys }: { ctx: StudentContext; industries: Industry[]; roleKeys: RoleKeyIndex }) {
  const t = useT();
  const { student, ready, example } = useMatchStudent(ctx);

  const degree = ready && student.programmeId ? (ctx.degrees.find((d) => d.id === student.programmeId) ?? null) : null;
  const links = useMemo(() => (degree ? ctx.links.filter((l) => l.programmeId === degree.id).slice(0, 3) : []), [ctx.links, degree]);
  const mine = links.map((l) => l.industryId);

  const roles = useMemo(() => rolesFromIndex(roleKeys), [roleKeys]);
  const hotCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of roles) if (r.hot) out[r.industryId] = (out[r.industryId] ?? 0) + 1;
    return out;
  }, [roles]);

  // Per linked industry: its hot roles, and the role of ALL its roles the student matches best (Q2), so a
  // degree whose hot roles are all Low still shows where it fits (Kaplan 360++'s match).
  const hot = useMemo(() => {
    const out: Record<string, IndustryMatch> = {};
    for (const l of links) {
      const best = bestMatch(student, roles.filter((r) => r.industryId === l.industryId), ctx);
      out[l.industryId] = {
        count: hotCounts[l.industryId] ?? 0,
        best: best ? { band: best.result.band, n: best.result.n, m: best.result.m, fieldOnly: best.result.fieldOnly, roleId: best.role.id, short: best.role.short } : null,
      };
    }
    return out;
  }, [links, roles, hotCounts, student, ctx]);

  // Numbered in reading order, row by row: each line's basis, the count on its card, the rule behind its best
  // match (the band rule, or the field-only rule for a degree without modules), then the count behind the
  // role it names.
  const hotView = useMemo(() => fromRule(HOT_COUNT_RULE, t(RULE_TEXT.hot)), [t]);
  const mapViews = useMemo(
    () =>
      links.flatMap((l) => {
        const best = hot[l.industryId]?.best ?? null;
        return [
          fromRule(linkRuleId(l), l.basis),
          // A card with no hot role shows its graduate roles first, then "No hot roles yet" (both footnoted).
          ...((hot[l.industryId]?.count ?? 0) === 0 ? [fromRule(GRID_RULES.entry, t(RULE_TEXT.entry))] : []),
          hotView,
          ...(best ? [fromRule(bestRuleId(best), t(best.fieldOnly ? MATCH_RULES.fieldOnly : MATCH_RULES.band))] : []),
          ...(namedBest(best) ? [fromRule(RULE_IDS.count, t(MATCH_RULES.count))] : []),
        ];
      }),
    [links, hotView, hot, t],
  );
  // Under the map, for every visitor: the share of all roles' key skills no Kaplan degree's core modules cover.
  const gap = useMemo(() => uncoveredShare(roleKeys, coverableSet(ctx.coverableSkills)), [roleKeys, ctx.coverableSkills]);
  const mapAndGapViews = useMemo(
    () => [...mapViews, fromRule(RULE_IDS.uncovered, t(MATCH_RULES.uncovered, { u: gap.uncovered, m: gap.places, r: gap.roles }))],
    [mapViews, gap, t],
  );
  // Only the rules a card shows: a card with no hot role shows its graduate roles instead.
  const gridViews = useMemo(() => {
    const anyHot = industries.some((i) => (hotCounts[i.id] ?? 0) > 0);
    const anyCold = industries.some((i) => (hotCounts[i.id] ?? 0) === 0);
    return [...(anyHot ? [hotView] : []), ...(anyCold ? [fromRule(GRID_RULES.entry, t(RULE_TEXT.entry))] : [])];
  }, [industries, hotCounts, hotView, t]);

  return (
    <>
      <FlowSteps current="compass" />
      <div className="home-wrap flex flex-col gap-3 pt-6">
        <ExampleGate />
        <ProfileGap part={1} />
      </div>

      <header className="home-wrap flex flex-col gap-4 pt-10 pb-8 sm:pt-14">
        <h1 className="m-0 max-w-[16ch] min-w-0 font-heading text-[clamp(36px,5.4vw,72px)] leading-[1.02] font-extrabold tracking-[-0.02em] text-balance wrap-break-word text-(--text)">
          {t(C.entry.h1)}
        </h1>
        <DegreePicker degrees={ctx.degrees} className="mt-2 self-start" />
      </header>

      <section aria-labelledby="cr-map-title" className="home-wrap flex flex-col gap-6 py-12 sm:py-16">
        <h2 id="cr-map-title" className={H2}>
          {t(C.entry.mapTitle)}
        </h2>
        <ReceiptSection receipts={mapAndGapViews}>
          <DegreeIndustryMap degree={degree} links={links} industries={industries} hot={hot} example={example} />
          <GapShare share={gap.share} className="mt-8" />
          <SourceList className="mt-6" />
        </ReceiptSection>
      </section>

      <section id="industries" aria-labelledby="cr-grid-title" className="home-wrap flex flex-col gap-6 border-t border-(--land-line) py-12 sm:py-16">
        <h2 id="cr-grid-title" className={H2}>
          {t(C.entry.gridTitle)}
        </h2>
        <ReceiptSection receipts={gridViews}>
          <p className="m-0 -mt-2 text-[15px] leading-snug font-semibold text-(--land-body)">{t(C.entry.pickIndustry)}</p>
          <IndustryGrid industries={industries} mine={mine} hotCounts={hotCounts} example={example} />
          <SourceList className="mt-6" />
        </ReceiptSection>
      </section>
    </>
  );
}
