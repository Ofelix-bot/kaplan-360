"use client";

import { cn } from "cn";
import { LayoutPanelLeftIcon, SquareKanbanIcon } from "lucide-react";
import { useT } from "@/components/i18n/I18nProvider";
import { ExampleBannerUi } from "@/components/shared/WorkedExampleBanner";
import { Badge } from "@/components/ui/badge";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlanStore } from "@/lib/workspace/plan-store";

// Above the workspace (the page's heading is the hero's): the two views (Programmes, Applications) and
// where this step sits in Start planning. While an example student is open, the shared
// worked-example banner (components/shared/WorkedExampleBanner.tsx) in the /results skin.

/** A step number in the breadcrumb: filled purple for the step the student is on. */
function Step({ n, current }: { n: number; current?: boolean }) {
  return (
    <span aria-hidden className={cn("inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums", current ? "bg-primary text-primary-foreground" : "border border-(--ui-input)")}>
      {n}
    </span>
  );
}

/** The line tabs' active underline in Kaplan purple. */
const VIEW_TAB = "text-muted-foreground after:bg-primary data-active:text-foreground";

/** Sits inside the workspace's Tabs root: the two tabs switch between the programmes and the board. */
export function Toolbar() {
  const t = useT();
  const shortlisted = usePlanStore((s) => s.answers.shortlist.length);
  return (
    <div className="shrink-0 border-b border-(--rs-line-soft) bg-(--rs-glass) backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 lg:px-4">
        <nav aria-label={t("Start planning steps")} className="min-w-0 text-xs text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li aria-current="step" className="flex items-center gap-1.5 font-medium text-foreground">
              <Step n={1} current />
              <span className="sr-only">1 · </span>
              {t("Programmes")}
            </li>
            <li aria-hidden className="h-px w-4 bg-(--ui-input)" />
            <li className="flex items-center gap-1.5">
              <Step n={2} />
              <span className="sr-only">2 · </span>
              {t("Your plan")}
            </li>
          </ol>
        </nav>
        <TabsList variant="line" aria-label={t("View")}>
          <TabsTrigger value="programmes" className={VIEW_TAB}>
            <LayoutPanelLeftIcon className="max-sm:hidden" />
            {t("Programmes")}
          </TabsTrigger>
          <TabsTrigger value="applications" className={VIEW_TAB}>
            <SquareKanbanIcon className="max-sm:hidden" />
            {t("Applications")}
            {shortlisted > 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 tabular-nums">
                {shortlisted}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </div>
      <ExampleBannerUi skin="results" className="mx-3 mb-2 lg:mx-4" />
    </div>
  );
}
