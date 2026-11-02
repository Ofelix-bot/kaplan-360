import "server-only";
import { cacheLife } from "next/cache";
import kaplan from "@/data/raw/kaplan-programmes.json";
import { selectAll } from "@/lib/supabase";

export type Awarder = { university: string; country: string | null };

/**
 * For each Kaplan degree, the partner university that awards it and that university's country
 * (UK and Irish degrees are classified First / 2:1 / 2:2; Australian ones use a GPA or WAM).
 */
export async function getKaplanAwarders(): Promise<Record<string, Awarder>> {
  "use cache";
  cacheLife("hours");
  const partners = await selectAll<{ name: string; country: string | null }>("institutions", "id,name,country", { column: "kaplan_partner", values: [true] });
  const country = new Map(partners.map((p) => [p.name, p.country]));
  return Object.fromEntries(
    kaplan.programmes.filter((p) => p.university).map((p) => [p.id, { university: p.university!, country: country.get(p.university!) ?? null }]),
  );
}

/** Countries that have programmes in the results data, largest first. */
export async function getProgrammeCountries(): Promise<{ country: string; programmes: number }[]> {
  "use cache";
  cacheLife("hours");
  const [rows, institutions] = await Promise.all([
    selectAll<{ id: string; institution_id: string }>("programmes", "id,institution_id"),
    selectAll<{ id: string; country: string | null }>("institutions", "id,country", { column: "tier", values: [1] }),
  ]);
  const country = new Map(institutions.map((i) => [i.id, i.country]));
  const counts = new Map<string, number>();
  for (const r of rows) {
    const c = country.get(r.institution_id);
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts].map(([c, n]) => ({ country: c, programmes: n })).sort((a, b) => b.programmes - a.programmes);
}
