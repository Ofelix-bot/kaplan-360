"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "cn";
import { SearchIcon } from "lucide-react";
import { useLocale, useT } from "@/components/i18n/I18nProvider";
import { useSiteNames } from "@/components/i18n/site-names";
import { FieldLabel, NumberField, Pick, Stepper } from "@/components/stand/fields";
import { CampusLoader } from "@/components/shared/campus-loader/CampusLoader";
import { MatchCurve, pct } from "@/components/shared/match-curve";
import { Slider } from "@/components/ui/slider";
import { bandOf, matchPosition, matchRate, type MatchBand, type MatchInput } from "@/lib/admit-model";
import { drawRates, THETA_SE_PREDICTED, type Draws } from "@/lib/algorithm/sample";
import { useCalc } from "@/lib/algorithm/store";
import { ukMarkToFour } from "@/lib/gpa4";
import { msg } from "@/lib/i18n/translate";
import type { ResultsData, ResultsProgramme } from "@/lib/results-types";
import { tierByQs, type Tier } from "@/lib/tiers";
import { useResultsData } from "@/lib/workspace/data";

// The Core Algorithm page's calculator: pick a programme and the Kaplan degree's awarding university, set the result,
// English, tests and work, and see the match rate (the same lib/admit-model.ts the finder uses), its 80% range
// (lib/algorithm/sample.ts) and the programme's curve with the student on it. Step 4's chart reads the same draws.

export type Partner = { name: string; qs: number | null; tier: Tier };
export type CalcProps = { partners: Partner[]; deltaSd: number; thetaSe: Record<string, number> };

const CLASS_OF = (mark: number) => (mark >= 70 ? msg("First") : mark >= 60 ? "2:1" : mark >= 50 ? "2:2" : msg("Third"));
export const BAND_TEXT: Record<MatchBand, string> = { gap: msg("Gap to close"), range: msg("In range"), strong: msg("Strong position") };
export const BAND_CLASS: Record<MatchBand, string> = {
  gap: "bg-(--land-no-bg) text-(--land-no)",
  range: "bg-(--land-check-bg) text-(--land-check)",
  strong: "bg-(--land-ok-bg) text-(--land-ok)",
};
export { Key, pct } from "@/components/shared/match-curve";

/** Lower case, accents dropped. */
const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

function useProgrammeName() {
  const locale = useLocale();
  return (p: ResultsProgramme, data: ResultsData) => {
    const u = data.universities[p.u];
    const zh = locale === "zh-hant" ? "hant" : "hans";
    const uni = locale !== "en" && u.zh ? u.zh[zh] : u.name;
    const name = locale !== "en" && p.zh ? p.zh[zh] : p.name;
    return { uni, name };
  };
}

