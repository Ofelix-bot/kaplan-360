import "server-only";
import { cacheLife } from "next/cache";
import { selectAll } from "@/lib/supabase";

// Homepage ③: benefits from official university pages (scholarships, fee reductions, application-fee
// waivers, deadlines, events), each field backed by a verbatim quote. Whether a benefit is still open
// is worked out in the browser against today's date (components/home/BenefitsBoard.tsx, BenefitsCalendar.tsx).

export type BenefitRow = {
  id: string;
  institution_id: string;
  kind: "scholarship" | "fee-reduction" | "application-fee-waiver" | "deadline" | "event";
  title: string;
  value: string | null;
  /** The sum or percentage the value states, when it was read as a number. */
  amount?: number | null;
  currency?: string | null;
  percent?: number | null;
  for_international: boolean | null;
  postgraduate_taught: boolean | null;
  automatic: boolean | null;
  intake: string | null;
  deadline: string | null;
  event_date: string | null;
  format: string | null;
  disciplines: string | null;
  eligibility: string | null;
  source_url: string;
  retrieved_at: string;
  checklist: { claim: string[]; know: string[]; prepare: string[] } | null;
};

export type BenefitInstitution = { id: string; name: string; country: string | null; kaplan_partner: boolean };

export async function getBenefits(): Promise<{ benefits: BenefitRow[]; institutions: BenefitInstitution[] }> {
  "use cache";
  cacheLife("hours");
  const benefits = (
    await selectAll<BenefitRow & { display: boolean }>(
      "benefits",
      "id,institution_id,kind,title,value,amount,currency,percent,for_international,postgraduate_taught,automatic,intake,deadline,event_date,format,disciplines,eligibility,source_url,retrieved_at,checklist,display",
    )
  )
    // Shown when meant for prospective students: international (or unstated) and not research-only.
    // Alumni discounts stay: Kaplan students on a partner degree become that university's alumni.
    .filter((b) => b.display && (b.for_international !== false || /alumni/i.test(b.title)) && b.postgraduate_taught !== false)
    .map(({ display, ...b }) => (void display, b));
  const ids = [...new Set(benefits.map((b) => b.institution_id))];
  const institutions = ids.length ? await selectAll<BenefitInstitution>("institutions", "id,name,country,kaplan_partner", { column: "id", values: ids }) : [];
  return { benefits, institutions };
}

/** Names for institutions without benefits (the planner's own application dates and events). */
export async function getInstitutionNames(ids: string[]): Promise<[string, string][]> {
  "use cache";
  cacheLife("hours");
  const rows = ids.length ? await selectAll<{ id: string; name: string }>("institutions", "id,name", { column: "id", values: ids }) : [];
  return rows.map((r) => [r.id, r.name]);
}
