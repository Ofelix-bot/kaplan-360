import { pageMetadata } from "@/lib/i18n/server";
import { StandApp } from "@/components/stand/stand-app";
import { getKaplanAwarders } from "@/lib/data/partners";
import { DISCIPLINES, KAPLAN_OPTIONS, OTHER_SCHOOLS } from "@/lib/data/plan-options";
import "../../ui.css";

export const generateMetadata = pageMetadata(
  "Where you stand",
  "Your Competitiveness Index on every master’s programme: each one’s official requirements and admitted students set against your grade, English and experience. Not an admission probability.",
);

// Built on shadcn/ui (components/stand): the index runs in the browser on the /results data file, so
// the student's answers never leave it.
export default async function WhereYouStandPage() {
  const awarders = await getKaplanAwarders();
  return <StandApp programmes={KAPLAN_OPTIONS} disciplines={DISCIPLINES} schools={OTHER_SCHOOLS} awarders={awarders} />;
}
