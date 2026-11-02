"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { ArrowUpRightIcon, ChevronDownIcon } from "lucide-react";
import { motion } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { basisText } from "@/components/results/compare";
import { topUpMarker } from "@/components/results/topup";
import { GPA_MIN, rangeBasis, SHORT, usualText, yoursText } from "@/components/results/words";
import { Badge } from "@/components/ui/badge";
import { Fn, ReceiptSection, SourceList } from "@/components/shared/receipt";
import { FOCUS, NUDGE } from "@/components/shared/receipt/text";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LEVEL_NAME, LEVELS, levelOf, RANK_LEVEL, type AdmitRange, type Level } from "@/lib/admit-range";
import { RANK_NAME, rankOfLevel, type Converted, type GoodReading } from "@/lib/grades";
import { msg, type T } from "@/lib/i18n/translate";
import { transitions } from "@/lib/motion";
import { hostOf, type ReceiptView } from "@/lib/receipts/model";
import type { CasesTier, ResultsCases } from "@/lib/results-types";
import { TopUpNote, TopUpTrack } from "./top-up";

// A programme's admission range on the UK class scale (lib/admit-range.ts): the steps it doesn't
// accept, the ones it accepts, and where most of its admitted students are, with the student's own
// result marked on it and what the range was worked out from. It places the result; it never says
// whether the student will get in. When reported admitted students exist (the children), they lead:
// their GPA range heads the section and the UK scale follows. For a private school's degree (every Kaplan
// degree, `tier` C), a marker beside the range shows the programme's tier C admits, or its admitted level when
// too few reported a GPA (./top-up.tsx); it never moves the range.

/** The minimum in words, with how a "good degree" was read. */
function minimumText(t: T, r: AdmitRange, minBasis: string | null, uni: { name: string; good: GoodReading | null }): string {
  if (r.floor === null) return t("The page states no academic minimum.");
  const grade = t(LEVEL_NAME[r.floor]);
  if (minBasis === "good degree") {
    const g = uni.good;
    if (g?.how === "own-words" && g.quote) return t("Minimum: “a good degree”, read as a {grade}, as {university} words it on another programme: “{quote}”", { grade, university: uni.name, quote: g.quote });
    if (g?.how === "most-programmes") return t("Minimum: “a good degree”, read as a {grade}: {n} of {university}’s {m} programmes that name a class ask for at least that", { grade, university: uni.name, n: g.n ?? 0, m: g.of ?? 0 });
    return t("Minimum: “a good degree”, read as at least a {grade}", { grade });
  }
  if (minBasis === "strong degree") return t("Minimum: “a strong degree”, read as at least a {grade}", { grade });
  if (!minBasis) return r.floor === 40 ? t("Minimum: a bachelor’s degree; no class or grade stated") : t("Minimum: {grade}", { grade });
  // A lower route in ("a 2:2 with relevant work experience may be considered") is the minimum; the main requirement is named too.
  if (r.main !== null && r.main > r.floor) return t("Minimum: {main}, or {grade} by another route the wording describes", { main: t(LEVEL_NAME[r.main]), grade });
  const own = minBasis === RANK_NAME[rankOfLevel(r.floor)] || minBasis === "High 2:1";
  return own ? t("Minimum: {grade}", { grade }) : t("Minimum: {basis} (≈ {grade})", { basis: basisText(t, minBasis), grade });
}

/**
 * The programme's own words as a receipt (the shared receipt UI, decisions Q18 and C6). The build keeps a
 * quote only when it is found on the page, so it is matched word for word; the page's read date is not part
 * of this view's data, so the card shows none.
 */
function statedView(id: string, quote: string, url: string, university: string): ReceiptView {
  return {
    id,
    kind: "official",
    quote,
    mark: [],
    quoteKind: "sentence",
    publisher: university,
    title: msg("The programme’s official page"),
    published: null,
    read: "",
    url,
    host: hostOf(url),
    where: null,
    shot: null,
    match: "word-for-word",
  };
}

/** A page the range reads figures from without a quote of its own: a plain link in the receipt UI's style. */
function Source({ url }: { url: string }) {
  const t = useT();
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-0.5 rounded-sm text-primary underline-offset-4 hover:underline", FOCUS, NUDGE)}>
      {t("Source")}
      <ArrowUpRightIcon aria-hidden className="size-3" />
    </a>
  );
}

const STEP_CLASS: Record<"is-out" | "is-open" | "is-min" | "is-usual", string> = {
  "is-out": "bg-muted text-muted-foreground/70 line-through decoration-muted-foreground/40",
  "is-open": "bg-secondary text-secondary-foreground",
  "is-min": "bg-secondary text-secondary-foreground",
  "is-usual": "bg-primary text-primary-foreground",
};

