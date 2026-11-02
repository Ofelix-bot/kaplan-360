import kaplan from "@/data/raw/kaplan-programmes.json";
import type { KaplanProgrammeOption, SchoolOption } from "@/lib/plan-options-types";
import { SCHOOLS } from "@/lib/data/topups";

// The choices Start planning offers, shared by Programmes for you and the homepage's one-sentence shortcut.

/** Kaplan Singapore's programmes from kaplan.com.sg (data/raw/kaplan-programmes.json). */
export const KAPLAN_OPTIONS: KaplanProgrammeOption[] = kaplan.programmes.map((p) => ({
  id: p.id,
  name: p.name,
  level: /diploma/.test(p.level) ? "diploma" : "degree",
  discipline: p.discipline,
  university: p.university,
}));

export const DISCIPLINES: Record<string, string> = kaplan.disciplines;

/** Other private schools a diploma student may come from. */
export const OTHER_SCHOOLS: SchoolOption[] = SCHOOLS.filter((s) => s.id !== "kaplan").map((s) => ({ id: s.id, name: s.name }));
