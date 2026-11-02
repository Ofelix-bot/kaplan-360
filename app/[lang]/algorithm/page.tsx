import { pageMetadata } from "@/lib/i18n/server";
import { AdviserContext } from "@/components/agent/AdviserDock";
import { AlgorithmPage } from "@/components/algorithm/algorithm-page";
import { algorithmFacts } from "@/lib/algorithm/facts";
import "../../ui.css";

export const generateMetadata = pageMetadata(
  "Core Algorithm",
  "How the match rate is worked out: one scale for every first degree, one curve per programme, what a Kaplan degree is worth, and the checks against official statistics and real Kaplan offers.",
);

// The Core Algorithm page (in place of Where you stand since 2026-11-02; next.config.ts sends /where-you-stand here).
// The numbers are read from the admission model at build time; the calculator runs lib/admit-model.ts in the
// browser on the /results data file, so the visitor's settings never leave it.
export default function CoreAlgorithmPage() {
  return (
    <>
      <AdviserContext page="algorithm" />
      <AlgorithmPage f={algorithmFacts()} />
    </>
  );
}
