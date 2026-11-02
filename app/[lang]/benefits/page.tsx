import type { Metadata } from "next";
import kaplan from "@/data/raw/kaplan-programmes.json";
import BenefitsBoard from "@/components/home/BenefitsBoard";
import BenefitsOverview from "@/components/home/BenefitsOverview";
import ChangeLog from "@/components/home/ChangeLog";
import Reveal from "@/components/home/Reveal";
import { getBenefits } from "@/lib/data/benefits";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: `${t("Benefits you can claim")} · Kaplan 360++`,
    description: t("Scholarships, fee reductions, deadlines and events from official university pages, starting with Kaplan partner universities."),
  };
}

export default async function BenefitsPage() {
  const t = await getT();
  const { benefits, institutions } = await getBenefits();
  // Kaplan degrees by awarding university, so an alumni discount can be flagged for the visitor's own plan.
  const byName = new Map(institutions.map((i) => [i.name, i.id]));
  const kaplanProgrammeUniversity = Object.fromEntries(
    kaplan.programmes.filter((p) => p.university && byName.has(p.university)).map((p) => [p.id, byName.get(p.university!)!]),
  );

  return (
    <section className="section" aria-labelledby="benefits-title">
      <div className="container">
        <Reveal className="section-head">
          <p className="eyebrow">
            <span className="num">03</span> {t("Benefits you can claim")}
          </p>
          <h1 id="benefits-title" className="section-title">
            {t("Scholarships and deadlines, before they close.")}
          </h1>
          <p className="section-lead">{t("What closes next, then every offer with what to do and the official page.")}</p>
        </Reveal>
        <Reveal>
          <BenefitsOverview benefits={benefits} institutions={institutions} />
        </Reveal>
        <h2 className="cx-table-title ox-more-head">{t("What changed")}</h2>
        <Reveal>
          <ChangeLog full />
        </Reveal>
        <h2 className="cx-table-title ox-more-head">{t("The next 12 months")}</h2>
        <Reveal className="bb-wrap">
          <BenefitsBoard benefits={benefits} institutions={institutions} kaplanProgrammeUniversity={kaplanProgrammeUniversity} />
        </Reveal>
      </div>
    </section>
  );
}
