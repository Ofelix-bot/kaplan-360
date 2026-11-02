import { pageMetadata } from "@/lib/i18n/server";
import { FinderShell } from "@/components/finder/finder-frame";
import { FinderStart } from "@/components/finder/questionnaire";
import { getKaplanAwarders } from "@/lib/data/partners";
import { DISCIPLINES, KAPLAN_OPTIONS, OTHER_SCHOOLS } from "@/lib/data/plan-options";

export const generateMetadata = pageMetadata("Programme finder", "Six questions about your degree, grades and the master’s you want, then the programmes that fit you.");

export default async function FinderStartPage() {
  const props = {
    programmes: KAPLAN_OPTIONS,
    disciplines: DISCIPLINES,
    schools: OTHER_SCHOOLS,
    awarders: await getKaplanAwarders(),
    // The one-sentence reader only where the server can read it (app/api/profile needs the key).
    sentence: !!process.env.ANTHROPIC_API_KEY,
  };
  return (
    <FinderShell props={props} needsData={false}>
      <FinderStart props={props} />
    </FinderShell>
  );
}
