"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { OutLink } from "./parts";
import { CampusLoader } from "@/components/shared/campus-loader/CampusLoader";

// /plan's Timeline tab: one column of about 720px (the homepage's ground, under the fixed header, is
// the page's frame around the tabs, ../PlanTabs.tsx), and the states before there is a road (loading,
// an error, no starred programme). Motion follows the visitor's reduced-motion setting.

export function PlanFrame({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-9">{children}</div>
    </MotionConfig>
  );
}

/** The campus scene and the line, where the road will be (components/shared/campus-loader). */
export function PlanLoading() {
  const t = useT();
  return <CampusLoader label={t("Loading your plan…")} />;
}

export function PlanError() {
  const t = useT();
  return (
    <p role="alert" className="text-[15px] text-(--land-body)">
      {t("The programme list couldn’t load. Refresh the page to try again.")}
    </p>
  );
}

/** No starred programme yet: the plan starts from the shortlist. */
export function PlanEmpty() {
  const t = useT();
  return (
    <p className="text-[17px] leading-relaxed text-pretty text-(--land-body)">
      {t.rich("Star a programme on <a>Programmes for you</a> to see your plan.", { a: (c) => <OutLink href="/results">{c}</OutLink> })}
    </p>
  );
}
