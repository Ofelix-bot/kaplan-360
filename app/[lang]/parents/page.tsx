import { Inter } from "next/font/google";
import { pageMetadata } from "@/lib/i18n/server";
import { FinderFrame, FinderShell } from "@/components/finder/finder-frame";
import type { ParentsFacts } from "@/components/parents/family-plan";
import { ParentsApp } from "@/components/parents/parents-app";
import { getBenefits, getInstitutionNames } from "@/lib/data/benefits";
import { getKaplanAwarders } from "@/lib/data/partners";
import { DISCIPLINES, KAPLAN_OPTIONS, OTHER_SCHOOLS } from "@/lib/data/plan-options";
import { PLAN_DATE_INSTITUTIONS, planSources } from "@/lib/plan-data";
import cscse from "@/data/raw/cscse-sg-2026-09.json";
import employment from "@/data/raw/employment.json";
import "../../ui.css";

// For parents (components/parents): the finder's skin and model (Inter, components/finder/finder-frame.tsx), the
// plan's sources for the months ahead (as app/[lang]/plan reads them), and the official facts the plan shows: SWDA's
// graduate employment survey (data/raw/employment.json) and CSCSE's recognition list (data/raw/cscse-sg-2026-09.json).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const generateMetadata = pageMetadata(
  "For parents",
  "Tell us about your child in your own words: three master’s programmes that fit, what they cost, what graduates earn, recognition in China and the months ahead.",
);

const value = (id: string) => {
  const v = employment.records.find((r) => r.id === id)?.value;
  if (typeof v !== "number") throw new Error(`data/raw/employment.json has no value for ${id}`);
  return v;
};

const FACTS: ParentsFacts = {
  cscse: { url: cscse.url, published: cscse.published, rows: cscse.rows.map((r) => ({ university: r.university, institution: r.institution, from: r.from })) },
  outcomes: {
    pei: { cohort: "2024/2025", ftp: value("sg-pei-2024-25-ftp"), salary: value("sg-pei-2024-25-salary") },
    au: { cohort: "2025", ftp: value("sg-au-2025-ftp"), salary: value("sg-au-2025-salary") },
    source: { name: employment.sources["swda-pei-2024-25"].name, url: employment.sources["swda-pei-2024-25"].url, published: employment.sources["swda-pei-2024-25"].published },
  },
};

export default async function ParentsPage() {
  const [{ benefits, institutions }, awarders] = await Promise.all([getBenefits(), getKaplanAwarders()]);
  const names = new Map([...(await getInstitutionNames(PLAN_DATE_INSTITUTIONS)), ...institutions.map((i) => [i.id, i.name] as const)]);
  const props = {
    programmes: KAPLAN_OPTIONS,
    disciplines: DISCIPLINES,
    schools: OTHER_SCHOOLS,
    awarders,
    // The page needs the server's AI reader (app/api/parents needs the key).
    sentence: !!process.env.ANTHROPIC_API_KEY,
  };
  return (
    <FinderFrame font={inter.variable}>
      <FinderShell props={props} needsData={false}>
        <ParentsApp props={props} sources={planSources(benefits, names)} facts={FACTS} />
      </FinderShell>
    </FinderFrame>
  );
}
