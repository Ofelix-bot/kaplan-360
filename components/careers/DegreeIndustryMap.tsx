"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { BriefcaseBusinessIcon, FlameIcon, GraduationCapIcon } from "lucide-react";
import { cn } from "cn";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { Fn } from "@/components/shared/receipt";
import { usePaused } from "@/components/shared/PauseProvider";
import { DRAFT } from "@/content/draft";
import { exampleHref, openExampleNow } from "@/lib/example-link";
import { GRID_RULES } from "./IndustryGrid";
import { breakable } from "@/lib/careers/industries";
import { industryHref, roleHref } from "@/lib/careers/links";
import { RULE_IDS } from "@/lib/careers/match";
import type { DegreeIndustry, Industry, KaplanDegree, MatchBand } from "@/lib/careers/types";
import { BAND_TEXT } from "./MatchMeter";

// The entry page's link diagram (plan §3.2, Q9): the student's degree on the left, the 1–3 industries it
// leads to on the right, one drawn line to each. Every line ends in a label with its shared-skill count and
// its basis ("Kaplan 360++'s rule"), footnoted to the rule (rule:link:<programmeId>:<industryId>). Each
// industry is a card whose title is a stretched link (the footnotes sit above it, never inside it).
// The lines draw one after another (stroke-dashoffset via Motion's pathLength) when the diagram comes into
// view; with reduced motion or the site's pause they are drawn from the start. The SVG is sized to its
// column in CSS pixels (ResizeObserver), so the strokes never scale. Below 640px the diagram stacks:
// the degree on top and a drawn trunk down the left of the industries. Decorative parts are aria-hidden;
// the cards carry the words. With no degree picked, a dashed outline of the diagram holds the place.
// Each card's "Best match" is over ALL the industry's roles, not only its hot ones (Q2), footnoted to the
// band rule (the field-only rule for a degree without a module list); the role it comes from follows with
// its n of m, footnoted to the count rule and linked to its page (a role need not be hot). Only the
// footnotes and links sit above the card's stretched title link, so the rest of the card stays its target.
// From 640px the grid places each row's line label and card next to each other in the DOM, so focus and
// reading order follow the rows (the lines are one overlay over the middle column).

const C = DRAFT.careers;

/** The rule receipt id of one degree → industry line (build-spec §2). */
export const linkRuleId = (l: Pick<DegreeIndustry, "programmeId" | "industryId">) => `rule:link:${l.programmeId}:${l.industryId}`;

/** The rule receipt id behind "{n} hot roles". */
export const HOT_COUNT_RULE = "rule:count:hot";

/** One industry card's figures: its hot roles, and the student's best match over all its roles. */
export type IndustryMatch = {
  count: number;
  best: { band: MatchBand; n: number; m: number; fieldOnly: boolean; roleId: string; short: string } | null;
};

const BEST_WORDS: Record<MatchBand, string> = { high: C.map.bestHigh, medium: C.map.bestMedium, low: C.map.bestLow };

/**
 * The best match a card names a role for: one with at least one key skill covered (by core modules,
 * certificates or ticked skills). A degree without a module list names none, nor does a best match of 0.
 */
export const namedBest = (best: IndustryMatch["best"]) => (best && !best.fieldOnly && best.n > 0 ? best : null);

/** The receipt behind a card's "Best match": the band rule, or the field-only rule for a degree without modules. */
export const bestRuleId = (best: NonNullable<IndustryMatch["best"]>) => (best.fieldOnly ? RULE_IDS.fieldOnly : RULE_IDS.band);

/** Grid rows of the 640px+ layout, by row count (static class names, so Tailwind generates them). */
const ROWS = ["grid-rows-1", "grid-rows-2", "grid-rows-3"];
const ROW_START = ["row-start-1", "row-start-2", "row-start-3"];
const ROW_SPAN = ["row-span-1", "row-span-2", "row-span-3"];

/** The line's label: shared skills, with the basis's footnote. */
function LinePill({ link, className }: { link: DegreeIndustry; className?: string }) {
  const t = useT();
  return (
    <span className={cn("relative z-10 inline-flex max-w-full flex-col rounded-xl border border-(--land-line) bg-(--land-card) px-3 py-1.5 text-[13px] leading-snug", className)}>
      <span className="font-semibold text-(--text)">
        {link.sharedSkills.length === 1 ? t(C.map.sharedOne) : t(C.map.shared, { k: link.sharedSkills.length })}
        <Fn id={linkRuleId(link)} />
      </span>
    </span>
  );
}

