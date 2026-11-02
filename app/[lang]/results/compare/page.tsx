import { pageMetadata } from "@/lib/i18n/server";
import { FinderCompare } from "@/components/finder/compare-table";
import { FinderShell } from "@/components/finder/finder-frame";
import { getKaplanAwarders } from "@/lib/data/partners";
import { DISCIPLINES, KAPLAN_OPTIONS, OTHER_SCHOOLS } from "@/lib/data/plan-options";

export const generateMetadata = pageMetadata("Compare programmes", "Up to four master’s programmes side by side: whether you can get in, what they cost and take, and their sources.");

export default async function FinderComparePage() {
  const props = { programmes: KAPLAN_OPTIONS, disciplines: DISCIPLINES, schools: OTHER_SCHOOLS, awarders: await getKaplanAwarders(), sentence: false };
  return (
    <FinderShell props={props}>
      <FinderCompare />
    </FinderShell>
  );
}
