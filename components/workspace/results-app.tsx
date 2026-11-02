"use client";

import { useEffect, useRef } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { motion, MotionConfig } from "motion/react";
import { useT } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyExampleFromUrl } from "@/lib/example-link";
import { ENTRANCE, entrance, transitions } from "@/lib/motion";
import { useResultsData } from "@/lib/workspace/data";
import { startPlanStore, usePlanStore } from "@/lib/workspace/plan-store";
import { startWorkspaceStore, useWorkspace } from "@/lib/workspace/store";
import { Board } from "./board";
import { ModelProvider, useModelMaybe, type WorkspaceProps } from "./model";
import { ResultsHero } from "./results-hero";
import { Spinner } from "./spinner";
import { Toolbar } from "./toolbar";
import { Workspace } from "./workspace";

// /results on shadcn/ui: every programme matched against the student's answers in the browser (the
// data is one static file; the answers never leave it), as a workspace of resizable panels and an
// application board. Motion drops movement for people who ask for less ("user").
// Its own skin (app/ui.css, data-rs-skin): a compact hero, then the workspace in a framed window
// with a soft glow behind it, on a black or white canvas that follows the system's colour mode.

function Loading() {
  const t = useT();
  return (
    <div className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground" role="status">
      <span className="flex items-center gap-2">
        <Spinner />
        {t("Loading programmes")}
      </span>
    </div>
  );
}

function LoadError() {
  const t = useT();
  const retry = () => {
    useResultsData.setState({ status: "idle" });
    useResultsData.getState().load();
  };
  return (
    <Empty className="m-4 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{t("The programme list didn’t load. Check your connection and reload the page.")}</EmptyTitle>
        <EmptyDescription>{t("Your answers are kept in this browser.")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={retry}>
          {t("Try again")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function Views() {
  const status = useResultsData((s) => s.status);
  const ready = usePlanStore((s) => s.ready);
  const hydrated = useWorkspace((s) => s.hydrated);
  const model = useModelMaybe();
  if (status === "error") return <LoadError />;
  if (!ready || !hydrated || !model) return <Loading />;
  return (
    <>
      <TabsContent value="programmes" className="flex min-h-0 flex-col">
        <Workspace />
      </TabsContent>
      <TabsContent value="applications" className="flex min-h-0 flex-col">
        <Board />
      </TabsContent>
    </>
  );
}

export function ResultsApp(props: WorkspaceProps) {
  const view = useWorkspace((s) => s.view);
  const setView = useWorkspace((s) => s.setView);
  const frameRef = useRef<HTMLDivElement>(null);

  // The skin's tokens for shadcn's popups too (portaled to <body>), only while this page is open.
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-rs-skin", "");
    return () => html.removeAttribute("data-rs-skin");
  }, []);

  useEffect(() => {
    // ?example=<id> first (a link "with our worked example"), then the answers: kept state is read knowing
    // whether an example student is open.
    applyExampleFromUrl();
    startPlanStore();
    startWorkspaceStore();
    // From the homepage's two ways in. "I don't know what I want yet": every field, nothing left out.
    // "I have an idea": the sentence box, ready to type the idea into. Neither the scope nor the tab is
    // kept between visits, so the rehydrated state can't undo this.
    const start = new URLSearchParams(window.location.search).get("start");
    const ws = useWorkspace.getState();
    if (start === "unsure") {
      ws.setScope({ fieldChoice: "" });
      ws.setTab("quick");
      ws.setAskFocus(false);
    }
    // The sentence box exists only where the server can read a sentence.
    if (start === "idea" && props.sentence) {
      ws.setTab("ask");
      ws.setAskFocus(true);
    }
    // From Where you stand: one programme, opened (every field, so it is in the list).
    const programme = new URLSearchParams(window.location.search).get("programme");
    if (programme) {
      ws.setScope({ fieldChoice: "" });
      ws.setView("programmes");
      ws.select(programme);
      ws.setOpenDetail(true);
    }
    // From a careers role page's master's: those programmes join the shortlist (after the student's own,
    // none twice) and the Compare sheet opens on them.
    const compare = new URLSearchParams(window.location.search).get("compare");
    const compareIds = [...new Set((compare ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 3);
    if (compareIds.length) {
      const plan = usePlanStore.getState();
      const shortlist = plan.answers.shortlist;
      const added = compareIds.filter((id) => !shortlist.includes(id));
      if (added.length) plan.update({ shortlist: [...shortlist, ...added] });
      ws.setView("programmes");
      ws.setCompare(compareIds);
    }
    // Applied once: coming back to the page (Back, or a revisit kept in memory) keeps the visitor's own choices.
    if (start || programme || compare !== null) {
      const url = new URL(window.location.href);
      url.searchParams.delete("start");
      url.searchParams.delete("programme");
      url.searchParams.delete("compare");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      // Straight to the workspace, past the hero, only when there is something there to show:
      // an opened programme or the sentence box. "I don't know" visitors start at the hero.
      if (programme || (start === "idea" && props.sentence)) frameRef.current?.scrollIntoView({ block: "start" });
    }
    useResultsData.getState().load();
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MotionConfig reducedMotion="user" transition={transitions.enter}>
      <TooltipProvider>
        <ModelProvider props={props}>
          <div className="ui flex min-h-dvh flex-col bg-background pt-(--ui-header) pb-10 lg:pb-16" data-rs-skin="">
            <ResultsHero frameRef={frameRef} sentence={props.sentence} />
            <motion.div {...entrance} transition={{ ...ENTRANCE, delay: 0.24 }} className="relative isolate px-0 sm:px-3 lg:px-2 xl:px-6 2xl:mx-auto 2xl:w-full 2xl:max-w-[1680px]">
              <div aria-hidden className="rs-glow pointer-events-none absolute -top-[23%] left-1/2 -z-10 h-[60%] w-[90%] -translate-x-1/2 rounded-full max-sm:-top-10 max-sm:h-48" />
              <Tabs
                ref={frameRef}
                data-rs-frame=""
                value={view}
                onValueChange={(v) => setView(v === "applications" ? "applications" : "programmes")}
                className="gap-0 overflow-clip border-y border-(--rs-line-soft) bg-card shadow-(--rs-shadow) sm:rounded-2xl sm:border-x lg:h-[calc(100dvh-var(--ui-header)-1.5rem)] lg:min-h-[600px]"
              >
                <Toolbar />
                <div className="flex min-h-0 flex-1 flex-col">
                  <Views />
                </div>
              </Tabs>
            </motion.div>
          </div>
        </ModelProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
