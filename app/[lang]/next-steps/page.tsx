import { pageMetadata } from "@/lib/i18n/server";
import { NextStepsApp } from "@/components/next-steps/next-steps-app";
import { getKaplanAwarders } from "@/lib/data/partners";
import { DISCIPLINES, KAPLAN_OPTIONS, OTHER_SCHOOLS } from "@/lib/data/plan-options";
import { loadNextStepsFacts } from "@/lib/next-steps/facts";
import cscse from "@/data/raw/cscse-sg-2026-09.json";
import employment from "@/data/raw/employment.json";
import "../../ui.css";
import "./roads.css";

export const generateMetadata = pageMetadata(
  "Next steps",
  "The roads from your degree in three groups: work, further study and a gap (professional qualifications, a year of work or an internship first), each with its own measure and the official page behind it.",
);

// The same map as /plan's Map tab (next.config.ts sends /next-steps there; this page file stays and
// works). Built on shadcn/ui and React Flow (components/next-steps) over Where you stand's model: the index runs
// in the browser on the /results data file, so the student's answers never leave it. The facts the map
// reads besides it (careers, the SWDA survey, CSCSE's notice, openings, qualifications) are read here,
// at build time, and passed down as one prop.
export default async function NextStepsPage() {
  const awarders = await getKaplanAwarders();
  const facts = loadNextStepsFacts();
  const dates = { swda: employment.retrievedAt, cscse: cscse.transcribedAt };
  return <NextStepsApp stand={{ programmes: KAPLAN_OPTIONS, disciplines: DISCIPLINES, schools: OTHER_SCHOOLS, awarders }} facts={facts} dates={dates} />;
}
