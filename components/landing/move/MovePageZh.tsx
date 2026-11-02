import { Seam } from "@/components/shared/Seam";
import { SectionBand } from "@/components/shared/SectionBand";
import { BAND } from "@/content/move.en";
import { CheckSection } from "../distance/Check";
import { DecideSection } from "../distance/Closing";
import { LookSection } from "../distance/Split";
import { ReceiptsSheet } from "../receipts";
import { Roads } from "@/components/landing/roads/Roads";
import { MoveHero } from "./MoveHero";
import { MoveMotion } from "./MoveMotion";
import { NoiseSection, ProblemSection, WhoSection } from "./MoveScreens";
import { Patch } from "./Patch";
import { ReceiptsTicker } from "./ReceiptsTicker";
import { StartBand } from "./StartBand";

// /zh-hans/move and /zh-hant/move, "Insights" (the English page is ./MovePage.tsx since 2026-11-02; the
// Chinese pages keep this layout until their words are written): the slogan's hero, the one line under it (Kaplan 360 and the patch), then the
// page's sections on the light ground under a sticky band of links: three screens (#why Who it's for,
// #problem The problem, #noise What they go on: ./MoveScreens.tsx), 01 Break it down (#look), the three
// roads one screen each (#roads, with #work, #study, #gap), 02 Bring it together across the page on the
// night ground (#check), 03 Lay it out (#decide), the closing band on the night ground (./StartBand.tsx:
// the page's one call to action) and the receipts ticker (#receipts). What a screen leaves out is
// in its drawer (./MoveDrawer.tsx). Dark and light meet in seams, never at a hard edge. One receipts sheet serves every
// chip on the page. The root is a direct child of <main> and opens on a ParticleHero (.page-hero),
// which gives the header its clear top (globals.css). The light ground is painted on the root, not
// on .ui, so the page's own box ends with its last section rather than with the closing seam: the
// seam then counts as space before the footer.

export function MovePageZh() {
  return (
    <MoveMotion>
      <div className="move-page page-hero bg-(--land-ground)">
        <div className="ui text-(--text)">
          <MoveHero />
          <Seam from="var(--hero-base)" to="var(--land-ground)" />
          <Patch />
          {/* The roads (Work, Study, Gap) aren't links in the band (the user's call, 2026-11-01): they only mark 01. */}
          <SectionBand label={BAND.label} items={BAND.items} subRows={false} />
          <WhoSection />
          <ProblemSection />
          <NoiseSection />
          <LookSection />
          <Roads />
          <Seam from="var(--land-ground)" to="var(--land-night)" />
          <CheckSection />
          <Seam from="var(--land-night)" to="var(--land-ground)" />
          <DecideSection />
          <Seam from="var(--land-ground)" to="var(--land-night)" />
          <StartBand />
          <Seam from="var(--land-night)" to="var(--land-tint)" />
          <ReceiptsTicker />
          <ReceiptsSheet />
          {/* From the ticker's tint into the footer's indigo. */}
          <Seam from="var(--land-tint)" to="var(--brand-deep)" />
        </div>
        {/* Without scripts nothing would bring in what Motion holds back: show it. */}
        <noscript dangerouslySetInnerHTML={{ __html: "<style>.move-page [data-still]{opacity:1!important;transform:none!important}</style>" }} />
      </div>
    </MoveMotion>
  );
}
