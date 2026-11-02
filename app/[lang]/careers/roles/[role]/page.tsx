import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { RoleMissing, RolePage } from "@/components/careers/RolePage";
import { DRAFT } from "@/content/draft";
import type { RoleFull } from "@/lib/careers/types";
import { getFacts, getHotRoleIds, getRole, getStudentContext } from "@/lib/data/careers-db";
import { getT } from "@/lib/i18n/server";
import { fromFact, type ReceiptView } from "@/lib/receipts/model";
import "../../../../ui.css";
import "../../careers.css";

// /careers/roles/<role> (plan §3.1; build-spec §8): pay, demand, key skills, the gap and how to close it,
// employers and master's (components/careers/RolePage). Only the hot roles are prerendered (getHotRoleIds,
// never empty, as Cache Components requires); every other role renders on its first visit and is then kept
// ("Pages rendered with runtime params are saved to disk after a successful first request"). dynamicParams
// is not available under Cache Components, so it is not set. An unknown id is answered in place with the
// list of industries (RoleMissing): inside the streamed boundary notFound() would still answer 200.

type Params = Promise<{ lang: string; role: string }>;

const C = DRAFT.careers;

export async function generateStaticParams() {
  return (await getHotRoleIds()).map((role) => ({ role }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { role: id } = await params;
  const [t, role] = await Promise.all([getT(), getRole(id)]);
  if (!role) return { title: `${t(C.role.missingTitle)} · Kaplan 360++`, description: t(C.role.missing) };
  return { title: `${role.short} · Kaplan 360++`, description: t(C.meta.roleDescription, { role: role.short }) };
}

// The page opens on the light ground under the light header, so the browser's bar matches it in either theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0c22" },
  ],
  viewportFit: "cover",
};

export default function Role({ params }: { params: Params }) {
  // params is read inside the boundary, so a navigation shows the page's shell at once.
  return (
    <div className="ui careers-page">
      <Suspense fallback={<Fallback />}>
        <RoleContent params={params} />
      </Suspense>
    </div>
  );
}

function Fallback() {
  return (
    <div className="cr-fallback" aria-busy="true">
      <div className="cr-skel cr-skel-crumbs" />
      <div className="cr-skel cr-skel-title" />
      <div className="cr-skel cr-skel-line" />
      <div className="cr-skel cr-skel-block" />
    </div>
  );
}

/** Every fact the page footnotes: the role's linked facts, plus any badge row not among them. */
async function pageReceipts(role: RoleFull): Promise<Record<string, ReceiptView>> {
  const out: Record<string, ReceiptView> = {};
  for (const l of role.facts) out[l.factId] = fromFact(l.fact);
  const ids = [...role.momNeedsFactIds, ...(role.wageFactId ? [role.wageFactId] : [])].filter((id) => !out[id]);
  for (const f of await getFacts([...new Set(ids)])) out[f.id] = fromFact(f);
  return out;
}

async function RoleContent({ params }: { params: Params }) {
  const { role: id } = await params;
  const role = await getRole(id);
  if (!role) return <RoleMissing />;
  const [ctx, receipts] = await Promise.all([getStudentContext(), pageReceipts(role)]);
  return <RolePage role={role} receipts={receipts} ctx={ctx} />;
}
