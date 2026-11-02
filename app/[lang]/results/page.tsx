import { pageMetadata } from "@/lib/i18n/server";
import { FinderShell } from "@/components/finder/finder-frame";
import { FinderList } from "@/components/finder/results-list";
import { getKaplanAwarders } from "@/lib/data/partners";
import { DISCIPLINES, KAPLAN_OPTIONS, OTHER_SCHOOLS } from "@/lib/data/plan-options";

export const generateMetadata = pageMetadata("Programmes for you", "Master’s programmes that fit your answers, with each official requirement next to your answer.");

export default async function FinderListPage() {
  const props = { programmes: KAPLAN_OPTIONS, disciplines: DISCIPLINES, schools: OTHER_SCHOOLS, awarders: await getKaplanAwarders(), sentence: false };
  return (
    <FinderShell props={props}>
      <FinderList />
    </FinderShell>
  );
}
