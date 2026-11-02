import { Declaration } from "@/components/landing/Declaration";
import { pageMetadata } from "@/lib/i18n/server";
import "../../ui.css";

export const generateMetadata = pageMetadata(
  "Declaration",
  "Programme information comes from official university pages, and graduate statistics from official national surveys. Each figure links to its source. Always check the official page before you apply.",
);

export default function DeclarationPage() {
  return <Declaration />;
}