function IndustryCard({ industry, hot, example }: { industry: Industry; hot: IndustryMatch | undefined; example: string | null }) {
  const t = useT();
  const path = industryHref(industry.id);
  const best = hot?.best ?? null;
  const named = namedBest(best);
  const rolePath = named ? roleHref(named.roleId) : null;
  return (
    <article className="group/ind relative flex min-w-0 flex-col gap-2 rounded-2xl border border-(--land-line) bg-(--land-card) p-4 transition-[translate,border-color] duration-(--motion-ui-dur) ease-(--motion-ui) hover:-translate-y-0.5 hover:border-(--brand-ink) motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-5">
      <h3 className="m-0 min-w-0 font-heading text-[19px] leading-tight font-bold text-balance wrap-break-word text-(--text) sm:text-[21px]">
        <Link
          href={example ? exampleHref(path, example) : path}
          onClick={example ? () => openExampleNow(example) : undefined}
          lang="en"
          className="text-inherit no-underline outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-(--focus-ring)"
        >
          {breakable(industry.short)}
        </Link>
      </h3>
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] leading-snug text-(--land-body)">
        {hot && hot.count > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <FlameIcon aria-hidden className="size-4 shrink-0 text-(--accent-ink)" />
            {hot.count === 1 ? t(C.entry.hotCountOne) : t(C.entry.hotCount, { n: hot.count })}
            <Fn id={HOT_COUNT_RULE} className="relative z-10" />
          </span>
        ) : (
          // No hot role: the industry's entry and early-career roles instead, as the 16 cards below show them
          // (IndustryGrid), with a quiet note that none is hot, still footnoted to the hot rule.
          <>
            <span className="inline-flex items-center gap-1.5">
              <BriefcaseBusinessIcon aria-hidden className="size-4 shrink-0" />
              {industry.entryRoleCount === 1 ? t(C.entry.roleCountOne) : t(C.entry.roleCount, { n: industry.entryRoleCount })}
              <Fn id={GRID_RULES.entry} className="relative z-10" />
            </span>
            <span className="inline-flex items-center text-[13px] text-(--muted)">
              {t(C.entry.noHot)}
              <Fn id={HOT_COUNT_RULE} className="relative z-10" />
            </span>
          </>
        )}
        {best ? (
          <span className={cn("inline-flex items-center gap-0.5 rounded-full border border-(--land-line) px-2 py-0.5 text-[13px] font-semibold", BAND_TEXT[best.band])}>
            {t(BEST_WORDS[best.band])}
            <Fn id={bestRuleId(best)} className="relative z-10" />
          </span>
        ) : null}
      </p>
      {named && rolePath ? (
        <p className="m-0 text-[13px] leading-snug text-(--land-body)">
          <Link
            href={example ? exampleHref(rolePath, example) : rolePath}
            onClick={example ? () => openExampleNow(example) : undefined}
            lang="en"
            className="relative z-10 rounded-sm font-semibold text-(--text) underline decoration-(--land-line) underline-offset-4 hover:decoration-(--brand-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
          >
            {named.short}
          </Link>
          {/* The dot stays with the role, so a wrap starts the next line with the count, never with "·". */}
          {" · "}
          <span className="whitespace-nowrap tabular-nums">
            {t(C.match.nOfM, { n: named.n, m: named.m })}
            <Fn id={RULE_IDS.count} className="relative z-10" />
          </span>
        </p>
      ) : null}
    </article>
  );
}

