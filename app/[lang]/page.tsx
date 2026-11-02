import type { Metadata, Viewport } from "next";
import { Landing } from "@/components/landing/Landing";
import { getProgrammeCount } from "@/lib/data/results";
import { getT } from "@/lib/i18n/server";
import "../ui.css";

// The homepage (components/landing/Landing.tsx): the PLAN ahead hero on its particle ground, then the
// "Why Kaplan 360++" bento. The rest of the old homepage is on /move. Tile 5's programme count is read
// here (a cached count, lib/data/results.ts); if the database can't be read the tile shows no number.

// The homepage's own description; the title and the rest come from the layout.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    description: t("Every door your Kaplan diploma or degree opens — master’s, work, a year to breathe — each checked against the official rules."),
  };
}

// The page opens on the hero's night, so the browser's bar matches it in either theme.
export const viewport: Viewport = {
  themeColor: "#0f0c22",
  viewportFit: "cover",
};

async function programmeCount() {
  try {
    return await getProgrammeCount();
  } catch (e) {
    console.error("homepage: programme count unavailable", e);
    return null;
  }
}

export default async function Home() {
  const programmes = await programmeCount();
  return (
    <>
      <Landing programmes={programmes} />
      {/* Header: Start planning here, no AI adviser button (globals.css). */}
      <span data-start-planning hidden />
    </>
  );
}
