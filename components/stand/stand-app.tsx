"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { MotionConfig } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import Link from "@/components/i18n/Link";
import { ExampleBannerUi } from "@/components/shared/WorkedExampleBanner";
import { Button } from "@/components/ui/button";
import { applyExampleFromUrl } from "@/lib/example-link";
import { transitions } from "@/lib/motion";
import { useResultsData } from "@/lib/workspace/data";
import { startPlanStore } from "@/lib/workspace/plan-store";
import { Inputs } from "./inputs";
import { StandProvider, type StandProps } from "./model";
import { NextSteps } from "./next-steps";
import { Overview } from "./overview";
import { Simulator } from "./simulator";
import { CampusLoader } from "@/components/shared/campus-loader/CampusLoader";

// /where-you-stand: the student's answers on one screen, then where they stand across every programme
// (bands, then field × country), what if they changed one thing, the three changes that move the most
// programmes. On a wide screen the answers stay beside the rest.
// Motion follows the visitor's reduced-motion setting and moves only in answer to a tap.

/**
 * Back to /next-steps, shown only when its "Edit answers" opened this page (?from=next-steps). The query
 * is read in the browser under its own Suspense boundary, so the page stays prerendered without it.
 */
function BackToNextSteps({ variant }: { variant: "ghost" | "outline" }) {
  const t = useT();
  if (useSearchParams().get("from") !== "next-steps") return null;
  return (
    <Button data-back variant={variant} size="sm" className="self-start" render={<Link href="/next-steps" />} nativeButton={false}>
      <ArrowLeftIcon aria-hidden data-icon="inline-start" />
      {t("Back to next steps")}
    </Button>
  );
}

function Waiting() {
  const t = useT();
  const status = useResultsData((s) => s.status);
  if (status === "error")
    return (
      <p role="alert" className="text-sm text-(--land-body)">
        {t("The programme list couldn’t load. Refresh the page to try again.")}
      </p>
    );
  return <CampusLoader label={t("Loading programmes")} />;
}

export function StandApp(props: StandProps) {
  const t = useT();
  useEffect(() => {
    // ?example=<id> before the answers are read, so the example's answers are the first ones shown.
    applyExampleFromUrl();
    startPlanStore();
    useResultsData.getState().load();
  }, []);

  return (
    <MotionConfig reducedMotion="user" transition={transitions.enter}>
      <div className="ui min-h-svh bg-(--land-ground) text-foreground">
        <div className="home-wrap pt-[80px] pb-20 sm:pt-[112px] sm:pb-28">
          <StandProvider props={props}>
            {(ready) => (
              <div className="flex flex-col gap-4">
                <ExampleBannerUi />
                <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                  <section aria-labelledby="stand-title" className="group/stand flex flex-col gap-3 lg:sticky lg:top-[92px] lg:self-start">
                    <Suspense fallback={null}>
                      <BackToNextSteps variant="ghost" />
                    </Suspense>
                    <div className="flex flex-col gap-1">
                      {/* Opened at #stand-title: with the back button above it, the heading lands below the button. */}
                      <h1 id="stand-title" className="group-has-[[data-back]]/stand:scroll-mt-10 font-heading text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-4xl">
                        {t("Where you stand")}
                      </h1>
                      <p className="text-[13px] leading-snug text-pretty text-(--land-body) sm:text-sm">{t("Your answers are kept in this browser.")}</p>
                    </div>
                    {ready ? <Inputs /> : <div aria-hidden className="h-[420px] rounded-2xl bg-(--land-line)/40" />}
                    <Suspense fallback={null}>
                      <BackToNextSteps variant="outline" />
                    </Suspense>
                  </section>
                  <div className="flex min-w-0 flex-col gap-14">
                    {ready ? (
                      <>
                        <Overview />
                        <Simulator />
                        <NextSteps />
                      </>
                    ) : (
                      <Waiting />
                    )}
                  </div>
                </div>
              </div>
            )}
          </StandProvider>
        </div>
      </div>
    </MotionConfig>
  );
}
