import { AdviserPage } from "@/components/agent/AdviserPage";
import { pageMetadata } from "@/lib/i18n/server";
import "../../ui.css";

// The AI adviser on its own page (components/agent): what narrow screens open instead of the dock, and the dock's
// "Full page" link. The run itself happens in the browser against /api/agent/*.

export const generateMetadata = pageMetadata(
  "AI adviser",
  "Tell the AI adviser about yourself: it looks up programmes, roles and the work-pass rules, compares a master’s first with work first, and saves a plan for you.",
);

export default function Page() {
  return <AdviserPage />;
}
