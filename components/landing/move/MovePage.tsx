import { Seam } from "@/components/shared/Seam";
import { SectionBand } from "@/components/shared/SectionBand";
import { DRAFT } from "@/content/draft";
import { BAND_EN, HOW } from "@/content/move.en";
import { CheckSection } from "../distance/Check";
import { LookSection } from "../distance/Split";
import { ReceiptsSheet } from "../receipts";
import { Roads } from "@/components/landing/roads/Roads";
import { HowItWorks } from "./HowItWorks";
import { LayItOut } from "./LayItOut";
import { MoveHero } from "./MoveHero";
import { MoveMotion } from "./MoveMotion";
import { WhySection } from "./MoveScreens";
import { ReceiptsTicker } from "./ReceiptsTicker";
import { SourcesSection } from "./SourcesSection";
import { StartBand } from "./StartBand";

// /move, "Insights", in English (the Chinese pages keep the earlier layout: ./MovePageZh.tsx). In page
// order: the slogan's hero; the sticky band of links (Why, 01, 02, 03, Sources); the line on Kaplan360 and
// "How it works" in four steps (./HowItWorks.tsx); Why (#why, the pixel scene: ./MoveScreens.tsx
// WhySection); 01 Break it down (#look) and the three roads, each with what Kaplan 360++ checks on it
// (#roads: #work, #study, #gap); 02 Bring it together on the night ground (#check); 03 Lay it out with
// what is planned (#decide, ./LayItOut.tsx); Sources, how every fact is checked (#sources,
// ./SourcesSection.tsx); the closing band on the night ground (./StartBand.tsx: the page's one call to
// action) and the receipts ticker (#receipts). Dark and light meet in seams, never at a hard edge. One
// receipts sheet serves every chip on the page. The root is a direct child of <main> and opens on a
// ParticleHero (.page-hero), which gives the header its clear top (globals.css). The light ground is
// painted on the root, not on .ui, so the page's own box ends with its last section rather than with the
// closing seam: the seam then counts as space before the footer.

export function MovePage() {
  return (
    <MoveMotion>
      <div className="move-page page-hero bg-(--land-ground)">
        <div className="ui text-(--text)">
          <MoveHero line={DRAFT.move.heroLineEn} />
          <Seam from="var(--hero-base)" to="var(--land-ground)" />
          <SectionBand label={BAND_EN.label} items={BAND_EN.items} subRows={false} />
          <HowItWorks />
          <WhySection />
          {/* A rule between Why and 01, across the content's width. */}
          <div aria-hidden className="home-wrap">
            <div className="h-px bg-(--land-line)" />
          </div>
          <LookSection sub={HOW.steps[1].body} stepClassName="text-(--accent-ink)" subClassName="max-w-[36rem]" />
          <Roads checks />
          <Seam from="var(--land-ground)" to="var(--land-night)" />
          <CheckSection stepClassName="text-(--accent)" />
          <Seam from="var(--land-night)" to="var(--land-ground)" />
          <LayItOut />
          <Seam from="var(--land-ground)" to="var(--land-card)" />
          <SourcesSection />
          <Seam from="var(--land-card)" to="var(--land-night)" />
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
