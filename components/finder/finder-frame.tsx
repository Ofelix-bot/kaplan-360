"use client";

import { useEffect, type ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { MotionConfig } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModelProvider, useModelMaybe, type WorkspaceProps } from "@/components/workspace/model";
import { applyExampleFromUrl } from "@/lib/example-link";
import { transitions } from "@/lib/motion";
import { useResultsData } from "@/lib/workspace/data";
import { startPlanStore, usePlanStore } from "@/lib/workspace/plan-store";
import { startWorkspaceStore, useWorkspace } from "@/lib/workspace/store";
import { CampusLoader } from "@/components/shared/campus-loader/CampusLoader";

// The Programme finder's frame: Inter and the data-finder skin (app/ui.css), on the page's root and on <html>
// while a finder page is open, so popups portaled to <body> get them too. FinderShell loads the student's
// answers and the programmes and gives the page the same model /results matches with (components/workspace/model).

export function FinderFrame({ font, children }: { font: string; children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-finder", "");
    html.classList.add(font);
    return () => {
      html.removeAttribute("data-finder");
      html.classList.remove(font);
    };
  }, [font]);
  return (
    <div className="ui min-h-dvh bg-background pt-(--ui-header) text-foreground" data-finder="">
      {children}
    </div>
  );
}

function Loading() {
  const t = useT();
  return <CampusLoader label={t("Loading programmes")} className="min-h-[50dvh]" />;
}

function LoadError() {
  const t = useT();
  const retry = () => {
    useResultsData.setState({ status: "idle" });
    useResultsData.getState().load();
  };
  return (
    <Empty className="m-4 border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{t("The programme list didn’t load. Check your connection and reload the page.")}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={retry}>
          {t("Try again")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function Ready({ children, needsData }: { children: ReactNode; needsData: boolean }) {
  const status = useResultsData((s) => s.status);
  const ready = usePlanStore((s) => s.ready);
  const hydrated = useWorkspace((s) => s.hydrated);
  const model = useModelMaybe();
  if (status === "error" && needsData) return <LoadError />;
  if (!ready || !hydrated || (needsData && !model)) return <Loading />;
  return children;
}

/** `needsData`: the page shows programmes (the questions don't wait for them, but start loading them). */
export function FinderShell({ props, needsData = true, children }: { props: WorkspaceProps; needsData?: boolean; children: ReactNode }) {
  useEffect(() => {
    applyExampleFromUrl();
    startPlanStore();
    startWorkspaceStore();
    useResultsData.getState().load();
  }, []);
  return (
    <MotionConfig reducedMotion="user" transition={transitions.enter}>
      <TooltipProvider>
        <ModelProvider props={props}>
          <Ready needsData={needsData}>{children}</Ready>
        </ModelProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
