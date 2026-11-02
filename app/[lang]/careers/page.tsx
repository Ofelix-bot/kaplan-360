import type { Viewport } from "next";
import { CareersEntry } from "@/components/careers/CareersEntry";
import { DRAFT } from "@/content/draft";
import { getIndustries, getRoleKeys, getStudentContext } from "@/lib/data/careers-db";
import { pageMetadata } from "@/lib/i18n/server";
import "../../ui.css";
import "./careers.css";

// /careers, the entry (plan §3.1; build-spec §8): pick a Kaplan degree, see the industries it leads to and
// the hot roles there (components/careers/CareersEntry). Everything is read through the cached readers of
// lib/data/careers-db.ts, so the page is prerendered whole; the visitor's own answers and the worked example
// are read on the client (lib/careers/use-student, ExampleGate), never from the URL here. Every role comes
// as its key skills only (getRoleKeys): enough for the hot counts and each industry's best match.

const C = DRAFT.careers;

export const generateMetadata = pageMetadata(C.meta.title, C.meta.description);

// The page opens on the light ground under the light header, so the browser's bar matches it in either theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0c22" },
  ],
  viewportFit: "cover",
};

export default async function Careers() {
  const [industries, roleKeys, ctx] = await Promise.all([getIndustries(), getRoleKeys(), getStudentContext()]);
  return (
    <div className="ui careers-page">
      <CareersEntry ctx={ctx} industries={industries} roleKeys={roleKeys} />
    </div>
  );
}
