import Hero from "@/components/home/Hero";
import { ParticleHero } from "@/components/shared/ParticleHero";
import { Seam } from "@/components/shared/Seam";
import { coreExample, coreModel } from "@/lib/home/core-example";
import { getReadCount } from "@/lib/read-count";
import { AnchorForward } from "./home/AnchorForward";
import { HomeBento } from "./home/HomeBento";
import { HomeMotion } from "./home/HomeMotion";
import { HeroStage } from "./HeroStage";
import { ReceiptsSheet } from "./receipts";

// The homepage: two blocks. First the PLAN ahead hero (#start) on the particle ground, with the two ways
// in; then, through a seam from the hero's indigo to the page's ground, the "Why Kaplan 360++" bento,
// and a seam down into the footer. Everything else the old homepage had (the Opener, the heading and
// fork, 01 Look, 02 Check, 03 Decide) is on /move; old links to /#look, /#check and /#distance are
// forwarded there. The root is a direct child of main and a .page-hero, which makes the header clear
// over the hero (globals.css). The hero stays outside .ui: its styles are the site's own, which
// Tailwind's scoped base would reset. The previous homepage sections are kept, unused, in ./v1.

export async function Landing({ programmes }: { programmes: { n: number; checked: string | null } | null }) {
  const reads = getReadCount();
  return (
    <div className="home-page page-hero">
      <HomeMotion>
        <AnchorForward />
        <ParticleHero as="div" scrim="home">
          <HeroStage>
            <Hero />
          </HeroStage>
        </ParticleHero>
        <Seam from="var(--hero-base)" to="var(--land-ground)" />
        <div className="ui bg-(--land-ground) text-foreground">
          <HomeBento
            reads={{ n: reads.total, date: reads.latest }}
            programmes={programmes}
            core={await coreExample()}
            model={coreModel()}
          />
          <ReceiptsSheet />
        </div>
        <Seam from="var(--land-ground)" to="var(--brand-deep)" />
      </HomeMotion>
    </div>
  );
}
