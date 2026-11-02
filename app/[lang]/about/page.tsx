import { AboutUs } from "@/components/landing/AboutUs";
import { pageMetadata } from "@/lib/i18n/server";
import "../../ui.css";

export const generateMetadata = pageMetadata("About us", "ReFly.X, the team building Kaplan 360++ for Kaplan (Singapore) AI For Impact 2026.");

export default function AboutUsPage() {
  return <AboutUs />;
}
