import { KappyShowcase } from "@/components/kappy/KappyShowcase";
import { pageMetadata } from "@/lib/i18n/server";

// Kappy, the AI adviser's mascot: every state on a stage (components/kappy). The corner Kappy on every page links here
// until the adviser page exists.
export const generateMetadata = pageMetadata("Kappy", "Kappy, the AI adviser's pixel mascot: every state it plays while the adviser works.");

export default function KappyPage() {
  return <KappyShowcase />;
}
