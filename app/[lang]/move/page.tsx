import type { Viewport } from "next";
import { MovePage } from "@/components/landing/move/MovePage";
import { MovePageZh } from "@/components/landing/move/MovePageZh";
import { pageMetadata } from "@/lib/i18n/server";
import "../../ui.css";
import "./move.css";

// "Insights · Kaplan 360++": private-school students in Singapore are here by default, not by design,
// and the three moves Kaplan 360++ answers with (components/landing/move). /insights redirects here,
// to #roads (next.config.ts).
export const generateMetadata = pageMetadata("Insights", "Here by default, not by design: Kaplan 360++ breaks your next step into work, study or a gap, brings it together from the job you want, and lays it out month by month.");

// The page opens on the hero's deep indigo, so the browser's bar matches it.
export const viewport: Viewport = {
  themeColor: "#0f0c22",
  viewportFit: "cover",
};

// English has the 2026-11-02 layout; the Chinese pages keep the earlier one until their words are written.
export default async function Move({ params }: PageProps<"/[lang]/move">) {
  const { lang } = await params;
  return (
    <>
      {lang === "en" ? <MovePage /> : <MovePageZh />}
      {/* Header: Start planning here, no AI adviser button (globals.css). */}
      <span data-start-planning hidden />
    </>
  );
}
