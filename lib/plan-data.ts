// The data behind /plan, gathered from the collected sources: dated events and deadlines from the
// universities' pages and the planner's own collection (scripts/plan/dates.ts), every scholarship and
// fee reduction with what to prepare (plus Kaplan's own awards), activities and MOM's work rule,
// employers hiring in each field, and the universities' English-test rules. Pure, so the page
// (app/[lang]/plan/page.tsx, with benefits from Supabase) and scripts/check-plan-road.ts (with
// data/raw/benefits.json) gather it the same way.

import companies from "@/data/raw/career-companies.json";
import checks from "@/data/raw/career-employers.json";
import careers from "@/data/raw/careers.json";
import activities from "@/data/raw/plan-activities.json";
import dates from "@/data/raw/plan-dates.json";
import englishValidity from "@/data/raw/plan-english-validity.json";
import kaplan from "@/data/raw/kaplan-programmes.json";
import kaplanScholarships from "@/data/raw/topup-scholarships.json";
import type { BenefitRow } from "@/lib/data/benefits";
import { FACTS } from "@/lib/data/pathway-facts";
import { universityKey } from "@/lib/pathway";
import { forStudentsInSingapore } from "@/lib/plan-events";
import type { PlanEmployer, PlanSources } from "@/lib/plan-input";
import type { PlanEvent, PlanScholarship } from "@/lib/plan-timeline";

/** The institutions the planner's own dates are for, whose names the page looks up. */
export const PLAN_DATE_INSTITUTIONS = [...new Set(dates.items.map((d) => d.institutionId))];

const degrees = kaplan.programmes.map((p) => ({ id: p.id, name: p.name, university: p.university, level: p.level, discipline: p.discipline }));

// Employers hiring in each field in Singapore, from their own careers sites (checked for /careers),
// with those listing an internship among the roles flagged.
const interning = new Set(
  (checks.checks as { career: string; employer: string; status: string; titles?: string[] }[])
    .filter((x) => x.status === "ok" && (x.titles ?? []).some((t) => /\bintern(ship)?\b|trainee/i.test(t)))
    .map((x) => x.employer),
);
const employersByField: Record<string, PlanEmployer[]> = {};
for (const c of careers.careers as { id: string; disciplines?: string[] | string }[]) {
  const fields = [c.disciplines ?? []].flat().join(",").split(",").filter(Boolean);
  for (const r of (companies.rows as { careerId: string; employerId: string; company: string; careersUrl: string; openings: number | null; status: string }[]).filter(
    (r) => r.careerId === c.id && r.status === "ok" && (r.openings ?? 0) > 0,
  )) {
    for (const d of fields) {
      const list = (employersByField[d] ??= []);
      if (!list.some((e) => e.name === r.company)) list.push({ name: r.company, url: r.careersUrl, intern: interning.has(r.employerId) });
    }
  }
}
for (const list of Object.values(employersByField)) list.sort((a, b) => Number(b.intern) - Number(a.intern));
const partners = [...new Set(kaplan.programmes.map((p) => p.university).filter((u): u is string => !!u))];
/** Kaplan's previews name the partner university in their title ("Murdoch University – Bachelor of …"). */
const previewUniversity = (title: string) => partners.find((u) => title.toLowerCase().includes(universityKey(u))) ?? null;

/** The benefits rows the page needs, as lib/data/benefits.ts reads them (with the sums when stated). */
export type PlanBenefit = Pick<BenefitRow, "id" | "institution_id" | "kind" | "title" | "value" | "automatic" | "intake" | "deadline" | "event_date" | "disciplines" | "eligibility" | "source_url" | "checklist"> & {
  amount?: number | string | null;
  percent?: number | string | null;
};

/** Everything /plan hands to the browser, from the benefits shown on the site and institution names by id. */
export function planSources(benefits: PlanBenefit[], names: Map<string, string>): PlanSources {
  const num = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v));
  // Dated items only: deadlines and events. Scholarships and fee reductions are planned on their own (below).
  const events: PlanEvent[] = benefits
    .filter((b) => (b.deadline || b.event_date) && b.kind !== "scholarship" && b.kind !== "fee-reduction")
    .map((b) => ({ id: b.id, university: names.get(b.institution_id) ?? b.institution_id, kind: b.kind, title: b.title, value: b.value, date: b.deadline ?? b.event_date, url: b.source_url }));
  // Application windows and events from the planner's own collection (scripts/plan/dates.ts).
  for (const d of dates.items as { id: string; institutionId: string; kind: string; title: string; date: string; intake: string | null; format: string | null; url: string }[]) {
    const university = d.institutionId === "kaplan" ? previewUniversity(d.title) : (names.get(d.institutionId) ?? null);
    if (!university) continue;
    if (!forStudentsInSingapore(d)) continue;
    events.push({
      id: d.id,
      university,
      kind: d.kind as PlanEvent["kind"],
      title: d.institutionId === "kaplan" ? `Kaplan preview: ${d.title}` : d.title.replace(/\s*:\s*$/, ""),
      value: [d.intake, d.format].filter(Boolean).join(" · ") || null,
      date: d.date,
      url: d.url,
    });
  }
  // Every scholarship and fee reduction, dated or not, with what the page says to prepare; and Kaplan's
  // own awards for Kaplan students (data/raw/topup-scholarships.json).
  const scholarships: PlanScholarship[] = [
    ...benefits
      .filter((b) => b.kind === "scholarship" || b.kind === "fee-reduction")
      .map((b) => ({
        id: b.id,
        university: names.get(b.institution_id) ?? b.institution_id,
        title: b.title,
        value: b.value,
        amount: num(b.amount),
        percent: num(b.percent),
        deadline: b.deadline,
        intake: b.intake,
        automatic: b.automatic,
        prepare: b.checklist?.prepare.length ? b.checklist.prepare : (b.checklist?.claim ?? []),
        eligibility: b.eligibility,
        // An award on an MBA's own page that names no field is for that MBA (Aston's Gold and Silver scholarships).
        disciplines: b.disciplines || (/\bmba\b/i.test(`${b.title} ${b.source_url}`) ? "MBA" : null),
        url: b.source_url,
        source: "university" as const,
      })),
    ...(kaplanScholarships.items as { id: string; university: string | null; title: string; value: string; eligibility: string[]; source: { url?: string } }[]).map((s) => ({
      id: s.id,
      university: s.university ?? "Kaplan",
      title: s.title,
      value: s.value,
      deadline: null,
      automatic: false,
      prepare: s.eligibility,
      url: s.source.url ?? null,
      source: "kaplan" as const,
      stage: s.university ? ("bachelor" as const) : ("both" as const),
    })),
  ];
  const englishRules = Object.entries(englishValidity.rules as Record<string, { url: string; quote: string }>).map(([id, r]) => ({ university: names.get(id) ?? id, ...r }));
  return { kaplan: degrees, facts: FACTS, events, scholarships, activities: activities.activities, mom: activities.mom, employers: employersByField, englishRules };
}
