"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import { Fn, ReceiptSection, SourceList } from "@/components/shared/receipt";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DRAFT } from "@/content/draft";
import { fieldFit, MATCH_RULES, matchRole, RULE_IDS } from "@/lib/careers/match";
import type { MatchBand, MatchResult, RoleCardData, StudentContext } from "@/lib/careers/types";
import { useMatchStudent } from "@/lib/careers/use-student";
import { fromRule, uniqueViews, type ReceiptView } from "@/lib/receipts/model";
import { RoleScene } from "./art/RoleScene";
import { RoleBadges } from "./Badges";
import { BAND_TEXT, MatchMeter } from "./MatchMeter";
import { gapReceipts, RoleGapPanel } from "./RoleGapPanel";
import { LEVELS_RECEIPT, SkillLevels } from "./SkillLevels";
import { highPayRuleView, roleReceiptViews } from "./RoleCard";

// The industry's hot roles (Q10, Q19, Q11; laid out after the 2026-11-02 board): every role MOM needs (per-industry
// JV 2025 rank or the SOL) or that pays in the industry's top quarter (Kaplan 360++'s rule), each matched against
// the student on this browser (their own answers, or the open worked example). Order: match first (band, share of
// key skills), then both badges, one, the OWT median. Compact cards: the badges, the role, "High match · 4/8
// skills" and its meter. Six show; the rest open under "Show all {n}". Picking a card (a toggle button) opens
// that role's gap under the list (./RoleGapPanel), and nothing shows until one is picked. An industry with no hot
// role shows its other graduate roles under their own heading. Then what the skill levels mean (./SkillLevels),
// and the section's numbered sources close it.

const C = DRAFT.careers;
const SHOWN = 6;
const BAND_RANK: Record<MatchBand, number> = { high: 3, medium: 2, low: 1 };
const CARD_LINE: Record<MatchBand, string> = { high: C.hot.cardHigh, medium: C.hot.cardMedium, low: C.hot.cardLow };

/** The student's match for each role (null before the answers load, or with no degree picked). */
export function useRoleMatches(roles: RoleCardData[], ctx: StudentContext, industryId: string): Map<string, MatchResult | null> {
  const { student, ready } = useMatchStudent(ctx);
  return useMemo(() => {
    const out = new Map<string, MatchResult | null>();
    if (!ready || !student.programmeId) {
      for (const r of roles) out.set(r.id, null);
      return out;
    }
    const fit = fieldFit(student.programmeId, industryId, ctx);
    for (const r of roles) out.set(r.id, matchRole(student, r, fit));
    return out;
  }, [roles, ctx, industryId, student, ready]);
}

const badges = (r: RoleCardData) => (r.momNeeds ? 1 : 0) + (r.highPay ? 1 : 0);

/** Match first (the standing rule): band → share of key skills → both badges → one → median pay (missing last) → the data's own order. */
export function sortRoles(roles: RoleCardData[], results: Map<string, MatchResult | null>): RoleCardData[] {
  const band = (r: RoleCardData) => {
    const b = results.get(r.id)?.band;
    return b ? BAND_RANK[b] : 0;
  };
  const share = (r: RoleCardData) => {
    const res = results.get(r.id);
    return res && res.m > 0 ? res.n / res.m : 0;
  };
  return [...roles].sort(
    (a, b) => band(b) - band(a) || share(b) - share(a) || badges(b) - badges(a) || (b.wageMedian ?? -1) - (a.wageMedian ?? -1) || a.sortOrder - b.sortOrder,
  );
}

const GRID = "m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5";

/** One compact card: a toggle button that picks the role whose gap shows under the list. */
function RolePick({ role, result, picked, controls, onPick }: { role: RoleCardData; result: MatchResult | null; picked: boolean; controls: string; onPick: () => void }) {
  const t = useT();
  const m = result?.m ?? role.keySkills.filter((s) => s.key).length;
  return (
    <button
      type="button"
      data-role-pick
      aria-pressed={picked}
      aria-controls={controls}
      onClick={onPick}
      className={cn(
        "flex h-full w-full min-w-0 cursor-pointer flex-col items-start gap-3 rounded-2xl border border-solid bg-(--land-card) p-5 text-left",
        "transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
        picked ? "border-(--text) shadow-[inset_0_0_0_1px_var(--text)]" : "border-(--land-line) hover:border-(--land-body)",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--focus-ring)",
      )}
    >
      {/* The badges and the role on the left, the role's animated scene (./art/RoleScene) in the top-right corner. */}
      <span className="flex w-full items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col items-start gap-3">
          <RoleBadges momNeeds={role.momNeeds} sol={role.momNeedsSol} highPay={role.highPay} />
          <span
            lang="en"
            title={role.title !== role.short ? role.title : undefined}
            className="font-heading text-[clamp(19px,1.7vw,22px)] [font-stretch:var(--display-stretch)] leading-[1.15] font-bold text-balance wrap-break-word text-(--text)"
          >
            {role.short}
          </span>
        </span>
        <RoleScene roleId={role.id} className="h-[72px] w-[112px] shrink-0 rounded-xl" />
      </span>
      <span className="mt-auto flex w-full items-center justify-between gap-3">
        {result ? (
          <span className={cn("text-[13px] font-semibold tabular-nums", BAND_TEXT[result.band])}>{t(CARD_LINE[result.band], { n: result.n, m: result.m })}</span>
        ) : (
          <span className="text-[13px] text-(--land-body)">{t(C.entry.empty)}</span>
        )}
        <MatchMeter n={result?.n ?? 0} m={m} band={result?.band ?? null} className="w-auto max-w-none shrink-0 gap-1 [&>span]:size-[7px] [&>span]:flex-none" barClassName="h-[7px] w-20 shrink-0" />
      </span>
    </button>
  );
}

