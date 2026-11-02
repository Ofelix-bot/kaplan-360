import "server-only";
import { cacheLife } from "next/cache";
import { programmeZh, universityZh } from "@/lib/data/chinese-names";
import { fixedName } from "@/lib/data/fixes";
import { selectAll } from "@/lib/supabase";
import type { ChineseName } from "@/lib/results-types";

// Master's for a /careers role page (lib/data/careers-db.ts getRoleProgrammes): official university pages
// read from Supabase, matched to a role by discipline and by words in the programme's own name. Also the
// names of the employer lists on a role page. The old /careers/[slug] readers went with that page on 2026-10-29.

export type ProgrammeCard = {
  id: string;
  name: string;
  zh: ChineseName | null;
  degree_type: string | null;
  discipline_id: string | null;
  tuition_amount: number | null;
  tuition_currency: string | null;
  tuition_basis: string | null;
  tuition_international: boolean;
  ielts_overall: number | null;
  duration_months: number | null;
  source_url: string;
  last_verified: string;
  institution: { id: string; name: string; zh: ChineseName | null; country: string | null; qs_rank: string | null; qs_rank_value: number | null; kaplan_partner: boolean };
};

/** A programme as listed, with the name as the database holds it (the match reads that name, before fixes). */
type Listed = { raw: string; card: ProgrammeCard };

/**
 * Every master's in these disciplines at a tier-1 university, by QS rank, then by name.
 * Cached per discipline list (sorted and deduplicated by the callers).
 */
async function programmesIn(disciplines: string[]): Promise<Listed[]> {
  "use cache";
  cacheLife("hours");
  if (disciplines.length === 0) return [];
  const [programmes, institutions] = await Promise.all([
    selectAll<Omit<ProgrammeCard, "institution" | "zh"> & { institution_id: string }>(
      "programmes",
      "id,name,degree_type,discipline_id,tuition_amount,tuition_currency,tuition_basis,tuition_international,ielts_overall,duration_months,source_url,last_verified,institution_id",
      { column: "discipline_id", values: disciplines },
    ),
    selectAll<Omit<ProgrammeCard["institution"], "zh">>("institutions", "id,name,country,qs_rank,qs_rank_value,kaplan_partner", { column: "tier", values: [1] }),
  ]);
  const inst = new Map(institutions.map((i) => [i.id, { ...i, zh: universityZh(i.id) }]));
  const rank = (p: ProgrammeCard) => [p.institution.qs_rank_value ?? 9999, p.name] as const;
  return programmes
    .filter((p) => p.discipline_id && inst.has(p.institution_id))
    .map(({ institution_id, ...p }) => ({ raw: p.name, card: { ...p, name: fixedName(p.id, p.name), zh: programmeZh(p.id), institution: inst.get(institution_id)! } }))
    .sort((a, b) => {
      const [x, y] = [rank(a.card), rank(b.card)];
      return x[0] - y[0] || x[1].localeCompare(y[1]);
    });
}

/** The listed programmes in `disciplines` whose own name matches `words` (order kept). */
function matchIn(pool: Listed[], disciplines: string[], words: RegExp): ProgrammeCard[] {
  const set = new Set(disciplines);
  // search() ignores a regex's lastIndex, so a /g pattern cannot skip names.
  return pool.filter((p) => p.card.discipline_id && set.has(p.card.discipline_id) && p.raw.search(words) >= 0).map((p) => p.card);
}

const sortedUnique = (xs: string[]) => [...new Set(xs)].sort();

/**
 * Master's that help toward a career or role: in one of `disciplines`, and the programme's own name matches
 * `words` (literal, never guessed from module lists), by QS rank.
 * The listing is cached by discipline; the RegExp is applied after the cache (it is not serializable).
 */
export async function matchProgrammes(disciplines: string[], words: RegExp): Promise<ProgrammeCard[]> {
  const ds = sortedUnique(disciplines);
  return matchIn(await programmesIn(ds), ds, words);
}

export const COMPANY_LISTS: Record<string, string> = {
  "fortune-global-500-2026": "Fortune Global 500",
  "linkedin-top-companies-sg-2026": "LinkedIn Top Companies SG",
  "kaplan-graduate-employers": "Employs Kaplan graduates",
};
