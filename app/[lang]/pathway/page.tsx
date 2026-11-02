import { getT, pageMetadata } from "@/lib/i18n/server";
import kaplan from "@/data/raw/kaplan-programmes.json";
import PathwayView from "@/components/pathway/PathwayView";
import { ExampleBannerSite } from "@/components/shared/WorkedExampleBanner";
import { SCHOLARSHIPS, SCHOOLS, TOPUPS } from "@/lib/data/topups";
import { FACTS } from "@/lib/data/pathway-facts";

export const generateMetadata = pageMetadata(
  "Routes",
  "From a diploma to a degree in Singapore: Kaplan’s partner degrees and top-ups, how your background compares with each one’s entry requirements, and the earliest start of each step from Kaplan’s 2026 intake months.",
);

const diplomas = kaplan.programmes.filter((p) => /diploma/.test(p.level)).map((p) => ({ id: p.id, name: p.name, discipline: p.discipline, level: p.level }));
const disciplines = kaplan.disciplines as Record<string, string>;

export default async function PathwayPage() {
  const t = await getT();
  return (
    <section className="container page-intro plan-page pathway-page">
      <ExampleBannerSite readUrl />
      <h1>{t("Routes")}</h1>
      <PathwayView diplomas={diplomas} facts={FACTS} topups={TOPUPS} schools={SCHOOLS} scholarships={SCHOLARSHIPS} disciplines={disciplines} />
    </section>
  );
}
