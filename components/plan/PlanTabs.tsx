"use client";

import { Suspense, useLayoutEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useT } from "@/components/i18n/I18nProvider";
import { FlowSteps } from "@/components/shared/FlowSteps";
import type { NextStepsProps } from "@/components/next-steps/next-steps-app";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampusLoader } from "@/components/shared/campus-loader/CampusLoader";

// /plan's frame and its two tabs, Map | Timeline. Timeline (the default) is PlanView, the month-by-month
// road; Map is the map of roads from the degree (components/next-steps, once /next-steps). ?view=map
// opens Map; a tab chosen writes ?view= with replaceState (Timeline takes it off), so tabs make no
// history entries. Base UI's Tabs give the arrow keys and mount only the active panel; the map's code
// loads the first time its tab opens, so the Timeline's load is the same as before, and React Flow
// mounts into a box that is on screen and measures it as it is.

type View = "map" | "timeline" | "applications";
const PARAM = "view";
const viewOf = (v: string | null): View => (v === "map" || v === "applications" ? v : "timeline");

/** Only in the browser: the map reads the device's answers and data and has nothing to prerender. */
const MapTab = dynamic(() => import("@/components/next-steps/next-steps-app").then((m) => m.NextStepsBody), { ssr: false, loading: MapLoading });

function MapLoading() {
  const t = useT();
  return <CampusLoader label={t("Loading the map…")} className="min-h-[640px]" />;
}

/**
 * Follows ?view= (on arrival, on a link to /plan?view=map while the page is open, and when the page is
 * shown again with its state kept), under its own Suspense boundary so the page stays prerendered. A
 * layout effect, so the tab is right before the first paint after hydration.
 */
function ViewParam({ onView }: { onView: (v: View) => void }) {
  const view = viewOf(useSearchParams().get(PARAM));
  useLayoutEffect(() => onView(view), [view, onView]);
  return null;
}

/** `applications`: the shortlist's application board (components/finder/plan-applications.tsx), a third tab. */
export function PlanTabs({ timeline, map, applications }: { timeline: ReactNode; map: NextStepsProps; applications?: ReactNode }) {
  const t = useT();
  const [view, setView] = useState<View>("timeline");
  const choose = (v: View) => {
    setView(v);
    const url = new URL(window.location.href);
    if (v !== "timeline") url.searchParams.set(PARAM, v);
    else url.searchParams.delete(PARAM);
    try {
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {}
  };
  return (
    <div className="ui min-h-svh bg-(--land-ground) pt-(--header-h) text-foreground">
      <FlowSteps current="plan" />
      <div className="home-wrap pt-8 pb-20 sm:pt-11 sm:pb-28">
        <Suspense fallback={null}>
          <ViewParam onView={setView} />
        </Suspense>
        <Tabs value={view} onValueChange={(v) => choose(viewOf(String(v)))} className="gap-9">
          <TabsList className="mx-auto" aria-label={t("Views of your plan")}>
            <TabsTrigger value="map" className="px-4">
              {t("Map")}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="px-4">
              {t("Timeline")}
            </TabsTrigger>
            {applications && (
              <TabsTrigger value="applications" className="px-4">
                {t("Applications")}
              </TabsTrigger>
            )}
          </TabsList>
          {/* The panels keep the page's own type sizes (TabsContent sets text-sm). */}
          <TabsContent value="map" className="text-[length:inherit]">
            <MapTab {...map} />
          </TabsContent>
          <TabsContent value="timeline" className="text-[length:inherit]">
            {timeline}
          </TabsContent>
          {applications && (
            <TabsContent value="applications" className="text-[length:inherit]">
              {applications}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
