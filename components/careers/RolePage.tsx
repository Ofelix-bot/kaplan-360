import { ChevronRightIcon } from "lucide-react";
import { HighPayBadge, MomNeedsBadge } from "@/components/careers/Badges";
import { ExampleGate } from "@/components/careers/ExampleGate";
import { GapActions } from "@/components/careers/GapActions";
import { MatchGap } from "@/components/careers/MatchGap";
import Link from "@/components/i18n/Link";
import { FlowSteps } from "@/components/shared/FlowSteps";
import { DRAFT } from "@/content/draft";
import { INDUSTRIES } from "@/lib/careers/industries";
import { careersHref, industryHref } from "@/lib/careers/links";
import type { RoleFull, StudentContext } from "@/lib/careers/types";
import { getT } from "@/lib/i18n/server";
import type { ReceiptView } from "@/lib/receipts/model";
import { DemandSignals } from "./DemandSignals";
import { PayRuler } from "./PayRuler";
import { RoleEmployers } from "./RoleEmployers";
import { RoleMasters } from "./RoleMasters";
import { RoleSkills } from "./RoleSkills";

// /careers/roles/<role> (plan §3.2; build-spec §6 K5). Server shell; the route wraps it in div.ui.careers-page.
// Order: the guided flow's step bar (FlowSteps, its Industry step back to this role's industry) → the
// worked-example banner (ExampleGate) → breadcrumb (industry › role, the chevron an icon) → the
// one H1 (the Skills Framework title) with its badges → pay → demand → key skills → the gap (MatchGap, then
// GapActions) → employers → master's. Each section is led by its visual and ends with its numbered sources
// (every section is its own ReceiptSection; numbering restarts per section). Sections with no data are left
// out, never filled. Facts arrive as ReceiptViews from the route (fromFact); our own rules are built here.

const C = DRAFT.careers;

const H2 = "m-0 min-w-0 font-heading text-[clamp(24px,2.6vw,34px)] leading-[1.12] font-bold tracking-[-0.02em] text-balance wrap-break-word text-(--text)";

export async function RolePage({
  role,
  receipts,
  ctx,
}: {
  role: RoleFull;
  receipts: Record<string, ReceiptView>;
  ctx: StudentContext;
}) {
  const t = await getT();
  return (
    <>
      <FlowSteps current="role" industryHref={industryHref(role.industryId)} />
      <div className="home-wrap pt-6">
        <ExampleGate />
      </div>

      <header className="home-wrap flex flex-col gap-4 pt-8 pb-10 sm:pt-12">
        <nav aria-label={t(C.role.crumbs)}>
          <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-[14px] leading-snug text-(--land-body)">
            <li>
              <Link href={careersHref()} className="rounded text-inherit underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)">
                {t(C.band.all)}
              </Link>
            </li>
            <li aria-hidden className="inline-flex">
              <ChevronRightIcon className="size-4" />
            </li>
            <li>
              <Link
                href={industryHref(role.industryId)}
                lang="en"
                className="rounded text-inherit underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
              >
                {role.industry.short}
              </Link>
            </li>
            <li aria-hidden className="inline-flex">
              <ChevronRightIcon className="size-4" />
            </li>
            <li aria-current="page" lang="en" className="font-semibold text-(--text)">
              {role.short}
            </li>
          </ol>
        </nav>
        <h1
          lang="en"
          className="m-0 max-w-[22ch] min-w-0 font-heading text-[clamp(32px,4.6vw,60px)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance wrap-break-word text-(--text)"
        >
          {role.title}
        </h1>
        {(role.momNeeds || role.highPay) && (
          <div className="flex flex-wrap items-center gap-2">
            {role.momNeeds && <MomNeedsBadge sol={role.momNeedsSol} />}
            {role.highPay && <HighPayBadge />}
          </div>
        )}
      </header>

      <PayRuler role={role} receipts={receipts} />
      <DemandSignals role={role} receipts={receipts} />
      <RoleSkills role={role} ctx={ctx} />

      <section aria-labelledby="cr-gap-title" className="home-wrap flex flex-col gap-8 border-t border-(--land-line) py-12 sm:py-14">
        <h2 id="cr-gap-title" className={H2}>
          {t(C.gap.title)}
        </h2>
        <MatchGap role={role} ctx={ctx} />
        <GapActions role={role} ctx={ctx} />
      </section>

      <RoleEmployers employers={role.employers} />
      <RoleMasters role={role} ctx={ctx} />
    </>
  );
}

/** An unknown role id: shown in place (no notFound(): inside a streamed boundary it would still answer 200). */
export async function RoleMissing() {
  const t = await getT();
  return (
    <>
      <div className="home-wrap pt-6">
        <ExampleGate />
      </div>
      <section aria-labelledby="cr-missing-title" className="home-wrap flex flex-col gap-6 py-12 sm:py-16">
        <h1 id="cr-missing-title" className="m-0 min-w-0 font-heading text-[clamp(32px,4.6vw,56px)] leading-[1.05] font-extrabold tracking-[-0.02em] text-balance wrap-break-word text-(--text)">
          {t(C.role.missingTitle)}
        </h1>
        <p className="m-0 text-[17px] leading-snug text-(--land-body)">{t(C.role.missing)}</p>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {INDUSTRIES.map((i) => (
            <li key={i.id} className="min-w-0">
              <Link
                href={industryHref(i.id)}
                lang="en"
                className="flex h-full min-w-0 items-center rounded-2xl border border-(--land-line) bg-(--land-card) p-4 text-[16px] leading-snug font-semibold wrap-break-word text-(--text) no-underline hover:border-(--brand-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring)"
              >
                {i.short}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
