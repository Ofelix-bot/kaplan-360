"use client";

import { FlowSteps } from "@/components/shared/FlowSteps";
import type { IndustryFull, RoleCardData, StudentContext } from "@/lib/careers/types";
import type { ReceiptView } from "@/lib/receipts/model";
import { ExampleGate } from "./ExampleGate";
import { HotRoles } from "./HotRoles";
import { IndustryBand } from "./IndustryBand";
import { IndustryLead } from "./IndustryLead";
import { IndustryNow, regionsOf } from "./IndustryNow";

// /careers/industries/<industry> (Q12, Q28), in the fixed order: the guided flow's step bar (FlowSteps, not
// sticky), the worked-example gate, the sticky purple
// band (name + dropdown, region toggle), the lead (the only H1), "<Industry> now" on the one night band,
// and the hot roles, whose picked role's gap opens under them (./HotRoles, ./RoleGapPanel; 2026-11-02 board).
// Each section closes on its own numbered sources.
// The route renders this inside <div class="ui careers-page">, so the band's sticky box is the whole page.

export function IndustryPage({
  industry,
  roles,
  receipts,
  ctx,
}: {
  industry: IndustryFull;
  roles: RoleCardData[];
  receipts: Record<string, ReceiptView>;
  ctx: StudentContext;
}) {
  return (
    <>
      {/* The guided flow's step bar, above the sticky band; it scrolls away with the page. */}
      <FlowSteps current="industry" />
      {/* In the page's column, as on the entry and role pages; with no example open it holds nothing and takes no room. */}
      <div className="home-wrap has-[>div]:py-4">
        <ExampleGate />
      </div>
      <IndustryBand industry={industry} regions={regionsOf(industry)} />
      <IndustryLead industryId={industry.id} />
      <IndustryNow industry={industry} receipts={receipts} />
      <HotRoles roles={roles} receipts={receipts} ctx={ctx} industryId={industry.id} />
    </>
  );
}
