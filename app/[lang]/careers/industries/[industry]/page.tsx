import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { IndustryPage } from "@/components/careers/IndustryPage";
import { RoleMissing } from "@/components/careers/RolePage";
import { DRAFT } from "@/content/draft";
import { INDUSTRIES, industryById, industryName, isIndustryId } from "@/lib/careers/industries";
import type { IndustryFull, RoleCardData } from "@/lib/careers/types";
import { getFacts, getIndustry, getRolesForIndustry, getStudentContext } from "@/lib/data/careers-db";
import { getT } from "@/lib/i18n/server";
import { fromFact, type ReceiptView } from "@/lib/receipts/model";
import "../../../../ui.css";
import "../../careers.css";

// /careers/industries/<industry> (plan §3.1; build-spec §8): the sticky band, the lead (the only H1), the
// industry's four figures, its hot roles and the gap → action summary (components/careers/IndustryPage).
// All 16 ids come from the static list (lib/careers/industries.ts), so the build never reads the database
// for its params. An unknown id is answered in place with the list of industries (RoleMissing): inside the
// streamed boundary notFound() would still answer 200, as on the old [slug] page; the site is noindex.

type Params = Promise<{ lang: string; industry: string }>;

const C = DRAFT.careers;

export function generateStaticParams() {
  return INDUSTRIES.map((i) => ({ industry: i.id }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { industry } = await params;
  const t = await getT();
  const meta = industryById(industry);
  if (!meta) return { title: `${t(C.role.missingTitle)} · Kaplan 360++`, description: t(C.role.missing) };
  return { title: `${industryName(t, meta.short)} · Kaplan 360++`, description: t(C.meta.industryDescription, { industry: meta.short }) };
}

// The light header sits over the page's light ground; the band below it is the page's own colour.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0c22" },
  ],
  viewportFit: "cover",
};

export default function Industry({ params }: { params: Params }) {
  // params is read inside the boundary, so a navigation shows the page's shell at once.
  return (
    <div className="ui careers-page">
      <Suspense fallback={<Fallback />}>
        <IndustryContent params={params} />
      </Suspense>
    </div>
  );
}

function Fallback() {
  return (
    <div className="cr-fallback" aria-busy="true">
      <div className="cr-skel cr-skel-band" />
      <div className="cr-skel cr-skel-title" />
      <div className="cr-skel cr-skel-line" />
      <div className="cr-skel cr-skel-block" />
    </div>
  );
}

/** Every fact the page footnotes: the "now" figures of every region and the hot roles' badge rows. */
async function pageReceipts(industry: IndustryFull, roles: RoleCardData[]): Promise<Record<string, ReceiptView>> {
  const out: Record<string, ReceiptView> = {};
  for (const stats of Object.values(industry.now)) for (const s of stats) out[s.factId] = fromFact(s.fact);
  const ids = [...new Set(roles.flatMap((r) => [...r.momNeedsFactIds, ...(r.wageFactId ? [r.wageFactId] : [])]))].filter((id) => !out[id]);
  for (const f of await getFacts(ids)) out[f.id] = fromFact(f);
  return out;
}

async function IndustryContent({ params }: { params: Params }) {
  const { industry: id } = await params;
  if (!isIndustryId(id)) return <RoleMissing />;
  const [industry, roles, ctx] = await Promise.all([getIndustry(id), getRolesForIndustry(id), getStudentContext()]);
  if (!industry) return <RoleMissing />;
  const receipts = await pageReceipts(industry, roles);
  return <IndustryPage industry={industry} roles={roles} receipts={receipts} ctx={ctx} />;
}