/** The drawn lines, sized to the middle column. `rows` lines from the left middle to each row's middle. */
function Lines({ rows, drawKey }: { rows: number; drawKey: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const paused = usePaused();

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={host} aria-hidden className="pointer-events-none absolute inset-0">
      {box && box.w > 0 && box.h > 0 && (
        <svg width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} className="block overflow-visible text-(--brand-ink)" focusable="false">
          {Array.from({ length: rows }, (_, i) => {
            const y0 = box.h / 2;
            const y = ((i + 0.5) * box.h) / rows;
            const mid = box.w / 2;
            const d = `M0 ${y0} C ${mid} ${y0}, ${mid} ${y}, ${box.w} ${y}`;
            // Paused or reduced motion: the final state, drawn from the start.
            if (paused) return <path key={`${drawKey}-${i}`} d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />;
            return (
              <motion.path
                // A new degree redraws the lines.
                key={`${drawKey}-${i}`}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.55, delay: 0.15 + i * 0.35, ease: [0.85, 0, 0, 1] }}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** The degree's node. */
function DegreeNode({ degree }: { degree: KaplanDegree | null }) {
  const t = useT();
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-2xl p-4 sm:p-5",
        degree ? "on-dark bg-(--tile-brand) text-white" : "border-2 border-dashed border-(--land-line) bg-transparent text-(--land-body)",
      )}
    >
      <GraduationCapIcon aria-hidden className={cn("size-5 shrink-0", degree ? "text-(--accent)" : "text-(--land-body)")} />
      {degree ? (
        <>
          <p lang="en" className="m-0 min-w-0 font-heading text-[18px] leading-tight font-bold text-balance wrap-break-word sm:text-[20px]">
            {degree.name}
          </p>
          <p lang="en" className="m-0 text-[14px] leading-snug text-white/85">
            {degree.university}
          </p>
        </>
      ) : (
        <p className="m-0 text-[15px] leading-snug font-semibold">{t(C.entry.empty)}</p>
      )}
    </div>
  );
}

export function DegreeIndustryMap({
  degree,
  links,
  industries,
  hot,
  example = null,
  className,
}: {
  degree: KaplanDegree | null;
  /** This degree's links (1–3); other degrees' links are ignored. */
  links: DegreeIndustry[];
  industries: Industry[];
  /** Per industry id: its hot roles and the student's best match over all its roles (Kaplan 360++'s count and match). */
  hot: Record<string, IndustryMatch>;
  /** The open example's id: the cards then carry ?example= and open it on click. */
  example?: string | null;
  className?: string;
}) {
  const t = useT();
  const byId = new Map(industries.map((i) => [i.id, i]));
  const rows = degree
    ? links
        .filter((l) => l.programmeId === degree.id && byId.has(l.industryId))
        .slice(0, 3)
        .map((l) => ({ link: l, industry: byId.get(l.industryId)! }))
    : [];

  if (!degree || rows.length === 0) {
    // The place-holder: a dashed node and three dashed strokes, decorative.
    return (
      <div className={cn("grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(120px,0.6fr)_minmax(0,1.3fr)]", className)}>
        <DegreeNode degree={degree} />
        <svg aria-hidden focusable="false" viewBox="0 0 160 120" preserveAspectRatio="none" className="hidden h-[120px] w-full text-(--land-line) sm:block">
          {[20, 60, 100].map((y) => (
            <path key={y} d={`M0 60 C 80 60, 80 ${y}, 160 ${y}`} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="6 6" />
          ))}
        </svg>
        <div aria-hidden className="hidden flex-col gap-3 sm:flex">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-2xl border-2 border-dashed border-(--land-line)" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div role="group" aria-label={rows.length === 1 ? t(C.map.labelOne, { degree: degree.name }) : t(C.map.label, { degree: degree.name, n: rows.length })} className={className}>
      {/* 640px and up: node | lines | cards, one equal grid row per industry. The node and the lines span
          every row; each row's label and card follow each other in the DOM. */}
      <div className={cn("hidden items-stretch gap-0 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.7fr)_minmax(0,1.3fr)]", ROWS[rows.length - 1])}>
        <div className={cn("col-start-1 row-start-1 flex items-center", ROW_SPAN[rows.length - 1])}>
          <DegreeNode degree={degree} />
        </div>
        <div className={cn("relative col-start-2 row-start-1", ROW_SPAN[rows.length - 1])}>
          <Lines rows={rows.length} drawKey={degree.id} />
        </div>
        {rows.map(({ link, industry }, i) => (
          <Fragment key={link.industryId}>
            <div className={cn("relative col-start-2 flex items-center justify-end py-1.5 pl-3", ROW_START[i])}>
              <LinePill link={link} />
            </div>
            <div className={cn("col-start-3 flex flex-col justify-center py-1.5 pl-2", ROW_START[i])}>
              <IndustryCard industry={industry} hot={hot[industry.id]} example={example} />
            </div>
          </Fragment>
        ))}
      </div>

      {/* Phones: the degree on top, a trunk down the left, each industry with its label. */}
      <div className="flex flex-col gap-4 sm:hidden">
        <DegreeNode degree={degree} />
        <ol className="m-0 flex list-none flex-col gap-4 border-l-2 border-(--brand-ink) p-0 pl-4">
          {rows.map(({ link, industry }) => (
            <li key={link.industryId} className="flex flex-col gap-2">
              <LinePill link={link} className="self-start" />
              <IndustryCard industry={industry} hot={hot[industry.id]} example={example} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
