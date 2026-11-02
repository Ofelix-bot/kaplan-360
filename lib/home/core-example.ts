import "server-only";
import { cacheLife } from "next/cache";
import admitCases from "@/data/raw/admit-cases.json";
import admitModel from "@/data/raw/admit-model.json";
import kaplan from "@/data/raw/kaplan-programmes.json";
import institutions from "@/data/raw/institutions.json";
import { matchRate, type MatchBand } from "@/lib/admit-model";
import { fitOf, MATCH } from "@/lib/data/results";
import { matchInput } from "@/lib/finder/row-state";
import { CLASS_FOUR, ukMarkToFour } from "@/lib/gpa4";
import { studentRank } from "@/lib/grades";
import { personaById } from "@/lib/personas";

// The homepage's core-algorithm tile (components/landing/home/tiles/CoreVisual.tsx): the worked example's
// match rate on the master's 02 Bring it together names for him (Arjun, UCD finance at Kaplan, on Bristol's
// MSc Management (Sustainability)), worked out as Programme finder does (components/workspace/model.tsx,
// lib/finder/row-state.ts), and the model's size: programmes with a curve, how many rest on 5+ reported
// admits, and the reported admits linked to programmes (data/raw/admit-cases.json).

/** The master's 02 names for Arjun (content/landing.en.ts CHECK). */
export const CORE_PROGRAMME = "university-of-bristol-msc-management-sustainability";

export type CoreExample = { rate: number; band: MatchBand };
export type CoreModel = { programmes: number; observed: number; admits: number; admitProgrammes: number };

/** Cached: the example's answers are dated from today (lib/personas.ts), which a prerender may not read directly. */
export async function coreExample(): Promise<CoreExample | null> {
  "use cache";
  cacheLife("days");
  const persona = personaById("arjun");
  const fit = fitOf(CORE_PROGRAMME);
  if (!persona || !fit) return null;
  const answers = persona.answers(new Date());
  const university = kaplan.programmes.find((p) => p.id === answers.programmeId)?.university ?? null;
  const you = studentRank(university, answers);
  if (!university || !you) return null;
  const gpa = you.mark !== null ? { low: ukMarkToFour(you.mark), high: ukMarkToFour(you.mark) } : { low: CLASS_FOUR[you.rank][0], high: CLASS_FOUR[you.rank][1] };
  const qs = (institutions.institutions as { name: string; qs?: { rankValue?: number | null } | null }[]).find((u) => u.name === university)?.qs?.rankValue ?? null;
  const input = matchInput(you, gpa, qs, answers);
  if (!input) return null;
  const m = matchRate(fit, MATCH, input);
  return m.belowMinimum ? null : { rate: m.rate, band: m.band };
}

export function coreModel(): CoreModel {
  const counts = (admitModel as unknown as { counts: { observed: number }; programmes: Record<string, unknown> });
  const cases = (admitCases as unknown as { programmes: Record<string, { n?: number }> }).programmes;
  return {
    programmes: Object.keys(counts.programmes).length,
    observed: counts.counts.observed,
    admits: Object.values(cases).reduce((t, p) => t + (p.n ?? 0), 0),
    admitProgrammes: Object.keys(cases).length,
  };
}