export function HotRoles({ roles, receipts, ctx, industryId }: { roles: RoleCardData[]; receipts: Record<string, ReceiptView>; ctx: StudentContext; industryId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const results = useRoleMatches(roles, ctx, industryId);
  const { student } = useMatchStudent(ctx);

  const hot = roles.filter((r) => r.hot);
  const anyHot = hot.length > 0;
  const list = sortRoles(anyHot ? hot : roles, results);
  const first = list.slice(0, SHOWN);
  const rest = list.slice(SHOWN);
  const role = list.find((r) => r.id === picked) ?? null;
  const result = role ? (results.get(role.id) ?? null) : null;

  // The picked role's gap comes into view under the list (the nearest edge, so the cards stay where they can).
  useEffect(() => {
    if (!picked) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-paused");
    panel.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [picked]);

  // The rule line's receipt: the High pay rule of this industry, where one is published.
  const ruleView = anyHot ? (hot.map(highPayRuleView).find((v) => v !== null) ?? null) : null;
  // The rule behind each card's band (one student: the field-only rule when their degree has no module list).
  const anyResult = [...results.values()].find((r) => r !== null) ?? null;
  const bandView = anyResult ? (anyResult.fieldOnly ? fromRule(RULE_IDS.fieldOnly, t(MATCH_RULES.fieldOnly)) : fromRule(RULE_IDS.band, t(MATCH_RULES.band))) : null;
  const url = ctx.degrees.find((d) => d.id === student.programmeId)?.url ?? null;
  const gapViews = result ? gapReceipts(student.programmeId, url, !result.fieldOnly, t) : [];
  const views = uniqueViews([...(ruleView ? [ruleView] : []), ...gapViews, ...(bandView ? [bandView] : []), ...list.flatMap((r) => roleReceiptViews(r, receipts)), LEVELS_RECEIPT]);
  const titleId = `cr-hot-${industryId}`;
  const panelId = `cr-gap-${industryId}`;
  const sectionTitle = t(anyHot ? C.hot.title : C.hot.otherRoles);

  if (list.length === 0) return null;

  const card = (r: RoleCardData) => (
    <li key={r.id} className="flex min-w-0">
      <RolePick role={r} result={results.get(r.id) ?? null} picked={r.id === picked} controls={panelId} onPick={() => setPicked((p) => (p === r.id ? null : r.id))} />
    </li>
  );

  return (
    <section aria-labelledby={titleId} className="py-16 sm:py-24">
      <div className="home-wrap">
        <ReceiptSection receipts={views} title={sectionTitle}>
          <h2 id={titleId} className="m-0 min-w-0 font-heading text-[clamp(26px,3vw,40px)] [font-stretch:var(--display-stretch)] leading-[1.1] font-bold tracking-[-0.01em] text-balance wrap-break-word text-(--text)">
            {sectionTitle}
            {anyHot && ruleView && <Fn id={ruleView.id} />}
          </h2>
          <p className="m-0 mt-3 max-w-[680px] text-[15px] leading-[1.55] text-pretty text-(--land-body)">
            {!anyHot && `${t(C.hot.none)} · `}
            {list.length === 1 ? t(C.hot.subOne) : t(C.hot.sub, { n: list.length })}
          </p>

          <ul className={cn(GRID, "mt-8 sm:mt-10")}>{first.map(card)}</ul>

          {rest.length > 0 && (
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleContent>
                <ul className={cn(GRID, "mt-4 lg:mt-5")}>{rest.map(card)}</ul>
              </CollapsibleContent>
              <CollapsibleTrigger
                className={cn(
                  "mt-6 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-solid border-(--land-line) bg-(--land-card) px-4 text-[15px] font-semibold text-(--text)",
                  "transition-[background-color] duration-200 hover:bg-(--land-ground) motion-reduce:transition-none",
                  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--focus-ring)",
                )}
              >
                {open ? t(C.hot.showFewer) : t(C.hot.showAllRoles, { n: list.length })}
                <ChevronDownIcon
                  aria-hidden
                  className={cn("size-4 transition-transform duration-(--motion-ui-dur) ease-(--motion-ui) motion-reduce:transition-none", open && "rotate-180")}
                />
              </CollapsibleTrigger>
            </Collapsible>
          )}

          <div id={panelId} ref={panel} className="scroll-mb-6">
            {role && <RoleGapPanel key={role.id} role={role} result={result} className="cr-gap-in mt-10" />}
          </div>

          {/* What "Level 3/6" means: SWDA's levels as a pixel pyramid, before the sources. */}
          <SkillLevels className="mt-14" />

          <SourceList className="mt-14" />
        </ReceiptSection>
      </div>
    </section>
  );
}
