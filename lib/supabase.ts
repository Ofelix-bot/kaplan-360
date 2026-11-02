import "server-only";
import { createClient } from "@supabase/supabase-js";

// Read-only access for pages: the publishable key, under row-level security that allows only
// selects on public tables. The secret key is used by the data scripts, never here.
export function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  // Requests skip Next's fetch cache, which outlives builds; caching is done by the "use cache" readers
  // (lib/data/*), so a new build or the hourly revalidation always sees the latest load.
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

/**
 * All rows of a select, in pages of 1,000 (the API's row limit), optionally where `column` is one of
 * `values`. `orderBy` (one or more columns) must be unique per row so pages don't overlap.
 */
export async function selectAll<T>(table: string, columns: string, where?: { column: string; values: (string | number | boolean)[] }, orderBy: string | string[] = "id"): Promise<T[]> {
  const db = supabase();
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let base = db.from(table).select(columns);
    for (const col of [orderBy].flat()) base = base.order(col, { ascending: true });
    base = base.range(from, from + 999);
    const { data, error } = await (where ? base.in(where.column, where.values) : base);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < 1000) return out;
  }
}
