// The facts /next-steps reads besides the Where you stand model, gathered on the server (the page's
// server component, and scripts/check-next-steps.ts) and passed to the browser as one small prop:
// careers and their MOM medians, Kaplan graduates' SWDA survey row, CSCSE's notice, the planner's
// activities and official application openings, the partner universities' degree lengths, and the
// professional-qualification facts. Reads files with node:fs: never import this from a client
// component (import the NextStepsFacts type from ./types instead).

import { readFileSync } from "node:fs";
import path from "node:path";
import careers from "@/data/raw/careers.json";
import cscse from "@/data/raw/cscse-sg-2026-09.json";
import employment from "@/data/raw/employment.json";
import activities from "@/data/raw/plan-activities.json";
import dates from "@/data/raw/plan-dates.json";
import { FACTS } from "@/lib/data/pathway-facts";
import type { CertificatesFile, NextStepsFacts } from "./types";

/** The Kaplan row of the SWDA PEI graduate employment survey 2024/25. */
const KAPLAN_RECORD = "sg-kaplan-2024-25";
const ON_CAMPUS = /kaplan\.com\.sg\S*cscse/i;

/**
 * data/raw/certificates.json, read when called: another collection writes it, so it can be missing
 * or half-written. Null when it cannot be read or parsed.
 */
export function readCertificates(root = process.cwd()): CertificatesFile | null {
  try {
    return JSON.parse(readFileSync(path.join(root, "data/raw/certificates.json"), "utf8")) as CertificatesFile;
  } catch {
    return null;
  }
}

/** Everything the tree needs that is not in the Where you stand model. `root`: the project folder (the working directory by default). */
export function loadNextStepsFacts(root?: string): NextStepsFacts {
  const wage = careers.sources.find((s) => s.id === "mom-ows-2025")!;
  const record = employment.records.find((r) => r.id === KAPLAN_RECORD)!;
  const v = record.values as { securedEmployment: number; medianSalary: number; respondentsInLabourForce: number };
  const survey = (employment.sources as Record<string, { name: string; url: string }>)[record.source];
  const note = cscse.notes.find((n) => ON_CAMPUS.test(n));
  return {
    careers: careers.careers.map((c) => ({ id: c.id, title: c.title, disciplines: c.disciplines, sortOrder: c.sortOrder, median: c.medianGrossWage ?? null })),
    wageSource: { title: wage.title, url: wage.url, period: wage.referencePeriod ?? "" },
    kaplan: { cohort: record.cohort ?? "", secured: v.securedEmployment, median: v.medianSalary, respondents: v.respondentsInLabourForce, quote: record.verbatimQuote ?? "", source: { name: survey.name, url: survey.url } },
    cscse: {
      title: cscse.title,
      published: cscse.published,
      url: cscse.url,
      rows: cscse.rows as { university: string | null; institution: string; from: string }[],
      onCampus: note ? { text: note, url: note.match(/https?:\/\/[^\s)]+/)?.[0] ?? "" } : null,
    },
    activities: (activities.activities as Record<string, unknown>[]).map((a) => ({
      id: a.id as string,
      kind: a.kind as string,
      mode: a.mode as string,
      title: a.title as string,
      short: a.short as string,
      note: (a.note as string | null) ?? null,
      link: (a.link as string | undefined) ?? null,
      url: a.url as string,
      universities: (a.universities as string[]) ?? [],
      applyBy: (a.applyBy as string | null) ?? null,
      start: (a.start as string | null) ?? null,
    })),
    openings: (dates.items as { institutionId: string; kind: string; title: string; date: string; intake: string | null; url: string; quotes?: { date?: string } }[])
      .filter((d) => d.kind === "applications-open")
      .map((d) => ({ institutionId: d.institutionId, title: d.title.replace(/\s*:\s*$/, ""), date: d.date, intake: d.intake, url: d.url, quote: d.quotes?.date ?? null })),
    degrees: FACTS,
    certificates: readCertificates(root),
  };
}