export function AdmitRangeView({
  range: r,
  minBasis,
  university,
  you,
  tier,
  cases,
  children,
}: {
  range: AdmitRange;
  minBasis: string | null;
  university: { name: string; good: GoodReading | null };
  you: Converted | null;
  /** The visitor's private-school degree's tier: C (QS 301+ or unranked), whatever the awarding university (lib/tiers.ts privateSchoolTier). */
  tier?: CasesTier | null;
  cases?: ResultsCases | null;
  children?: ReactNode;
}) {
  const t = useT();
  const marker = tier ? topUpMarker(r, cases) : null;
  // Where the marker sits: the step of the student's mark, or every step inside their class (a 2:1 covers 2:1 and high 2:1).
  const youLevels = you ? (you.mark !== null ? [levelOf(you.mark)] : LEVELS.filter((l) => rankOfLevel(l) === you.rank && l >= RANK_LEVEL[you.rank])) : [];
  const state = (l: Level) => (r.floor !== null && l < r.floor ? "is-out" : l >= r.usual ? "is-usual" : r.floor === null ? "is-open" : "is-min");
  const stats = r.from.find((f) => f.k === "stats");
  const stated = r.from.find((f) => f.k === "stated");
  const reported = r.from.find((f) => f.k === "cases");
  const competitive = r.from.find((f) => f.k === "competitive");
  const qs = r.from.find((f) => f.k === "qs");
  const receipts = r.from.flatMap((f, i) => (f.k === "stated" ? [statedView(`admit:${i}:${f.url}`, f.quote, f.url, university.name)] : []));
  const short = [
    stated && t("the programme’s own words"),
    reported && reported.k === "cases" && t("the GPAs of {n} reported admits", { n: reported.n }),
    stats && stats.k === "stats" && t("{a} applications for {p} places", { a: stats.applications.toLocaleString("en-SG"), p: stats.places.toLocaleString("en-SG") }),
    competitive && t("says entry is competitive"),
    qs && qs.k === "qs" && t("QS rank {n}", { n: qs.rank }),
  ].filter(Boolean);
  const basis = (
    <Badge variant={r.basis === "minimum" || r.basis === "estimate" ? "outline" : "secondary"} className="h-auto max-w-full text-left font-normal whitespace-normal">
      {rangeBasis(t, r)}
    </Badge>
  );

  return (
    <section aria-labelledby="admit-heading" className="flex flex-col gap-3">
      {cases ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 id="admit-heading" className="font-heading text-sm font-semibold">
              {t(cases.gpa && cases.gpa.n >= GPA_MIN ? "Admitted range" : "Admitted students")}
            </h3>
            {cases.gpa && cases.gpa.n >= GPA_MIN && <b className="text-sm tabular-nums">{t("GPA {low}–{high}", { low: cases.gpa.p10.toFixed(2), high: cases.gpa.p90.toFixed(2) })}</b>}
            <span className="text-xs text-muted-foreground">
              {cases.years
                ? t("Basis: {n} reported admits, {years}", { n: cases.n, years: cases.years[0] === cases.years[1] ? cases.years[0] : `${cases.years[0]}–${cases.years[1]}` })
                : t("Basis: {n} reported admits", { n: cases.n })}
            </span>
          </div>
          {children}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
            <span className="text-xs font-medium">{t("On the UK degree scale")}</span>
            <b className="text-sm">{usualText(t, r.usual)}</b>
            {basis}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 id="admit-heading" className="font-heading text-sm font-semibold">
            {t("Admitted range")}
          </h3>
          <b className="text-sm">{usualText(t, r.usual)}</b>
          {basis}
        </div>
      )}

      <ol className="grid grid-cols-5 gap-1" aria-hidden>
        {LEVELS.map((l, i) => {
          const mine = youLevels.includes(l);
          return (
            <li key={l} className="relative">
              <motion.span
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...transitions.enter, delay: i * 0.03 }}
                className={cn("flex h-7 items-center justify-center rounded-md px-1 text-center text-[11px] leading-tight font-medium", STEP_CLASS[state(l)], mine && "ring-2 ring-amber ring-offset-1 ring-offset-background")}
              >
                {t(SHORT[l])}
              </motion.span>
            </li>
          );
        })}
      </ol>
      {marker && <TopUpTrack marker={marker} />}
      {/* The student's own result labels the marker: data, never a sentence about where they stand. */}
      {you && !cases && (
        <p className="flex items-center gap-1.5 text-xs">
          <span className="inline-block size-2 rounded-full bg-amber" aria-hidden />
          {t("You: {result}", { result: yoursText(t, you) })}
        </p>
      )}
      {marker && <TopUpNote marker={marker} />}
      <p className="text-xs text-muted-foreground">{minimumText(t, r, minBasis, university)}</p>
      {r.basis !== "minimum" && (
        <Collapsible>
          <CollapsibleTrigger className="group/why flex w-full items-start gap-1 rounded-md text-left text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronDownIcon className="mt-0.5 size-3.5 shrink-0 transition-transform group-data-[panel-open]/why:rotate-180" />
            <span>{t("Worked out from: {list}", { list: short.join(" · ") })}</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ReceiptSection receipts={receipts} title={t("Admitted range")}>
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-xs leading-relaxed text-muted-foreground marker:text-muted-foreground/60">
                {r.from.map((f, i) =>
                  f.k === "stated" ? (
                    <li key={i}>
                      {t("The programme says: “{quote}”", { quote: f.quote })}
                      <Fn id={`admit:${i}:${f.url}`} />
                    </li>
                  ) : f.k === "stats" ? (
                    <li key={i}>
                      {t(f.year ? "{a} applications for {p} places ({year}): {r} per place." : "{a} applications for {p} places: {r} per place.", {
                        a: f.applications.toLocaleString("en-SG"),
                        p: f.places.toLocaleString("en-SG"),
                        year: f.year ?? "",
                        r: (f.applications / f.places).toFixed(1),
                      })}{" "}
                      <Source url={f.url} />
                    </li>
                  ) : f.k === "competitive" ? (
                    <li key={i}>{t("The page says: “{quote}”", { quote: f.quote })}</li>
                  ) : f.k === "qs" ? (
                    <li key={i}>{t("QS World University Ranking 2027: {n}", { n: f.rank })}</li>
                  ) : null,
                )}
              </ul>
              <SourceList className="mt-3 pt-3" />
            </ReceiptSection>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