function ProgrammeSearch({ data }: { data: ResultsData }) {
  const t = useT();
  const id = useId();
  const nameOf = useProgrammeName();
  const { programmeId, set } = useCalc();
  const [query, setQuery] = useState("");
  const current = useMemo(() => data.programmes.find((p) => p.id === programmeId) ?? null, [data, programmeId]);
  const hits = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const out: ResultsProgramme[] = [];
    for (const p of data.programmes) {
      if (!p.fit) continue;
      const u = data.universities[p.u];
      const hay = fold(`${p.name} ${u.name} ${p.zh?.hans ?? ""} ${p.zh?.hant ?? ""} ${u.zh?.hans ?? ""} ${u.zh?.hant ?? ""}`);
      if (words.every((w) => hay.includes(w))) out.push(p);
      if (out.length >= 8) break;
    }
    return out;
  }, [data, query]);
  const cur = current ? nameOf(current, data) : null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <FieldLabel htmlFor={id}>{t("Programme")}</FieldLabel>
      {cur && (
        <p className="m-0 min-w-0 text-sm font-semibold text-(--text)">
          {cur.name}
          <span className="block truncate text-xs font-normal text-(--land-body)">{cur.uni}</span>
        </p>
      )}
      <div className="relative">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search a programme or university")}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-(--land-card) pr-2 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {hits.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-0.5 rounded-lg border border-(--land-line) bg-(--land-card) p-1">
          {hits.map((p) => {
            const n = nameOf(p, data);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    set({ programmeId: p.id });
                    setQuery("");
                  }}
                  className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="font-medium">{n.name}</span>
                  <span className="text-xs text-(--land-body)">{n.uni}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The calculator's inputs as the match rate reads them, and the programme they apply to. */
export function useCalcResult(props: CalcProps) {
  const data = useResultsData((s) => s.data);
  const byId = useResultsData((s) => s.byId);
  const c = useCalc();
  return useMemo(() => {
    const p = byId.get(c.programmeId);
    if (!data || !p?.fit) return null;
    const partner = props.partners.find((x) => x.name === c.awarder);
    const you: MatchInput = {
      gpa4: ukMarkToFour(c.mark), mark: c.mark, awarderTier: partner ? partner.tier : tierByQs(null),
      workYears: c.workYears, internshipsSame: c.internships, internshipsOther: 0, ielts: c.ielts, gre: c.gre, gmat: null,
    };
    const fit = p.fit;
    const match = matchRate(fit, data.match, you);
    // What the internships add: the same student with none, in percentage points (small by design: among 8,023
    // admits the data show no measurable internship effect, so the page shows one decimal to make it visible).
    const internshipGap = c.internships > 0 && !match.belowMinimum ? match.rate - matchRate(fit, data.match, { ...you, internshipsSame: 0 }).rate : null;
    const draws: Draws = drawRates(fit, data.match, you, props.deltaSd, props.thetaSe[p.id] ?? THETA_SE_PREDICTED);
    return { p, fit, you, match, internshipGap, draws, x: matchPosition(fit, data.match, you), g: data.match, data };
  }, [data, byId, c.programmeId, c.awarder, c.mark, c.ielts, c.gre, c.internships, c.workYears, props]);
}

export function Calculator(props: CalcProps) {
  const t = useT();
  const names = useSiteNames();
  const status = useResultsData((s) => s.status);
  const data = useResultsData((s) => s.data);
  const c = useCalc();
  useEffect(() => useResultsData.getState().load(), []);
  const r = useCalcResult(props);

  if (!data)
    return (
      <div className="rounded-2xl border border-(--land-line) bg-(--land-card) p-6">
        {status === "error" ? <p role="alert" className="text-sm text-(--land-body)">{t("The programme list couldn’t load. Refresh the page to try again.")}</p> : <CampusLoader label={t("Loading programmes")} />}
      </div>
    );

  const band = r ? bandOf(r.match.rate) : null;
  return (
    <div className="grid gap-6 rounded-2xl border border-(--land-line) bg-(--land-card) p-4 sm:p-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <ProgrammeSearch data={data} />
        <Pick
          label={t("Kaplan partner university (awards your degree)")}
          value={c.awarder}
          items={props.partners.map((p) => ({ value: p.name, label: `${names.school(p.name).name} · ${t("Tier {tier}", { tier: p.tier })}` }))}
          onChange={(v) => c.set({ awarder: v })}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <FieldLabel>{t("Result")}</FieldLabel>
          <Slider min={40} max={80} step={1} value={[c.mark]} onValueChange={(v) => c.set({ mark: Array.isArray(v) ? v[0] : v })} thumbLabels={[t("Result")]} />
          {/* The GPA first, on its own line, so it is always in view; the class and UK mark after it. */}
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm text-(--land-body) tabular-nums">
            <span className="font-heading text-lg font-bold text-(--text)">{t("GPA {gpa} / 4", { gpa: ukMarkToFour(c.mark).toFixed(2) })}</span>
            <span>
              {t(CLASS_OF(c.mark))} · {c.mark}
            </span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t("IELTS overall")} value={c.ielts} min={4} max={9} step={0.5} onChange={(v) => c.set({ ielts: v })} />
          <Stepper label={t("Years of full-time work")} value={c.workYears} max={10} onChange={(v) => c.set({ workYears: v })} />
          <NumberField label={t("GRE (optional)")} value={c.gre} min={260} max={340} step={1} onChange={(v) => c.set({ gre: v })} />
          <Stepper label={t("Internships in your field")} value={c.internships} max={3} onChange={(v) => c.set({ internships: v })} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {r && band ? (
          <>
            <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-(--land-body)">{t("Match rate")}</span>
                <span aria-live="polite" className="font-heading text-5xl leading-none font-bold tabular-nums">
                  {r.match.belowMinimum ? t("Not met") : pct(r.match.rate)}
                </span>
              </div>
              {!r.match.belowMinimum && (
                <div className="flex flex-col gap-1 pb-1">
                  <span className="text-xs text-(--land-body) tabular-nums">{t("80% range {low}–{high}", { low: pct(r.draws.p10), high: pct(r.draws.p90) })}</span>
                  <span className={cn("self-start rounded-full px-2 py-0.5 text-xs font-semibold", BAND_CLASS[band])}>{t(BAND_TEXT[band])}</span>
                </div>
              )}
            </div>
            {r.match.belowMinimum && <p className="m-0 text-sm text-(--land-body)">{t("Below the programme’s stated minimum class, so it is shown as not met.")}</p>}
            {r.internshipGap !== null && (
              <p className="m-0 self-start rounded-lg bg-(--land-ground) px-2.5 py-1.5 text-sm text-(--land-body) tabular-nums">
                {/* A gap that rounds to 0.0 is said in words, not shown as "+0.0". */}
                {Math.abs(r.internshipGap * 100) < 0.05
                  ? t("Internships change this programme’s match rate by less than 0.1 points")
                  : t.rich("Internships add <b>{gap} points</b> (0 → {n})", { b: (chunk) => <strong className="font-semibold text-(--text)">{chunk}</strong> }, {
                      gap: `${r.internshipGap >= 0 ? "+" : "−"}${Math.abs(r.internshipGap * 100).toFixed(1)}`,
                      n: c.internships,
                    })}
              </p>
            )}
            <MatchCurve fit={r.fit} g={r.g} you={r.you} draws={r.draws} />
          </>
        ) : (
          <p className="m-0 text-sm text-(--land-body)">{t("This programme has no model parameters yet. Pick another one.")}</p>
        )}
      </div>
    </div>
  );
}
