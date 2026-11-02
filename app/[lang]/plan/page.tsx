import { pageMetadata } from "@/lib/i18n/server";
import { AdviserContext } from "@/components/agent/AdviserDock";
import PlanView from "@/components/plan/PlanView";
import { PlanTabs } from "@/components/plan/PlanTabs";
import { PlanApplications } from "@/components/finder/plan-applications";
import { getBenefits, getInstitutionNames } from "@/lib/data/benefits";
import { getKaplanAwarders } from "@/lib/data/partners";
import { DISCIPLINES, KAPLAN_OPTIONS, OTHER_SCHOOLS } from "@/lib/data/plan-options";
import { loadNextStepsFacts } from "@/lib/next-steps/facts";
import { PLAN_DATE_INSTITUTIONS, planSources } from "@/lib/plan-data";
import cscse from "@/data/raw/cscse-sg-2026-09.json";
import employment from "@/data/raw/employment.json";
import "../../ui.css";
import "../next-steps/roads.css";

export const generateMetadata = pageMetadata(
  "Your plan",
  "Your own plan to a master’s: a map of the roads from your degree (work, further study, a gap), and a timeline of tests, application windows, events, experience and scholarship deadlines to download as a PDF or calendar.",
);

// Two tabs (components/plan/PlanTabs.tsx): Timeline, the default, from the benefits and the plan's dates;
// Map, the map of roads from the degree (components/next-steps, as on /next-steps), from what that page
// reads here at build time: the partner universities, the next-steps facts and their sources' dates.
export default async function PlanPage() {
  const [{ benefits, institutions }, awarders] = await Promise.all([getBenefits(), getKaplanAwarders()]);
  const names = new Map([...(await getInstitutionNames(PLAN_DATE_INSTITUTIONS)), ...institutions.map((i) => [i.id, i.name] as const)]);
  const sources = planSources(benefits, names);
  const map = {
    stand: { programmes: KAPLAN_OPTIONS, disciplines: DISCIPLINES, schools: OTHER_SCHOOLS, awarders },
    facts: loadNextStepsFacts(),
    dates: { swda: employment.retrievedAt, cscse: cscse.transcribedAt },
  };
  // Applications: the shortlist's board, moved here from /results with the Programme finder.
  const applications = <PlanApplications props={{ ...map.stand, sentence: false }} />;
  return (
    <>
      <AdviserContext page="plan" />
      <PlanTabs timeline={<PlanView sources={sources} />} map={map} applications={applications} />
    </>
  );
}
