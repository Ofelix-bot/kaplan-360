import { Suspense } from "react";
import { AdviserPageV2 } from "@/components/adviser/adviser-page";
import { pageMetadata } from "@/lib/i18n/server";
import "../../ui.css";

// AI adviser v2 (components/adviser, docs/agent/debate-blueprint.md): two advisers argue master's first and work first,
// a judge decides, a second AI audits every figure. The run happens in the browser against /api/adviser/*.
// ?from=<page> says where the visitor came from; ?mock=1 and ?replay=arjun replay a run without the model.

export const generateMetadata = pageMetadata(
  "AI adviser",
  "Two advisers argue master's first and work first for you; a judge decides; a second AI checks every figure against the official page.",
);

export default function Page() {
  return (
    <Suspense>
      <AdviserPageV2 />
    </Suspense>
  );
}
