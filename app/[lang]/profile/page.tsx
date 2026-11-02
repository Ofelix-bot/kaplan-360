import type { Viewport } from "next";
import { AdviserContext } from "@/components/agent/AdviserDock";
import { ProfileApp } from "@/components/profile/ProfileApp";
import { pageMetadata } from "@/lib/i18n/server";
import { getProfileData } from "./data";
import "../../ui.css";

export const generateMetadata = pageMetadata("Your profile", "Your degree, English, internships, work and certificates, in one place: every service reads them. Saved in this browser only.");

// The page opens on the light ground under the light header, so the browser's bar matches it in either theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0c22" },
  ],
  viewportFit: "cover",
};

// /profile (plan D): the student's own answers in four groups, saved as they change in this browser
// (lib/plan-storage.ts, the answers every service reads). Everything from the server is read through cached
// readers, so the page is prerendered whole; the answers are read on the client.
export default async function ProfilePage() {
  const data = await getProfileData();
  // The autofill card only where the reader can run (app/api/profile needs the key).
  return (
    <>
      <AdviserContext page="profile" />
      <ProfileApp data={data} autofill={!!process.env.ANTHROPIC_API_KEY} />
    </>
  );
}
