import type { Metadata } from "next";
import { AdviserContext, AdviserPrompt } from "@/components/agent/AdviserDock";
import EmployerTicker from "@/components/home/EmployerTicker";
import Link from "@/components/i18n/Link";
import OutcomesDetail from "@/components/home/OutcomesDetail";
import OutcomesExplorer from "@/components/home/OutcomesExplorer";
import Reveal from "@/components/home/Reveal";
import { ExampleBannerSite } from "@/components/shared/WorkedExampleBanner";
import { getT } from "@/lib/i18n/server";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: `${t("Graduate outcomes")} · Kaplan 360++`,
    description: t("Employment and starting salaries of Kaplan Singapore graduates against private-degree, public-university and polytechnic graduates, and graduates abroad."),
  };
}

export default async function OutcomesPage() {
  const t = await getT();
  return (
    <section className="section outcomes" aria-labelledby="outcomes-title">
      <div className="container">
        <ExampleBannerSite readUrl />
        <Reveal className="section-head">
          <p className="eyebrow">
            <span className="num">01</span> {t("Graduate outcomes")}
          </p>
          <h1 id="outcomes-title" className="section-title">
            {t("Where Kaplan graduates land, six months on.")}
          </h1>
        </Reveal>
        <Reveal>
          <OutcomesExplorer />
        </Reveal>
        {/* The AI adviser: what these figures mean for this student (components/agent). */}
        <AdviserContext page="outcomes" />
        <div className="adviser-prompt-row">
          <AdviserPrompt label={t("What do these numbers mean for you?")} />
        </div>
        <p className="adviser-prompt-row">
          <Link href="/adviser?from=outcomes">{t("Ask the AI adviser: master’s first or work first?")}</Link>
        </p>
      </div>
      <EmployerTicker />
      <OutcomesDetail />
    </section>
  );
}
